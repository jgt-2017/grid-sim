/*
 * PURPOSE:    Mode transitions for the person exploring the site: get in / out of the truck (V),
 *             launch / land the drone (F), and teleport to a zone (1-5) in whichever mode is active.
 *             Each function takes the player context `p` built by player.js.
 * USED BY:    src/render/player.js
 * DEPENDS ON: three, src/config.js (WORLD, DRONE), src/render/vehicleDynamics.js, src/render/terrain.js
 * UNITS:      metres, radians.
 */
import * as THREE from 'three';
import { WORLD, DRONE } from '../config.js';
import { placeVehicle, stepDynamics } from './vehicleDynamics.js';
import { heightAt } from './terrain.js';

const CALL_TRUCK_BEYOND_M = 15;   // farther than this, getting in brings the truck to you
const STEP_OUT_M = 2.6;           // stand this far from the truck's centre when getting out
const forward = new THREE.Vector3();

// Yaw (rad) the camera is facing on the ground plane
function cameraYaw(p) {
  p.camera.getWorldDirection(forward);
  return Math.atan2(forward.x, forward.z);
}

// Parks the truck at (x, z) facing yaw and pushes it out of anything it landed in
function parkTruck(p, x, z, yaw) {
  placeVehicle(p.dyn, x, z, yaw);
  stepDynamics(p.dyn, p.drive, 0, p.colliders);
}

// Walk -> drive. The truck comes to you if it is far away
export function getIn(p) {
  const { camera, dyn } = p;
  if (Math.hypot(dyn.x - camera.position.x, dyn.z - camera.position.z) > CALL_TRUCK_BEYOND_M) {
    parkTruck(p, camera.position.x, camera.position.z, cameraYaw(p));
  }
  p.mode = 'drive';
  p.walk.setEnabled(false);
  p.chase.snap(dyn);
}

// Drive -> walk: stand beside the driver's door, looking the way the truck faces
export function getOut(p) {
  const { dyn } = p;
  const x = dyn.x + Math.cos(dyn.yaw) * STEP_OUT_M;      // truck's left-hand side
  const z = dyn.z - Math.sin(dyn.yaw) * STEP_OUT_M;
  p.walk.placeAt(x, z, dyn.x + Math.sin(dyn.yaw) * 30, dyn.y + 2, dyn.z + Math.cos(dyn.yaw) * 30);
  dyn.speed = 0;
  p.mode = 'walk';
  p.walk.setEnabled(true);
}

// Fly -> walk: put the drone away and stand on the ground beneath it
export function land(p) {
  const { x, z, yaw } = p.flyer.pose;
  p.flyer.hide();
  p.walk.placeAt(x, z, x + Math.sin(yaw) * 30, heightAt(x, z) + 2, z + Math.cos(yaw) * 30);
  p.mode = 'walk';
  p.walk.setEnabled(true);
}

// Walk or drive -> fly: launch from where you stand (or from the parked truck)
export function launch(p) {
  const fromTruck = p.mode === 'drive';
  const from = fromTruck ? p.dyn : p.camera.position;
  const yaw = fromTruck ? p.dyn.yaw : cameraYaw(p);
  if (fromTruck) p.dyn.speed = 0;
  p.flyer.launch(from.x, heightAt(from.x, from.z) + DRONE.launchHeightM, from.z, yaw);
  p.mode = 'fly';
  p.walk.setEnabled(false);
}

// Jumps to a zone's spawn point; the truck or drone comes too, facing the zone
export function teleport(p, zoneKey) {
  const zone = WORLD.zones[zoneKey];
  if (!zone) return;
  if (p.mode === 'walk') return p.walk.teleport(zoneKey);
  const [x, z] = zone.spawn;
  const yaw = Math.atan2(zone.lookAt[0] - x, zone.lookAt[2] - z);
  if (p.mode === 'fly') return p.flyer.launch(x, heightAt(x, z) + 25, z, yaw);
  parkTruck(p, x, z, yaw);
  p.chase.snap(p.dyn);
}

// Handles one key press: V drive / walk, F fly / land, R reset the truck, 1-5 teleport
export function handleKey(p, code) {
  if (code === 'KeyV') {
    if (p.mode === 'fly') land(p);                       // land first, then get in the truck
    if (p.mode === 'walk') getIn(p);
    else getOut(p);
  }
  if (code === 'KeyF') {
    if (p.mode === 'fly') land(p);
    else launch(p);
  }
  if (code === 'KeyR' && p.mode === 'drive') placeVehicle(p.dyn, p.dyn.x, p.dyn.z, p.dyn.yaw);
  if (code.startsWith('Digit')) teleport(p, WORLD.zoneOrder[Number(code.slice(5)) - 1]);
}
