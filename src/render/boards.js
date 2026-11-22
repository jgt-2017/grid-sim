/*
 * PURPOSE:    Entrance boards at each zone: maker band, asset name and its real ratings, all built
 *             from config so the boards always match the model. Each board faces its zone's spawn.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, src/config.js (WORLD, WIND, SOLAR, BESS, GRID, DATACENTER, BRANDS),
 *             src/render/signage.js, src/render/terrain.js (heightAt)
 * UNITS:      metres; ratings in MW / MWh / MVA / kV as configured.
 */
import * as THREE from 'three';
import { WORLD, WIND, SOLAR, BESS, GRID, DATACENTER, BRANDS } from '../config.js';
import { createEntranceBoard } from './signage.js';
import { heightAt } from './terrain.js';
import { circle } from './colliders.js';

// Returns { zoneKey: { maker, accent, title, lines } } from the current config
function boardContent() {
  const gb300 = DATACENTER.profiles.gb300;
  const gpus = (DATACENTER.rackCount * gb300.gpusPerRack).toLocaleString('en-US');
  return {
    wind: { ...BRANDS.wind, title: 'Wind farm',
      lines: [`${WIND.turbineCount} × ${BRANDS.wind.model}`, `${WIND.turbineCount * WIND.ratedMwPerTurbine} MW installed`] },
    solar: { ...BRANDS.solar, title: 'Solar site',
      lines: [`${SOLAR.dcRatingMwp} MWp DC · ${SOLAR.inverterAcLimitMw} MW AC`, BRANDS.solar.model] },
    bess: { ...BRANDS.bess, title: `${BRANDS.bess.model} BESS`,
      lines: [`${BESS.unitCount} units · ${BESS.energyMwh.toFixed(2)} MWh / ${BESS.powerMw.toFixed(2)} MW`, `Round-trip ${BESS.roundTripEff * 100}% (datasheet)`] },
    substation: { maker: '', accent: '', title: `${GRID.hvKv}/${GRID.mvKv} kV substation`,
      lines: [`${GRID.xfmrRatingMva} MVA ONAN/ONAF transformer`, 'Protection 87T · 50/51'] },
    datacenter: { ...BRANDS.gpu, title: BRANDS.gpu.name,
      lines: [`${DATACENTER.rackCount} × ${gb300.label} racks`, `${gpus} GPUs · PUE ${DATACENTER.pue}`] },
  };
}

// Takes the scene; places one board per zone, turned to face that zone's spawn point; returns { colliders }
export function createZoneBoards(scene) {
  const content = boardContent();
  const target = new THREE.Vector3();
  const colliders = [];
  for (const key of WORLD.zoneOrder) {
    const zone = WORLD.zones[key];
    if (!zone.board) continue;
    const board = createEntranceBoard(content[key]);
    const [x, z] = zone.board;
    board.position.set(x, heightAt(x, z), z);
    board.lookAt(target.set(zone.spawn[0], board.position.y, zone.spawn[1]));
    scene.add(board);
    colliders.push(circle(x, z, 3.6));
  }
  return { colliders };
}
