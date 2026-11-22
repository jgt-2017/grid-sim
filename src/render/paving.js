/*
 * PURPOSE:    Constructed ground for the campus: jointed concrete slabs draped over the terrain out
 *             to WORLD.pavedHalfM (with a concrete edge kerb), asphalt roads with lane markings, a
 *             plain-asphalt intersection and zebra crossings. Grass remains outside the campus.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, src/config.js (WORLD, SCENERY), src/render/texPaving.js, src/render/texConcrete.js,
 *             src/render/texGround.js,
 *             src/render/terrain.js (heightAt), src/utils/noise.js
 * UNITS:      metres.
 */
import * as THREE from 'three';
import { WORLD, SCENERY } from '../config.js';
import { roadTextures } from './texPaving.js';
import { concreteTextures } from './texConcrete.js';
import { asphaltTexture } from './texGround.js';
import { heightAt } from './terrain.js';
import { fbm } from '../utils/noise.js';

const SLABS_PER_TILE = 4;      // one concrete texture tile = 4 x 4 slabs
const ROAD_TILE_M = 12;        // one road texture tile covers 12 m of road
const ROAD_Y_M = 0.08;         // road surface just above the slabs
const CURB_GAP_M = 0.2;        // clearance between the road edge and the kerb

// Clones a { map, normalMap, roughnessMap } set with its own repeat
function withRepeat(set, u, v) {
  const out = {};
  for (const [key, tex] of Object.entries(set)) {
    out[key] = tex.clone();
    out[key].repeat.set(u, v);
    out[key].needsUpdate = true;
  }
  return out;
}

// Concrete slabs draped over the terrain (follows the gentle ridge under the turbines)
function addSlabs(scene) {
  const size = WORLD.pavedHalfM * 2;
  const geometry = new THREE.PlaneGeometry(size, size, 90, 90);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z) + 0.02);
    // Large-scale tone drift so the texture tiling is not visible
    const k = 0.93 + 0.1 * fbm(x * 0.01, z * 0.01, 3, SCENERY.seed + 11);
    colors.set([k, k, k], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const tiles = size / (WORLD.slabM * SLABS_PER_TILE);
  const maps = withRepeat(concreteTextures({ slabsPerTile: SLABS_PER_TILE }), tiles, tiles);
  // polygonOffset pushes the slabs back in depth so pads and roads on top never flicker
  const material = new THREE.MeshStandardMaterial({ ...maps, vertexColors: true, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
  const slabs = new THREE.Mesh(geometry, material);
  slabs.receiveShadow = true;
  scene.add(slabs);

  // Edge kerb around the campus where paving meets grass
  const kerbMat = new THREE.MeshStandardMaterial({ color: '#bdbab2', roughness: 0.85 });
  const h = WORLD.pavedHalfM;
  for (const [x, z, sx, sz] of [[0, -h, size, 0.4], [0, h, size, 0.4], [-h, 0, 0.4, size], [h, 0, 0.4, size]]) {
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.25, sz), kerbMat);
    kerb.position.set(x, heightAt(x, z) + 0.12, z);
    kerb.receiveShadow = true;
    scene.add(kerb);
  }
}

// One road strip: length along x (eastWest) or z (northSouth), centred at (cx, cz)
function addRoad(scene, textures, cx, cz, lengthM, alongZ) {
  const { widthM } = WORLD.roads;
  const maps = withRepeat(textures, lengthM / ROAD_TILE_M, 1);
  const geometry = new THREE.PlaneGeometry(lengthM, widthM).rotateX(-Math.PI / 2);
  if (alongZ) geometry.rotateY(Math.PI / 2);
  const road = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ ...maps, roughness: 1 }));
  road.position.set(cx, ROAD_Y_M, cz);
  road.receiveShadow = true;
  scene.add(road);
}

// Plain asphalt over the crossing (covers the lane markings) plus zebra crossings on each approach
function addIntersection(scene, x, z) {
  const w = WORLD.roads.widthM;
  const map = asphaltTexture().clone();
  map.repeat.set(1, 1);
  map.needsUpdate = true;
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, w + 0.6).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
  patch.position.set(x, ROAD_Y_M + 0.01, z);
  patch.receiveShadow = true;
  scene.add(patch);

  // Zebra stripes: 0.5 m bars across each approach, 2.5 m beyond the crossing edge
  const stripes = [];
  for (const dir of [-1, 1]) {
    for (let k = -3; k <= 3; k++) {
      stripes.push([x + dir * (w / 2 + 2.5), z + k * 1.0, 3, 0.5]);   // on the east-west road
      stripes.push([x + k * 1.0, z + dir * (w / 2 + 2.5), 0.5, 3]);   // on the north-south road
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.01, 1),
    new THREE.MeshStandardMaterial({ color: '#ecebe4', roughness: 0.6 }), stripes.length);
  const m = new THREE.Matrix4();
  stripes.forEach(([sx, sz, lx, lz], i) => {
    m.makeScale(lx, 1, lz).setPosition(sx, ROAD_Y_M + 0.02, sz);
    mesh.setMatrixAt(i, m);
  });
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// Takes the scene; adds slabs, kerb, roads and the intersection
export function createPaving(scene) {
  addSlabs(scene);
  const { eastWest: ew, northSouth: ns } = WORLD.roads;
  const textures = roadTextures(ROAD_TILE_M, WORLD.roads.widthM);
  addRoad(scene, textures, (ew.fromX + ew.toX) / 2, ew.z, ew.toX - ew.fromX, false);
  addRoad(scene, textures, ns.x, (ns.fromZ + ns.toZ) / 2, ns.toZ - ns.fromZ, true);
  addIntersection(scene, ns.x, ew.z);
}

export { CURB_GAP_M, ROAD_Y_M };
