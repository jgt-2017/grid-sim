/*
 * PURPOSE:    Street furniture that makes the campus read as built: precast concrete kerbs along
 *             both road edges (open at the intersection), street lamps facing the road, and concrete
 *             tree planters along the main road. All instanced; lamps and planters are solid for the truck.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, three/addons RoundedBoxGeometry, src/config.js (WORLD), src/render/paving.js,
 *             src/render/trees.js (createSpeciesMeshes), src/render/colliders.js
 * UNITS:      metres.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WORLD } from '../config.js';
import { CURB_GAP_M } from './paving.js';
import { createSpeciesMeshes } from './trees.js';
import { circle } from './colliders.js';

const KERB = { widthM: 0.3, heightM: 0.18 };
const LAMP = { heightM: 8, armM: 1.6, setbackM: 2.2 };   // setback: from the road edge
const PLANTER = { sizeM: 2.6, heightM: 0.6, setbackM: 6 };
const CLEAR_OF_CROSSING_M = 12;                          // no furniture this close to the intersection

// Returns [{ x, z, facing }] points along both sides of each road, skipping the intersection
function alongRoads(spacingM, setbackM, offsetM = 0) {
  const { widthM, eastWest: ew, northSouth: ns } = WORLD.roads;
  const edge = widthM / 2 + setbackM;
  const points = [];
  for (let x = ew.fromX + offsetM + 6; x < ew.toX - 4; x += spacingM) {
    if (Math.abs(x - ns.x) < CLEAR_OF_CROSSING_M) continue;
    points.push({ x, z: ew.z - edge, facing: 0 }, { x, z: ew.z + edge, facing: Math.PI });
  }
  for (let z = ns.fromZ + offsetM + 8; z < ns.toZ - 4; z += spacingM) {
    if (Math.abs(z - ew.z) < CLEAR_OF_CROSSING_M) continue;
    points.push({ x: ns.x - edge, z, facing: Math.PI / 2 }, { x: ns.x + edge, z, facing: -Math.PI / 2 });
  }
  return points;
}

// Kerb runs along both edges of both roads, with gaps where the roads cross
function addKerbs(scene) {
  const { widthM, eastWest: ew, northSouth: ns } = WORLD.roads;
  const off = widthM / 2 + CURB_GAP_M + KERB.widthM / 2;
  const gap = widthM / 2 + CURB_GAP_M + KERB.widthM;
  const runs = [];   // [centreX, centreZ, lengthX, lengthZ]
  for (const side of [-1, 1]) {
    runs.push([(ew.fromX + ns.x - gap) / 2, ew.z + side * off, ns.x - gap - ew.fromX, KERB.widthM]);
    runs.push([(ns.x + gap + ew.toX) / 2, ew.z + side * off, ew.toX - ns.x - gap, KERB.widthM]);
    runs.push([ns.x + side * off, (ns.fromZ + ew.z - gap) / 2, KERB.widthM, ew.z - gap - ns.fromZ]);
    runs.push([ns.x + side * off, (ew.z + gap + ns.toZ) / 2, KERB.widthM, ns.toZ - ew.z - gap]);
  }
  const mat = new THREE.MeshStandardMaterial({ color: '#c9c6be', roughness: 0.8 });
  for (const [x, z, lx, lz] of runs) {
    const kerb = new THREE.Mesh(new RoundedBoxGeometry(lx, KERB.heightM, lz, 1, 0.04), mat);
    kerb.position.set(x, KERB.heightM / 2 + 0.02, z);
    kerb.castShadow = true;
    kerb.receiveShadow = true;
    scene.add(kerb);
  }
}

// Instanced street lamps: pole, arm reaching over the road, LED head
function addLamps(scene, colliders) {
  const spots = alongRoads(WORLD.lampSpacingM, LAMP.setbackM);
  const steel = new THREE.MeshStandardMaterial({ color: '#6f7479', metalness: 0.7, roughness: 0.4 });
  const ledMat = new THREE.MeshStandardMaterial({ color: '#dfe6ea', emissive: '#fff8e8', emissiveIntensity: 1.2 });
  const parts = [
    [new THREE.CylinderGeometry(0.09, 0.14, LAMP.heightM, 8).translate(0, LAMP.heightM / 2, 0), steel],
    [new THREE.BoxGeometry(0.1, 0.1, LAMP.armM).translate(0, LAMP.heightM - 0.1, LAMP.armM / 2), steel],
    [new THREE.BoxGeometry(0.4, 0.12, 0.7).translate(0, LAMP.heightM - 0.2, LAMP.armM), ledMat],
  ].map(([geo, mat]) => new THREE.InstancedMesh(geo, mat, spots.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  spots.forEach(({ x, z, facing }, i) => {
    q.setFromAxisAngle(up, facing);                     // arm points toward the road (+z local)
    m.compose(new THREE.Vector3(x, 0, z), q, one);
    for (const part of parts) part.setMatrixAt(i, m);
    colliders.push(circle(x, z, 0.4));
  });
  for (const part of parts) part.castShadow = true;
  scene.add(...parts);
}

// Instanced concrete planters with a tree each, along the main road
function addPlanters(scene, colliders) {
  const spots = alongRoads(WORLD.planterSpacingM, PLANTER.setbackM, 15);
  const box = new THREE.InstancedMesh(new RoundedBoxGeometry(PLANTER.sizeM, PLANTER.heightM, PLANTER.sizeM, 1, 0.08),
    new THREE.MeshStandardMaterial({ color: '#bcb8ae', roughness: 0.85 }), spots.length);
  const soil = new THREE.InstancedMesh(new THREE.BoxGeometry(PLANTER.sizeM - 0.3, 0.05, PLANTER.sizeM - 0.3),
    new THREE.MeshStandardMaterial({ color: '#4a3a2a', roughness: 1 }), spots.length);
  const trees = createSpeciesMeshes('broadleaf', spots.length);
  const tint = new THREE.Color(0.95, 1, 0.92);
  const m = new THREE.Matrix4();
  spots.forEach(({ x, z }, i) => {
    box.setMatrixAt(i, m.makeTranslation(x, PLANTER.heightM / 2, z));
    soil.setMatrixAt(i, m.makeTranslation(x, PLANTER.heightM, z));
    trees.set(i, m.makeRotationY(i * 1.7).scale(new THREE.Vector3(0.8, 0.8, 0.8)).setPosition(x, PLANTER.heightM, z), tint);
    colliders.push(circle(x, z, PLANTER.sizeM * 0.7));
  });
  trees.finish(spots.length);
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box, soil, ...trees.meshes);
}

// Takes the scene; returns { colliders } for lamps and planters
export function createStreetscape(scene) {
  const colliders = [];
  addKerbs(scene);
  addLamps(scene, colliders);
  addPlanters(scene, colliders);
  return { colliders };
}
