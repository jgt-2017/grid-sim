/*
 * PURPOSE:    Hand-calculated checks of BESS taper curves, SOC integration, RTE and SOC bounds.
 * USED BY:    npm test (node --test)
 * DEPENDS ON: src/model/bess.js
 * UNITS:      MW, MWh, hours, SOC 0-1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bess, chargeTaperFraction, dischargeTaperFraction } from '../src/model/bess.js';

const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

test('charge taper: 1.0 at 80%, 0.55 at 90%, 0.1 at 100%', () => {
  assert.equal(chargeTaperFraction(0.5), 1);
  assert.ok(close(chargeTaperFraction(0.9), 0.55));
  assert.ok(close(chargeTaperFraction(1.0), 0.1));
});

test('discharge taper: 1.0 at 20%, 0.5 at 12.5%, 0 at 5%', () => {
  assert.equal(dischargeTaperFraction(0.3), 1);
  assert.ok(close(dischargeTaperFraction(0.125), 0.5));
  assert.equal(dischargeTaperFraction(0.05), 0);
});

test('charge 20 MW for 1 h from 50%: SOC += 0.9539 * 20 / 40 = 0.4770', () => {
  const b = new Bess();
  b.step(20, 0, 1);
  assert.ok(close(b.soc, 0.5 + Math.sqrt(0.91) * 20 / 40));
});

test('round trip: 10 MWh in, 9.1 MWh out returns SOC to start (RTE 91%)', () => {
  const b = new Bess();
  b.step(10, 0, 1);
  b.step(0, 9.1, 1);
  assert.ok(close(b.soc, 0.5));
});

test('headroom near full: at SOC 99% a 15 min step allows 0.01*40/(0.9539*0.25) = 1.677 MW', () => {
  const b = new Bess();
  b.soc = 0.99;
  assert.ok(close(b.chargeLimitMw(0.25), 0.01 * 40 / (Math.sqrt(0.91) * 0.25)));
});

test('SOC never leaves 5-100%, even with absurd or NaN requests', () => {
  const b = new Bess();
  b.step(0, 1000, 10);
  assert.equal(b.soc, 0.05);
  assert.equal(b.dischargeLimitMw(0.25), 0);
  b.step(1000, 0, 10);
  assert.equal(b.soc, 1.0);
  assert.equal(b.chargeLimitMw(0.25), 0);
  b.step(NaN, NaN, 0.25);
  assert.equal(b.soc, 1.0);
});
