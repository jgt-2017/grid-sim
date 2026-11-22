/*
 * PURPOSE:    138/34.5 kV substation laid out like a real distribution substation, north (HV) to south
 *             (MV): line dead-end structure -> surge arresters -> group-operated disconnects -> SF6
 *             dead-tank breaker (52) -> power transformer T1 at the centre -> rigid bus -> 34.5 kV
 *             metal-clad switchgear (main + 4 feeders) -> 34.5 kV bus. Plus lightning masts with
 *             shield wires, station-service transformer, relay house (87T, 50/51), fence and signs.
 *             Live: disconnect blades swing open with the breaker; T1 fans run above 60% loading.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, src/config.js (WORLD, GRID, COLORS), src/render/{substationParts,substationExtras,
 *             transformerModel,labels,colliders}.js
 * UNITS:      metres; breaker state and transformer loading from state.
 */
import * as THREE from 'three';
import { WORLD, GRID, COLORS } from '../config.js';
import { MAT, box, insulator, disconnectSwitch, deadTankBreaker } from './substationParts.js';
import { deadEndStructure, surgeArrester, lightningMast, switchgearLineup, stationService, dangerSign } from './substationExtras.js';
import { createPowerTransformer, TRANSFORMER_TANK } from './transformerModel.js';
import { createSign, createTextPlate } from './labels.js';
import { aabb } from './colliders.js';

const PHASE_X_M = [-2.4, 0, 2.4];   // three phases side by side
const BLADE_OPEN_RAD = 1.2;         // disconnect blade angle when open
const FENCE = { minX: -27, maxX: 27, minZ: -24, maxZ: 31, heightM: 2.4 };
const T1_Z = 3;                     // transformer centre (the middle of the yard)
const MASTS = [[-24, -21], [24, -21], [24, 28], [-24, 28]];

// Moves an object by (x, y, z) and returns it
function placed(object, x, z, y = 0) {
  object.position.set(object.position.x + x, object.position.y + y, object.position.z + z);
  return object;
}

// HV bays north of the transformer; returns the disconnect blades (they swing with the breaker)
function addHvBays(root) {
  root.add(placed(deadEndStructure(9, 13), 0, -21));
  const blades = [];
  for (const x of PHASE_X_M) {
    root.add(placed(box(0.35, 2.4, 0.35, MAT.steel, 0, 1.2, 0), x, -17.5));       // arrester pedestal
    root.add(placed(surgeArrester(2.2), x, -17.5, 2.4));
    const sw = disconnectSwitch();
    root.add(placed(sw.group, x, -13));
    blades.push(sw.blade);
    root.add(placed(deadTankBreaker(), x, -7));
  }
  root.add(placed(box(7.6, 0.3, 4, MAT.steel, 0, 0.15, 0), 0, -7));                  // breaker common frame
  root.add(placed(box(1.4, 1.8, 1, MAT.cabinet, 0, 0.9, 0), 4.8, -7));               // breaker mechanism
  root.add(placed(box(0.9, 1.2, 0.6, MAT.cabinet, 0, 1.6, 0), 4.2, -13));            // motor operator
  return blades;
}

// MV side: rigid bus from T1 LV bushings to the switchgear, then the lineup and the 34.5 kV bus
function addMvSide(root) {
  const lvTopY = TRANSFORMER_TANK.baseY + TRANSFORMER_TANK.y + 1.4;
  // Steel bus stands with short station-post insulators carry the rigid bus over the yard
  const postM = 1.1;
  for (const x of [-1.6, 0, 1.6]) {
    root.add(box(0.12, 0.12, 11, MAT.conductor, x, lvTopY, T1_Z + 7));
    root.add(box(0.3, lvTopY - postM, 0.3, MAT.steel, x, (lvTopY - postM) / 2, T1_Z + 9));
    root.add(placed(insulator(postM), x, T1_Z + 9, lvTopY - postM));
  }
  root.add(placed(switchgearLineup(['52-T1 MAIN', 'F1 WIND', 'F2 SOLAR', 'F3 BESS', 'F4 DATA CTR']), 0, 17));
  const [[x0, z], [x1]] = [WORLD.busBar.from, WORLD.busBar.to];
  root.add(box(x1 - x0, 0.25, 0.25, MAT.conductor, (x0 + x1) / 2, 1.6, z));
  for (let x = x0; x <= x1; x += 6) root.add(placed(insulator(1.5), x, z));
}

// Lightning masts at the yard corners joined by overhead shield wires
function addShielding(root) {
  const top = 20;
  for (const [x, z] of MASTS) root.add(placed(lightningMast(top), x, z));
  const points = [...MASTS, MASTS[0]].map(([x, z]) => new THREE.Vector3(x, top, z));
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#4a4a48' })));
}

