/*
 * PURPOSE:    Builders for substation equipment: insulator posts, disconnect switch, dead-tank
 *             breaker, CT/VT column, power transformer, metal-clad switchgear, steel gantry.
 * USED BY:    src/render/substation.js, src/render/gridLine.js
 * DEPENDS ON: three
 * UNITS:      metres; returned objects are THREE.Group positioned at the origin.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const MAT = {
  porcelain: new THREE.MeshStandardMaterial({ color: '#8a6e5a', roughness: 0.4 }),
  steel: new THREE.MeshStandardMaterial({ color: '#9da3a6', roughness: 0.5, metalness: 0.6 }),
  tank: new THREE.MeshStandardMaterial({ color: '#7d8a80', roughness: 0.55, metalness: 0.3 }),
  cabinet: new THREE.MeshStandardMaterial({ color: '#c9ccc4', roughness: 0.7 }),
  conductor: new THREE.MeshStandardMaterial({ color: '#c7b28a', roughness: 0.35, metalness: 0.8 }),
};

// Merged insulator geometries, cached by height so each insulator is a single draw call
const insulatorCache = new Map();

// Takes height (m); returns merged geometry: a thin core with stacked discs
function insulatorGeometry(heightM) {
  if (insulatorCache.has(heightM)) return insulatorCache.get(heightM);
  const parts = [new THREE.CylinderGeometry(0.14, 0.18, heightM, 8).translate(0, heightM / 2, 0)];
  for (let y = 0.4; y < heightM - 0.2; y += 0.35) {
    parts.push(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 10).translate(0, y, 0));
  }
  const merged = mergeGeometries(parts);
  insulatorCache.set(heightM, merged);
  return merged;
}

// Takes height (m); returns a ribbed insulator post wrapped in a group (so callers can position it)
export function insulator(heightM) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(insulatorGeometry(heightM), MAT.porcelain);
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

// Returns a softly rounded box mesh with shadows (edges catch the light like real castings)
export function box(sx, sy, sz, material, x = 0, y = 0, z = 0) {
  const radius = Math.min(sx, sy, sz) * 0.12;
  const m = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 1, radius), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Returns { group, blade }: two posts with a blade that pivots open about the north post
export function disconnectSwitch() {
  const group = new THREE.Group();
  const a = insulator(5);
  const b = insulator(5);
  a.position.z = -1.6;
  b.position.z = 1.6;
  const pivot = new THREE.Group();
  pivot.position.set(0, 5.2, -1.6);
  pivot.add(box(0.12, 0.12, 3.3, MAT.conductor, 0, 0, 1.65));
  group.add(box(0.6, 0.5, 4.6, MAT.steel, 0, 0.25, 0), a, b, pivot);
  return { group, blade: pivot };
}

// Returns a dead-tank breaker phase: frame, horizontal tank, two bushings
export function deadTankBreaker() {
  const g = new THREE.Group();
  g.add(box(0.2, 2, 0.2, MAT.steel, 0, 1, -1), box(0.2, 2, 0.2, MAT.steel, 0, 1, 1));
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 3.2, 12), MAT.tank);
  tank.rotation.x = Math.PI / 2;
  tank.position.y = 2.6;
  tank.castShadow = true;
  const b1 = insulator(2.6);
  const b2 = insulator(2.6);
  b1.position.set(0, 3, -1.1);
  b2.position.set(0, 3, 1.1);
  g.add(tank, b1, b2);
  return g;
}

// Returns a CT/VT column: tall insulator with a metal head
export function instrumentTransformer() {
  const g = new THREE.Group();
  g.add(box(0.7, 1.2, 0.7, MAT.tank, 0, 0.6, 0));
  const ins = insulator(4.2);
  ins.position.y = 1.2;
  g.add(ins, box(0.8, 0.8, 0.8, MAT.tank, 0, 5.7, 0));
  return g;
}

// Returns the 138/34.5 kV power transformer: tank, radiator fins, conservator, bushings
export function powerTransformer() {
  const g = new THREE.Group();
  g.add(box(6, 4.6, 5, MAT.tank, 0, 2.5, 0));
  // Radiator banks on east and west faces
  for (const side of [-1, 1]) {
    for (let k = 0; k < 8; k++) g.add(box(1.2, 3.6, 0.12, MAT.tank, side * 3.7, 2.4, -1.9 + k * 0.55));
  }
  const conservator = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 4.4, 12), MAT.tank);
  conservator.rotation.z = Math.PI / 2;
  conservator.position.set(0, 5.9, -1.6);
  g.add(conservator);
  // HV bushings (north, tall) and MV bushings (south, short), one per phase
  for (const x of [-1.8, 0, 1.8]) {
    const hv = insulator(2.6);
    hv.position.set(x, 4.8, -1.2);
    const mv = insulator(1.2);
    mv.position.set(x, 4.8, 1.6);
    g.add(hv, mv);
  }
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

// Returns a steel gantry: two lattice-ish columns and a cross beam at the given height
export function gantry(spanM, heightM) {
  const g = new THREE.Group();
  for (const x of [-spanM / 2, spanM / 2]) g.add(box(0.6, heightM, 0.6, MAT.steel, x, heightM / 2, 0));
  g.add(box(spanM + 0.8, 0.6, 0.6, MAT.steel, 0, heightM, 0));
  return g;
}
