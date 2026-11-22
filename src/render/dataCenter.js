/*
 * PURPOSE:    Data center campus: two clad halls with full-height glass facades (racks visible
 *             inside), rooftop maker sign that follows the rack profile, instanced rooftop chillers
 *             whose fans spin with facility load, and the MV room where the cable lands.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, src/config.js (WORLD, DATACENTER, BRANDS), src/render/texEquipment.js,
 *             src/render/dataCenterRacks.js, src/render/signage.js
 * UNITS:      metres; utilization 0-1 and MW from state; time in seconds.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WORLD, DATACENTER, BRANDS } from '../config.js';
import { claddingTexture } from './texEquipment.js';
import { createRacks } from './dataCenterRacks.js';
import { createFacadeSign } from './signage.js';
import { aabb } from './colliders.js';

const HALL_SIZE_M = [68, 11, 20];   // x, y, z
const HALL_OFFSETS_Z = [-14, 14];   // relative to campus centre; glass faces outward (north / south)
const CHILLERS_PER_ROW = 8;
const FAN_MAX_RAD_S = 14;           // fan speed at full facility load (visual)
const MULLION_PITCH_M = 3.4;
const FLOOR_Y_M = 0.18;            // hall floor sits just above the gravel pad

// Takes the scene; returns { update(state, dtSec, timeSec) }
export function createDataCenter(scene) {
  const [cx, cz] = WORLD.dataCenter.center;
  const cladding = claddingTexture();
  cladding.repeat.set(8, 1.5);
  const wall = new THREE.MeshStandardMaterial({ map: cladding, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide });
  const roof = new THREE.MeshStandardMaterial({ color: '#8d9194', roughness: 0.8, side: THREE.DoubleSide });
  const floor = new THREE.MeshStandardMaterial({ color: '#4a4d50', roughness: 0.7, side: THREE.DoubleSide });
  const glass = new THREE.MeshStandardMaterial({ color: '#9fc3d4', roughness: 0.04, metalness: 0.1,
    transparent: true, opacity: 0.22, depthWrite: false });
  const unitMat = new THREE.MeshStandardMaterial({ color: '#b9bdb9', roughness: 0.6 });
  const fanMat = new THREE.MeshStandardMaterial({ color: '#3b3f42', roughness: 0.5 });

  const halls = [];
  const signs = [];
  for (const dz of HALL_OFFSETS_Z) {
    const glassSign = Math.sign(dz);              // +1: glass on the south face, -1: north face
    const faces = [wall, wall, roof, floor, glassSign > 0 ? glass : wall, glassSign < 0 ? glass : wall];
    const hall = new THREE.Mesh(new RoundedBoxGeometry(...HALL_SIZE_M, 2, 0.35), faces);
    hall.position.set(cx, FLOOR_Y_M + HALL_SIZE_M[1] / 2, cz + dz);
    hall.castShadow = true;
    hall.receiveShadow = true;
    scene.add(hall);
    addMullions(scene, cx, cz + dz + glassSign * (HALL_SIZE_M[2] / 2 + 0.05));
    signs.push(addRoofSign(scene, cx, cz + dz + glassSign * (HALL_SIZE_M[2] / 2 - 0.5), glassSign));
    halls.push({ center: [cx, cz + dz], glassSign, lengthM: HALL_SIZE_M[0] });
  }
  const racks = createRacks(scene, halls);

  // MV room where the feeder cable lands
  const [mx, mz] = WORLD.cables.load[0];
  const mvRoom = new THREE.Mesh(new RoundedBoxGeometry(6, 4, 8, 1, 0.15), wall);
  mvRoom.position.set(mx - 3, 2, mz);
  mvRoom.castShadow = true;
  scene.add(mvRoom);

  const colliders = halls.map((h) => aabb(h.center[0], h.center[1], HALL_SIZE_M[0] / 2, HALL_SIZE_M[2] / 2));
  colliders.push(aabb(mx - 3, mz, 3, 4));
  const fans = addChillers(scene, cx, cz, unitMat, fanMat);
  const fanMatrix = new THREE.Matrix4();
  const fanQuat = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const halfLoadMw = DATACENTER.rackCount * DATACENTER.profiles.gb300.rackTdpKw * DATACENTER.pue / 1000;
  let fanAngle = 0;
  let shownProfileKey = '';   // rack profile currently drawn on the rooftop signs

  return {
    colliders,
    update(state, dtSec, timeSec) {
      if (state.rackProfile !== shownProfileKey) {
        shownProfileKey = state.rackProfile;
        const profile = DATACENTER.profiles[shownProfileKey] ?? DATACENTER.profiles.gb300;
        for (let i = 0; i < signs.length; i++) signs[i].setProfile(profile, DATACENTER.rackCount);
      }

      const served = state.pLoadMw > 0 ? 1 - state.pUnservedMw / state.pLoadMw : 1;
      const flicker = served < 0.999 ? 0.5 + 0.5 * Math.sign(Math.sin(timeSec * 23)) : 1;
      racks.update(state, served, flicker);

      // Chiller fans spin with facility load (cooling follows heat)
      fanAngle += FAN_MAX_RAD_S * Math.min(state.pLoadMw / halfLoadMw, 1.5) * dtSec;
      fanQuat.setFromAxisAngle(up, fanAngle);
      for (let i = 0; i < fans.positions.length; i++) {
        fans.mesh.setMatrixAt(i, fanMatrix.compose(fans.positions[i], fanQuat, one));
      }
      fans.mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// Vertical mullions and two transoms across a glass facade at depth z
function addMullions(scene, cx, z) {
  const mat = new THREE.MeshStandardMaterial({ color: '#2d3033', metalness: 0.7, roughness: 0.35 });
  const count = Math.floor(HALL_SIZE_M[0] / MULLION_PITCH_M) + 1;
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, HALL_SIZE_M[1], 0.25), mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    bars.setMatrixAt(i, m.makeTranslation(cx - HALL_SIZE_M[0] / 2 + i * MULLION_PITCH_M, HALL_SIZE_M[1] / 2, z));
  }
  scene.add(bars);
  for (const y of [3.6, 7.3]) {
    const transom = new THREE.Mesh(new THREE.BoxGeometry(HALL_SIZE_M[0], 0.18, 0.25), mat);
    transom.position.set(cx, y, z);
    scene.add(transom);
  }
}

// Rooftop sign along the facade edge, facing outward; returns the facade-sign controller
function addRoofSign(scene, cx, z, facing) {
  const sign = createFacadeSign(30, 4.2, BRANDS.gpu.accent, BRANDS.gpu.maker);
  sign.mesh.position.set(cx - 12, HALL_SIZE_M[1] + 2.6, z);
  sign.mesh.rotation.y = facing > 0 ? 0 : Math.PI;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(30.6, 4.8, 0.3),
    new THREE.MeshStandardMaterial({ color: '#1b1d20', metalness: 0.5, roughness: 0.5 }));
  frame.position.set(cx - 12, HALL_SIZE_M[1] + 2.6, z - facing * 0.2);
  frame.castShadow = true;
  scene.add(sign.mesh, frame);
  return sign;
}

// Adds rooftop chiller units (instanced) and their fans; returns { mesh, positions } for the fans
function addChillers(scene, cx, cz, unitMat, fanMat) {
  const spots = [];
  for (const dz of HALL_OFFSETS_Z) {
    for (const row of [-4.5, 3]) {
      for (let k = 0; k < CHILLERS_PER_ROW; k++) spots.push([cx - 20 + k * 6.5, cz + dz + row * Math.sign(dz)]);
    }
  }
  const units = new THREE.InstancedMesh(new RoundedBoxGeometry(5, 2, 3, 1, 0.12), unitMat, spots.length);
  const fans = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 0.1, 0.3), fanMat, spots.length * 2);
  const positions = [];
  const m = new THREE.Matrix4();
  const roofY = HALL_SIZE_M[1];
  spots.forEach(([x, z], i) => {
    units.setMatrixAt(i, m.makeTranslation(x, roofY + 1, z));
    positions.push(new THREE.Vector3(x - 1.3, roofY + 2.1, z), new THREE.Vector3(x + 1.3, roofY + 2.1, z));
  });
  units.castShadow = true;
  scene.add(units, fans);
  return { mesh: fans, positions };
}
