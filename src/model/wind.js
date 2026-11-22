/*
 * PURPOSE:    Wind turbine power curve (cubic between cut-in and rated) and rotor speed.
 * USED BY:    src/model/simulation.js, (later) src/ui/charts.js, src/render/windFarm.js, test/wind.test.js
 * DEPENDS ON: src/config.js (WIND), src/utils/units.js
 * UNITS:      wind speed in m/s; power in MW; rotor speed in rpm.
 */
import { WIND } from '../config.js';
import { finiteOr } from '../utils/units.js';

// Takes hub-height wind speed (m/s), returns one turbine's output (MW)
export function turbinePowerMw(windSpeedMs, cfg = WIND) {
  const v = finiteOr(windSpeedMs, 0);

  // Outside the operating window the turbine produces nothing
  if (v < cfg.cutInMs || v > cfg.cutOutMs) return 0;

  // Between rated and cut-out: flat at nameplate
  if (v >= cfg.ratedMs) return cfg.ratedMwPerTurbine;

  // Between cut-in and rated: cubic rise, normalised so it hits rated exactly
  const vIn3 = cfg.cutInMs ** 3;
  const vR3 = cfg.ratedMs ** 3;
  return cfg.ratedMwPerTurbine * (v ** 3 - vIn3) / (vR3 - vIn3);
}

// Takes wind speed (m/s), returns total farm output (MW)
export function farmPowerMw(windSpeedMs, cfg = WIND) {
  return cfg.turbineCount * turbinePowerMw(windSpeedMs, cfg);
}

// Takes wind speed (m/s), returns rotor speed (rpm) for the visuals.
// Proportional to wind speed up to rated, constant above; parked outside cut-in/cut-out.
export function rotorRpm(windSpeedMs, cfg = WIND) {
  const v = finiteOr(windSpeedMs, 0);
  if (v < cfg.cutInMs || v > cfg.cutOutMs) return 0;
  return cfg.maxRotorRpm * Math.min(v, cfg.ratedMs) / cfg.ratedMs;
}
