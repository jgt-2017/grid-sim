/*
 * PURPOSE:    Cable runs from each asset to its bus tap, with glowing flow particles. Particle speed
 *             and size grow with |MW|; direction follows the sign (toward the bus = injecting).
 *             All particles of all cables are one InstancedMesh: one draw call, no per-frame allocation.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, src/config.js (WORLD, COLORS, HUD), src/model/feeders.js, src/render/terrain.js
 * UNITS:      metres, m/s for particle speed, MW from state.
 */
import * as THREE from 'three';
import { WORLD, COLORS, HUD } from '../config.js';
import { feederIntoBusMw } from '../model/feeders.js';
import { heightAt } from './terrain.js';

const GROUND_CLEARANCE_M = 0.45;  // buried-cable marker height above ground
const STEP_M = 4;                 // resample spacing so ground cables follow the terrain
const PARTICLE_RADIUS_M = 0.32;

// Takes a route of [x, z] or [x, y, z] points; returns { points: Vector3[], cum: Float32Array, length }
function buildPath(route) {
  const raw = route.map((p) => (p.length === 3
    ? new THREE.Vector3(p[0], p[1], p[2])
    : new THREE.Vector3(p[0], NaN, p[1])));      // NaN y = follow the ground
  const points = [];
  for (let k = 0; k < raw.length - 1; k++) {
    const a = raw[k];
    const b = raw[k + 1];
    const horizontalM = Math.hypot(b.x - a.x, b.z - a.z);   // ground points have no y yet
    const n = Math.max(1, Math.ceil(horizontalM / STEP_M));
    for (let s = 0; s < n; s++) points.push(lerpPoint(a, b, s / n));
  }
  points.push(lerpPoint(raw[raw.length - 1], raw[raw.length - 1], 0));
  const cum = new Float32Array(points.length);
  for (let i = 1; i < points.length; i++) cum[i] = cum[i - 1] + points[i].distanceTo(points[i - 1]);
  return { points, cum, length: cum[cum.length - 1] };
}

// Interpolates two route points; ground-following points take terrain height + clearance
function lerpPoint(a, b, t) {
  const x = a.x + (b.x - a.x) * t;
  const z = a.z + (b.z - a.z) * t;
  const y = Number.isNaN(a.y) ? heightAt(x, z) + GROUND_CLEARANCE_M : a.y + (b.y - a.y) * t;
  return new THREE.Vector3(x, y, z);
}

// Takes a path and a distance along it (m); writes the point into out
function pointAt(path, d, out) {
  let i = 1;
  while (i < path.cum.length - 1 && path.cum[i] < d) i++;
  const segLen = path.cum[i] - path.cum[i - 1] || 1;
  out.lerpVectors(path.points[i - 1], path.points[i], (d - path.cum[i - 1]) / segLen);
}

// Takes the scene; returns { update(state, dtSec) }
export function createCables(scene) {
  const keys = Object.keys(WORLD.cables);
  const n = WORLD.particlesPerCable;
  const cables = keys.map((key) => ({ key, path: buildPath(WORLD.cables[key]), phase: 0 }));

  // Static cable lines (thin, coloured by asset)
  for (const c of cables) {
    const material = new THREE.LineBasicMaterial({ color: COLORS[c.key], transparent: true, opacity: 0.55 });
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.path.points), material));
  }

  // One instanced mesh for every particle; colour per instance = asset colour
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(PARTICLE_RADIUS_M, 8, 6),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    keys.length * n,
  );
  const color = new THREE.Color();
  cables.forEach((c, k) => {
    color.set(COLORS[c.key]).multiplyScalar(6);     // HDR-bright so bloom makes it glow
    for (let i = 0; i < n; i++) mesh.setColorAt(k * n + i, color);
  });
  mesh.frustumCulled = false;
  scene.add(mesh);

  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  return {
    update(state, dtSec) {
      for (let k = 0; k < cables.length; k++) {
        const c = cables[k];
        // Route runs asset -> bus, so positive "into bus" MW moves particles forward
        const mw = feederIntoBusMw(state, c.key);
        const frac = Math.min(Math.abs(mw) / HUD.sldFullScaleMw, 1);
        const speed = Math.sign(mw) * (WORLD.particleBaseSpeedMs + WORLD.particleSpeedPerMw * Math.abs(mw));
        c.phase = (c.phase + speed * dtSec + c.path.length) % c.path.length;
        const size = Math.abs(mw) < 0.01 ? 0 : 0.6 + 0.9 * frac;   // hide particles when idle
        s.setScalar(size);
        const spacing = c.path.length / n;
        for (let i = 0; i < n; i++) {
          pointAt(c.path, (c.phase + i * spacing) % c.path.length, p);
          mesh.setMatrixAt(k * n + i, m.compose(p, q, s));
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
