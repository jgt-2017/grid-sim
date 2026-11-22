/*
 * PURPOSE:    Ground: textured, smooth-shaded terrain (flat inside the site, a ridge under the wind
 *             farm, natural noise-shaped hills outside the paved campus), plus the zone pads
 *             (crushed rock or polished concrete). Roads and campus paving: paving.js.
 * USED BY:    src/render/world.js; heightAt() also by controls.js, windFarm.js, gridLine.js,
 *             cables.js, trees.js; PADS by trees.js
 * DEPENDS ON: three, src/utils/noise.js, src/render/texGround.js, src/render/texPaving.js,
 *             src/config.js (SCENERY, WORLD)
 * UNITS:      metres.
 */
import * as THREE from 'three';
import { fbm } from '../utils/noise.js';
import { SCENERY, WORLD } from '../config.js';
import { grassTexture, gravelTexture } from './texGround.js';
import { concreteTextures } from './texPaving.js';

const GROUND_SIZE_M = 2700;    // reaches under the mountain ring
const GROUND_SEGMENTS = 170;
const GRASS_TILE_M = 9;        // one grass texture tile covers this many metres
const FLAT_HALF_M = 215;       // flat (apart from the wind ridge) inside this square: the paved campus
const RIDGE_Z_M = -135;        // wind ridge centre line
const RIDGE_HEIGHT_M = 6;

// Pads and roads: [centreX, centreZ, sizeX, sizeZ, surface]
export const PADS = [
  [0, 4, 56, 52, 'gravel'],          // substation: crushed rock inside the fence
  [-75, 78, 70, 46, 'concrete'],     // BESS yard: polished concrete equipment pad
  [105, 72, 90, 64, 'concrete'],     // data center: polished concrete apron
  [-110, -55, 128, 84, 'gravel'],    // solar field: gravel between the rows
];

// Takes ground x, z (m); returns terrain height (m). Deterministic.
export function heightAt(x, z) {
  // Gentle ridge under the turbines
  const ridge = RIDGE_HEIGHT_M * Math.exp(-((z - RIDGE_Z_M) ** 2) / 1600) * smooth(1 - Math.abs(x - 105) / 160);

  // Natural hills that fade in outside the flat site and grow with distance
  const outside = smooth((Math.max(Math.abs(x), Math.abs(z)) - FLAT_HALF_M) / 260);
  if (outside === 0) return ridge;
  const hills = 34 * (fbm(x * 0.0045, z * 0.0045, 4, SCENERY.seed) - 0.35);
  return ridge + outside * (hills + 16 * outside);
}

// Smoothstep on [0, 1]
function smooth(t) {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c);
}

// Takes the scene; adds terrain, pads and roads
export function createTerrain(scene) {
  const geometry = new THREE.PlaneGeometry(GROUND_SIZE_M, GROUND_SIZE_M, GROUND_SEGMENTS, GROUND_SEGMENTS);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const lush = new THREE.Color('#d9e8c4');      // multiplies the grass texture
  const dry = new THREE.Color('#e8dfb5');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Grass under the campus is sunk well below the concrete so it can never show through it
    const underPaving = Math.max(Math.abs(x), Math.abs(z)) <= WORLD.pavedHalfM;
    pos.setY(i, heightAt(x, z) - (underPaving ? 1.5 : 0));
    // Large patches of lusher / drier grass so the texture repeat is not obvious
    tmp.copy(lush).lerp(dry, fbm(x * 0.012, z * 0.012, 3, SCENERY.seed + 5));
    tmp.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const map = grassTexture();
  map.repeat.set(GROUND_SIZE_M / GRASS_TILE_M, GROUND_SIZE_M / GRASS_TILE_M);
  const ground = new THREE.Mesh(
    geometry,                                       // indexed: smooth, natural-looking hills
    new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 1 }),
  );
  ground.geometry.computeVertexNormals();
  // Grass lies outside the campus (paving receives the shadows); not receiving avoids a visible
  // line where the sun's shadow box ends
  ground.receiveShadow = false;
  scene.add(ground);
  addPads(scene);
}

// Pads under each zone: crushed-rock gravel or polished concrete (4 m joints)
function addPads(scene) {
  const gravel = { map: gravelTexture() };
  const concrete = concreteTextures({ slabsPerTile: 4, tone: [196, 194, 188], seed: 9, polished: true });
  const tileM = { gravel: 6, concrete: 16 };
  for (const [x, z, sx, sz, surface] of PADS) {
    const maps = {};
    for (const [key, tex] of Object.entries(surface === 'gravel' ? gravel : concrete)) {
      maps[key] = tex.clone();                     // own repeat per pad; image is shared
      maps[key].repeat.set(sx / tileM[surface], sz / tileM[surface]);
      maps[key].needsUpdate = true;
    }
    const material = new THREE.MeshStandardMaterial({ ...maps, roughness: 1, metalness: 0 });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.2, sz), material);
    pad.position.set(x, 0.05, z);
    pad.receiveShadow = true;
    scene.add(pad);
  }
}
