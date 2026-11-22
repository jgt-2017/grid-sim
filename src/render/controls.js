/*
 * PURPOSE:    First-person walking: click to lock the pointer, mouse to look (PointerLockControls),
 *             WASD / arrows to move, Shift to sprint. The camera follows the terrain.
 *             Mode switching and zone teleports live in player.js.
 * USED BY:    src/render/player.js
 * DEPENDS ON: three, three/addons PointerLockControls, src/config.js (WORLD, VEHICLE), src/render/terrain.js
 * UNITS:      metres, m/s, seconds.
 */
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { WORLD, VEHICLE } from '../config.js';
import { heightAt } from './terrain.js';

// Takes the camera, canvas and input; returns { update(dtSec), teleport(zoneKey), setEnabled(on), placeAt(x, z, lookX, lookZ) }
export function createControls(camera, canvas, input) {
  const controls = new PointerLockControls(camera, canvas);
  canvas.addEventListener('click', () => controls.lock());
  const lookTarget = new THREE.Vector3();

  // Stands at (x, z) on the ground, facing (lookX, lookY, lookZ)
  function placeAt(x, z, lookX, lookY, lookZ) {
    camera.position.set(x, heightAt(x, z) + WORLD.eyeHeightM, z);
    camera.lookAt(lookTarget.set(lookX, lookY, lookZ));
  }

  // Teleport: stand at the zone's spawn point and face its focus point
  function teleport(zoneKey) {
    const zone = WORLD.zones[zoneKey];
    if (zone) placeAt(zone.spawn[0], zone.spawn[1], ...zone.lookAt);
  }

  // Takes frame time (s); moves the camera on the ground plane and clamps to the site
  function update(dtSec) {
    const forward = Number(input.isDown('KeyW') || input.isDown('ArrowUp'))
      - Number(input.isDown('KeyS') || input.isDown('ArrowDown'));
    const right = Number(input.isDown('KeyD') || input.isDown('ArrowRight'))
      - Number(input.isDown('KeyA') || input.isDown('ArrowLeft'));
    if (forward !== 0 || right !== 0) {
      const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      const speed = WORLD.walkSpeedMs * (sprint ? WORLD.sprintMultiplier : 1);
      const norm = Math.hypot(forward, right);            // equal speed on diagonals
      controls.moveForward((forward / norm) * speed * dtSec);
      controls.moveRight((right / norm) * speed * dtSec);
    }
    const limit = VEHICLE.driveHalfSizeM;   // same roaming area as the truck, so you can step out anywhere
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -limit, limit);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -limit, limit);
    camera.position.y = heightAt(camera.position.x, camera.position.z) + WORLD.eyeHeightM;
  }

  // Mouse-look is handed to the chase camera while driving
  function setEnabled(on) {
    controls.enabled = on;
  }

  return { update, teleport, setEnabled, placeAt };
}
