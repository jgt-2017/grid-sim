/*
 * PURPOSE:    Battery energy storage: SOC memory, power limits with SOC taper, and SOC integration.
 *             The only class in the model, because it has to remember SOC between steps.
 * USED BY:    src/model/simulation.js, (later) src/ui/charts.js, test/bess.test.js
 * DEPENDS ON: src/config.js (BESS), src/utils/units.js
 * UNITS:      power in MW, energy in MWh, time step in hours, SOC as fraction 0-1.
 */
import { BESS } from '../config.js';
import { clamp, finiteOr, safeNonNeg } from '../utils/units.js';

// Takes SOC (0-1), returns charge limit as a fraction of rated power.
// 1.0 below the taper start, falling linearly to chargeTaperEndFraction at socMax.
export function chargeTaperFraction(soc, cfg = BESS) {
  if (soc <= cfg.chargeTaperStartSoc) return 1;
  const progress = clamp((soc - cfg.chargeTaperStartSoc) / (cfg.socMax - cfg.chargeTaperStartSoc), 0, 1);
  return 1 - progress * (1 - cfg.chargeTaperEndFraction);
}

// Takes SOC (0-1), returns discharge limit as a fraction of rated power.
// 1.0 above the taper start, falling linearly to 0 at socMin.
export function dischargeTaperFraction(soc, cfg = BESS) {
  if (soc >= cfg.dischargeTaperStartSoc) return 1;
  return clamp((soc - cfg.socMin) / (cfg.dischargeTaperStartSoc - cfg.socMin), 0, 1);
}

export class Bess {
  // Takes a BESS config block; starts at socInitial
  constructor(cfg = BESS) {
    this.cfg = cfg;
    this.etaCharge = Math.sqrt(cfg.roundTripEff);    // one-way charge efficiency
    this.etaDischarge = Math.sqrt(cfg.roundTripEff); // one-way discharge efficiency
    this.soc = cfg.socInitial;                       // state of charge, 0-1
  }

  // Restores the starting SOC
  reset() {
    this.soc = this.cfg.socInitial;
  }

  // Takes step length (h), returns max charge power (MW): rated x taper, capped by SOC headroom
  chargeLimitMw(dtHours) {
    const { powerMw, energyMwh, socMax } = this.cfg;
    const taperedMw = powerMw * chargeTaperFraction(this.soc, this.cfg);
    // Power that would fill the battery exactly to socMax in this step
    const headroomMw = Math.max(0, socMax - this.soc) * energyMwh / (this.etaCharge * dtHours);
    return Math.min(taperedMw, headroomMw);
  }

  // Takes step length (h), returns max discharge power (MW): rated x taper, capped by energy above socMin
  dischargeLimitMw(dtHours) {
    const { powerMw, energyMwh, socMin } = this.cfg;
    const taperedMw = powerMw * dischargeTaperFraction(this.soc, this.cfg);
    // Power that would empty the battery exactly to socMin in this step
    const availableMw = Math.max(0, this.soc - socMin) * energyMwh * this.etaDischarge / dtHours;
    return Math.min(taperedMw, availableMw);
  }

  // Takes charge and discharge power (MW, both >= 0) and step length (h); updates and returns SOC
  step(chargeMw, dischargeMw, dtHours) {
    const chg = safeNonNeg(chargeMw);
    const dis = safeNonNeg(dischargeMw);
    const deltaMwh = (this.etaCharge * chg - dis / this.etaDischarge) * dtHours;
    const next = this.soc + deltaMwh / this.cfg.energyMwh;
    // Clamp: limits already keep SOC inside the window; this only absorbs float rounding.
    // NaN guard: if anything went wrong, hold the previous SOC rather than propagate NaN.
    this.soc = clamp(finiteOr(next, this.soc), this.cfg.socMin, this.cfg.socMax);
    return this.soc;
  }
}
