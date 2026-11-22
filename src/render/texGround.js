/*
 * PURPOSE:    Procedural canvas textures for the ground: grass, gravel and asphalt. Generated once
 *             at start-up from a seeded RNG (no image files to download).
 * USED BY:    src/render/terrain.js
 * DEPENDS ON: three, src/utils/rng.js, src/config.js (SCENERY)
 * UNITS:      texture size in pixels; callers set repeat in metres-per-tile.
 */
import * as THREE from 'three';
import { createRng } from '../utils/rng.js';
import { SCENERY } from '../config.js';

const SIZE_PX = 512;

// Takes a draw(ctx, rng) function; returns a tiling sRGB CanvasTexture
function makeTexture(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE_PX;
  canvas.height = SIZE_PX;
  const ctx = canvas.getContext('2d');
  draw(ctx, createRng(SCENERY.seed));
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Grass: mid-green base with thousands of short blades in varied greens and a few dry ones
export function grassTexture() {
  return makeTexture((ctx, rng) => {
    ctx.fillStyle = '#6b7f45';
    ctx.fillRect(0, 0, SIZE_PX, SIZE_PX);
    const greens = ['#62773d', '#74894b', '#7b9050', '#5a6e37', '#829353', '#8f8c58'];
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55;                          // soft blades: detail without pixel noise
    for (let i = 0; i < 16000; i++) {
      const x = rng() * SIZE_PX;
      const y = rng() * SIZE_PX;
      const len = 3 + rng() * 6;
      ctx.strokeStyle = greens[Math.floor(rng() * greens.length)];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * 3, y - len);
      ctx.stroke();
    }
  });
}

// Gravel: light grey base with small stones of varied tone
export function gravelTexture() {
  return makeTexture((ctx, rng) => {
    ctx.fillStyle = '#a9a49a';
    ctx.fillRect(0, 0, SIZE_PX, SIZE_PX);
    for (let i = 0; i < 14000; i++) {
      const shade = 120 + Math.floor(rng() * 110);
      ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 12})`;
      const r = 0.8 + rng() * 2.2;
      ctx.beginPath();
      ctx.ellipse(rng() * SIZE_PX, rng() * SIZE_PX, r, r * (0.6 + rng() * 0.4), rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// Asphalt: dark base with fine aggregate speckle
export function asphaltTexture() {
  return makeTexture((ctx, rng) => {
    ctx.fillStyle = '#3e3f40';
    ctx.fillRect(0, 0, SIZE_PX, SIZE_PX);
    for (let i = 0; i < 20000; i++) {
      const shade = 40 + Math.floor(rng() * 60);
      ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade + 2})`;
      ctx.fillRect(rng() * SIZE_PX, rng() * SIZE_PX, 1.2, 1.2);
    }
  });
}
