/*
 * PURPOSE:    GT Computing Data Center campus: the two halls (dataCenterHalls.js) with GPU racks
 *             visible inside, the MV room where the cable lands, and instanced rooftop chillers whose
 *             fans spin with facility load. Rooftop signs follow the selected rack profile.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, three/addons RoundedBoxGeometry, src/config.js (WORLD, DATACENTER),
 *             src/render/dataCenterHalls.js, src/render/dataCenterRacks.js, src/render/colliders.js
 * UNITS:      metres; utilization 0-1 and MW from state; time in seconds.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WORLD, DATACENTER } from '../config.js';
import { createRacks } from './dataCenterRacks.js';
import { HALL_SIZE_M, HALL_OFFSETS_Z, hallMaterials, buildHalls } from './dataCenterHalls.js';
import { aabb } from './colliders.js';

const CHILLERS_PER_ROW = 8;
const FAN_MAX_RAD_S = 14;           // fan speed at full facility load (visual)

// MV room where the feeder cable lands; returns its collider
function addMvRoom(scene, wall) {
  const [mx, mz] = WORLD.cables.load[0];
  const room = new THREE.Mesh(new RoundedBoxGeometry(6, 4, 8, 1, 0.15), wall);
  room.position.set(mx - 3, 2, mz);
  room.castShadow = true;
  scene.add(room);
  return aabb(mx - 3, mz, 3, 4);
}

// Takes the scene; returns { colliders, update(state, dtSec, timeSec) }
export function createDataCenter(scene) {
  const [cx, cz] = WORLD.dataCenter.center;
  const mats = hallMaterials();
  const { halls, signs } = buildHalls(scene, cx, cz, mats);
  const racks = createRacks(scene, halls);
  const colliders = halls.map((h) => aabb(h.center[0], h.center[1], HALL_SIZE_M[0] / 2, HALL_SIZE_M[2] / 2));
  colliders.push(addMvRoom(scene, mats.wall));
  const fans = addChillers(scene, cx, cz);
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
      // Rack LEDs follow utilization and flicker when load is unserved
      const served = state.pLoadMw > 0 ? 1 - state.pUnservedMw / state.pLoadMw : 1;
      racks.update(state, served, served < 0.999 ? 0.5 + 0.5 * Math.sign(Math.sin(timeSec * 23)) : 1);
      // Chiller fans spin with facility load (cooling follows heat)
      fanAngle += FAN_MAX_RAD_S * Math.min(state.pLoadMw / halfLoadMw, 1.5) * dtSec;
      fans.spin(fanAngle);
    },
  };
}

// Adds rooftop chiller units (instanced) and their fans; returns { spin(angleRad) } for the fans
function addChillers(scene, cx, cz) {
  const unitMat = new THREE.MeshStandardMaterial({ color: '#b9bdb9', roughness: 0.6 });
  const fanMat = new THREE.MeshStandardMaterial({ color: '#3b3f42', roughness: 0.5 });
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
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  return {
    // Sets every fan to the given angle (no allocation)
    spin(angleRad) {
      q.setFromAxisAngle(up, angleRad);
      for (let i = 0; i < positions.length; i++) fans.setMatrixAt(i, m.compose(positions[i], q, one));
      fans.instanceMatrix.needsUpdate = true;
    },
  };
}
