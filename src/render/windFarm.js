/*
 * PURPOSE:    Three low-poly wind turbines (tapered tower, nacelle, hub, three blades) on the ridge.
 *             Rotors spin at state.rotorRpm (proportional to wind up to rated, then constant).
 *             Maker wordmark on both nacelle sides, tower door, blinking red aviation light.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, src/config.js (WORLD, BRANDS), src/render/terrain.js (heightAt),
 *             src/render/signage.js (createDecal)
 * UNITS:      metres; rpm from state; frame time in seconds.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WORLD, BRANDS } from '../config.js';
import { heightAt } from './terrain.js';
import { createDecal } from './signage.js';
import { circle } from './colliders.js';

// Visual dimensions (not to scale: a 164 m rotor would dwarf the site)
const TOWER_HEIGHT_M = 62;
const BLADE_LENGTH_M = 27;
const NACELLE_SIZE_M = [4, 4, 11];   // x, y, z
const ROTOR_FACING = Math.PI * 0.1;  // yaw (rad): rotors face south, toward the site

// Shared geometry and materials for all turbines
const white = new THREE.MeshStandardMaterial({ color: '#eef0f2', roughness: 0.55, flatShading: true });
const towerGeo = new THREE.CylinderGeometry(1.1, 2.1, TOWER_HEIGHT_M, 10);
const nacelleGeo = new RoundedBoxGeometry(...NACELLE_SIZE_M, 3, 1.1);
const hubGeo = new THREE.ConeGeometry(1.6, 3.2, 10).rotateX(Math.PI / 2);
const bladeGeo = createBladeGeometry();
const doorMat = new THREE.MeshStandardMaterial({ color: '#b9bcbf', metalness: 0.5, roughness: 0.4 });
const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 0.3, 0.2), toneMapped: false });
const BEACON_PERIOD_S = 1.5;          // aviation light: on for the first BEACON_ON_S of each period
const BEACON_ON_S = 0.45;

// Returns a tapered, slightly twisted blade pointing along +y from the hub
function createBladeGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.9, 0);
  shape.lineTo(0.9, 0);
  shape.lineTo(0.35, BLADE_LENGTH_M);
  shape.lineTo(-0.15, BLADE_LENGTH_M);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false });
}

// Takes ground x, z; returns { group, rotor } for one turbine
function createTurbine(x, z) {
  const group = new THREE.Group();
  group.position.set(x, heightAt(x, z), z);
  group.rotation.y = ROTOR_FACING;

  const tower = new THREE.Mesh(towerGeo, white);
  tower.position.y = TOWER_HEIGHT_M / 2;
  const nacelle = new THREE.Mesh(nacelleGeo, white);
  nacelle.position.set(0, TOWER_HEIGHT_M + 1.5, -2);

  // Rotor: spins about its local z axis, sits in front of the nacelle
  const rotor = new THREE.Group();
  rotor.position.set(0, TOWER_HEIGHT_M + 1.5, 4.6);
  rotor.add(new THREE.Mesh(hubGeo, white));
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(bladeGeo, white);
    blade.rotation.z = (i * Math.PI * 2) / 3;
    blade.position.z = -0.2;
    rotor.add(blade);
  }
  // Start each rotor at a different angle so they do not spin in lock-step
  rotor.rotation.z = x * 0.37;

  group.add(tower, nacelle, rotor);
  group.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });

  // Maker wordmark on both nacelle sides (decals sit just off the surface)
  for (const side of [1, -1]) {
    const decal = createDecal(BRANDS.wind.maker, 9, 2, { color: '#1b4f8f', weight: 700 });
    decal.position.set(side * (NACELLE_SIZE_M[0] / 2 + 0.03), TOWER_HEIGHT_M + 1.8, -2.5);
    decal.rotation.y = side * Math.PI / 2;
    group.add(decal);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.3, 0.2), doorMat);
  door.position.set(0, 1.25, 2.0);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), beaconMat);
  beacon.position.set(0, TOWER_HEIGHT_M + 3.8, -6.5);
  group.add(door, beacon);
  return { group, rotor, beacon };
}

// Takes the scene; returns { update(state, dtSec) }
export function createWindFarm(scene) {
  const turbines = WORLD.windTurbines.map(([x, z]) => createTurbine(x, z));
  for (const t of turbines) scene.add(t.group);

  const colliders = WORLD.windTurbines.map(([x, z]) => circle(x, z, 3));   // tower bases
  return {
    colliders,
    update(state, dtSec, timeSec) {
      const radPerSec = (state.rotorRpm / 60) * Math.PI * 2;
      const beaconOn = timeSec % BEACON_PERIOD_S < BEACON_ON_S;
      for (let i = 0; i < turbines.length; i++) {
        turbines[i].rotor.rotation.z -= radPerSec * dtSec;
        turbines[i].beacon.visible = beaconOn;
      }
    },
  };
}
