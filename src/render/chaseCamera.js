/*
 * PURPOSE:    Third-person chase camera for driving: follows behind the truck with spring
 *             smoothing, looks slightly ahead, lets the mouse orbit around the truck (easing back
 *             behind it once you drive on), and never dips below the ground.
 * USED BY:    src/render/player.js
 * DEPENDS ON: three, src/config.js (VEHICLE), src/render/terrain.js (heightAt)
 * UNITS:      metres, radians, seconds; mouse movement in pixels.
 */
import * as THREE from 'three';
import { VEHICLE } from '../config.js';
import { heightAt } from './terrain.js';

const ORBIT_PER_PX = 0.004;     // radians of orbit per pixel of mouse movement
const RETURN_DELAY_S = 1.5;     // after this long without mouse input, swing back behind the truck

// Takes the camera; returns { snap(v), update(v, dtSec, mouse) }
export function createChaseCamera(camera) {
  const cfg = VEHICLE.camera;
  const position = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const target = new THREE.Vector3();
  let orbitYaw = 0;             // extra rotation around the truck from the mouse (rad)
  let orbitPitch = Math.atan2(cfg.heightM, cfg.distanceM);   // camera elevation angle (rad)
  let idleS = 0;

  // Desired camera point behind (and orbited around) the truck
  function computeDesired(v) {
    const a = v.yaw + orbitYaw;
    const flat = cfg.distanceM * Math.cos(orbitPitch);
    desired.set(v.x - Math.sin(a) * flat, v.y + 1.2 + cfg.distanceM * Math.sin(orbitPitch), v.z - Math.cos(a) * flat);
    const floor = heightAt(desired.x, desired.z) + 1.2;
    if (desired.y < floor) desired.y = floor;
  }

  function lookAtTruck(v) {
    target.set(v.x + Math.sin(v.yaw) * cfg.lookAheadM, v.y + 1.6, v.z + Math.cos(v.yaw) * cfg.lookAheadM);
    camera.lookAt(target);
  }

  return {
    // Jumps straight to the chase position (after teleporting or getting in)
    snap(v) {
      orbitYaw = 0;
      computeDesired(v);
      position.copy(desired);
      camera.position.copy(position);
      lookAtTruck(v);
    },
    update(v, dtSec, mouse) {
      if (mouse.dx !== 0 || mouse.dy !== 0) idleS = 0;
      else idleS += dtSec;
      orbitYaw -= mouse.dx * ORBIT_PER_PX;
      orbitPitch = THREE.MathUtils.clamp(orbitPitch + mouse.dy * ORBIT_PER_PX * 0.6, 0.08, 1.1);
      if (idleS > RETURN_DELAY_S && Math.abs(v.speed) > 2) orbitYaw *= 1 - Math.min(1, dtSec * 2);

      computeDesired(v);
      position.lerp(desired, 1 - Math.exp(-cfg.stiffness * dtSec));   // frame-rate independent spring
      camera.position.copy(position);
      lookAtTruck(v);
    },
  };
}
