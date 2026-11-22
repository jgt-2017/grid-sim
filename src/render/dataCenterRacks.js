/*
 * PURPOSE:    GPU racks inside the data center halls, seen through the glass facades. Each rack
 *             front shows the maker band and model (from the selected rack profile), compute and
 *             switch trays, and status LEDs that glow with GPU utilization.
 * USED BY:    src/render/dataCenter.js
 * DEPENDS ON: three, src/render/texEquipment.js (canvasTexture, FONT), src/config.js (DATACENTER, BRANDS)
 * UNITS:      metres; utilization 0-1.
 */
import * as THREE from 'three';
import { canvasTexture, FONT } from './texEquipment.js';
import { DATACENTER, BRANDS } from '../config.js';

// Rack size from the datasheet: 2236 (H) x 600 (W) x 1068 (D) mm -> [width, height, depth]
const dims = DATACENTER.profiles.gb300.rackDimsMm;
const RACK_SIZE_M = [dims[1] / 1000, dims[0] / 1000, dims[2] / 1000];
// Front elevation top to bottom, as in the datasheet's rack diagram: [kind, count]
const RACK_LAYOUT = [['switch', 2], ['power', 4], ['compute', 10], ['nvlink', 9], ['compute', 8], ['power', 4], ['cdu', 1]];
const SLOT = { switch: ['#2b2f35', '#3aa0ff'], power: ['#3a3d42', '#ffb020'], compute: ['#30343a', '#7dff4a'],
  nvlink: ['#23262b', '#3aa0ff'], cdu: ['#4a4f56', '#7dd3ff'] };   // [panel colour, LED colour]

// Takes a rack profile; returns { map, emissiveMap } for the rack front face
function rackFrontTextures(profile) {
  const w = 160;
  const h = 600;
  const model = profile.label.replace(' (projected)', '');
  // Draws either the colour pass or the glow pass (glow: only band, text and LEDs are lit)
  const draw = (glow) => (ctx) => {
    ctx.fillStyle = glow ? '#000' : '#141618';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = BRANDS.gpu.accent;
    ctx.fillRect(0, 0, w, 46);
    ctx.fillStyle = '#fff';
    ctx.font = `800 24px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(BRANDS.gpu.maker, w / 2, 34, w - 12);
    ctx.fillStyle = glow ? '#555' : '#e8e8e8';
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText(model, w / 2, 70, w - 10);
    // 1U slots fill the space below the label; the CDU takes four slots
    const units = RACK_LAYOUT.reduce((sum, [kind, n]) => sum + (kind === 'cdu' ? 4 : n), 0);
    const slotPx = (h - 84) / units;
    let y = 80;
    for (const [kind, n] of RACK_LAYOUT) {
      const [panel, led] = SLOT[kind];
      const height = kind === 'cdu' ? slotPx * 4 : slotPx;
      for (let t = 0; t < n; t++) {
        ctx.fillStyle = glow ? '#000' : panel;
        ctx.fillRect(6, y + 1, w - 12, height - 2);
        ctx.fillStyle = led;                                         // status LEDs
        for (let k = 0; k < (kind === 'cdu' ? 2 : 4); k++) ctx.fillRect(12 + k * 9, y + height / 2 - 2, 4, 4);
        y += height;
      }
    }
  };
  return { map: canvasTexture(w, h, draw(false)), emissiveMap: canvasTexture(w, h, draw(true)) };
}

// Takes the scene and the halls [{ center: [x, z], glassSign: +1|-1, lengthM }];
// returns { update(state, served, flicker) }
export function createRacks(scene, halls) {
  const textures = {};
  for (const key of Object.keys(DATACENTER.profiles)) textures[key] = rackFrontTextures(DATACENTER.profiles[key]);

  const body = new THREE.MeshStandardMaterial({ color: '#1b1d20', roughness: 0.5, metalness: 0.4 });
  const front = new THREE.MeshStandardMaterial({
    map: textures.gb300.map, emissiveMap: textures.gb300.emissiveMap, emissive: '#ffffff',
    emissiveIntensity: 1, roughness: 0.4, metalness: 0.3,
  });
  const perHall = Math.ceil(DATACENTER.rackCount / halls.length);
  const ROW_OFFSETS_M = [7, 3.4, -0.2, -3.8];   // four rows per hall, fronts toward the glass (cold aisles)
  const perRow = Math.ceil(perHall / ROW_OFFSETS_M.length);
  const racks = new THREE.InstancedMesh(new THREE.BoxGeometry(...RACK_SIZE_M),
    [body, body, body, body, front, body], perHall * halls.length);

  // Racks stand shoulder to shoulder in rows behind the glass, fronts facing out through it
  const m = new THREE.Matrix4();
  const rot = new THREE.Matrix4();
  let i = 0;
  for (const hall of halls) {
    const pitch = RACK_SIZE_M[0] + 0.02;        // side by side, as in a real data hall
    rot.makeRotationY(hall.glassSign > 0 ? 0 : Math.PI);
    for (let k = 0; k < perHall && i < DATACENTER.rackCount; k++) {
      const row = Math.floor(k / perRow);
      const x = hall.center[0] + ((k % perRow) - (perRow - 1) / 2) * pitch;
      const z = hall.center[1] + hall.glassSign * ROW_OFFSETS_M[row];
      m.makeTranslation(x, RACK_SIZE_M[1] / 2 + 0.2, z).multiply(rot);
      racks.setMatrixAt(i++, m);
    }
  }
  racks.count = i;
  racks.castShadow = true;
  scene.add(racks);

  let shownProfile = 'gb300';
  return {
    update(state, served, flicker) {
      if (state.rackProfile !== shownProfile && textures[state.rackProfile]) {
        shownProfile = state.rackProfile;
        front.map = textures[shownProfile].map;
        front.emissiveMap = textures[shownProfile].emissiveMap;
        front.needsUpdate = true;
      }
      // LEDs and maker band glow with utilization; unserved load makes them flicker
      front.emissiveIntensity = (0.8 + 5 * state.dcUtilization) * served * flicker;
    },
  };
}
