/*
 * PURPOSE:    The forest beyond the campus (and the street trees in planters): realistic conifers and
 *             broadleaf trees from bark + alpha-cut foliage cards, instanced (2 draw calls per species),
 *             with per-tree size, yaw and tint, leaf-shaped shadows, and a gentle wind sway in the
 *             vertex shader. Placement is seeded and keeps clear of the campus, cables, the grid line
 *             and the walk spawn points.
 * USED BY:    src/render/world.js, src/render/streetscape.js (createSpeciesMeshes)
 * DEPENDS ON: three, src/utils/rng.js, src/config.js (WORLD, SCENERY), src/render/terrain.js,
 *             src/render/treeGeometry.js, src/render/texFoliage.js, src/render/colliders.js
 * UNITS:      metres, seconds.
 */
import * as THREE from 'three';
import { createRng } from '../utils/rng.js';
import { WORLD, SCENERY } from '../config.js';
import { heightAt } from './terrain.js';
import { broadleafGeometries, coniferGeometries } from './treeGeometry.js';
import { leafClusterTexture, needleBranchTexture, barkTexture } from './texFoliage.js';
import { circle } from './colliders.js';

const CONIFER_SHARE = 0.55;
const CLEARANCE_M = { cable: 6, turbine: 25, spawn: 30, gridLine: 14 };
const sway = { uTime: { value: 0 } };        // shared wind clock for every tree material

// Adds a height-weighted sway to a material's vertex shader (also used for the shadow pass)
function withSway(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sway.uTime;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 seedXZ = instanceMatrix[3].xz;
      #else
        vec2 seedXZ = vec2(0.0);
      #endif
      float bend = max(position.y - 1.5, 0.0) * 0.014;
      transformed.x += sin(uTime * 1.3 + seedXZ.x * 0.07) * bend;
      transformed.z += cos(uTime * 1.1 + seedXZ.y * 0.09) * bend;`);
  };
  return material;
}

// Lazily built shared materials and geometries (built once, reused by forest and planters)
let shared = null;
function sharedAssets() {
  if (shared) return shared;
  const bark = barkTexture();
  bark.repeat.set(2, 3);
  const wood = withSway(new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 }));
  const foliage = (map) => ({
    material: withSway(new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 })),
    depth: withSway(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45 })),
  });
  shared = {
    wood,
    broadleaf: { geo: broadleafGeometries(), ...foliage(leafClusterTexture()) },
    conifer: { geo: coniferGeometries(), ...foliage(needleBranchTexture()) },
  };
  return shared;
}

// Takes 'broadleaf' | 'conifer' and a capacity; returns { meshes, set(i, matrix, tint), finish(count) }
export function createSpeciesMeshes(kind, capacity) {
  const assets = sharedAssets();
  const sp = assets[kind];
  const wood = new THREE.InstancedMesh(sp.geo.wood, assets.wood, capacity);
  const leaves = new THREE.InstancedMesh(sp.geo.leaves, sp.material, capacity);
  leaves.customDepthMaterial = sp.depth;      // shadows follow the leaf texture, not the cards
  for (const mesh of [wood, leaves]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  return {
    meshes: [wood, leaves],
    set(i, matrix, tint) {
      wood.setMatrixAt(i, matrix);
      leaves.setMatrixAt(i, matrix);
      leaves.setColorAt(i, tint);
    },
    finish(count) {
      wood.count = leaves.count = count;
    },
  };
}

// Distance from point p to segment a-b on the ground plane
function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

// Takes x, z (m); true when a forest tree may stand there (never on the paved campus)
function isClear(x, z) {
  if (Math.max(Math.abs(x), Math.abs(z)) < WORLD.pavedHalfM + 8) return false;
  for (const [tx, tz] of WORLD.windTurbines) if (Math.hypot(x - tx, z - tz) < CLEARANCE_M.turbine) return false;
  for (const zone of Object.values(WORLD.zones)) {
    const [sx, sz] = zone.spawn;
    if (distToSegment(x, z, sx, sz, zone.lookAt[0], zone.lookAt[2]) < CLEARANCE_M.spawn / 2) return false;
  }
  if (Math.abs(x) < CLEARANCE_M.gridLine && z < -15) return false;
  for (const route of Object.values(WORLD.cables)) {
    for (let k = 0; k < route.length - 1; k++) {
      const [a, b] = [route[k], route[k + 1]];
      if (distToSegment(x, z, a[0], a[a.length - 1], b[0], b[b.length - 1]) < CLEARANCE_M.cable) return false;
    }
  }
  return true;
}

// Takes the scene; plants the forest; returns { colliders, update(timeSec) }
export function createTrees(scene) {
  const rng = createRng(SCENERY.seed + 1);
  const species = [createSpeciesMeshes('conifer', SCENERY.treeCount), createSpeciesMeshes('broadleaf', SCENERY.treeCount)];
  const counts = [0, 0];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const tint = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  const colliders = [];
  for (let attempt = 0, placed = 0; attempt < SCENERY.treeCount * 8 && placed < SCENERY.treeCount; attempt++) {
    const r = WORLD.pavedHalfM + (SCENERY.treeMaxRadiusM - WORLD.pavedHalfM) * Math.sqrt(rng());
    const a = rng() * Math.PI * 2;
    const [x, z] = [r * Math.cos(a), r * Math.sin(a)];
    if (!isClear(x, z)) continue;
    const k = rng() < CONIFER_SHARE ? 0 : 1;
    const scale = 0.75 + rng() * 0.6;
    p.set(x, heightAt(x, z) - 0.15, z);
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    s.set(scale, scale * (0.85 + rng() * 0.3), scale);
    // Leaf tint: near-white multiplier with slight brightness and hue drift (yellower / bluer greens)
    tint.setHSL(0.2 + (rng() - 0.5) * 0.1, 0.3, 0.74 + rng() * 0.22);
    species[k].set(counts[k]++, m.compose(p, q, s), tint);
    colliders.push(circle(x, z, 0.5 * scale));
    placed++;
  }
  species.forEach((sp, k) => {
    sp.finish(counts[k]);
    scene.add(...sp.meshes);
  });
  return {
    colliders,
    update(timeSec) {
      sway.uTime.value = timeSec;
    },
  };
}
