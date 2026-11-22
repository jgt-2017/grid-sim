/*
 * PURPOSE:    Hand-calculated checks of the wind power curve and rotor speed.
 * USED BY:    npm test (node --test)
 * DEPENDS ON: src/model/wind.js
 * UNITS:      m/s in, MW / rpm out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { turbinePowerMw, farmPowerMw, rotorRpm } from '../src/model/wind.js';

test('above rated (12 m/s) gives 6 MW per turbine, 18 MW per farm', () => {
  assert.equal(turbinePowerMw(12), 6);
  assert.equal(farmPowerMw(12), 18);
});

test('7 m/s on the cubic segment: 6 * (343 - 27) / (1157.625 - 27) = 1.67695 MW', () => {
  assert.ok(Math.abs(turbinePowerMw(7) - 1.67695) < 1e-4);
});

test('zero below cut-in and above cut-out; full at cut-out exactly', () => {
  assert.equal(turbinePowerMw(2.9), 0);
  assert.equal(turbinePowerMw(25), 6);
  assert.equal(turbinePowerMw(26), 0);
  assert.equal(turbinePowerMw(NaN), 0);
});

test('rotor rpm: proportional below rated, constant above, parked outside window', () => {
  assert.equal(rotorRpm(5.25), 5);   // half of rated speed -> half of 10 rpm
  assert.equal(rotorRpm(20), 10);
  assert.equal(rotorRpm(27), 0);
});
