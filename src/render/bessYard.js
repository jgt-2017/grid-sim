/*
 * PURPOSE:    BESS yard: 16 Megapack-style enclosures at datasheet size (7168 x 1659 x 2522 mm) in two
 *             blocks of 8, with door / louvre sides, maker wordmark, slatted thermal roof, a status lamp
 *             per unit that glows with battery power, and a SOC gauge per block.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, src/config.js (WORLD, BESS, MEGAPACK, BRANDS, COLORS), src/render/texEquipment.js,
 *             src/render/signage.js (createDecal)
 * UNITS:      metres; SOC 0-1 and MW from state.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WORLD, BESS, MEGAPACK, BRANDS, COLORS } from '../config.js';
import { cabinetSideTexture, cabinetEndTexture, cabinetRoofTexture } from './texEquipment.js';
import { createDecal } from './signage.js';
import { aabb, circle } from './colliders.js';

// Enclosure from the datasheet: W 7168 (long axis, north-south), D 1659, H 2522 mm
const UNIT_SIZE_M = [MEGAPACK.dimsMm[1] / 1000, MEGAPACK.dimsMm[2] / 1000 - 0.06, MEGAPACK.dimsMm[0] / 1000];
const ROOF_H_M = 0.06;                 // thin cap; total height matches the datasheet
const UNIT_PITCH_X_M = 3.4;            // side-by-side spacing (service clearance)
const UNIT_PITCH_Z_M = 9;
const UNITS_ACROSS = 4;                // per row; two rows per block -> 8 per block
const GAUGE_HEIGHT_M = 9;
const GAUGE_WIDTH_M = 2.4;

// Takes the scene; returns { update(state, dtSec, timeSec) }
export function createBessYard(scene) {
  const { center, unitsPerBlock, blockGapM } = WORLD.bessYard;
  const blockWidthM = UNITS_ACROSS * UNIT_PITCH_X_M;
  const blockCentersX = [center[0] - (blockWidthM + blockGapM) / 2, center[0] + (blockWidthM + blockGapM) / 2];
  const lampMat = addCabinets(scene, blockCentersX, center, unitsPerBlock);

  const gaugeZ = center[1] + UNIT_PITCH_Z_M + 3;
  const gauges = blockCentersX.map((bx, k) => createGauge(scene, bx, gaugeZ, `BLOCK ${'AB'[k] ?? k + 1}`));
  addPcsSkid(scene);
  const colliders = blockCentersX.map((bx) => aabb(bx, center[1], blockWidthM / 2, (UNIT_PITCH_Z_M + UNIT_SIZE_M[2]) / 2));
  for (const bx of blockCentersX) colliders.push(circle(bx, gaugeZ, 1.6));
  colliders.push(aabb(WORLD.cables.bess[0][0] - 2, WORLD.cables.bess[0][1], 2.2, 3.2));

  return {
    colliders,
    update(state, dtSec, timeSec) {
      // Lamps: brightness follows |battery MW|; a slow pulse shows it is active
      const frac = (state.pBessDisMw + state.pBessChgMw) / BESS.powerMw;
      lampMat.emissiveIntensity = 0.3 + 7 * frac * (0.85 + 0.15 * Math.sin(timeSec * 4));
      for (let g = 0; g < gauges.length; g++) {
        gauges[g].fill.scale.y = Math.max(state.soc, 0.001);
        gauges[g].fill.position.y = gauges[g].baseY + (GAUGE_HEIGHT_M * state.soc) / 2;
      }
    },
  };
}

// Places every cabinet (enclosure, roof, a status lamp on both ends): per block, two rows of four.
// Returns the shared lamp material so the yard can make the lamps glow with battery power.
function addCabinets(scene, blockCentersX, center, unitsPerBlock) {
  const count = blockCentersX.length * unitsPerBlock;
  // Enclosure faces: +x/-x long sides, +y top, -y bottom, +z/-z ends (box face order)
  const side = new THREE.MeshStandardMaterial({ map: cabinetSideTexture(BRANDS.bess.maker), roughness: 0.5 });
  const end = new THREE.MeshStandardMaterial({ map: cabinetEndTexture(BRANDS.bess.maker, BRANDS.bess.model), roughness: 0.55 });
  const plain = new THREE.MeshStandardMaterial({ color: '#e6e6e2', roughness: 0.6 });
  const roofTop = new THREE.MeshStandardMaterial({ map: cabinetRoofTexture(), roughness: 0.7, metalness: 0.2 });
  const roofSide = new THREE.MeshStandardMaterial({ color: '#cfd0cd', roughness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: '#222', emissive: COLORS.bess, emissiveIntensity: 0.3 });
  const bodies = new THREE.InstancedMesh(new RoundedBoxGeometry(...UNIT_SIZE_M, 1, 0.06), [side, side, plain, plain, end, end], count);
  const roofs = new THREE.InstancedMesh(new RoundedBoxGeometry(UNIT_SIZE_M[0] + 0.05, ROOF_H_M, UNIT_SIZE_M[2] - 0.2, 1, 0.08),
    [roofSide, roofSide, roofTop, roofSide, roofSide, roofSide], count);
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.12, 0.06), lampMat, count * 2);
  const m = new THREE.Matrix4();
  let i = 0;
  for (const bx of blockCentersX) {
    for (let k = 0; k < unitsPerBlock; k++, i++) {
      const x = bx + ((k % UNITS_ACROSS) - (UNITS_ACROSS - 1) / 2) * UNIT_PITCH_X_M;
      const z = center[1] + (Math.floor(k / UNITS_ACROSS) - 0.5) * UNIT_PITCH_Z_M;
      bodies.setMatrixAt(i, m.makeTranslation(x, UNIT_SIZE_M[1] / 2 + 0.15, z));
      roofs.setMatrixAt(i, m.makeTranslation(x, UNIT_SIZE_M[1] + 0.15 + ROOF_H_M / 2, z));
      lamps.setMatrixAt(2 * i, m.makeTranslation(x, 0.55, z + UNIT_SIZE_M[2] / 2 + 0.03));
      lamps.setMatrixAt(2 * i + 1, m.makeTranslation(x, 0.55, z - UNIT_SIZE_M[2] / 2 - 0.03));
    }
  }
  bodies.castShadow = bodies.receiveShadow = roofs.castShadow = true;
  scene.add(bodies, roofs, lamps);
  return lampMat;
}

// Builds a tall frame with an amber fill bar that rises with SOC, labelled; returns { fill, baseY }
function createGauge(scene, x, z, label) {
  const baseY = 1.2;
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(GAUGE_WIDTH_M + 0.4, GAUGE_HEIGHT_M + 0.4, 0.3),
    new THREE.MeshStandardMaterial({ color: '#2a2a28', roughness: 0.6 }),
  );
  frame.position.set(x, baseY + GAUGE_HEIGHT_M / 2, z);
  frame.castShadow = true;
  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(GAUGE_WIDTH_M, GAUGE_HEIGHT_M, 0.4),
    new THREE.MeshStandardMaterial({ color: COLORS.bess, emissive: COLORS.bess, emissiveIntensity: 0.6 }),
  );
  fill.position.set(x, baseY, z + 0.05);

  // Tick marks at the SOC limit (5%) and the taper knees (20%, 80%)
  const tickMat = new THREE.MeshBasicMaterial({ color: '#f0efec' });
  for (const soc of [BESS.socMin, BESS.dischargeTaperStartSoc, BESS.chargeTaperStartSoc]) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(GAUGE_WIDTH_M + 0.8, 0.08, 0.5), tickMat);
    tick.position.set(x, baseY + GAUGE_HEIGHT_M * soc, z + 0.05);
    scene.add(tick);
  }
  const caption = createDecal(`${label} · SOC`, 4.2, 0.6, { color: '#1d1f22', weight: 700 });
  caption.position.set(x, baseY + GAUGE_HEIGHT_M + 0.7, z + 0.2);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, baseY, 0.3), tickMat);
  leg.position.set(x, baseY / 2, z);
  scene.add(frame, fill, leg, caption);
  return { fill, baseY };
}

// Adds the power conversion / MV transformer skid where the BESS cable starts
function addPcsSkid(scene) {
  const [x, z] = WORLD.cables.bess[0];
  const skid = new THREE.Mesh(new RoundedBoxGeometry(4, 2.8, 6, 1, 0.12), new THREE.MeshStandardMaterial({ color: '#cfd3cf' }));
  skid.position.set(x - 2, 1.4, z);
  skid.castShadow = true;
  scene.add(skid);
}
