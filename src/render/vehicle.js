/*
 * PURPOSE:    Builds the electric site utility truck (also used, recoloured, for the service van):
 *             rounded cab and frame, flatbed with a cable reel, chunky wheels on steer pivots,
 *             roof beacon bar, head / brake lights and door lettering. Geometry only; motion lives
 *             in vehicleDynamics.js and player.js.
 * USED BY:    src/render/ambient.js (createVehicle: the service van), src/render/player.js (poseVehicle)
 * DEPENDS ON: three, three/addons RoundedBoxGeometry, src/config.js (VEHICLE), src/render/signage.js
 * UNITS:      metres. Root origin is on the ground at the centre of the wheelbase; +z is forward.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { VEHICLE } from '../config.js';
import { createDecal } from './signage.js';

const dark = new THREE.MeshStandardMaterial({ color: '#25282c', roughness: 0.6, metalness: 0.3 });
const glass = new THREE.MeshStandardMaterial({ color: '#0e1a22', roughness: 0.05, metalness: 0.6 });
const tyre = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: '#c9cdd1', roughness: 0.3, metalness: 0.8 });
const reelMat = new THREE.MeshStandardMaterial({ color: '#e07a1f', roughness: 0.5 });

// Rounded box mesh with shadows at (x, y, z)
function rounded(sx, sy, sz, radius, material, x, y, z) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 2, radius), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Returns one wheel: { pivot (steers about y), spin (rolls about x) }
function wheel(x, z) {
  const r = VEHICLE.wheelRadiusM;
  const pivot = new THREE.Group();
  pivot.position.set(x, r, z);
  const spin = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.42, 22).rotateZ(Math.PI / 2), tyre);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.44, 12).rotateZ(Math.PI / 2), rimMat);
  const lug = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, r * 1.1), dark);   // shows the rotation
  t.castShadow = true;
  spin.add(t, rim, lug);
  pivot.add(spin);
  return { pivot, spin };
}

// Takes { bodyColor, decal }; returns { root, body, wheels: [{ pivot, spin, front }], brakeMat, beaconMat }
export function createVehicle({ bodyColor = '#1f6f78', decal = 'MICROGRID OPS' } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.4 });
  const headMat = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff6e0', emissiveIntensity: 2 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: '#400', emissive: '#ff1a10', emissiveIntensity: 0.6 });
  const beaconMat = new THREE.MeshStandardMaterial({ color: '#552f00', emissive: '#ff9a1a', emissiveIntensity: 0.5 });

  const root = new THREE.Group();
  const body = new THREE.Group();                 // tilts on the suspension
  root.add(body);

  // Frame, cab, glass
  body.add(rounded(2.1, 0.55, 4.9, 0.15, dark, 0, 0.85, 0));
  body.add(rounded(2.05, 1.3, 2.0, 0.28, paint, 0, 1.75, 1.35));
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.72, 0.05), glass);
  windshield.position.set(0, 1.98, 2.36);
  windshield.rotation.x = -0.18;
  body.add(windshield);
  for (const side of [1, -1]) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 1.25), glass);
    pane.position.set(side * 1.03, 2.0, 1.4);
    body.add(pane);
    const lettering = createDecal(decal, 1.6, 0.26, { color: '#f4f4f0', weight: 800 });
    lettering.position.set(side * 1.035, 1.45, 1.35);
    lettering.rotation.y = side * Math.PI / 2;
    body.add(lettering);
  }

  // Flatbed with low sides and a cable reel
  body.add(rounded(2.05, 0.14, 2.6, 0.05, paint, 0, 1.18, -1.15));
  for (const side of [1, -1]) body.add(rounded(0.1, 0.42, 2.6, 0.04, paint, side * 0.98, 1.45, -1.15));
  body.add(rounded(2.05, 0.42, 0.1, 0.04, paint, 0, 1.45, -2.42));
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 18).rotateZ(Math.PI / 2), reelMat);
  reel.position.set(0, 1.8, -1.2);
  reel.castShadow = true;
  body.add(reel);

  // Lights: roof beacon bar, headlights, brake lights
  body.add(rounded(1.3, 0.14, 0.28, 0.06, beaconMat, 0, 2.47, 1.2));
  for (const side of [1, -1]) {
    body.add(rounded(0.38, 0.18, 0.06, 0.04, headMat, side * 0.72, 1.3, 2.36));
    body.add(rounded(0.3, 0.2, 0.06, 0.04, brakeMat, side * 0.85, 1.25, -2.46));
  }

  // Wheels: front pair steers
  const half = VEHICLE.wheelbaseM / 2;
  const wheels = [];
  for (const [x, z, front] of [[1, half, true], [-1, half, true], [1, -half, false], [-1, -half, false]]) {
    const w = wheel(x * (VEHICLE.trackM / 2), z);
    root.add(w.pivot);
    wheels.push({ ...w, front });
    body.add(rounded(0.5, 0.18, 1.2, 0.08, dark, x * 1.0, 1.14, z));   // fender
  }
  return { root, body, wheels, brakeMat, beaconMat };
}

// Takes the truck model, its dynamics state, whether it is being driven and the time (s);
// copies pose, wheel spin / steer, brake lights and roof beacon onto the model
export function poseVehicle(truck, dyn, driven, timeSec) {
  truck.root.position.set(dyn.x, dyn.y, dyn.z);
  truck.root.rotation.set(-dyn.pitch, dyn.yaw, dyn.roll, 'YXZ');
  truck.body.rotation.set(dyn.leanPitch, 0, dyn.leanRoll);
  for (let i = 0; i < truck.wheels.length; i++) {
    const w = truck.wheels[i];
    w.spin.rotation.x = dyn.wheelAngle;
    w.pivot.rotation.y = w.front ? dyn.steer : 0;
  }
  truck.brakeMat.emissiveIntensity = dyn.braking ? 6 : 0.6;
  const beaconOn = driven && Math.abs(dyn.speed) > 0.5 && timeSec % 0.8 < 0.4;
  truck.beaconMat.emissiveIntensity = beaconOn ? 7 : 0.5;
}
