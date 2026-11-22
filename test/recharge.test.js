/*
 * PURPOSE:    Battery recovery scenarios: generation drops (battery discharges), then comes back
 *             (battery must recharge); grid-tied backup reserve is held and refilled from the grid;
 *             islanded operation can use the full window; limits and the bus balance always hold.
 * USED BY:    npm test (node --test)
 * DEPENDS ON: src/model/simulation.js, src/model/bus.js, src/state.js, src/config.js
 * UNITS:      MW, SOC 0-1, hours (15-min steps).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, stepSimulation } from '../src/model/simulation.js';
import { dispatch } from '../src/model/bus.js';
import { createState } from '../src/state.js';
import { BESS, GRID } from '../src/config.js';

const LOW = { windSpeedMs: 2, irradianceWm2: 200 };      // 5.1 MW PV, no wind: well below the load
const NORMAL = { windSpeedMs: 9, irradianceWm2: 1000 };  // 36 MW: well above the load

// Runs `hours` of 15-min steps; checks balance and limits each step; returns the SOC history
function run(state, sim, hours) {
  const socs = [];
  for (let i = 0; i < hours * 4; i++) {
    stepSimulation(state, sim);
    assert.ok(state.busBalanceOk, `residual ${state.busResidualMw}`);
    assert.ok(state.pGridImportMw <= GRID.importLimitMw + 1e-9);
    assert.ok(state.pBessChgMw === 0 || state.pBessDisMw === 0, 'never charge and discharge together');
    socs.push(state.soc);
  }
  return socs;
}

test('grid-tied: low generation drains only to the reserve, then restored generation recharges to 100%', () => {
  const state = createState();
  const sim = createSimulation();
  Object.assign(state, LOW);
  const low = run(state, sim, 12);
  assert.ok(Math.min(...low) >= BESS.backupReserveSoc - 1e-6, `fell below reserve: ${Math.min(...low)}`);
  assert.ok(Math.abs(state.soc - BESS.backupReserveSoc) < 0.01, 'should settle at the reserve');
  assert.ok(state.pGridImportMw > 0, 'grid covers the shortfall once the reserve is reached');
  Object.assign(state, NORMAL);
  run(state, sim, 6);
  assert.ok(state.soc > 0.99, `should recharge to full, got ${state.soc}`);
});

test('islanded deep discharge to 5%, then breaker closes with no surplus: grid refills the reserve', () => {
  const state = createState();
  const sim = createSimulation();
  Object.assign(state, LOW, { gridBreakerClosed: false });
  run(state, sim, 12);
  assert.ok(state.soc <= BESS.socMin + 1e-6, 'islanded can use the whole window');
  state.gridBreakerClosed = true;                       // grid back, renewables still low
  run(state, sim, 1);
  assert.ok(state.pBessGridChgMw > 0 && state.pBessGridChgMw <= BESS.gridRechargeMw + 1e-9);
  run(state, sim, 6);
  assert.ok(Math.abs(state.soc - BESS.backupReserveSoc) < 0.01, `refilled to reserve, got ${state.soc}`);
  assert.equal(state.pBessGridChgMw, 0, 'stops pulling from the grid at the reserve');
});

test('islanded drain, then generation restored: recharges from the surplus all the way', () => {
  const state = createState();
  const sim = createSimulation();
  Object.assign(state, LOW, { gridBreakerClosed: false });
  run(state, sim, 12);
  Object.assign(state, NORMAL);
  const after = run(state, sim, 6);
  assert.ok(after[3] > BESS.socMin + 0.2, 'SOC rises within the first hour');
  assert.ok(state.soc > 0.99);
});

test('recovery charge is trimmed to fit the import limit before any load is shed', () => {
  // 24 MW load, no renewables, 8 MW recovery requested, 25 MW import limit -> 1 MW charge, 0 unserved
  const r = dispatch({ pvMw: 0, windMw: 0, loadMw: 24, bessChgLimitMw: 20, bessDisLimitMw: 0,
    importLimitMw: 25, exportLimitMw: 25, gridChargeMw: 8 });
  assert.ok(Math.abs(r.bessChgMw - 1) < 1e-9);
  assert.equal(r.gridImportMw, 25);
  assert.equal(r.unservedMw, 0);
  assert.ok(r.balanceOk);
});

test('with surplus, recovery and renewables combine: surplus first, grid tops up the request', () => {
  // 3 MW surplus, 8 MW requested -> charge 8 (3 from surplus + 5 imported)
  const r = dispatch({ pvMw: 20, windMw: 0, loadMw: 17, bessChgLimitMw: 20, bessDisLimitMw: 0,
    importLimitMw: 25, exportLimitMw: 25, gridChargeMw: 8 });
  assert.equal(r.bessChgMw, 8);
  assert.ok(Math.abs(r.gridImportMw - 5) < 1e-9);
  assert.ok(Math.abs(r.bessGridChgMw - 5) < 1e-9);
  assert.ok(r.balanceOk);
});
