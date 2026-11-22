/*
 * PURPOSE:    Adaptive render quality. Starts at the configured level and steps down (high ->
 *             medium -> low) whenever the measured frame rate stays below the target, so the sim
 *             keeps ~60 fps on slower laptops. A level forced from the URL (?quality=...) is kept.
 * USED BY:    src/render/world.js
 * DEPENDS ON: src/config.js (QUALITY, WORLD)
 * UNITS:      seconds, frames per second.
 */
import { QUALITY, WORLD } from '../config.js';

const LEVELS = ['low', 'medium', 'high'];

// Takes renderer, postfx, an onResize trigger and an optional forced level; returns { update(dtSec), level() }
export function createQualityManager(renderer, postfx, resize, forced) {
  let level = LEVELS.indexOf(forced ?? QUALITY.start);
  if (level < 0) level = LEVELS.length - 1;
  const adaptive = !forced;

  // high: AO + bloom; medium: bloom only; low: no post effects and pixel ratio 1
  function apply() {
    postfx.setAo(level >= 2);
    postfx.setBloom(level >= 1);
    const ratio = level === 0 ? 1 : Math.min(window.devicePixelRatio || 1, WORLD.pixelRatioMax);
    if (renderer.getPixelRatio() !== ratio) {
      renderer.setPixelRatio(ratio);
      resize();
    }
    console.info(`[grid-sim] render quality: ${LEVELS[level]}`);
  }
  apply();

  let elapsedS = 0;        // time since start
  let windowS = 0;         // time in the current sample window
  let frames = 0;          // frames in the current sample window
  return {
    update(dtSec) {
      elapsedS += dtSec;
      if (!adaptive || level === 0 || elapsedS < QUALITY.warmupS) return;
      windowS += dtSec;
      frames += 1;
      if (windowS < QUALITY.sampleS) return;
      const fps = frames / windowS;
      windowS = 0;
      frames = 0;
      if (fps < QUALITY.minFps) {
        level -= 1;
        apply();
      }
    },
    level: () => LEVELS[level],
  };
}