// Relay/control house with protection labels on the wall facing the yard
function addRelayHouse(root) {
  const [x, z] = [19, 10];
  root.add(box(7, 3.6, 9, MAT.cabinet, x, 1.8, z), box(7.6, 0.3, 9.6, MAT.steel, x, 3.75, z));
  root.add(box(0.1, 2.2, 1.1, MAT.steel, x - 3.52, 1.1, z + 2.5));                    // door
  const labels = [['RELAY HOUSE', 4.2, 0.6, 3.0, z - 1], ['87T', 1.6, 0.6, 2.0, z - 2.2], ['50/51', 1.6, 0.6, 2.0, z]];
  for (const [text, w, h, y, pz] of labels) {
    const p = createTextPlate(text, w, h);
    p.rotation.y = -Math.PI / 2;
    p.position.set(x - 3.53, y, pz);
    root.add(p);
  }
}

// Chain-link fence (instanced posts + see-through panels) with danger signs on the south side
function addFence(root) {
  const { minX, maxX, minZ, maxZ, heightM } = FENCE;
  const spots = [];
  for (let x = minX; x <= maxX; x += 3) spots.push([x, minZ], [x, maxZ]);
  for (let z = minZ + 3; z < maxZ; z += 3) spots.push([minX, z], [maxX, z]);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, heightM, 0.1), MAT.steel, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, z], i) => posts.setMatrixAt(i, m.makeTranslation(x, heightM / 2, z)));
  root.add(posts);
  const mesh = new THREE.MeshStandardMaterial({ color: '#b5b9bb', transparent: true, opacity: 0.25 });
  for (const [x, z, sx, sz] of [[0, minZ, maxX - minX, 0.02], [0, maxZ, maxX - minX, 0.02],
    [minX, (minZ + maxZ) / 2, 0.02, maxZ - minZ], [maxX, (minZ + maxZ) / 2, 0.02, maxZ - minZ]]) {
    const panel = box(sx, heightM, sz, mesh, x, heightM / 2, z);
    panel.castShadow = false;
    root.add(panel);
  }
  for (const x of [-12, 12]) root.add(placed(dangerSign(), x, maxZ + 0.05, 1.5));
}

// Takes the scene and the overlay scene for floating signs; returns { colliders, update(state, dtSec) }
export function createSubstation(scene, labelScene) {
  const root = new THREE.Group();
  scene.add(root);
  const blades = addHvBays(root);
  const t1 = createPowerTransformer();
  root.add(placed(t1.group, 0, T1_Z));
  addMvSide(root);
  addShielding(root);
  addRelayHouse(root);
  root.add(placed(stationService(), -17, 20));
  addFence(root);

  // Identification: a plaque in front of T1 and floating status signs for T1 and the breaker
  const plaque = createTextPlate(`POWER TRANSFORMER T1 · ${GRID.hvKv}/${GRID.mvKv} kV · ${GRID.xfmrRatingMva} MVA`, 6, 0.7,
    { background: '#1d1f22', ink: '#f0efec' });
  root.add(placed(plaque, -9, T1_Z + 5.6, 1.3), placed(box(0.12, 1.3, 0.12, MAT.steel, 0, 0.65, 0), -9, T1_Z + 5.5));
  const t1Sign = createSign({ title: 'Power transformer T1', accentColor: COLORS.grid, widthM: 11 });
  t1Sign.sprite.position.set(0, 14, T1_Z);
  const breakerSign = createSign({ title: 'HV breaker 52', accentColor: COLORS.grid, widthM: 9 });
  breakerSign.sprite.position.set(0, 10, -7);
  labelScene.add(t1Sign.sprite, breakerSign.sprite);

  const { minX, maxX, minZ, maxZ } = FENCE;
  const colliders = [aabb((minX + maxX) / 2, (minZ + maxZ) / 2, (maxX - minX) / 2, (maxZ - minZ) / 2)];
  let bladeAngle = 0;     // current visual blade angle (rad), eased toward the target
  let shownClosed = null; // breaker state currently drawn on the sign
  let signTimer = 0;      // seconds since the T1 sign was last redrawn
  return {
    colliders,
    update(state, dtSec) {
      const target = state.gridBreakerClosed ? 0 : BLADE_OPEN_RAD;
      bladeAngle += (target - bladeAngle) * Math.min(1, dtSec * 3);
      for (let i = 0; i < blades.length; i++) blades[i].rotation.x = bladeAngle;
      t1.update(state.xfmrLoadingPu, dtSec);
      if (shownClosed !== state.gridBreakerClosed) {
        shownClosed = state.gridBreakerClosed;
        breakerSign.setText('HV breaker 52', shownClosed ? 'CLOSED' : '✕ OPEN · islanded');
      }
      signTimer += dtSec;
      if (signTimer > WORLD.labelRefreshMs / 1000) {
        signTimer = 0;
        const cooling = state.xfmrLoadingPu > 0.6 ? 'ONAF fans on' : 'ONAN';
        t1Sign.setText('Power transformer T1', `${(state.xfmrLoadingPu * 100).toFixed(0)}% · ${cooling}`);
      }
    },
  };
}
