/*
 * PURPOSE:    PV field: instanced tilted tables on posts in rows, plus inverter skids whose status
 *             lamps glow with PV output. One draw call per part regardless of table count.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, src/config.js (WORLD, SOLAR, COLORS), src/render/texEquipment.js
 * UNITS:      metres; MW from state.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WORLD, SOLAR, COLORS } from '../config.js';
import { pvTableTexture } from './texEquipment.js';
import { aabb } from './colliders.js';

const TABLE_SIZE_M = [6.5, 0.12, 3.2];  // width (x), thickness, depth (slope length)
const TILT_RAD = THREE.MathUtils.degToRad(25);
const TABLE_HEIGHT_M = 1.9;             // centre height of the panel
const SKID_COUNT = 3;

// Takes the scene; returns { update(state) }
export function createSolarSite(scene) {
  const { center, rows, tablesPerRow, rowPitchM, tablePitchM } = WORLD.solarArray;
  const count = rows * tablesPerRow;

  // Glass-topped modules (cell texture, glossy so they pick up the sky) in aluminium frames
  const glassMat = new THREE.MeshStandardMaterial({ map: pvTableTexture(), roughness: 0.18, metalness: 0.2 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#a8adb3', roughness: 0.45, metalness: 0.7 });
  const panelFaces = [frameMat, frameMat, glassMat, frameMat, frameMat, frameMat]; // +y face is the top
  const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(...TABLE_SIZE_M), panelFaces, count);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, TABLE_HEIGHT_M, 0.15), frameMat, count);
  panels.castShadow = true;
  panels.receiveShadow = true;
  posts.castShadow = true;

  // Lay tables out row by row, panels tilted to face south (+z, toward the sun)
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), TILT_RAD);
  const one = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  const x0 = center[0] - ((tablesPerRow - 1) * tablePitchM) / 2;
  const z0 = center[1] - ((rows - 1) * rowPitchM) / 2;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let t = 0; t < tablesPerRow; t++) {
      p.set(x0 + t * tablePitchM, TABLE_HEIGHT_M, z0 + r * rowPitchM);
      panels.setMatrixAt(i, m.compose(p, q, one));
      p.y = TABLE_HEIGHT_M / 2;
      posts.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
      i++;
    }
  }
  scene.add(panels, posts);

  const lamps = addInverterSkids(scene, center, rows, rowPitchM);
  // Each table row is a solid strip; the aisles between rows stay drivable
  const colliders = [];
  for (let r = 0; r < rows; r++) colliders.push(aabb(center[0], z0 + r * rowPitchM, (tablesPerRow * tablePitchM) / 2, 1.8));
  for (const lamp of lamps) colliders.push(aabb(lamp.position.x + 1.56, lamp.position.z, 1.7, 3.7));
  return {
    colliders,
    update(state) {
      // Lamp brightness follows PV output as a fraction of the inverter limit
      const frac = state.pPvDeliveredMw / SOLAR.inverterAcLimitMw;
      for (const lamp of lamps) lamp.material.emissiveIntensity = 0.2 + 2.5 * frac;
    },
  };
}

// Adds inverter/transformer skids along the east edge; returns their status-lamp meshes
function addInverterSkids(scene, center, rows, rowPitchM) {
  const skidMat = new THREE.MeshStandardMaterial({ color: '#d9dcd6', roughness: 0.7 });
  const lampMat = new THREE.MeshStandardMaterial({ color: COLORS.solar, emissive: COLORS.solar });
  const lamps = [];
  const xEdge = center[0] + 58;
  for (let k = 0; k < SKID_COUNT; k++) {
    const z = center[1] - rows * rowPitchM * 0.3 + k * rows * rowPitchM * 0.3;
    const skid = new THREE.Mesh(new RoundedBoxGeometry(3, 2.6, 7, 1, 0.12), skidMat);
    skid.position.set(xEdge, 1.3, z);
    skid.castShadow = true;
    skid.receiveShadow = true;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 2.2), lampMat.clone());
    lamp.position.set(xEdge - 1.56, 1.9, z);
    scene.add(skid, lamp);
    lamps.push(lamp);
  }
  return lamps;
}
