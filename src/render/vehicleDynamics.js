/*
 * PURPOSE:    Arcade driving for the site truck: throttle / brake / reverse, speed-sensitive
 *             steering on a bicycle model, handbrake slides, terrain following (pitch and roll from
 *             four wheel heights), body lean from acceleration, and collisions that push the truck
 *             out of buildings and trees. Fixed sub-steps keep it stable at any frame rate.
 *             This is game-feel motion for exploring the site, not part of the grid physics.
 * USED BY:    src/render/player.js
 * DEPENDS ON: src/config.js (VEHICLE), src/render/terrain.js (heightAt), src/render/colliders.js
 * UNITS:      metres, m/s, radians, seconds.
 */
import { VEHICLE } from '../config.js';
import { heightAt } from './terrain.js';
import { resolveCircle } from './colliders.js';

const SUBSTEP_S = 1 / 120;
const GRAVITY = 9.81;

// Returns a fresh vehicle state (position, heading, speed, steering and body attitude)
export function createDynamics() {
  return {
    x: 0, z: 0, y: 0,          // ground position (m)
    yaw: 0,                    // heading (rad); 0 faces +z
    speed: 0,                  // along the heading (m/s), negative = reversing
    steer: 0,                  // front wheel angle (rad), positive = left
    pitch: 0, roll: 0,         // chassis attitude from the terrain (rad)
    leanPitch: 0, leanRoll: 0, // body lean from acceleration (rad)
    wheelAngle: 0,             // accumulated wheel rotation (rad)
    braking: false,
    push: { x: 0, z: 0 },      // scratch for collision push-out
  };
}

// Takes state, ground position and heading; parks the truck there at rest
export function placeVehicle(v, x, z, yaw) {
  Object.assign(v, { x, z, yaw, speed: 0, steer: 0, leanPitch: 0, leanRoll: 0 });
  followTerrain(v);
}

// Takes state, input { throttle -1..1, steer -1..1, handbrake, boost }, frame time (s), colliders
export function stepDynamics(v, input, dtSec, colliders) {
  let remaining = Math.min(dtSec, 0.1);
  while (remaining > 1e-6) {
    const dt = Math.min(SUBSTEP_S, remaining);
    integrate(v, input, dt);
    collide(v, colliders);
    remaining -= dt;
  }
  if (dtSec <= 0) collide(v, colliders);                        // just placed: push out of obstacles
  followTerrain(v);
}

// One sub-step of longitudinal and steering motion
function integrate(v, input, dt) {
  const top = input.boost ? VEHICLE.boostSpeedMs : VEHICLE.maxSpeedMs;
  const startSpeed = v.speed;
  v.braking = false;

  // Throttle forward, brake when pushing against the motion, then reverse once stopped
  if (input.throttle > 0) {
    if (v.speed < 0) { v.speed += VEHICLE.brakeDecelMs2 * dt; v.braking = true; }
    else if (v.speed < top) v.speed += (input.boost ? VEHICLE.boostAccelMs2 : VEHICLE.engineAccelMs2) * dt;
  } else if (input.throttle < 0) {
    if (v.speed > 0.3) { v.speed -= VEHICLE.brakeDecelMs2 * dt; v.braking = true; }
    else if (v.speed > -VEHICLE.reverseSpeedMs) v.speed -= VEHICLE.engineAccelMs2 * 0.6 * dt;
  }
  if (input.handbrake) { v.speed *= 1 - 2.2 * dt; v.braking = true; }
  v.speed -= v.speed * VEHICLE.dragPerS * dt;                    // air and rolling drag
  v.speed -= GRAVITY * Math.sin(v.pitch) * 0.5 * dt;            // slopes slow you uphill
  if (input.throttle === 0 && Math.abs(v.speed) < 0.15) v.speed = 0;

  // Steering: less lock at speed; the wheels turn toward the target at a finite rate
  const lock = VEHICLE.maxSteerRad * (1 - Math.min(Math.abs(v.speed) / 45, 0.6));
  const target = -input.steer * lock;
  v.steer += Math.max(-VEHICLE.steerRatePerS * dt, Math.min(VEHICLE.steerRatePerS * dt, target - v.steer));
  const slide = input.handbrake ? 1.6 : 1;                       // handbrake: tail steps out
  v.yaw += (v.speed / VEHICLE.wheelbaseM) * Math.tan(v.steer) * slide * dt;

  v.x += Math.sin(v.yaw) * v.speed * dt;
  v.z += Math.cos(v.yaw) * v.speed * dt;
  v.wheelAngle += (v.speed / VEHICLE.wheelRadiusM) * dt;

  // Body lean: nose lifts under acceleration, dips under braking; leans out of turns
  const accel = (v.speed - startSpeed) / dt;
  const lateral = v.speed * (v.speed / VEHICLE.wheelbaseM) * Math.tan(v.steer);
  const k = Math.min(1, dt * 6);
  v.leanPitch += (-accel * 0.008 - v.leanPitch) * k;
  v.leanRoll += (lateral * 0.006 - v.leanRoll) * k;           // lean outward in turns
}

// Pushes the truck out of obstacles (two circles along its length); bounces on head-on hits
function collide(v, colliders) {
  const half = VEHICLE.wheelbaseM / 2;
  const fx = Math.sin(v.yaw);
  const fz = Math.cos(v.yaw);
  for (let i = 0; i < 2; i++) {
    const offset = i === 0 ? half : -half;                       // front circle, then rear circle
    if (!resolveCircle(colliders, v.x + fx * offset, v.z + fz * offset, VEHICLE.collisionRadiusM, v.push)) continue;
    v.x += v.push.x;
    v.z += v.push.z;
    const len = Math.hypot(v.push.x, v.push.z) || 1;
    const headOn = (fx * v.push.x + fz * v.push.z) / len * Math.sign(v.speed || 1);
    v.speed *= headOn < -0.5 ? -0.25 : 0.96;                     // bounce back, or scrape along
  }
  // Keep inside the drivable area
  const limit = VEHICLE.driveHalfSizeM;
  if (Math.abs(v.x) > limit || Math.abs(v.z) > limit) {
    v.x = Math.max(-limit, Math.min(limit, v.x));
    v.z = Math.max(-limit, Math.min(limit, v.z));
    v.speed *= 0.5;
  }
}

// Sets height, pitch and roll from the ground under the four wheels
function followTerrain(v) {
  const fx = Math.sin(v.yaw);
  const fz = Math.cos(v.yaw);
  const half = VEHICLE.wheelbaseM / 2;
  const side = VEHICLE.trackM / 2;
  const front = heightAt(v.x + fx * half, v.z + fz * half);
  const rear = heightAt(v.x - fx * half, v.z - fz * half);
  const left = heightAt(v.x + fz * side, v.z - fx * side);      // local +x is the truck's left
  const right = heightAt(v.x - fz * side, v.z + fx * side);
  v.y = (front + rear + left + right) / 4;
  v.pitch = Math.atan2(front - rear, VEHICLE.wheelbaseM);
  v.roll = Math.atan2(left - right, VEHICLE.trackM);
}
