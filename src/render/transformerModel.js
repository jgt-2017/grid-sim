/*
 * PURPOSE:    The 138/34.5 kV power transformer (T1), the centrepiece of the substation: ANSI-grey
 *             main tank with stiffening ribs, radiator banks with ONAF cooling fans (spin when loading
 *             exceeds the ONAN rating), conservator with Buchholz pipe, HV bushings with arresters, LV and
 *             neutral bushings, on-load tap changer and control cabinets, nameplate, and an
 *             oil-containment berm filled with crushed rock.
 * USED BY:    src/render/substation.js
 * DEPENDS ON: three, src/config.js (GRID), src/render/substationParts.js (MAT, box, insulator),
 *             src/render/labels.js (createTextPlate)
 * UNITS:      metres; transformer loading in per-unit of the 30 MVA rating.
 */
import * as THREE from 'three';
import { GRID } from '../config.js';
import { MAT, box, insulator } from './substationParts.js';
import { createTextPlate } from './labels.js';

const TANK = { x: 5.6, y: 3.8, z: 3.4, baseY: 0.5 };   // main tank size and height of its skid
const ONAF_START_PU = 0.6;                              // fans start above 60% loading
const grey = new THREE.MeshStandardMaterial({ color: '#8f989a', roughness: 0.45, metalness: 0.35 });
const fanMat = new THREE.MeshStandardMaterial({ color: '#2f3336', roughness: 0.5, metalness: 0.4 });

// One radiator bank: thin vertical fins between top and bottom headers, cooling fans underneath
function radiatorBank(group, side, zCentre, fans) {
  const x = side * (TANK.x / 2 + 0.95);
  for (let k = 0; k < 11; k++) group.add(box(1.3, 3.0, 0.06, grey, x, TANK.baseY + 1.9, zCentre - 1.1 + k * 0.22));
  for (const y of [TANK.baseY + 0.45, TANK.baseY + 3.35]) {
    const header = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 8).rotateZ(Math.PI / 2), grey);
    header.position.set(side * (TANK.x / 2 + 0.25), y, zCentre);
    group.add(header);
  }
  // Two fans hang below each bank, blowing up through the fins
  for (const dz of [-0.55, 0.55]) {
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 16), fanMat);
    guard.position.set(x, TANK.baseY + 0.15, zCentre + dz);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.12), fanMat);
    blade.position.set(x, TANK.baseY + 0.24, zCentre + dz);
    group.add(guard, blade);
    fans.push(blade);
  }
}

// Bushings across the tank top: tall HV (north, with arresters), shorter LV + neutral (south)
function bushings(group) {
  const top = TANK.baseY + TANK.y;
  for (const x of [-1.6, 0, 1.6]) {
    const hv = insulator(2.8);
    hv.position.set(x, top, -1.0);
    const turret = box(0.5, 0.4, 0.5, grey, x, top + 0.2, -1.0);
    const arrester = insulator(1.6);
    arrester.position.set(x + 0.55, top, -1.4);
    const lv = insulator(1.3);
    lv.position.set(x, top, 1.1);
    group.add(turret, hv, arrester, lv);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.25, 10), MAT.conductor);
    cap.position.set(x, top + 2.9, -1.0);
    group.add(cap);
  }
  const neutral = insulator(0.9);
  neutral.position.set(2.4, top, 1.1);
  group.add(neutral);
}

// Conservator (oil expansion tank) on brackets, with the Buchholz pipe down to the main tank
function conservator(group) {
  const top = TANK.baseY + TANK.y;
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 3.6, 16).rotateZ(Math.PI / 2), grey);
  tank.position.set(-0.3, top + 1.9, 0.2);
  tank.castShadow = true;
  group.add(tank, box(0.15, 1.4, 0.15, grey, -1.8, top + 0.9, 0.2), box(0.15, 1.4, 0.15, grey, 1.2, top + 0.9, 0.2));
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), grey);
  pipe.position.set(0.6, top + 0.8, 0.2);
  group.add(pipe, box(0.25, 0.2, 0.2, MAT.cabinet, 0.6, top + 0.9, 0.2));   // Buchholz relay
}

// Takes nothing; returns { group, update(loadingPu, dtSec) }. Origin = centre of the foundation.
export function createPowerTransformer() {
  const group = new THREE.Group();
  const fans = [];

  // Oil containment: concrete berm around a crushed-rock pit, transformer on a foundation slab
  const berm = new THREE.MeshStandardMaterial({ color: '#b9b6ae', roughness: 0.9 });
  for (const [x, z, sx, sz] of [[0, -5, 12, 0.3], [0, 5, 12, 0.3], [-6, 0, 0.3, 10], [6, 0, 0.3, 10]]) {
    group.add(box(sx, 0.45, sz, berm, x, 0.22, z));
  }
  group.add(box(11.6, 0.12, 9.6, new THREE.MeshStandardMaterial({ color: '#6f6c66', roughness: 1 }), 0, 0.06, 0));
  group.add(box(TANK.x + 0.6, TANK.baseY, TANK.z + 0.6, berm, 0, TANK.baseY / 2, 0));

  // Main tank with vertical stiffening ribs and a bolted cover
  group.add(box(TANK.x, TANK.y, TANK.z, grey, 0, TANK.baseY + TANK.y / 2, 0));
  for (let k = -2; k <= 2; k++) {
    for (const zFace of [-1, 1]) group.add(box(0.12, TANK.y - 0.3, 0.12, grey, k * 1.1, TANK.baseY + TANK.y / 2, zFace * (TANK.z / 2 + 0.05)));
  }
  group.add(box(TANK.x + 0.2, 0.15, TANK.z + 0.2, grey, 0, TANK.baseY + TANK.y + 0.05, 0));
  for (const side of [-1, 1]) for (const zc of [-0.75, 0.75]) radiatorBank(group, side, zc * 1.3, fans);
  bushings(group);
  conservator(group);

  // Tap changer and control cabinets on the south face, nameplate between them
  group.add(box(1.3, 2.1, 0.8, grey, 1.9, TANK.baseY + 1.6, TANK.z / 2 + 0.45));
  group.add(box(1.0, 1.4, 0.5, MAT.cabinet, -2.0, TANK.baseY + 1.2, TANK.z / 2 + 0.3));
  const plate = createTextPlate(`T1  ${GRID.hvKv}/${GRID.mvKv} kV  ${GRID.xfmrRatingMva} MVA  Z ${GRID.xfmrImpedancePu * 100}%`, 2.4, 0.45);
  plate.position.set(0, TANK.baseY + 2.4, TANK.z / 2 + 0.07);
  group.add(plate);

  let fanAngle = 0;
  return {
    group,
    // Fans run (ONAF stage) once loading passes the ONAN threshold; speed grows with loading
    update(loadingPu, dtSec) {
      const running = loadingPu > ONAF_START_PU;
      fanAngle += running ? (8 + 14 * (loadingPu - ONAF_START_PU)) * dtSec : 0;
      for (let i = 0; i < fans.length; i++) fans[i].rotation.y = fanAngle + i;
    },
  };
}

export const TRANSFORMER_TANK = TANK;
