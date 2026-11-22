/*
 * PURPOSE:    More substation equipment builders: line dead-end structure, surge arresters, lightning
 *             masts, the 34.5 kV metal-clad switchgear lineup (one labelled cubicle per feeder), a
 *             pad-mounted station-service transformer, and fence warning signs.
 * USED BY:    src/render/substation.js
 * DEPENDS ON: three, src/render/substationParts.js (MAT, box, insulator), src/render/labels.js
 * UNITS:      metres. Each builder returns a THREE.Group at the origin.
 */
import * as THREE from 'three';
import { MAT, box, insulator } from './substationParts.js';
import { createTextPlate } from './labels.js';

// Steel H-frame dead-end structure where the 138 kV line terminates (span and beam height in m)
export function deadEndStructure(spanM, heightM) {
  const g = new THREE.Group();
  for (const x of [-spanM / 2, spanM / 2]) {
    for (const dz of [-0.5, 0.5]) {
      const leg = box(0.35, heightM, 0.35, MAT.steel, x, heightM / 2, dz);
      leg.rotation.x = dz * 0.06;
      g.add(leg);
    }
    for (let y = 2; y < heightM; y += 2.5) g.add(box(0.12, 0.12, 1.1, MAT.steel, x, y, 0));   // lacing
  }
  g.add(box(spanM + 1, 0.5, 0.5, MAT.steel, 0, heightM, 0), box(spanM + 1, 0.3, 0.3, MAT.steel, 0, heightM - 1.6, 0));
  // Strain insulators hanging from the beam, one per phase
  for (const x of [-spanM / 3, 0, spanM / 3]) {
    const string = insulator(1.6);
    string.rotation.x = Math.PI / 2;
    string.position.set(x, heightM - 0.3, 0.3);
    g.add(string);
  }
  return g;
}

// Station-class surge arrester: grey polymer sheds on a short base (height in m)
export function surgeArrester(heightM) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#9aa1a3', roughness: 0.6 });
  g.add(box(0.5, 0.25, 0.5, MAT.steel, 0, 0.12, 0));
  for (let y = 0.35; y < heightM; y += 0.22) {
    const shed = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12), mat);
    shed.position.y = y;
    g.add(shed);
  }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, heightM, 8), mat);
  core.position.y = heightM / 2 + 0.25;
  g.add(core);
  return g;
}

// Tubular steel lightning mast with a spike on top (height in m)
export function lightningMast(heightM) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, heightM, 10), MAT.steel);
  pole.position.y = heightM / 2;
  pole.castShadow = true;
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 2, 6), MAT.steel);
  spike.position.y = heightM + 1;
  g.add(pole, spike);
  return g;
}

// Outdoor metal-clad switchgear: one cubicle per label, each with a door, window and name plate
export function switchgearLineup(labels) {
  const g = new THREE.Group();
  const cubicleW = 2.4;
  const left = (-(labels.length - 1) * cubicleW) / 2;
  labels.forEach((label, i) => {
    const x = left + i * cubicleW;
    g.add(box(cubicleW - 0.05, 3, 2.6, MAT.cabinet, x, 1.5, 0));
    g.add(box(cubicleW - 0.5, 2.2, 0.06, MAT.steel, x, 1.4, 1.32));         // door
    g.add(box(0.5, 0.35, 0.07, new THREE.MeshStandardMaterial({ color: '#203040', roughness: 0.1 }), x, 2.1, 1.34));
    const plate = createTextPlate(label, cubicleW - 0.5, 0.32, { background: '#1d1f22', ink: '#f0efec' });
    plate.position.set(x, 2.75, 1.36);
    g.add(plate);
  });
  g.add(box(labels.length * cubicleW + 0.4, 0.2, 3.0, MAT.steel, 0, 3.1, 0));   // roof
  return g;
}

// Pad-mounted station-service transformer (green box with cooling fins)
export function stationService() {
  const g = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: '#4d6b4f', roughness: 0.6 });
  g.add(box(1.6, 1.4, 1.5, green, 0, 0.7, 0));
  for (let k = 0; k < 6; k++) g.add(box(0.05, 1.0, 0.5, green, -0.82, 0.7, -0.6 + k * 0.24));
  const plate = createTextPlate('SST 34.5 kV / 480 V', 1.2, 0.2);
  plate.position.set(0, 1.15, 0.76);
  g.add(plate);
  return g;
}

// Red-and-white "DANGER - HIGH VOLTAGE" sign plate
export function dangerSign() {
  return createTextPlate('DANGER  HIGH VOLTAGE', 1.6, 0.5, { background: '#f4f2ec', ink: '#c8102e' });
}
