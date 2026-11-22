/*
 * PURPOSE:    The person exploring the site: walks (first person), drives the sports jeep (V) or
 *             flies a drone (F); keys 1-5 teleport in any mode. Builds the shared player context and
 *             runs the active mode each frame; the transitions themselves live in playerModes.js.
 *             Driving: W/S throttle-brake-reverse, A/D steer, Space handbrake, Shift boost, R reset.
 *             Flying: W/S/A/D move, mouse turns, Space/E climb, C/Q descend, Shift boost.
 * USED BY:    src/render/world.js
 * DEPENDS ON: src/config.js (VEHICLE), src/render/{input,controls,jeep,vehicle,vehicleDynamics,chaseCamera,
 *             flyer,playerModes}.js
 * UNITS:      metres, seconds.
 */
import { VEHICLE } from '../config.js';
import { createInput, readDriveKeys, readFlyKeys } from './input.js';
import { createControls } from './controls.js';
import { poseVehicle } from './vehicle.js';
import { createJeep } from './jeep.js';
import { createDynamics, placeVehicle, stepDynamics } from './vehicleDynamics.js';
import { createChaseCamera } from './chaseCamera.js';
import { createFlyer } from './flyer.js';
import { handleKey } from './playerModes.js';

// Takes camera, canvas, scene and the colliders list; returns { update(dtSec, timeSec), mode(), speedKmh(), flyerPose(), vehiclePose() }
export function createPlayer(camera, canvas, scene, colliders) {
  const input = createInput(canvas);
  const truck = createJeep();                          // the sports jeep you drive
  scene.add(truck.root);

  // Player context shared with playerModes.js
  const p = {
    mode: 'walk',                                        // 'walk' | 'drive' | 'fly'
    camera, colliders,
    walk: createControls(camera, canvas, input),
    dyn: createDynamics(),                               // truck physics state
    chase: createChaseCamera(camera),
    flyer: createFlyer(scene, camera),
    drive: { throttle: 0, steer: 0, handbrake: false, boost: false },   // reused each frame
    sticks: { forward: 0, strafe: 0, climb: 0, boost: false },          // reused each frame
    mouse: { dx: 0, dy: 0 },
  };
  placeVehicle(p.dyn, VEHICLE.startSpawn[0], VEHICLE.startSpawn[1], Math.PI);
  stepDynamics(p.dyn, p.drive, 0, colliders);
  p.walk.teleport('substation');
  input.onPress((code) => handleKey(p, code));

  return {
    update(dtSec, timeSec) {
      input.takeMouse(p.mouse);
      if (p.mode === 'drive') {
        stepDynamics(p.dyn, readDriveKeys(input, p.drive), dtSec, colliders);
        p.chase.update(p.dyn, dtSec, p.mouse);
      } else if (p.mode === 'fly') {
        p.flyer.update(dtSec, readFlyKeys(input, p.sticks), p.mouse, timeSec);
      } else {
        p.walk.update(dtSec);
      }
      poseVehicle(truck, p.dyn, p.mode === 'drive', timeSec);
    },
    mode: () => p.mode,
    speedKmh: () => (p.mode === 'fly' ? p.flyer.speedMs() : Math.abs(p.dyn.speed)) * 3.6,
    flyerPose: () => p.flyer.pose,
    vehiclePose: () => p.dyn,                            // jeep position / heading (read-only use)
  };
}
