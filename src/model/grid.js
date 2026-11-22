/*
 * PURPOSE:    Utility connection (slack bus): import/export limits gated by the breaker,
 *             and transformer loading/losses for display only (not part of the balance).
 * USED BY:    src/model/simulation.js, test/bus.test.js
 * DEPENDS ON: src/config.js (GRID), src/utils/units.js
 * UNITS:      power in MW, reactive power in Mvar, apparent power in MVA, loading per-unit.
 */
import { GRID } from '../config.js';
import { safeNonNeg } from '../utils/units.js';

// Takes breaker state (true = closed); returns { importLimitMw, exportLimitMw }.
// Open breaker = islanded, so both limits are zero.
export function gridLimits(breakerClosed, cfg = GRID) {
  if (!breakerClosed) return { importLimitMw: 0, exportLimitMw: 0 };
  return { importLimitMw: cfg.importLimitMw, exportLimitMw: cfg.exportLimitMw };
}

// Takes net grid power (MW, sign irrelevant) and reactive power through the transformer (Mvar);
// returns { sMva, loadingPu, lossMw }. Assumed: all load Mvar is supplied through the transformer.
export function transformerLosses(gridMw, reactiveMvar, breakerClosed, cfg = GRID) {
  // Islanded: transformer is de-energised, no flow and no losses
  if (!breakerClosed) return { sMva: 0, loadingPu: 0, lossMw: 0 };

  const p = Math.abs(gridMw) || 0;
  const q = safeNonNeg(reactiveMvar);
  const sMva = Math.sqrt(p * p + q * q);
  const loadingPu = sMva / cfg.xfmrRatingMva;

  // Core loss is constant when energised; copper loss scales with loading squared
  const noLoadMw = cfg.noLoadLossFraction * cfg.xfmrRatingMva;
  const copperMw = cfg.fullLoadLossFraction * cfg.xfmrRatingMva * loadingPu * loadingPu;
  return { sMva, loadingPu, lossMw: noLoadMw + copperMw };
}

// Takes active power (MW) and power factor; returns reactive power (Mvar)
export function reactiveFromPf(activeMw, powerFactor) {
  const pf = Math.min(Math.max(powerFactor, 0.01), 1);
  return safeNonNeg(activeMw) * Math.tan(Math.acos(pf));
}
