/*
 * PURPOSE:    The drone you fly (F): arcade flight with momentum (velocity eases toward the stick
 *             input), mouse to turn and tilt the view, climb / descend, boost, terrain clearance and
 *             altitude / area limits. The model pitches and banks with its motion; a spring chase
 *             camera follows. Game-feel motion for exploring, not part of the grid simulation.
 * USED BY:    src/render/player.js
 * DEPENDS ON: three, src/config.js (DRONE), src/render/droneModel.js, src/render/terrain.js (heightAt)
 * UNITS:      metres, m/s, radians, seconds; mouse movement in pixels.
 */
import * as THREE from 'three';
import { DRONE } from '../config.js';
import { createDroneModel } from './droneModel.js';
import { heightAt } from './terrain.js';

const TURN_PER_PX = 0.0025;    // yaw per pixel of mouse movement (rad)
const TILT_PER_PX = 0.002;     // camera pitch per pixel (rad)

// Takes scene and camera; returns { launch(x, y, z, yaw), hide(), update(dtSec, sticks, mouse, timeSec), pose, speedMs() }
export function createFlyer(scene, camera) {
  const model = createDroneModel({ shellColor: '#2b2f35', accentColor: '#3987e5', scale: DRONE.scale });
  model.group.visible = false;
  scene.add(model.group);

  const pose = { x: 0, y: 0, z: 0, yaw: 0 };          // drone position (m) and heading (rad)
  const vel = new THREE.Vector3();                     // m/s
  const target = new THREE.Vector3();                  // velocity the sticks ask for (m/s)
  const camPos = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  let camPitch = 0.3;                                   // camera elevation behind the drone (rad)

  // Camera point behind and above the drone, never inside the ground
  function computeCamera() {
    const { distanceM, heightM } = DRONE.camera;
    const fx = Math.sin(pose.yaw);
    const fz = Math.cos(pose.yaw);
    const flat = distanceM * Math.cos(camPitch);
    desired.set(pose.x - fx * flat, pose.y + heightM * 0.3 + distanceM * Math.sin(camPitch), pose.z - fz * flat);
    desired.y = Math.max(desired.y, heightAt(desired.x, desired.z) + 0.6);
    lookAt.set(pose.x + fx * 2, pose.y + 0.4, pose.z + fz * 2);
  }

  // Clamp to the flight envelope: above the ground, below the ceiling, inside the area
  function clampEnvelope() {
    const lim = DRONE.flyHalfSizeM;
    pose.x = Math.max(-lim, Math.min(lim, pose.x));
    pose.z = Math.max(-lim, Math.min(lim, pose.z));
    const floor = heightAt(pose.x, pose.z) + DRONE.minClearanceM;
    if (pose.y < floor) { pose.y = floor; vel.y = Math.max(vel.y, 0); }
    if (pose.y > DRONE.maxAltitudeM) { pose.y = DRONE.maxAltitudeM; vel.y = Math.min(vel.y, 0); }
  }

  return {
    pose,
    speedMs: () => vel.length(),
    // Takes off from (x, y, z) facing yaw; jumps the camera into place
    launch(x, y, z, yaw) {
      Object.assign(pose, { x, y, z, yaw });
      vel.set(0, 0, 0);
      clampEnvelope();
      model.group.visible = true;
      computeCamera();
      camPos.copy(desired);
      camera.position.copy(camPos);
      camera.lookAt(lookAt);
    },
    hide() {
      model.group.visible = false;
    },
    // Takes frame time, sticks { forward, strafe, climb -1..1, boost }, mouse { dx, dy } and time
    update(dtSec, sticks, mouse, timeSec) {
      pose.yaw -= mouse.dx * TURN_PER_PX;
      camPitch = THREE.MathUtils.clamp(camPitch + mouse.dy * TILT_PER_PX, -0.35, 1.25);

      // Velocity eases toward the stick command (momentum, no instant stops)
      const speed = sticks.boost ? DRONE.boostSpeedMs : DRONE.cruiseSpeedMs;
      const fx = Math.sin(pose.yaw);
      const fz = Math.cos(pose.yaw);
      const norm = Math.hypot(sticks.forward, sticks.strafe) || 1;
      const f = (sticks.forward / norm) * speed;
      const r = (sticks.strafe / norm) * speed;          // right = -local x
      target.set(fx * f - fz * r, sticks.climb * DRONE.climbSpeedMs * (sticks.boost ? 2 : 1), fz * f + fx * r);
      vel.lerp(target, 1 - Math.exp(-DRONE.responsiveness * dtSec));
      pose.x += vel.x * dtSec;
      pose.y += vel.y * dtSec;
      pose.z += vel.z * dtSec;
      clampEnvelope();

      // Model: nose dips when flying forward, banks into sideways motion
      const forwardVel = vel.x * fx + vel.z * fz;
      const rightVel = -vel.x * fz + vel.z * fx;
      model.group.position.set(pose.x, pose.y, pose.z);
      model.group.rotation.y = pose.yaw;
      model.tilt.rotation.x = THREE.MathUtils.clamp(forwardVel * 0.018, -0.4, 0.4);
      model.tilt.rotation.z = THREE.MathUtils.clamp(rightVel * 0.018, -0.4, 0.4);
      model.animate(timeSec);

      computeCamera();
      camPos.lerp(desired, 1 - Math.exp(-DRONE.camera.stiffness * dtSec));
      camera.position.copy(camPos);
      camera.lookAt(lookAt);
    },
  };
}
