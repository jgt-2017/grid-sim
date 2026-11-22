/*
 * PURPOSE:    Checks the feeder mapping used by the SLD and 3D cables: sign conventions, and that the
 *             five feeder flows into the bus sum to zero (the bus balance seen from the feeders).
 * USED BY:    npm test (node --test)
 * DEPENDS ON: src/model/feeders.js, src/model/simulation.js, src/state.js, src/utils/rng.js
 * UNITS:      MW.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEEDER_KEYS, feederIntoBusMw } from '../src/model/feeders.js';
import { createSimulation, stepSimulation } from '../src/model/simulation.js';
import { createState } from '../src/state.js';
import { createRng, uniform } from '../src/utils/rng.js';

test('signs: load draws from the bus, export and charging are negative', () => {
  const s = { pGridImportMw: 0, pGridExportMw: 5, pWindDeliveredMw: 10, pPvDeliveredMw: 12,
    pBessDisMw: 0, pBessChgMw: 3, pLoadMw: 14, pUnservedMw: 0 };
  assert.equal(feederIntoBusMw(s, 'grid'), -5);
  assert.equal(feederIntoBusMw(s, 'bess'), -3);
  assert.equal(feederIntoBusMw(s, 'load'), -14);
  assert.equal(feederIntoBusMw(s, 'wind') + feederIntoBusMw(s, 'solar'), 22);
});

test('feeder flows sum to zero over 2,000 random sim steps (incl. curtailment and islanding)', () => {
  const rng = createRng(11);
  const state = createState();
  const sim = createSimulation();
  for (let i = 0; i < 2000; i++) {
    state.windSpeedMs = uniform(rng, 0, 30);
    state.irradianceWm2 = [200, 600, 1000][Math.floor(rng() * 3)];
    state.gridBreakerClosed = rng() > 0.3;
    stepSimulation(state, sim);
    let sum = 0;
    for (const key of FEEDER_KEYS) sum += feederIntoBusMw(state, key);
    assert.ok(Math.abs(sum) < 1e-6, `step ${i} feeder sum ${sum}`);
  }
});
