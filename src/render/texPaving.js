/*
 * PURPOSE:    Procedural PBR textures for constructed surfaces: jointed concrete slabs (aggregate,
 *             trowel mottling, stains, hairline cracks, saw-cut joints) and asphalt road with lane
 *             markings. Each comes as { map, normalMap, roughnessMap }; the normal map is derived
 *             from a height field so joints read as real grooves and aggregate catches the light.
 * USED BY:    src/render/paving.js, src/render/terrain.js (polished pads), src/render/mountains.js (normalFromHeight)
 * DEPENDS ON: three, src/utils/rng.js, src/utils/noise.js, src/config.js (SCENERY)
 * UNITS:      canvas pixels; callers map one tile to a known size in metres.
 */
import * as THREE from 'three';
import { createRng } from '../utils/rng.js';
import { fbm } from '../utils/noise.js';
import { SCENERY } from '../config.js';

// Takes a canvas and colour-space flag; returns a repeating CanvasTexture
function toTexture(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Takes a height field (0-1) and strength; returns a tangent-space normal map texture
export function normalFromHeight(height, w, h, strength) {
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = height[y * w + ((x + 1) % w)] - height[y * w + ((x - 1 + w) % w)];
      const dy = height[((y + 1) % h) * w + x] - height[((y - 1 + h) % h) * w + x];
      const nx = -dx * strength;
      const ny = dy * strength;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * w + x) * 4;
      img.data[i] = (nx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas, false);
}

// Takes { slabsPerTile, tone [r,g,b], seed, polished }; returns concrete { map, normalMap, roughnessMap }
export function concreteTextures({ slabsPerTile = 4, tone = [160, 156, 148], seed = 1, polished = false } = {}) {
  const size = 1024;
  const slabPx = size / slabsPerTile;
  const rng = createRng(SCENERY.seed + seed);
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
  const ctx = canvas.getContext('2d');

  // Each slab poured separately: slightly different tone
  for (let sy = 0; sy < slabsPerTile; sy++) {
    for (let sx = 0; sx < slabsPerTile; sx++) {
      const k = 1 + (rng() - 0.5) * 0.07;
      ctx.fillStyle = `rgb(${tone[0] * k}, ${tone[1] * k}, ${tone[2] * k})`;
      ctx.fillRect(sx * slabPx, sy * slabPx, slabPx, slabPx);
    }
  }
  // Weathering: soft stains and a few hairline cracks (fewer on polished floors)
  for (let i = 0; i < (polished ? 3 : 9); i++) {
    const [x, y, r] = [rng() * size, rng() * size, 30 + rng() * 120];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(70, 66, 58, 0.10)');
    g.addColorStop(1, 'rgba(70, 66, 58, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.strokeStyle = 'rgba(60, 58, 54, 0.45)';
  ctx.lineWidth = 1;
  for (let c = 0; c < (polished ? 0 : 4); c++) {
    let [x, y] = [rng() * size, rng() * size];
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 40; s++) ctx.lineTo((x += (rng() - 0.5) * 14), (y += (rng() - 0.3) * 9));
    ctx.stroke();
  }

  // Per-pixel pass: aggregate speckle, trowel mottling, saw-cut joints -> colour, height, roughness
  const img = ctx.getImageData(0, 0, size, size);
  const height = new Float32Array(size * size);
  const rough = ctx.createImageData(size, size);
  const speckle = polished ? 8 : 22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const jx = Math.min(x % slabPx, slabPx - (x % slabPx));     // distance to nearest joint (px)
      const jy = Math.min(y % slabPx, slabPx - (y % slabPx));
      const joint = Math.min(jx, jy) < 2;
      const grain = rng() - 0.5;
      const mottle = (fbm(x / 90, y / 90, 3, seed) - 0.5) * 16;
      const shade = joint ? -55 : grain * speckle + mottle;
      img.data[i * 4] += shade;
      img.data[i * 4 + 1] += shade;
      img.data[i * 4 + 2] += shade;
      height[i] = joint ? 0 : 0.6 + grain * (polished ? 0.02 : 0.08);
      const r = joint ? 255 : (polished ? 120 : 215) + grain * 30;
      rough.data[i * 4] = rough.data[i * 4 + 1] = rough.data[i * 4 + 2] = r;
      rough.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const roughCanvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
  roughCanvas.getContext('2d').putImageData(rough, 0, 0);
  return {
    map: toTexture(canvas, true),
    normalMap: normalFromHeight(height, size, size, 6),
    roughnessMap: toTexture(roughCanvas, false),
  };
}

// Takes tile length and road width (m); returns asphalt { map, normalMap, roughnessMap } with
// white edge lines and a dashed yellow centre line. u runs along the road, v across it.
export function roadTextures(tileLengthM = 12, widthM = 8) {
  const w = 1024;
  const h = Math.round((w * widthM) / tileLengthM);
  const pxPerM = w / tileLengthM;
  const rng = createRng(SCENERY.seed + 77);
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3b3c3e';
  ctx.fillRect(0, 0, w, h);
  // Wheel paths: slightly darker, polished bands in each lane
  ctx.fillStyle = 'rgba(20, 20, 22, 0.18)';
  for (const v of [0.2, 0.36, 0.64, 0.8]) ctx.fillRect(0, h * v - 6, w, 12);
  // Markings: edge lines 0.15 m wide, 0.35 m in from each edge; centre dash 4.5 m of every tile
  const line = 0.15 * pxPerM;
  ctx.fillStyle = '#e9e7df';
  ctx.fillRect(0, 0.35 * pxPerM, w, line);
  ctx.fillRect(0, h - 0.35 * pxPerM - line, w, line);
  ctx.fillStyle = '#e2b53a';
  ctx.fillRect(0.5 * pxPerM, h / 2 - line / 2, 4.5 * pxPerM, line);

  const img = ctx.getImageData(0, 0, w, h);
  const height = new Float32Array(w * h);
  const rough = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const grain = rng() - 0.5;
    const isPaint = img.data[i * 4] > 150;
    const wear = isPaint && rng() < 0.12 ? -70 : 0;               // worn paint
    for (let c = 0; c < 3; c++) img.data[i * 4 + c] += grain * (isPaint ? 14 : 34) + wear;
    height[i] = 0.5 + grain * 0.18 + (isPaint ? 0.08 : 0);
    rough.data[i * 4] = rough.data[i * 4 + 1] = rough.data[i * 4 + 2] = isPaint ? 150 : 225 + grain * 30;
    rough.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const roughCanvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  roughCanvas.getContext('2d').putImageData(rough, 0, 0);
  return {
    map: toTexture(canvas, true),
    normalMap: normalFromHeight(height, w, h, 3),
    roughnessMap: toTexture(roughCanvas, false),
  };
}
