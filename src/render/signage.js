/*
 * PURPOSE:    Real-world signage: entrance boards at each zone (maker wordmark, asset, ratings),
 *             transparent wordmark decals for equipment (e.g. on a nacelle), and the data center
 *             facade sign that follows the selected rack profile.
 * USED BY:    src/render/world.js, src/render/windFarm.js, src/render/dataCenter.js
 * DEPENDS ON: three, src/render/texEquipment.js (canvasTexture, FONT), src/config.js (COLORS)
 * UNITS:      metres; canvas pixels inside textures.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture, FONT } from './texEquipment.js';
import { COLORS } from '../config.js';

const BOARD_W_M = 7;
const BOARD_H_M = 3.6;

// Takes a wordmark, its size (m) and { color, weight, spacingPx }; returns a transparent text plane
export function createDecal(text, widthM, heightM, { color = '#1f2124', weight = 700, spacingPx = 0 } = {}) {
  const pxW = 512;
  const pxH = Math.round((pxW * heightM) / widthM);
  const map = canvasTexture(pxW, pxH, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${Math.round(h * 0.7)}px ${FONT}`;
    ctx.letterSpacing = `${spacingPx}px`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2, w * 0.96);
  });
  const material = new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.6, depthWrite: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(widthM, heightM), material);
}

// Draws a board face: maker band (optional, in accent colour), title, detail lines
function drawBoard(ctx, w, h, { maker, accent, title, lines }) {
  ctx.fillStyle = '#1d1f22';
  ctx.fillRect(0, 0, w, h);
  let y = 30;
  if (maker) {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, 120);
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 78px ${FONT}`;
    ctx.letterSpacing = '6px';
    ctx.fillText(maker, 40, 92, w - 80);
    ctx.letterSpacing = '0px';
    y = 150;
  }
  ctx.fillStyle = '#f0efec';
  ctx.font = `700 64px ${FONT}`;
  ctx.fillText(title, 40, y + 60, w - 80);
  ctx.fillStyle = '#c3c2b7';
  ctx.font = `500 42px ${FONT}`;
  lines.forEach((line, i) => ctx.fillText(line, 40, y + 130 + i * 56, w - 80));
}

// Takes { maker, accent, title, lines }; returns a board on two posts (group, origin at ground)
export function createEntranceBoard(content) {
  const group = new THREE.Group();
  const map = canvasTexture(1024, 528, (ctx, w, h) => drawBoard(ctx, w, h, content));
  const face = new THREE.MeshStandardMaterial({ map, roughness: 0.5 });
  const back = new THREE.MeshStandardMaterial({ color: '#2a2c2f', roughness: 0.6 });
  // Box faces: +z gets the printed face, the rest are plain
  const board = new THREE.Mesh(new RoundedBoxGeometry(BOARD_W_M, BOARD_H_M, 0.15, 1, 0.05),
    [back, back, back, back, face, back]);
  board.position.y = 1.2 + BOARD_H_M / 2;
  board.castShadow = true;
  group.add(board);
  const postMat = new THREE.MeshStandardMaterial({ color: '#5f6366', metalness: 0.6, roughness: 0.4 });
  for (const x of [-BOARD_W_M * 0.35, BOARD_W_M * 0.35]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.3, 0.18), postMat);
    post.position.set(x, 0.65, 0);
    post.castShadow = true;
    group.add(post);
  }
  return group;
}

// Takes facade sign size (m); returns { mesh, setProfile(profile, rackCount) } — redraws on change
export function createFacadeSign(widthM, heightM, accent, maker) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.round((1024 * heightM) / widthM);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffffff',
    emissiveIntensity: 0.35, roughness: 0.4 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, heightM), material);

  let shown = '';
  function setProfile(profile, rackCount) {
    const key = `${profile.label}|${rackCount}`;
    if (key === shown) return;
    shown = key;
    const ctx = canvas.getContext('2d');
    const { width: w, height: h } = canvas;
    ctx.fillStyle = '#101214';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent;
    ctx.fillRect(30, h * 0.58, w * 0.35, 6);                 // accent rule under the name
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(h * 0.36)}px ${FONT}`;
    ctx.letterSpacing = '8px';
    ctx.textBaseline = 'middle';
    ctx.fillText(maker, 30, h * 0.34, w * 0.62);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = '#f0efec';
    ctx.font = `600 ${Math.round(h * 0.2)}px ${FONT}`;
    const gpus = (rackCount * profile.gpusPerRack).toLocaleString('en-US');
    ctx.fillText(`${profile.label} · ${rackCount} racks · ${gpus} GPUs`, 30, h * 0.8, w - 60);
    if (!profile.confirmed) {
      ctx.fillStyle = COLORS.warning;
      ctx.font = `700 ${Math.round(h * 0.16)}px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText('⚠ UNCONFIRMED', w - 30, h * 0.36);
      ctx.textAlign = 'left';
    }
    map.needsUpdate = true;
  }
  return { mesh, setProfile };
}

export { BOARD_W_M };
