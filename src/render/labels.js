/*
 * PURPOSE:    In-world text: floating zone signs (sprites, redrawn only when text changes) and
 *             flat text plates for equipment labels (87T, 50/51, 52).
 * USED BY:    src/render/world.js, src/render/substation.js
 * DEPENDS ON: three, src/config.js (COLORS)
 * UNITS:      sizes in metres.
 */
import * as THREE from 'three';
import { COLORS } from '../config.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SIGN_W_PX = 512;
const SIGN_H_PX = 150;

// Takes { title, accentColor, widthM }; returns { sprite, setText(title, line2) }
export function createSign({ title, accentColor, widthM = 26 }) {
  const canvas = document.createElement('canvas');
  canvas.width = SIGN_W_PX;
  canvas.height = SIGN_H_PX;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, fog: false, depthWrite: false, depthTest: false, toneMapped: false }));
  sprite.scale.set(widthM, (widthM * SIGN_H_PX) / SIGN_W_PX, 1);
  sprite.renderOrder = 10;

  let lastText = '';
  // Redraws the canvas only when the text changed (texture uploads are the expensive part)
  function setText(heading, detail) {
    const key = `${heading}|${detail}`;
    if (key === lastText) return;
    lastText = key;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, SIGN_W_PX, SIGN_H_PX);
    ctx.fillStyle = 'rgba(26,26,25,0.82)';
    ctx.beginPath();
    ctx.roundRect(4, 4, SIGN_W_PX - 8, SIGN_H_PX - 8, 18);
    ctx.fill();
    ctx.fillStyle = accentColor;
    ctx.fillRect(22, 26, 8, SIGN_H_PX - 52);
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = `600 34px ${FONT}`;
    ctx.textBaseline = 'top';
    ctx.fillText(heading, 46, 22, SIGN_W_PX - 64);
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = `700 46px ${FONT}`;
    ctx.fillText(detail, 46, 68, SIGN_W_PX - 64);
    texture.needsUpdate = true;
  }
  setText(title, '');
  return { sprite, setText };
}

// Takes text, plate width/height (m), colours; returns a double-sided text plate mesh
export function createTextPlate(text, widthM, heightM, { background = '#f2efe6', ink = '#1a1a19' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = Math.round((256 * heightM) / widthM);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = ink;
  ctx.font = `700 ${Math.round(canvas.height * 0.6)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(widthM, heightM),
    new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: 0.8 }),
  );
}
