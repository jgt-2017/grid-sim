/*
 * PURPOSE:    Shared PBR texture helpers (tiling canvas texture, normal map from a height field) and
 *             the asphalt road texture with lane markings, as { map, normalMap, roughnessMap }.
 *             Concrete slabs live in texConcrete.js.
 * USED BY:    src/render/paving.js (roadTextures), src/render/texConcrete.js, src/render/mountains.js
 * DEPENDS ON: three, src/utils/rng.js, src/config.js (SCENERY)
 * UNITS:      canvas pixels; callers map one tile to a known size in metres.
 */
import * as THREE from 'three';
import { createRng } from '../utils/rng.js';
import { SCENERY } from '../config.js';

// Takes a canvas and colour-space flag; returns a repeating CanvasTexture
export function toTexture(canvas, srgb) {
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

// Asphalt base, wheel-path wear and lane markings (edge lines 0.15 m wide, 0.35 m in from each edge;
// yellow centre dash 4.5 m of every tile)
function paintRoad(ctx, w, h, pxPerM) {
  ctx.fillStyle = '#3b3c3e';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(20, 20, 22, 0.18)';
  for (const v of [0.2, 0.36, 0.64, 0.8]) ctx.fillRect(0, h * v - 6, w, 12);
  const line = 0.15 * pxPerM;
  ctx.fillStyle = '#e9e7df';
  ctx.fillRect(0, 0.35 * pxPerM, w, line);
  ctx.fillRect(0, h - 0.35 * pxPerM - line, w, line);
  ctx.fillStyle = '#e2b53a';
  ctx.fillRect(0.5 * pxPerM, h / 2 - line / 2, 4.5 * pxPerM, line);
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
  paintRoad(ctx, w, h, pxPerM);

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
