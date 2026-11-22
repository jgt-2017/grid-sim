/*
 * PURPOSE:    Substation yard dressing: lightning masts with overhead shield wires, the relay /
 *             control house with its protection labels (87T, 50/51), and the chain-link fence with
 *             danger signs. FENCE also bounds the yard for the truck's collisions.
 * USED BY:    src/render/substation.js
 * DEPENDS ON: three, src/render/substationParts.js (MAT, box), src/render/substationExtras.js
 *             (lightningMast, dangerSign), src/render/labels.js (createTextPlate)
 * UNITS:      metres, in substation-local coordinates (yard centred on the origin).
 */
import * as THREE from 'three';
import { MAT, box } from './substationParts.js';
import { lightningMast, dangerSign } from './substationExtras.js';
import { createTextPlate } from './labels.js';

export const FENCE = { minX: -27, maxX: 27, minZ: -24, maxZ: 31, heightM: 2.4 };
const MASTS = [[-24, -21], [24, -21], [24, 28], [-24, 28]];   // lightning mast positions [x, z]

// Moves an object by (x, y, z) and returns it
function placed(object, x, z, y = 0) {
  object.position.set(object.position.x + x, object.position.y + y, object.position.z + z);
  return object;
}

// Lightning masts at the yard corners joined by overhead shield wires
export function addShielding(root) {
  const top = 20;
  for (const [x, z] of MASTS) root.add(placed(lightningMast(top), x, z));
  const points = [...MASTS, MASTS[0]].map(([x, z]) => new THREE.Vector3(x, top, z));
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#4a4a48' })));
}

// Relay/control house with protection labels on the wall facing the yard
export function addRelayHouse(root) {
  const [x, z] = [19, 10];
  root.add(box(7, 3.6, 9, MAT.cabinet, x, 1.8, z), box(7.6, 0.3, 9.6, MAT.steel, x, 3.75, z));
  root.add(box(0.1, 2.2, 1.1, MAT.steel, x - 3.52, 1.1, z + 2.5));                    // door
  const labels = [['RELAY HOUSE', 4.2, 0.6, 3.0, z - 1], ['87T', 1.6, 0.6, 2.0, z - 2.2], ['50/51', 1.6, 0.6, 2.0, z]];
  for (const [text, w, h, y, pz] of labels) {
    const p = createTextPlate(text, w, h);
    p.rotation.y = -Math.PI / 2;
    p.position.set(x - 3.53, y, pz);
    root.add(p);
  }
}

// Chain-link fence (instanced posts + see-through panels) with danger signs on the south side
export function addFence(root) {
  const { minX, maxX, minZ, maxZ, heightM } = FENCE;
  const spots = [];
  for (let x = minX; x <= maxX; x += 3) spots.push([x, minZ], [x, maxZ]);
  for (let z = minZ + 3; z < maxZ; z += 3) spots.push([minX, z], [maxX, z]);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, heightM, 0.1), MAT.steel, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, z], i) => posts.setMatrixAt(i, m.makeTranslation(x, heightM / 2, z)));
  root.add(posts);
  const mesh = new THREE.MeshStandardMaterial({ color: '#b5b9bb', transparent: true, opacity: 0.25 });
  for (const [x, z, sx, sz] of [[0, minZ, maxX - minX, 0.02], [0, maxZ, maxX - minX, 0.02],
    [minX, (minZ + maxZ) / 2, 0.02, maxZ - minZ], [maxX, (minZ + maxZ) / 2, 0.02, maxZ - minZ]]) {
    const panel = box(sx, heightM, sz, mesh, x, heightM / 2, z);
    panel.castShadow = false;
    root.add(panel);
  }
  for (const x of [-12, 12]) root.add(placed(dangerSign(), x, maxZ + 0.05, 1.5));
}
