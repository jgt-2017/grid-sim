/*
 * PURPOSE:    Large, readable datasheet boards on site: the GPU rack (Supermicro GB300 NVL72) next to
 *             the data center and the battery unit (Tesla Megapack) next to the BESS yard. Every line
 *             is built from config, so the boards always match what the simulation uses.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, three/addons RoundedBoxGeometry, src/config.js (WORLD, DATACENTER, MEGAPACK, BESS,
 *             BRANDS), src/render/texEquipment.js (canvasTexture, FONT), src/render/terrain.js,
 *             src/render/colliders.js
 * UNITS:      metres; ratings as printed on the datasheets.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WORLD, DATACENTER, MEGAPACK, BESS, BRANDS } from '../config.js';
import { canvasTexture, FONT } from './texEquipment.js';
import { heightAt } from './terrain.js';
import { circle } from './colliders.js';

const BOARD = { widthM: 10, heightM: 6.6, liftM: 1.4 };
const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

// Rows for the GPU rack sheet
function gpuSheet() {
  const p = DATACENTER.profiles.gb300;
  const n = DATACENTER.rackCount;
  const cdus = Math.ceil(n / p.cduRacksPerInRowUnit);
  return {
    maker: BRANDS.gpu.maker, accent: BRANDS.gpu.accent, title: `${p.label} rack`,
    rows: [
      ['GPUs / CPUs', `${p.gpusPerRack}× B300  ·  ${p.cpusPerRack}× Grace 72-core`],
      ['Trays', `${p.computeTrays}× 1U compute (4 GPU + 2 CPU)  ·  ${p.nvlinkSwitchTrays}× NVLink switch`],
      ['Memory', `${p.hbmPerGpuGb} GB HBM3e per GPU  ·  ${p.hbmPerRackTb} TB per rack`],
      ['Fabric', `NVLink ${p.nvlinkTBs} TB/s  ·  ConnectX-8 ${p.nicGbps} Gb/s`],
      ['Rack power', `${p.rackShelfKw}–${p.rackTdpKw} kW  (8× 33 kW power shelves)`],
      ['Rack size', `${p.rackDimsMm.map((v) => fmt(v)).join(' × ')} mm (H × W × D)`],
      ['Cooling', `Direct liquid  ·  in-row CDU ${p.cduInRowMw} MW per ${p.cduRacksPerInRowUnit} racks`],
      ['This site', `${n} racks · ${fmt(n * p.gpusPerRack)} GPUs · ${cdus} CDUs · ${fmt(n * p.rackTdpKw / 1000, 1)} MW IT max`],
    ],
    footer: `Source: ${p.datasheet}`,
  };
}

// Rows for the battery unit sheet
function megapackSheet() {
  const m = MEGAPACK;
  return {
    maker: BRANDS.bess.maker, accent: BRANDS.bess.accent, title: m.model,
    rows: [
      ['Per unit', `${fmt(m.powerKw, 1)} kW  /  ${fmt(m.energyKwh)} kWh (AC)`],
      ['Round trip', `${m.roundTripEff * 100}%  (25 °C, incl. thermal loads, day 1)`],
      ['Enclosure', `${m.dimsMm.map((v) => fmt(v)).join(' × ')} mm  ·  ${fmt(m.weightKg)} kg`],
      ['Electrical', `${m.acVoltage}  ·  inverter ≤ ${fmt(m.inverterKva)} kVA`],
      ['Rating', `${m.ingress}  ·  ${m.ambientC[0]} °C to ${m.ambientC[1]} °C`],
      ['Inside', `up to ${m.batteryModules} battery modules  ·  ${m.warrantyYears}-yr warranty`],
      ['This site', `${BESS.unitCount} units = ${fmt(BESS.energyMwh, 2)} MWh / ${fmt(BESS.powerMw, 2)} MW`],
    ],
    footer: `Source: ${m.datasheet}`,
  };
}

// Draws a sheet: maker band, title, key / value rows with rules, source footer
function drawSheet(ctx, w, h, sheet) {
  ctx.fillStyle = '#16181b';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = sheet.accent;
  ctx.fillRect(0, 0, w, 110);
  ctx.fillStyle = '#fff';
  ctx.font = `800 70px ${FONT}`;
  ctx.fillText(sheet.maker, 40, 80);
  ctx.fillStyle = '#f0efec';
  ctx.font = `700 52px ${FONT}`;
  ctx.fillText(sheet.title, 40, 180, w - 80);
  const rowH = (h - 300) / sheet.rows.length;
  sheet.rows.forEach(([key, value], i) => {
    const y = 230 + i * rowH;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(40, y - 6, w - 80, 2);
    ctx.fillStyle = i === sheet.rows.length - 1 ? sheet.accent : '#a9a8a0';
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(key, 40, y + rowH * 0.6);
    ctx.fillStyle = '#f0efec';
    ctx.font = `${i === sheet.rows.length - 1 ? 700 : 500} 36px ${FONT}`;
    ctx.fillText(value, 300, y + rowH * 0.6, w - 340);
  });
  ctx.fillStyle = '#8a8981';
  ctx.font = `italic 400 26px ${FONT}`;
  ctx.fillText(sheet.footer, 40, h - 26, w - 80);
}

// Takes a sheet; returns a board on two posts (origin on the ground, printed face on +z)
function createSheetBoard(sheet) {
  const group = new THREE.Group();
  const map = canvasTexture(1500, 990, (ctx, w, h) => drawSheet(ctx, w, h, sheet));
  const face = new THREE.MeshStandardMaterial({ map, roughness: 0.55, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.12 });
  const back = new THREE.MeshStandardMaterial({ color: '#2a2c2f', roughness: 0.6 });
  const board = new THREE.Mesh(new RoundedBoxGeometry(BOARD.widthM, BOARD.heightM, 0.18, 1, 0.06),
    [back, back, back, back, face, back]);
  board.position.y = BOARD.liftM + BOARD.heightM / 2;
  board.castShadow = true;
  group.add(board);
  const postMat = new THREE.MeshStandardMaterial({ color: '#5f6366', metalness: 0.6, roughness: 0.4 });
  for (const x of [-BOARD.widthM * 0.38, BOARD.widthM * 0.38]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, BOARD.liftM + 0.2, 0.2), postMat);
    post.position.set(x, (BOARD.liftM + 0.2) / 2, -0.1);
    group.add(post);
  }
  return group;
}

// Takes the scene; places both sheets facing their zone's spawn; returns { colliders }
export function createSpecBoards(scene) {
  const colliders = [];
  const target = new THREE.Vector3();
  for (const [zoneKey, sheet] of [['datacenter', gpuSheet()], ['bess', megapackSheet()]]) {
    const zone = WORLD.zones[zoneKey];
    const [x, z] = zone.specBoard;
    const board = createSheetBoard(sheet);
    board.position.set(x, heightAt(x, z), z);
    board.lookAt(target.set(zone.spawn[0], board.position.y, zone.spawn[1]));
    scene.add(board);
    colliders.push(circle(x, z, BOARD.widthM / 2));
  }
  return { colliders };
}
