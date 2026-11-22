/*
 * PURPOSE:    Realistic mountain backdrop: a near range with domain-warped ridged peaks and a distant
 *             range that fades blue into the haze. Smooth normals; colours placed the way nature does:
 *             forest on low gentle slopes, alpine meadow above, bare rock on steep faces, snow only on
 *             high, gentler slopes. A tiling rock-grain map and detail normal map add surface relief.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, src/utils/noise.js, src/config.js (SCENERY), src/render/texPaving.js (normalFromHeight)
 * UNITS:      metres.
 */
import * as THREE from 'three';
import { ridged, fbm } from '../utils/noise.js';
import { SCENERY } from '../config.js';
import { normalFromHeight } from './texPaving.js';
import { createRng } from '../utils/rng.js';

const C = {
  forest: new THREE.Color('#2f4527'), meadow: new THREE.Color('#5f7440'),
  rock: new THREE.Color('#6f6a62'), darkRock: new THREE.Color('#4c4944'), snow: new THREE.Color('#f2f5f8'),
};

// Smoothstep from a to b
function smooth(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

// Takes x, z, ring radii and peak (m); returns height. Domain warp bends ridgelines naturally.
function ridgeHeight(x, z, r0, r1, peak, seed, scale) {
  const t = (Math.hypot(x, z) - r0) / (r1 - r0);
  const envelope = Math.sin(Math.min(Math.max(t, 0), 1) * Math.PI * 0.9) ** 0.8;
  const wx = x + 180 * (fbm(x * 0.002, z * 0.002, 3, seed) - 0.5);
  const wz = z + 180 * (fbm(x * 0.002 + 7, z * 0.002 + 3, 3, seed) - 0.5);
  return peak * envelope * (0.2 + 0.8 * ridged(wx * scale, wz * scale, 6, seed)) - 8;
}

// Colour from height share, slope (0 flat .. 1 vertical) and a little noise, blended smoothly
function landColour(h, peak, slope, n, out, tmp) {
  const share = h / peak + (n - 0.5) * 0.12;
  out.copy(C.forest).lerp(tmp.copy(C.meadow), smooth(0.18, 0.35, share));
  out.lerp(tmp.copy(C.rock), Math.max(smooth(0.38, 0.55, share), smooth(0.35, 0.6, slope)));
  out.lerp(tmp.copy(C.darkRock), smooth(0.6, 0.85, slope) * 0.7);
  const snow = smooth(SCENERY.snowLineFraction - 0.05, SCENERY.snowLineFraction + 0.06, share) * (1 - smooth(0.45, 0.7, slope));
  return out.lerp(tmp.copy(C.snow), snow);
}

// Builds one ring mesh (indexed, smooth normals, vertex colours, world-space UVs for detail maps)
function ringMesh(r0, r1, peak, seed, scale, radialSegs, angularSegs, material) {
  const cols = angularSegs + 1;
  const count = (radialSegs + 1) * cols;
  const pos = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  let k = 0;
  for (let i = 0; i <= radialSegs; i++) {
    const r = r0 + ((r1 - r0) * i) / radialSegs;
    for (let j = 0; j < cols; j++) {
      const a = (j / angularSegs) * Math.PI * 2;
      const [x, z] = [r * Math.cos(a), r * Math.sin(a)];
      pos.set([x, ridgeHeight(x, z, r0, r1, peak, seed, scale), z], k * 3);
      uv.set([x / 30, z / 30], k * 2);
      k++;
    }
  }
  const index = [];
  for (let i = 0; i < radialSegs; i++) {
    for (let j = 0; j < angularSegs; j++) {
      const a = i * cols + j;
      index.push(a, a + 1, a + cols, a + cols, a + 1, a + cols + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();

  // Colour each vertex from its height, its slope (from the smooth normal) and noise
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(count * 3);
  const out = new THREE.Color();
  const tmp = new THREE.Color();
  for (let v = 0; v < count; v++) {
    const [x, y, z] = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    landColour(y, peak, 1 - nrm.getY(v), fbm(x * 0.01, z * 0.01, 3, seed + 4), out, tmp).toArray(colors, v * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Mesh(geo, material);
}

// Tiling rock grain: { map, normalMap } from fBm noise (adds surface texture at close range)
function rockDetail() {
  const size = 256;
  const height = new Float32Array(size * size);
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  // Isotropic grain: soft stones and grit of three sizes, wrapped at the edges so the tile is seamless
  const rng = createRng(SCENERY.seed + 71);
  const field = Object.assign(document.createElement('canvas'), { width: size, height: size }).getContext('2d');
  field.fillStyle = '#808080';
  field.fillRect(0, 0, size, size);
  for (const [count, radius, alpha] of [[90, 14, 0.18], [500, 5, 0.22], [3000, 1.5, 0.3]]) {
    for (let i = 0; i < count; i++) {
      const [x, y, r] = [rng() * size, rng() * size, radius * (0.5 + rng())];
      field.fillStyle = rng() < 0.5 ? `rgba(30,30,30,${alpha})` : `rgba(230,230,230,${alpha})`;
      for (const dx of [-size, 0, size]) {
        for (const dy of [-size, 0, size]) {
          field.beginPath();
          field.arc(x + dx, y + dy, r, 0, Math.PI * 2);
          field.fill();
        }
      }
    }
  }
  const src = field.getImageData(0, 0, size, size).data;
  for (let i = 0; i < size * size; i++) {
    height[i] = src[i * 4] / 255;
    const g = 205 + (height[i] - 0.5) * 70;
    img.data.set([g, g, g, 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, normalMap: normalFromHeight(height, size, size, 4) };
}

// Takes the scene; adds the near and far ranges (outside the shadow box, so no shadow casting)
export function createMountains(scene) {
  const detail = rockDetail();
  const near = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, ...detail,
    normalScale: new THREE.Vector2(0.6, 0.6) });
  const far = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  scene.add(ringMesh(SCENERY.mountainInnerRadiusM, SCENERY.mountainOuterRadiusM, SCENERY.mountainHeightM,
    SCENERY.seed + 99, 0.0026, 56, 420, near));
  const [f0, f1] = SCENERY.farRangeRadiusM;
  scene.add(ringMesh(f0, f1, SCENERY.farRangeHeightM, SCENERY.seed + 313, 0.0016, 24, 300, far));
}
