/*
 * PURPOSE:    Hand-calculated checks of grid limits (breaker) and transformer losses.
 * USED BY:    npm test (node --test)
 * DEPENDS ON: src/model/grid.js
 * UNITS:      MW, Mvar, MVA, per-unit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridLimits, transformerLosses } from '../src/model/grid.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('breaker closed -> 25 MW each way; open -> islanded, 0 each way', () => {
  assert.deepEqual(gridLimits(true), { importLimitMw: 25, exportLimitMw: 25 });
  assert.deepEqual(gridLimits(false), { importLimitMw: 0, exportLimitMw: 0 });
});

test('losses: no-load 0.1% x 30 = 0.03 MW; at 30 MVA add 0.5% x 30 = 0.15 MW', () => {
  assert.ok(close(transformerLosses(0, 0, true).lossMw, 0.03));
  const full = transformerLosses(-18, 24, true); // 18-24-30 triangle -> 30 MVA
  assert.ok(close(full.sMva, 30));
  assert.ok(close(full.loadingPu, 1));
  assert.ok(close(full.lossMw, 0.18));
});

test('open breaker: transformer de-energised, zero losses', () => {
  assert.equal(transformerLosses(10, 5, false).lossMw, 0);
});
