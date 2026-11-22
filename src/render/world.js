/*
 * PURPOSE:    Root of the 3D view: builds the scene, scenery, every zone, cables, signs, the
 *             keyframe-animated site life and the walk / drive / fly player (with collisions), then each
 *             frame reads state, animates and renders through post-processing with adaptive quality.
 *             Never writes to state.
 * USED BY:    src/main.js
 * DEPENDS ON: three, src/render/*.js
 * UNITS:      frame time in seconds; everything else read from state.
 */
import * as THREE from 'three';
import { createScene } from './scene.js';
import { createTerrain } from './terrain.js';
import { createWindFarm } from './windFarm.js';
import { createSolarSite } from './solarSite.js';
import { createBessYard } from './bessYard.js';
import { createSubstation } from './substation.js';
import { createGridLine } from './gridLine.js';
import { createDataCenter } from './dataCenter.js';
import { createCables } from './cables.js';
import { createMountains } from './mountains.js';
import { createTrees } from './trees.js';
import { createZoneBoards } from './boards.js';
import { createPostFx } from './postfx.js';
import { createQualityManager } from './quality.js';
import { createPlayer } from './player.js';
import { createAmbient } from './ambient.js';
import { createPaving } from './paving.js';
import { createStreetscape } from './streetscape.js';
import { createSpecBoards } from './specBoards.js';
import { createClouds } from './clouds.js';
import { createZoneSigns } from './zoneSigns.js';

// Builds everything on the site; returns { colliders, animated } where every animated part has
// update(state, dtSec, timeSec). Anything solid contributes collision shapes for the truck.
function buildSite(scene, labelScene, camera) {
  createTerrain(scene);
  createPaving(scene);
  createMountains(scene);
  const static_ = [createStreetscape(scene), createGridLine(scene), createZoneBoards(scene), createSpecBoards(scene)];
  const trees = createTrees(scene);
  const clouds = createClouds(scene);
  const ambient = createAmbient(scene);
  const animated = [
    createWindFarm(scene), createSolarSite(scene), createBessYard(scene),
    createSubstation(scene, labelScene), createDataCenter(scene), createCables(scene),
    createZoneSigns(labelScene, camera),
    { update: (state, dtSec, timeSec) => trees.update(timeSec) },
    { update: (state, dtSec, timeSec) => clouds.update(timeSec) },
    { update: (state, dtSec, timeSec) => ambient.update(dtSec, timeSec) },
  ];
  const colliders = [];
  for (const part of [...static_, trees, ...animated]) if (part.colliders) colliders.push(...part.colliders);
  return { colliders, animated };
}

// Takes the container element and { quality } (optional forced level); returns { update(state, dtSec, timeSec), ... }
export function createWorld(container, options = {}) {
  const { renderer, scene, camera, onResize, resize } = createScene(container);
  const labelScene = new THREE.Scene();          // floating signs, drawn as an overlay after AO
  const postfx = createPostFx(renderer, scene, camera, labelScene);
  onResize((w, h) => postfx.setSize(w, h));
  const quality = createQualityManager(renderer, postfx, resize, options.quality);
  const { colliders, animated } = buildSite(scene, labelScene, camera);
  const player = createPlayer(camera, renderer.domElement, scene, colliders);

  return {
    update(state, dtSec, timeSec) {
      player.update(dtSec, timeSec);
      for (let i = 0; i < animated.length; i++) animated[i].update(state, dtSec, timeSec);
      postfx.render();
      quality.update(dtSec);
    },
    renderer,
    camera,
    scene,
    player,
    quality,
  };
}
