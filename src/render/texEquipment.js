/*
 * PURPOSE:    Procedural canvas textures for equipment: PV modules, Megapack-style cabinet faces
 *             and roof, metal wall cladding, and GPU rack fronts (with a matching glow map).
 * USED BY:    src/render/solarSite.js, src/render/bessYard.js, src/render/dataCenter.js,
 *             src/render/dataCenterRacks.js
 * DEPENDS ON: three
 * UNITS:      canvas pixels; each texture maps onto one face of known size (noted per function).
 */
import * as THREE from 'three';

const FONT = 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif';

// Takes width, height (px) and draw(ctx, w, h); returns an sRGB CanvasTexture
function canvasTexture(w, h, draw, srgb = true) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// PV table top (6.5 x 3.2 m): 2 rows x 6 modules, each a grid of dark cells in an aluminium frame
export function pvTableTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c4c8cc';                       // frame / gaps
    ctx.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 2;
    const mw = w / cols;
    const mh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = c * mw + 3;
        const y0 = r * mh + 3;
        ctx.fillStyle = '#17233d';
        ctx.fillRect(x0, y0, mw - 6, mh - 6);
        // Cell grid: thin lighter lines between cells
        ctx.strokeStyle = 'rgba(150, 170, 200, 0.35)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 6; i++) line(ctx, x0 + (i * (mw - 6)) / 6, y0, x0 + (i * (mw - 6)) / 6, y0 + mh - 6);
        for (let j = 1; j < 10; j++) line(ctx, x0, y0 + (j * (mh - 6)) / 10, x0 + mw - 6, y0 + (j * (mh - 6)) / 10);
      }
    }
  });
}

// Cabinet long side (7.168 x 2.522 m, per datasheet photo): louvred thermal band along the top,
// eight tall white doors with angled handles, small red maker wordmark top-left, plinth
export function cabinetSideTexture(maker = '') {
  return canvasTexture(1024, 360, (ctx, w, h) => {
    ctx.fillStyle = '#eeeeeb';
    ctx.fillRect(0, 0, w, h);
    const band = h * 0.13;                          // thermal system intake band
    ctx.fillStyle = '#c4c6c4';
    ctx.fillRect(w * 0.2, 6, w * 0.78, band);
    ctx.fillStyle = '#8e918f';
    for (let x = w * 0.2 + 4; x < w * 0.98; x += 7) ctx.fillRect(x, 10, 3, band - 8);
    if (maker) {
      ctx.fillStyle = '#c8102e';
      ctx.font = `700 26px ${FONT}`;
      ctx.letterSpacing = '6px';
      ctx.fillText(maker, 24, band * 0.75 + 6);
      ctx.letterSpacing = '0px';
    }
    const doors = 8;
    for (let d = 0; d < doors; d++) {
      const x = (d * w) / doors;
      ctx.fillStyle = '#cfd0cc';
      ctx.fillRect(x, band + 10, 3, h - band - 26);  // door seam
      ctx.save();                                     // angled handle, as on the unit
      ctx.translate(x + w / doors - 26, h * 0.52);
      ctx.rotate(0.35);
      ctx.fillStyle = '#a3a5a2';
      ctx.fillRect(0, 0, 5, 36);
      ctx.restore();
    }
    ctx.fillStyle = '#9fa19d';
    ctx.fillRect(0, h - 16, w, 16);                   // plinth / base frame
  });
}

// Cabinet end (1.7 x 2.6 m): maker wordmark and model text, small service panel
export function cabinetEndTexture(maker, model) {
  return canvasTexture(256, 392, (ctx, w, h) => {
    ctx.fillStyle = '#ecece8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2b2c2e';
    ctx.textAlign = 'center';
    ctx.font = `700 40px ${FONT}`;
    ctx.letterSpacing = '10px';
    ctx.fillText(maker, w / 2 + 5, 86);
    ctx.letterSpacing = '0px';
    ctx.font = `500 22px ${FONT}`;
    ctx.fillStyle = '#5a5b5e';
    ctx.fillText(model, w / 2, 124);
    ctx.strokeStyle = '#b5b6b2';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 180, w - 80, 150);           // service panel
  });
}

// Cabinet roof (1.66 x 7.17 m): light grey cap with the thermal system's slatted exhaust grille
export function cabinetRoofTexture() {
  return canvasTexture(128, 512, (ctx, w, h) => {
    ctx.fillStyle = '#d7d8d5';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9da09d';
    for (let y = h * 0.22; y < h * 0.96; y += 6) ctx.fillRect(10, y, w - 20, 3);
  });
}

// Metal wall cladding: light grey panels with vertical seams; tile it with texture.repeat
export function claddingTexture() {
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#cfd2d0';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      ctx.fillStyle = '#b4b8b6';
      ctx.fillRect(x, 0, 2, h);
      ctx.fillStyle = '#dde0de';
      ctx.fillRect(x + 2, 0, 2, h);
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function line(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

export { canvasTexture, FONT };
