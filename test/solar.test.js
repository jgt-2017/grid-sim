/*
 * PURPOSE:    Hand-calculated checks of PV output, clipping and the optional diurnal shape.
 * USED BY:    npm test (node --test)
 * DEPENDS ON: src/model/solar.js
 * UNITS:      W/m2 in, MW out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pvAvailableMw, effectiveIrradianceWm2 } from '../src/model/solar.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('High (1000 W/m2): 30 * 1.0 * 0.85 = 25.5 MW, clipped to 25 MW', () => {
  assert.equal(pvAvailableMw(1000), 25);
});

test('Medium 600 -> 15.3 MW, Low 200 -> 5.1 MW', () => {
  assert.ok(close(pvAvailableMw(600), 15.3));
  assert.ok(close(pvAvailableMw(200), 5.1));
});

test('bad irradiance is treated as zero', () => {
  assert.equal(pvAvailableMw(NaN), 0);
  assert.equal(pvAvailableMw(-50), 0);
});

test('diurnal shape: off = flat, on = half-sine 06-18 h', () => {
  assert.equal(effectiveIrradianceWm2(1000, 3, false), 1000);
  assert.equal(effectiveIrradianceWm2(1000, 3, true), 0);
  assert.ok(close(effectiveIrradianceWm2(1000, 12, true), 1000));
  assert.ok(close(effectiveIrradianceWm2(1000, 9, true), 1000 * Math.SQRT1_2));
});
