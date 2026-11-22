/*
 * PURPOSE:    The data center halls: clad walls, full-height glass facade with mullions and transoms
 *             (racks visible inside), and the rooftop maker sign that follows the rack profile.
 * USED BY:    src/render/dataCenter.js
 * DEPENDS ON: three, three/addons RoundedBoxGeometry, src/config.js (BRANDS),
 *             src/render/texEquipment.js (claddingTexture), src/render/signage.js (createFacadeSign)
 * UNITS:      metres.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BRANDS } from '../config.js';
import { claddingTexture } from './texEquipment.js';
import { createFacadeSign } from './signage.js';

export const HALL_SIZE_M = [68, 11, 20];   // x, y, z
export const HALL_OFFSETS_Z = [-14, 14];   // relative to campus centre; glass faces outward (north / south)
const MULLION_PITCH_M = 3.4;
const FLOOR_Y_M = 0.18;                    // hall floor sits just above the pad

// Returns the hall materials: clad walls, roof, floor (double-sided so the interior shows) and glass
export function hallMaterials() {
  const cladding = claddingTexture();
  cladding.repeat.set(8, 1.5);
  return {
    wall: new THREE.MeshStandardMaterial({ map: cladding, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide }),
    roof: new THREE.MeshStandardMaterial({ color: '#8d9194', roughness: 0.8, side: THREE.DoubleSide }),
    floor: new THREE.MeshStandardMaterial({ color: '#4a4d50', roughness: 0.7, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: '#9fc3d4', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false }),
  };
}

// Builds both halls with their glass facade, mullions and rooftop sign; returns { halls, signs }
export function buildHalls(scene, cx, cz, mats) {
  const halls = [];
  const signs = [];
  for (const dz of HALL_OFFSETS_Z) {
    const glassSign = Math.sign(dz);              // +1: glass on the south face, -1: north face
    const faces = [mats.wall, mats.wall, mats.roof, mats.floor, glassSign > 0 ? mats.glass : mats.wall, glassSign < 0 ? mats.glass : mats.wall];
    const hall = new THREE.Mesh(new RoundedBoxGeometry(...HALL_SIZE_M, 2, 0.35), faces);
    hall.position.set(cx, FLOOR_Y_M + HALL_SIZE_M[1] / 2, cz + dz);
    hall.castShadow = true;
    hall.receiveShadow = true;
    scene.add(hall);
    addMullions(scene, cx, cz + dz + glassSign * (HALL_SIZE_M[2] / 2 + 0.05));
    signs.push(addRoofSign(scene, cx, cz + dz + glassSign * (HALL_SIZE_M[2] / 2 - 0.5), glassSign));
    halls.push({ center: [cx, cz + dz], glassSign, lengthM: HALL_SIZE_M[0] });
  }
  return { halls, signs };
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
