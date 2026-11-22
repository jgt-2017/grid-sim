/*
 * PURPOSE:    Hand-calculated checks of utilization modes, rack power and facility load.
 * USED BY:    npm test (node --test)
 * DEPENDS ON: src/model/datacenter.js, src/config.js
 * UNITS:      utilization 0-1, rack kW, facility MW / MVA.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fleetUtilization, rackPowerKw, facilityLoad } from '../src/model/datacenter.js';
import { DATACENTER } from '../src/config.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;
const gb300 = DATACENTER.profiles.gb300;

test('GB300 rack at training 0.95: 33.75 + 101.25 * 0.95 = 129.9375 kW', () => {
  assert.ok(close(rackPowerKw(0.95, gb300), 129.9375));
  assert.ok(close(rackPowerKw(0, gb300), 33.75));
  assert.equal(rackPowerKw(1, gb300), 135);
});

test('facility: 100 racks -> 12.99375 MW IT, x1.25 PUE = 16.2421875 MW, /0.97 PF for MVA', () => {
  const f = facilityLoad(0.95, 'gb300');
  assert.ok(close(f.itMw, 12.99375));
  assert.ok(close(f.facilityMw, 16.2421875));
  assert.ok(close(f.facilityMva, 16.2421875 / 0.97));
});

test('inference wave: 0.80 at 14:00, 0.40 at 02:00; mixed 50/50 at 14:00 = 0.875', () => {
  assert.ok(close(fleetUtilization('inference', 14, 0), 0.8));
  assert.ok(close(fleetUtilization('inference', 2, 0), 0.4));
  assert.ok(close(fleetUtilization('mixed', 14, 0.5), 0.875));
  assert.equal(fleetUtilization('training', 3, 0), 0.95);
});
