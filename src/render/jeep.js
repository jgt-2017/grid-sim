/*
 * PURPOSE:    The sports off-roader you drive (V): two-tone tub body with flared fenders, open-top
 *             tubular roll cage with LED light bar, bucket seats, slotted grille with round headlights,
 *             winch bumper, hood stripes, snorkel, rear spare and chunky lugged tyres with red calipers.
 *             Same interface as createVehicle(), so poseVehicle() and the driving physics are unchanged.
 * USED BY:    src/render/player.js
 * DEPENDS ON: three, three/addons RoundedBoxGeometry + BufferGeometryUtils, src/config.js (VEHICLE),
 *             src/render/signage.js (createDecal)
 * UNITS:      metres. Root origin is on the ground at the centre of the wheelbase; +z is forward.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VEHICLE } from '../config.js';
import { createDecal } from './signage.js';

const up = new THREE.Vector3(0, 1, 0);

// Rounded box mesh with shadows at (x, y, z)
function part(sx, sy, sz, r, material, x, y, z) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 2, r), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Round tube from point a to point b (roll cage, snorkel)
function tube(a, b, radius, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 10), material);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(up, dir.normalize());
  m.castShadow = true;
  return m;
}

// Tyre with tread lugs around the circumference (merged into one geometry), axis along x
function tyreGeometry(radius, width) {
  const parts = [new THREE.CylinderGeometry(radius - 0.03, radius - 0.03, width, 24).rotateZ(Math.PI / 2)];
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    parts.push(new THREE.BoxGeometry(width * 1.02, 0.06, 0.12).rotateX(a)
      .translate(0, Math.sin(a + Math.PI / 2) * (radius - 0.01), Math.cos(a + Math.PI / 2) * (radius - 0.01)));
  }
  return mergeGeometries(parts);
}

// One wheel: { pivot (steers), spin (rolls) } with lugged tyre, six-spoke rim and a red caliper
function wheel(x, z, mats) {
  const r = VEHICLE.wheelRadiusM;
  const pivot = new THREE.Group();
  pivot.position.set(x, r, z);
  const spin = new THREE.Group();
  const tyre = new THREE.Mesh(tyreGeometry(r, 0.42), mats.tyre);
  tyre.castShadow = true;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.58, r * 0.58, 0.44, 18).rotateZ(Math.PI / 2), mats.rim);
  spin.add(tyre, rim);
  for (let k = 0; k < 6; k++) spin.add(part(0.46, 0.06, r * 1.0, 0.02, mats.rimDark, 0, 0, 0).rotateX((k * Math.PI) / 3));
  const caliper = part(0.12, 0.22, 0.16, 0.03, mats.caliper, -Math.sign(x) * 0.08, 0.16, 0.12);
  pivot.add(spin, caliper);
  return { pivot, spin };
}

// Body: tub, hood with stripes and vent, fender flares, rock sliders, windshield, seats, decals
function addBody(body, m) {
  body.add(part(1.9, 0.75, 4.1, 0.14, m.paint, 0, 1.1, 0));
  const hood = part(1.84, 0.18, 1.55, 0.08, m.paint, 0, 1.53, 1.3);
  hood.rotation.x = 0.05;
  body.add(hood, part(0.6, 0.05, 0.42, 0.02, m.trim, 0, 1.64, 1.05));
  for (const x of [-0.25, 0.25]) body.add(part(0.22, 0.02, 1.5, 0.01, m.trim, x, 1.63, 1.32));
  const half = VEHICLE.wheelbaseM / 2;
  for (const x of [-1, 1]) {
    for (const z of [-half, half]) body.add(part(0.4, 0.16, 1.35, 0.06, m.trim, x * (VEHICLE.trackM / 2 + 0.06), 1.0, z));   // flares
    body.add(part(0.15, 0.12, 1.7, 0.04, m.trim, x * 1.0, 0.72, 0));
    const badge = createDecal('GT COMPUTING', 1.2, 0.2, { color: '#ffffff', weight: 800 });
    badge.position.set(x * 0.955, 1.22, -0.95);
    badge.rotation.y = x * Math.PI / 2;
    body.add(badge);
  }
  const shield = part(1.78, 0.72, 0.07, 0.03, m.trim, 0, 1.82, 0.6);
  shield.rotation.x = -0.22;
  const glass = part(1.58, 0.56, 0.08, 0.02, m.glass, 0, 1.84, 0.6);
  glass.rotation.x = -0.22;
  body.add(shield, glass);
  for (const x of [-0.42, 0.42]) body.add(part(0.5, 0.18, 0.5, 0.06, m.seat, x, 1.52, -0.15), part(0.5, 0.62, 0.14, 0.06, m.seat, x, 1.8, -0.42));
}

// Open-top roll cage with roof rails and crossbars; LED light bar and amber beacon on top
function addCage(body, m, beaconMat) {
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const r = 0.045;
  for (const s of [-1, 1]) {
    body.add(tube(v(s * 0.9, 1.45, -0.45), v(s * 0.86, 2.3, -0.45), r, m.trim));     // B hoop
    body.add(tube(v(s * 0.9, 1.45, -1.65), v(s * 0.86, 2.15, -1.65), r, m.trim));    // rear hoop
    body.add(tube(v(s * 0.86, 2.18, 0.5), v(s * 0.86, 2.3, -0.45), r, m.trim));      // roof rail front
    body.add(tube(v(s * 0.86, 2.3, -0.45), v(s * 0.86, 2.15, -1.65), r, m.trim));    // roof rail rear
  }
  for (const [y, z] of [[2.18, 0.5], [2.3, -0.45], [2.15, -1.65]]) body.add(tube(v(-0.86, y, z), v(0.86, y, z), r, m.trim));
  body.add(part(1.3, 0.1, 0.12, 0.03, m.led, 0, 2.27, 0.52), part(0.26, 0.1, 0.14, 0.03, beaconMat, 0, 2.39, -0.45));
}

// Front: slotted grille, round headlights, winch bumper with tow hooks, snorkel
function addFront(body, m) {
  body.add(part(1.5, 0.62, 0.12, 0.04, m.trim, 0, 1.17, 2.07));
  for (let k = -3; k <= 3; k++) body.add(part(0.08, 0.44, 0.05, 0.02, m.grille, k * 0.13, 1.17, 2.14));
  for (const x of [-0.62, 0.62]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 20).rotateX(Math.PI / 2), m.head);
    lamp.position.set(x, 1.2, 2.16);
    body.add(lamp, part(0.08, 0.1, 0.12, 0.02, m.hook, x, 0.78, 2.38));
  }
  body.add(part(2.0, 0.22, 0.3, 0.05, m.trim, 0, 0.8, 2.2), part(0.5, 0.18, 0.22, 0.04, m.trim, 0, 0.97, 2.32));
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  body.add(tube(v(0.98, 1.35, 1.25), v(0.98, 2.15, 0.62), 0.06, m.trim), part(0.16, 0.12, 0.2, 0.04, m.trim, 0.98, 2.2, 0.6));
}

// Rear: brake lights, bumper, exhaust and the spare wheel on the tailgate
function addRear(body, m, brakeMat) {
  for (const x of [-0.85, 0.85]) body.add(part(0.12, 0.24, 0.05, 0.02, brakeMat, x, 1.15, -2.07));
  body.add(part(2.0, 0.2, 0.26, 0.05, m.trim, 0, 0.8, -2.15));
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10).rotateX(Math.PI / 2), m.rim);
  exhaust.position.set(0.55, 0.72, -2.15);
  const spare = new THREE.Mesh(tyreGeometry(0.42, 0.3).rotateY(Math.PI / 2), m.tyre);
  spare.position.set(0, 1.35, -2.28);
  spare.castShadow = true;
  body.add(exhaust, spare);
}

// Takes { paint, trim }; returns { root, body, wheels: [{ pivot, spin, front }], brakeMat, beaconMat }
export function createJeep({ paint = VEHICLE.style.paint, trim = VEHICLE.style.trim } = {}) {
  const std = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const m = {
    paint: new THREE.MeshPhysicalMaterial({ color: paint, roughness: 0.4, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    trim: std(trim, 0.55, 0.3), grille: std('#2a2c30', 0.4, 0.6), seat: std('#2b2d31', 0.8),
    glass: std('#0e1a22', 0.05, 0.6), tyre: std('#161616', 0.92), rim: std('#5d6268', 0.3, 0.85),
    rimDark: std('#3a3e43', 0.35, 0.8), caliper: std('#c8202a', 0.4, 0.3), hook: std('#c8202a', 0.4, 0.3),
    head: new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#f4f8ff', emissiveIntensity: 2.4 }),
    led: new THREE.MeshStandardMaterial({ color: '#ddd', emissive: '#eef4ff', emissiveIntensity: 1.5 }),
  };
  const brakeMat = new THREE.MeshStandardMaterial({ color: '#400', emissive: '#ff1a10', emissiveIntensity: 0.6 });
  const beaconMat = new THREE.MeshStandardMaterial({ color: '#552f00', emissive: '#ff9a1a', emissiveIntensity: 0.5 });
  const root = new THREE.Group();
  const body = new THREE.Group();                  // tilts on the suspension
  root.add(body);
  addBody(body, m);
  addCage(body, m, beaconMat);
  addFront(body, m);
  addRear(body, m, brakeMat);
  const half = VEHICLE.wheelbaseM / 2;
  const wheels = [];
  for (const [x, z, front] of [[1, half, true], [-1, half, true], [1, -half, false], [-1, -half, false]]) {
    const w = wheel(x * (VEHICLE.trackM / 2), z, m);
    root.add(w.pivot);
    wheels.push({ ...w, front });
  }
  return { root, body, wheels, brakeMat, beaconMat };
}
