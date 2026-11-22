/*
 * PURPOSE:    Root of the 3D view: builds the scene, scenery, every zone, cables, signs, the
 *             keyframe-animated site life and the walk / drive player (with collisions), then each
 *             frame reads state, animates and renders through post-processing with adaptive quality.
 *             Never writes to state.
 * USED BY:    src/main.js
 * DEPENDS ON: three, src/config.js (WORLD, COLORS), src/render/*.js
 * UNITS:      frame time in seconds; everything else read from state.
 */
import * as THREE from 'three';
import { WORLD, COLORS } from '../config.js';
import { createScene } from './scene.js';
import { createTerrain } from './terrain.js';
import { createWindFarm } from './windFarm.js';
import { createSolarSite } from './solarSite.js';
import { createBessYard } from './bessYard.js';
import { createSubstation } from './substation.js';
import { createGridLine } from './gridLine.js';
import { createDataCenter } from './dataCenter.js';
import { createCables } from './cables.js';
import { createSign } from './labels.js';
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

// Sign accent colour and live detail text for each zone
const SIGN_TEXT = {
  wind: { color: COLORS.wind, detail: (s) => `${s.pWindDeliveredMw.toFixed(1)} MW · ${s.windSpeedMs.toFixed(1)} m/s` },
  solar: { color: COLORS.solar, detail: (s) => `${s.pPvDeliveredMw.toFixed(1)} MW · ${s.effectiveIrradianceWm2.toFixed(0)} W/m²` },
  bess: { color: COLORS.bess, detail: bessDetail },
  substation: { color: COLORS.grid, detail: gridDetail },
  datacenter: { color: COLORS.load, detail: (s) => `${s.pLoadMw.toFixed(1)} MW · ${(s.dcUtilization * 100).toFixed(0)}% util` },
};

function bessDetail(s) {
  const soc = `SOC ${(s.soc * 100).toFixed(0)}%`;
  if (s.pBessDisMw > 0) return `${soc} · −${s.pBessDisMw.toFixed(1)} MW`;
  if (s.pBessChgMw > 0) return `${soc} · +${s.pBessChgMw.toFixed(1)} MW`;
  return `${soc} · idle`;
}

function gridDetail(s) {
  if (!s.gridBreakerClosed) return 'Islanded';
  if (s.pGridImportMw > 0) return `Import ${s.pGridImportMw.toFixed(1)} MW`;
  if (s.pGridExportMw > 0) return `Export ${s.pGridExportMw.toFixed(1)} MW`;
  return 'Grid idle';
}

// Takes the container element; returns { update(state, dtSec, timeSec) }
// Takes the container element and { quality } (optional forced level); returns { update(state, dtSec, timeSec) }
export function createWorld(container, options = {}) {
  const { renderer, scene, camera, onResize, resize } = createScene(container);
  const labelScene = new THREE.Scene();          // floating signs, drawn as an overlay
  const postfx = createPostFx(renderer, scene, camera, labelScene);
  onResize((w, h) => postfx.setSize(w, h));
  const quality = createQualityManager(renderer, postfx, resize, options.quality);

  // Static scenery; everything solid contributes collision shapes for the truck
  createTerrain(scene);
  createPaving(scene);
  createMountains(scene);
  const clouds = createClouds(scene);
  const trees = createTrees(scene);
  const colliders = [
    ...createStreetscape(scene).colliders,
    ...trees.colliders,
    ...createGridLine(scene).colliders,
    ...createZoneBoards(scene).colliders,
    ...createSpecBoards(scene).colliders,
  ];
  const parts = [
    createWindFarm(scene),
    createSolarSite(scene),
    createBessYard(scene),
    createSubstation(scene, labelScene),
    createDataCenter(scene),
    createCables(scene),
  ];
  for (const part of parts) if (part.colliders) colliders.push(...part.colliders);
  const ambient = createAmbient(scene);

  // Floating zone signs
  const signs = WORLD.zoneOrder.map((key) => {
    const zone = WORLD.zones[key];
    const sign = createSign({ title: zone.label, accentColor: SIGN_TEXT[key].color });
    sign.sprite.position.set(...zone.sign);
    labelScene.add(sign.sprite);
    return { key, label: zone.label, sign };
  });

  const player = createPlayer(camera, renderer.domElement, scene, colliders);

  // Floating signs fade out up close (they draw on top, so near ones would fill the view)
  const SIGN_FADE = { nearM: 20, farM: 45 };
  function fadeSigns() {
    for (let i = 0; i < signs.length; i++) {
      const sprite = signs[i].sign.sprite;
      const d = sprite.position.distanceTo(camera.position);
      sprite.material.opacity = Math.min(1, Math.max(0, (d - SIGN_FADE.nearM) / (SIGN_FADE.farM - SIGN_FADE.nearM)));
    }
  }

  let lastSignMs = -Infinity;
  return {
    update(state, dtSec, timeSec) {
      player.update(dtSec, timeSec);
      for (let i = 0; i < parts.length; i++) parts[i].update(state, dtSec, timeSec);
      ambient.update(dtSec, timeSec);
      trees.update(timeSec);
      clouds.update(timeSec);

      // Sign text changes a few times a second at most (each change re-uploads a texture)
      if (timeSec * 1000 - lastSignMs > WORLD.labelRefreshMs) {
        lastSignMs = timeSec * 1000;
        for (const s of signs) s.sign.setText(s.label, SIGN_TEXT[s.key].detail(state));
      }
      fadeSigns();
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
