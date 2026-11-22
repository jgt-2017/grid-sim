/*
 * PURPOSE:    Procedural foliage textures with alpha: a broadleaf leaf cluster, a conifer needle
 *             branch, and tiling bark. Drawn once on canvases from a seeded RNG.
 * USED BY:    src/render/treeGeometry.js, src/render/trees.js
 * DEPENDS ON: three, src/utils/rng.js, src/config.js (SCENERY)
 * UNITS:      canvas pixels.
 */
import * as THREE from 'three';
import { createRng } from '../utils/rng.js';
import { SCENERY } from '../config.js';

// Takes size and draw(ctx, rng); returns an sRGB texture with mipmaps (transparent where not drawn)
function texture(w, h, draw, repeat = false) {
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  draw(canvas.getContext('2d'), createRng(SCENERY.seed + w + h));
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// One leaf: pointed ellipse with a lighter tip and a midrib
function leaf(ctx, x, y, size, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, -size, 0, size);
  g.addColorStop(0, color[0]);
  g.addColorStop(1, color[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(size * 0.55, 0, 0, size);
  ctx.quadraticCurveTo(-size * 0.55, 0, 0, -size);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 45, 20, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.9);
  ctx.lineTo(0, size * 0.9);
  ctx.stroke();
  ctx.restore();
}

// Broadleaf cluster: dense in the middle, ragged at the edge, with twigs showing through
export function leafClusterTexture() {
  const palette = [['#7fa04a', '#4c6b2a'], ['#6d8f3e', '#3f5a22'], ['#8bab55', '#56762f'], ['#5f8236', '#34501d']];
  return texture(512, 512, (ctx, rng) => {
    ctx.strokeStyle = '#4a3a28';
    ctx.lineWidth = 4;
    for (let k = 0; k < 5; k++) {                     // twigs
      ctx.beginPath();
      ctx.moveTo(256, 256);
      ctx.lineTo(256 + (rng() - 0.5) * 400, 256 + (rng() - 0.5) * 400);
      ctx.stroke();
    }
    for (let i = 0; i < 420; i++) {
      const r = 230 * Math.sqrt(rng()) * (0.6 + 0.4 * rng());   // more leaves toward the centre
      const a = rng() * Math.PI * 2;
      leaf(ctx, 256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 13 + rng() * 15, rng() * Math.PI * 2,
        palette[Math.floor(rng() * palette.length)]);
    }
  });
}

// Conifer branch: woody stem left to right with needles angled forward on both sides
export function needleBranchTexture() {
  return texture(512, 256, (ctx, rng) => {
    ctx.strokeStyle = '#4b3b2a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.lineTo(500, 128 + 10);
    ctx.stroke();
    const greens = ['#2f4a2a', '#3b5a31', '#264022', '#456738'];
    for (let x = 4; x < 500; x += 2.2) {
      const reach = 100 * (1 - x / 560);             // branch tapers toward the tip
      for (const side of [-1, 1]) {
        const len = reach * (0.5 + rng() * 0.5);
        ctx.strokeStyle = greens[Math.floor(rng() * greens.length)];
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, 128 + x * 0.02);
        ctx.lineTo(x + len * 0.45, 128 + x * 0.02 + side * len);
        ctx.stroke();
      }
    }
  });
}

// Bark: grey-brown base with vertical furrows and lichen flecks (tiles vertically)
export function barkTexture() {
  return texture(256, 512, (ctx, rng) => {
    ctx.fillStyle = '#5b4a3b';
    ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 160; i++) {
      const x = rng() * 256;
      ctx.strokeStyle = rng() < 0.5 ? 'rgba(35, 26, 18, 0.55)' : 'rgba(120, 104, 88, 0.35)';
      ctx.lineWidth = 1 + rng() * 4;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y <= 512; y += 32) ctx.lineTo(x + (rng() - 0.5) * 10, y);
      ctx.stroke();
    }
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = 'rgba(140, 150, 110, 0.35)';
      ctx.fillRect(rng() * 256, rng() * 512, 3 + rng() * 6, 2 + rng() * 4);
    }
  }, true);
}
