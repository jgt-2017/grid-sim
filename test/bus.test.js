/*
 * PURPOSE:    Bus balance tests: hand cases, 10k seeded random dispatches, and a long
 *             full-simulation run with random inputs (residual, NaN, SOC bounds, limits).
 * USED BY:    npm test (node --test)
 * DEPENDS ON: src/model/bus.js, src/model/simulation.js, src/state.js, src/utils/rng.js, src/config.js
 * UNITS:      MW, SOC 0-1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/model/bus.js';
import { createSimulation, stepSimulation } from '../src/model/simulation.js';
import { createState } from '../src/state.js';
import { createRng, uniform } from '../src/utils/rng.js';
import { BUS, BESS } from '../src/config.js';

const TOL = BUS.residualToleranceMw;
const close = (a, b) => Math.abs(a - b) < 1e-9;
const open = { importLimitMw: 25, exportLimitMw: 25 };

test('surplus: 25 PV + 18 wind - 16.24 load = 26.76 -> 20 charge, 6.76 export', () => {
  const r = dispatch({ pvMw: 25, windMw: 18, loadMw: 16.24, bessChgLimitMw: 20, bessDisLimitMw: 20, ...open });
  assert.equal(r.bessChgMw, 20);
  assert.ok(close(r.gridExportMw, 6.76));
  assert.equal(r.curtailedMw, 0);
});

test('deficit islanded with empty battery: all of it is unserved', () => {
  const r = dispatch({ pvMw: 0, windMw: 0, loadMw: 16, bessChgLimitMw: 0, bessDisLimitMw: 0,
    importLimitMw: 0, exportLimitMw: 0 });
  assert.equal(r.unservedMw, 16);
  assert.ok(r.balanceOk);
});

test('10k random dispatches: residual < 1e-6, all flows >= 0 and within limits', () => {
  const rng = createRng(42);
  for (let i = 0; i < 10000; i++) {
    const inp = {
      pvMw: uniform(rng, 0, 25), windMw: uniform(rng, 0, 18), loadMw: uniform(rng, 0, 40),
      bessChgLimitMw: uniform(rng, 0, 20), bessDisLimitMw: uniform(rng, 0, 20),
      importLimitMw: rng() < 0.2 ? 0 : 25, exportLimitMw: rng() < 0.2 ? 0 : 25,
      gridChargeMw: rng() < 0.3 ? uniform(rng, 0, 10) : 0,     // backup-reserve recovery requests
    };
    const r = dispatch(inp);
    assert.ok(Math.abs(r.residualMw) < TOL, `case ${i} residual ${r.residualMw}`);
    for (const k of ['bessChgMw', 'bessDisMw', 'gridImportMw', 'gridExportMw', 'curtailedMw', 'unservedMw']) {
      assert.ok(r[k] >= 0 && Number.isFinite(r[k]), `case ${i} ${k}=${r[k]}`);
    }
    assert.ok(r.bessChgMw <= inp.bessChgLimitMw + 1e-12 && r.bessDisMw <= inp.bessDisLimitMw);
    assert.ok(r.gridImportMw <= inp.importLimitMw && r.gridExportMw <= inp.exportLimitMw);
    assert.ok(r.bessChgMw === 0 || r.bessDisMw === 0);
  }
});

test('NaN / negative inputs are sanitised and still balance', () => {
  const r = dispatch({ pvMw: NaN, windMw: -5, loadMw: Infinity, bessChgLimitMw: 20,
    bessDisLimitMw: NaN, ...open });
  assert.ok(r.balanceOk);
  assert.equal(r.unservedMw, 0);
});

test('30 sim days with random inputs every step: balance, no NaN, SOC in window', () => {
  const rng = createRng(7);
  const state = createState();
  const sim = createSimulation();
  const modes = ['training', 'inference', 'mixed'];
  for (let i = 0; i < 30 * 96; i++) {
    state.windSpeedMs = uniform(rng, 0, 30);
    state.irradianceWm2 = [200, 600, 1000][Math.floor(rng() * 3)];
    state.dcMode = modes[Math.floor(rng() * 3)];
    state.mixedTrainingFraction = rng();
    state.gridBreakerClosed = rng() > 0.3;
    state.diurnalSunEnabled = rng() > 0.5;
    stepSimulation(state, sim);
    assert.ok(state.busBalanceOk, `step ${i} residual ${state.busResidualMw}`);
    assert.ok(state.soc >= BESS.socMin && state.soc <= BESS.socMax, `step ${i} soc ${state.soc}`);
    for (const [k, v] of Object.entries(state)) {
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `step ${i} ${k}=${v}`);
    }
  }
  assert.ok(state.maxAbsResidualMw < TOL);
});
