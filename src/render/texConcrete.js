/*
 * PURPOSE:    Procedural jointed-concrete PBR textures: slabs poured in slightly different tones,
 *             soft stains and hairline cracks, then a per-pixel pass for aggregate speckle, trowel
 *             mottling and saw-cut joints, producing colour, height (-> normal map) and roughness.
 * USED BY:    src/render/paving.js (campus slabs), src/render/terrain.js (polished pads)
 * DEPENDS ON: src/utils/rng.js, src/utils/noise.js, src/config.js (SCENERY),
 *             src/render/texPaving.js (toTexture, normalFromHeight)
 * UNITS:      canvas pixels; one tile = slabsPerTile x slabsPerTile slabs.
 */
import { createRng } from '../utils/rng.js';
import { fbm } from '../utils/noise.js';
import { SCENERY } from '../config.js';
import { toTexture, normalFromHeight } from './texPaving.js';

const SIZE = 1024;

// Pours each slab in a slightly different tone, then weathers it with stains and hairline cracks
function pourAndWeather(ctx, slabPx, slabsPerTile, tone, rng, polished) {
  for (let sy = 0; sy < slabsPerTile; sy++) {
    for (let sx = 0; sx < slabsPerTile; sx++) {
      const k = 1 + (rng() - 0.5) * 0.07;
      ctx.fillStyle = `rgb(${tone[0] * k}, ${tone[1] * k}, ${tone[2] * k})`;
      ctx.fillRect(sx * slabPx, sy * slabPx, slabPx, slabPx);
    }
  }
  for (let i = 0; i < (polished ? 3 : 9); i++) {
    const [x, y, r] = [rng() * SIZE, rng() * SIZE, 30 + rng() * 120];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(70, 66, 58, 0.10)');
    g.addColorStop(1, 'rgba(70, 66, 58, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.strokeStyle = 'rgba(60, 58, 54, 0.45)';
  ctx.lineWidth = 1;
  for (let c = 0; c < (polished ? 0 : 4); c++) {
    let [x, y] = [rng() * SIZE, rng() * SIZE];
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 40; s++) ctx.lineTo((x += (rng() - 0.5) * 14), (y += (rng() - 0.3) * 9));
    ctx.stroke();
  }
}

// Per-pixel finish: speckle, mottling and joints into colour; returns { height, roughCanvas }
function finishSurface(ctx, slabPx, rng, polished, seed) {
  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  const height = new Float32Array(SIZE * SIZE);
  const roughCanvas = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE });
  const rough = roughCanvas.getContext('2d').createImageData(SIZE, SIZE);
  const speckle = polished ? 8 : 22;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const jointDist = Math.min(x % slabPx, slabPx - (x % slabPx), y % slabPx, slabPx - (y % slabPx));
      const joint = jointDist < 2;                                  // saw-cut joint, ~2 px wide
      const grain = rng() - 0.5;
      const shade = joint ? -55 : grain * speckle + (fbm(x / 90, y / 90, 3, seed) - 0.5) * 16;
      for (let c = 0; c < 3; c++) img.data[i * 4 + c] += shade;
      height[i] = joint ? 0 : 0.6 + grain * (polished ? 0.02 : 0.08);
      const r = joint ? 255 : (polished ? 120 : 215) + grain * 30;
      rough.data.set([r, r, r, 255], i * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  roughCanvas.getContext('2d').putImageData(rough, 0, 0);
  return { height, roughCanvas };
}

// Takes { slabsPerTile, tone [r,g,b], seed, polished }; returns concrete { map, normalMap, roughnessMap }
export function concreteTextures({ slabsPerTile = 4, tone = [160, 156, 148], seed = 1, polished = false } = {}) {
  const rng = createRng(SCENERY.seed + seed);
  const canvas = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE });
  const ctx = canvas.getContext('2d');
  const slabPx = SIZE / slabsPerTile;
  pourAndWeather(ctx, slabPx, slabsPerTile, tone, rng, polished);
  const { height, roughCanvas } = finishSurface(ctx, slabPx, rng, polished, seed);
  return {
    map: toTexture(canvas, true),
    normalMap: normalFromHeight(height, SIZE, SIZE, 6),
    roughnessMap: toTexture(roughCanvas, false),
  };
}
