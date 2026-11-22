/*
 * PURPOSE:    The person exploring the site: walks (first person), drives the utility truck (V) or
 *             flies a drone (F). V: getting in brings the truck to you if it is far away; getting
 *             out stands you beside it. F: launches the drone from where you are; F again lands it.
 *             Hotkeys 1-5 teleport you (with the truck or drone).
 *             Driving: W/S throttle-brake-reverse, A/D steer, Space handbrake, Shift boost, R reset.
 *             Flying: W/S/A/D move, mouse turns, Space/E climb, C/Q descend, Shift boost.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, src/config.js (WORLD, VEHICLE), src/render/{input,controls,vehicle,
 *             vehicleDynamics,chaseCamera,flyer}.js
 * UNITS:      metres, seconds.
 */
import * as THREE from 'three';
import { WORLD, VEHICLE, DRONE } from '../config.js';
import { createInput } from './input.js';
import { createControls } from './controls.js';
import { createVehicle } from './vehicle.js';
import { createDynamics, placeVehicle, stepDynamics } from './vehicleDynamics.js';
import { createChaseCamera } from './chaseCamera.js';
import { createFlyer } from './flyer.js';
import { heightAt } from './terrain.js';

const CALL_TRUCK_BEYOND_M = 15;   // farther than this, pressing V brings the truck to you
const FORWARD_KEYS = ['KeyW', 'ArrowUp'];
const BACK_KEYS = ['KeyS', 'ArrowDown'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const BOOST_KEYS = ['ShiftLeft', 'ShiftRight'];

// Takes camera, canvas, scene and the colliders list; returns { update(dtSec, timeSec), mode() }
export function createPlayer(camera, canvas, scene, colliders) {
  const input = createInput(canvas);
  const walk = createControls(camera, canvas, input);
  const truck = createVehicle();
  scene.add(truck.root);
  const dyn = createDynamics();
  const chase = createChaseCamera(camera);
  const flyer = createFlyer(scene, camera);
  const drive = { throttle: 0, steer: 0, handbrake: false, boost: false };   // reused each frame
  const sticks = { forward: 0, strafe: 0, climb: 0, boost: false };          // reused each frame
  const mouse = { dx: 0, dy: 0 };
  const forward = new THREE.Vector3();
  let mode = 'walk';

  placeVehicle(dyn, VEHICLE.startSpawn[0], VEHICLE.startSpawn[1], Math.PI);
  stepDynamics(dyn, drive, 0, colliders);
  walk.teleport('substation');

  // Get in: drive from here (truck comes to you if far); get out: stand beside the driver door
  function toggleMode() {
    if (mode === 'walk') {
      camera.getWorldDirection(forward);
      if (Math.hypot(dyn.x - camera.position.x, dyn.z - camera.position.z) > CALL_TRUCK_BEYOND_M) {
        placeVehicle(dyn, camera.position.x, camera.position.z, Math.atan2(forward.x, forward.z));
        stepDynamics(dyn, drive, 0, colliders);           // nudges it out of anything it landed in
      }
      mode = 'drive';
      walk.setEnabled(false);
      chase.snap(dyn);
    } else {
      const sideX = Math.cos(dyn.yaw) * 2.6;               // truck's left-hand side
      const sideZ = -Math.sin(dyn.yaw) * 2.6;
      walk.placeAt(dyn.x + sideX, dyn.z + sideZ,
        dyn.x + Math.sin(dyn.yaw) * 30, dyn.y + 2, dyn.z + Math.cos(dyn.yaw) * 30);
      dyn.speed = 0;
      mode = 'walk';
      walk.setEnabled(true);
    }
  }

  // Lands the drone and stands you on the ground beneath it, facing the same way
  function land() {
    const { x, z, yaw } = flyer.pose;
    flyer.hide();
    walk.placeAt(x, z, x + Math.sin(yaw) * 30, heightAt(x, z) + 2, z + Math.cos(yaw) * 30);
    mode = 'walk';
    walk.setEnabled(true);
  }

  // F: launch the drone from the truck or from where you stand; F again lands it
  function toggleFly() {
    if (mode === 'fly') return land();
    camera.getWorldDirection(forward);
    const from = mode === 'drive' ? dyn : camera.position;
    const yaw = mode === 'drive' ? dyn.yaw : Math.atan2(forward.x, forward.z);
    if (mode === 'drive') dyn.speed = 0;                   // truck stays parked where it is
    flyer.launch(from.x, heightAt(from.x, from.z) + DRONE.launchHeightM, from.z, yaw);
    mode = 'fly';
    walk.setEnabled(false);
  }

  // Teleport to a zone; when driving, the truck comes too, facing the zone
  function teleport(zoneKey) {
    const zone = WORLD.zones[zoneKey];
    if (!zone) return;
    if (mode === 'walk') return walk.teleport(zoneKey);
    const [x, z] = zone.spawn;
    if (mode === 'fly') {
      return flyer.launch(x, heightAt(x, z) + 25, z, Math.atan2(zone.lookAt[0] - x, zone.lookAt[2] - z));
    }
    placeVehicle(dyn, x, z, Math.atan2(zone.lookAt[0] - x, zone.lookAt[2] - z));
    stepDynamics(dyn, drive, 0, colliders);
    chase.snap(dyn);
  }

  input.onPress((code) => {
    if (code === 'KeyV') {
      if (mode === 'fly') land();                          // land first, then get in the truck
      toggleMode();
    }
    if (code === 'KeyF') toggleFly();
    if (code === 'KeyR' && mode === 'drive') placeVehicle(dyn, dyn.x, dyn.z, dyn.yaw);
    if (code.startsWith('Digit')) teleport(WORLD.zoneOrder[Number(code.slice(5)) - 1]);
  });

  // Reads the driving keys into the reusable input object
  function readDriveInput() {
    drive.throttle = input.axis(FORWARD_KEYS, BACK_KEYS);
    drive.steer = input.axis(RIGHT_KEYS, LEFT_KEYS);
    drive.handbrake = input.isDown('Space');
    drive.boost = input.anyDown(BOOST_KEYS);
  }

  // Reads the flight keys into the reusable sticks object
  function readFlyInput() {
    sticks.forward = input.axis(FORWARD_KEYS, BACK_KEYS);
    sticks.strafe = input.axis(RIGHT_KEYS, LEFT_KEYS);
    sticks.climb = input.axis(['Space', 'KeyE'], ['KeyC', 'KeyQ']);
    sticks.boost = input.anyDown(BOOST_KEYS);
  }

  // Copies the simulated pose onto the truck model
  function poseTruck(timeSec) {
    truck.root.position.set(dyn.x, dyn.y, dyn.z);
    truck.root.rotation.set(-dyn.pitch, dyn.yaw, dyn.roll, 'YXZ');
    truck.body.rotation.set(dyn.leanPitch, 0, dyn.leanRoll);
    for (let i = 0; i < truck.wheels.length; i++) {
      const w = truck.wheels[i];
      w.spin.rotation.x = dyn.wheelAngle;
      w.pivot.rotation.y = w.front ? dyn.steer : 0;
    }
    truck.brakeMat.emissiveIntensity = dyn.braking ? 6 : 0.6;
    const beaconOn = mode === 'drive' && Math.abs(dyn.speed) > 0.5 && timeSec % 0.8 < 0.4;
    truck.beaconMat.emissiveIntensity = beaconOn ? 7 : 0.5;
  }

  return {
    update(dtSec, timeSec) {
      input.takeMouse(mouse);
      if (mode === 'drive') {
        readDriveInput();
        stepDynamics(dyn, drive, dtSec, colliders);
        chase.update(dyn, dtSec, mouse);
      } else if (mode === 'fly') {
        readFlyInput();
        flyer.update(dtSec, sticks, mouse, timeSec);
      } else {
        walk.update(dtSec);
      }
      poseTruck(timeSec);
    },
    mode: () => mode,
    speedKmh: () => (mode === 'fly' ? flyer.speedMs() : Math.abs(dyn.speed)) * 3.6,
    flyerPose: () => flyer.pose,
  };
}
