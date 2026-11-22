/*
 * PURPOSE:    The drone you fly (F): arcade flight with momentum (velocity eases toward the stick
 *             input), mouse to turn and tilt the view, climb / descend, boost, terrain clearance and
 *             altitude / area limits. The model pitches and banks with its motion; a spring chase
 *             camera follows. Game-feel motion for exploring, not part of the grid simulation.
 * USED BY:    src/render/player.js, src/render/playerModes.js
 * DEPENDS ON: three, src/config.js (DRONE), src/render/droneModel.js, src/render/terrain.js (heightAt)
 * UNITS:      metres, m/s, radians, seconds; mouse movement in pixels.
 */
import * as THREE from 'three';
import { DRONE } from '../config.js';
import { createDroneModel } from './droneModel.js';
import { heightAt } from './terrain.js';

const TURN_PER_PX = 0.0025;    // yaw per pixel of mouse movement (rad)
const TILT_PER_PX = 0.002;     // camera pitch per pixel (rad)
const TILT_PER_MS = 0.018;     // model pitch / bank per m/s of forward / sideways speed (rad)

// Keeps the drone inside its flight envelope: above the ground, below the ceiling, inside the area
function clampEnvelope(f) {
  const { pose, vel } = f;
  const lim = DRONE.flyHalfSizeM;
  pose.x = Math.max(-lim, Math.min(lim, pose.x));
  pose.z = Math.max(-lim, Math.min(lim, pose.z));
  const floor = heightAt(pose.x, pose.z) + DRONE.minClearanceM;
  if (pose.y < floor) { pose.y = floor; vel.y = Math.max(vel.y, 0); }
  if (pose.y > DRONE.maxAltitudeM) { pose.y = DRONE.maxAltitudeM; vel.y = Math.min(vel.y, 0); }
}

// Sets the desired camera point behind and above the drone (never inside the ground) and its aim
function aimCamera(f) {
  const { distanceM, heightM } = DRONE.camera;
  const { pose } = f;
  const fx = Math.sin(pose.yaw);
  const fz = Math.cos(pose.yaw);
  const flat = distanceM * Math.cos(f.camPitch);
  f.desired.set(pose.x - fx * flat, pose.y + heightM * 0.3 + distanceM * Math.sin(f.camPitch), pose.z - fz * flat);
  f.desired.y = Math.max(f.desired.y, heightAt(f.desired.x, f.desired.z) + 0.6);
  f.lookAt.set(pose.x + fx * 2, pose.y + 0.4, pose.z + fz * 2);
}

// One frame of flight: mouse turns, velocity eases toward the sticks, position integrates
function fly(f, sticks, mouse, dtSec) {
  const { pose, vel, target } = f;
  pose.yaw -= mouse.dx * TURN_PER_PX;
  f.camPitch = THREE.MathUtils.clamp(f.camPitch + mouse.dy * TILT_PER_PX, -0.35, 1.25);
  const speed = sticks.boost ? DRONE.boostSpeedMs : DRONE.cruiseSpeedMs;
  const fx = Math.sin(pose.yaw);
  const fz = Math.cos(pose.yaw);
  const norm = Math.hypot(sticks.forward, sticks.strafe) || 1;     // equal speed on diagonals
  const ahead = (sticks.forward / norm) * speed;
  const right = (sticks.strafe / norm) * speed;                     // right = -local x
  target.set(fx * ahead - fz * right, sticks.climb * DRONE.climbSpeedMs * (sticks.boost ? 2 : 1), fz * ahead + fx * right);
  vel.lerp(target, 1 - Math.exp(-DRONE.responsiveness * dtSec));
  pose.x += vel.x * dtSec;
  pose.y += vel.y * dtSec;
  pose.z += vel.z * dtSec;
  clampEnvelope(f);
}

// Places the model and tips it with its motion: nose dips going forward, banks into sideways moves
function poseModel(f, timeSec) {
  const { pose, vel, model } = f;
  const fx = Math.sin(pose.yaw);
  const fz = Math.cos(pose.yaw);
  model.group.position.set(pose.x, pose.y, pose.z);
  model.group.rotation.y = pose.yaw;
  model.tilt.rotation.x = THREE.MathUtils.clamp((vel.x * fx + vel.z * fz) * TILT_PER_MS, -0.4, 0.4);
  model.tilt.rotation.z = THREE.MathUtils.clamp((-vel.x * fz + vel.z * fx) * TILT_PER_MS, -0.4, 0.4);
  model.animate(timeSec);
}

// Takes scene and camera; returns { pose, speedMs(), launch(x, y, z, yaw), hide(), update(dtSec, sticks, mouse, timeSec) }
export function createFlyer(scene, camera) {
  const model = createDroneModel({ shellColor: '#2b2f35', accentColor: '#3987e5', scale: DRONE.scale });
  model.group.visible = false;
  scene.add(model.group);
  const f = {
    model,
    pose: { x: 0, y: 0, z: 0, yaw: 0 },   // drone position (m) and heading (rad)
    vel: new THREE.Vector3(),              // m/s
    target: new THREE.Vector3(),           // velocity the sticks ask for (m/s)
    camPos: new THREE.Vector3(),
    desired: new THREE.Vector3(),
    lookAt: new THREE.Vector3(),
    camPitch: 0.3,                          // camera elevation behind the drone (rad)
  };
  return {
    pose: f.pose,
    speedMs: () => f.vel.length(),
    launch(x, y, z, yaw) {
      Object.assign(f.pose, { x, y, z, yaw });
      f.vel.set(0, 0, 0);
      clampEnvelope(f);
      model.group.visible = true;
      aimCamera(f);
      f.camPos.copy(f.desired);
      camera.position.copy(f.camPos);
      camera.lookAt(f.lookAt);
    },
    hide() {
      model.group.visible = false;
    },
    update(dtSec, sticks, mouse, timeSec) {
      fly(f, sticks, mouse, dtSec);
      poseModel(f, timeSec);
      aimCamera(f);
      f.camPos.lerp(f.desired, 1 - Math.exp(-DRONE.camera.stiffness * dtSec));   // spring follow
      camera.position.copy(f.camPos);
      camera.lookAt(f.lookAt);
    },
  };
}
