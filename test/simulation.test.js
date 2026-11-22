/*
 * PURPOSE:    Checks of the real-time accumulator, pause, reset and daily roll-over.
 * USED BY:    npm test (node --test)
 * DEPENDS ON: src/model/simulation.js, src/state.js
 * UNITS:      real seconds in, sim hours / MWh out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, advanceSimulation } from '../src/model/simulation.js';
import { createState } from '../src/state.js';

test('speed 1 h/s: one real second runs four 15-min steps', () => {
  const state = createState();
  const sim = createSimulation();
  assert.equal(advanceSimulation(state, sim, 1.0), 4);
  assert.equal(state.simTimeH, 1);
});

test('paused runs nothing; reset restores time and SOC but keeps inputs', () => {
  const state = createState();
  const sim = createSimulation();
  state.windSpeedMs = 15;
  advanceSimulation(state, sim, 5);
  state.paused = true;
  assert.equal(advanceSimulation(state, sim, 5), 0);
  state.resetRequested = true;
  advanceSimulation(state, sim, 0);
  assert.equal(state.simTimeH, 0);
  assert.equal(state.soc, 0.5);
  assert.equal(state.windSpeedMs, 15);
});

test('daily totals roll over at midnight: training load = 16.2421875 MW x 24 h', () => {
  const state = createState();
  const sim = createSimulation();
  state.speedSimHoursPerSec = 24;
  advanceSimulation(state, sim, 1.0);
  assert.equal(state.dayIndex, 1);
  assert.ok(Math.abs(state.previousDay.loadMwh - 16.2421875 * 24) < 1e-9);
  assert.equal(state.daily.loadMwh, 0);
});
