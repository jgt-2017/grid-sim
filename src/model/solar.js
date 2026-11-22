/*
 * PURPOSE:    PV plant AC output from irradiance, with performance ratio and inverter clipping.
 *             Optional diurnal shaping scales irradiance by a half-sine over daylight hours.
 * USED BY:    src/model/simulation.js, test/solar.test.js
 * DEPENDS ON: src/config.js (SOLAR), src/utils/units.js
 * UNITS:      irradiance in W/m2; power in MW; hour of day 0-24.
 */
import { SOLAR } from '../config.js';
import { safeNonNeg, finiteOr } from '../utils/units.js';

// Takes plane-of-array irradiance (W/m2), returns available AC power (MW) after clipping
export function pvAvailableMw(irradianceWm2, cfg = SOLAR) {
  const g = safeNonNeg(irradianceWm2);
  const dcAfterLossesMw = cfg.dcRatingMwp * (g / cfg.stcIrradianceWm2) * cfg.performanceRatio;
  return Math.min(dcAfterLossesMw, cfg.inverterAcLimitMw);
}

// Takes peak irradiance (W/m2), hour of day and an on/off flag; returns effective irradiance (W/m2).
// Off: irradiance is used as-is (the spec's flat toggle). On: half-sine between sunrise and sunset.
export function effectiveIrradianceWm2(peakIrradianceWm2, hourOfDay, diurnalEnabled, cfg = SOLAR) {
  const peak = safeNonNeg(peakIrradianceWm2);
  if (!diurnalEnabled) return peak;

  const h = finiteOr(hourOfDay, 12);
  if (h <= cfg.sunriseHour || h >= cfg.sunsetHour) return 0;

  // Fraction of the way through daylight, 0 at sunrise, 1 at sunset
  const dayFraction = (h - cfg.sunriseHour) / (cfg.sunsetHour - cfg.sunriseHour);
  return peak * Math.sin(Math.PI * dayFraction);
}
