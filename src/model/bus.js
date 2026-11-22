/*
 * PURPOSE:    The common 34.5 kV bus solver. One-pass merit-order dispatch, no iteration:
 *             renewables must-take -> BESS -> grid -> curtail / unserved. Optionally the battery is
 *             recharged from the grid (backup-reserve recovery) within the import limit; it never
 *             charges and discharges at once, and recovery charging is trimmed before any load is
 *             shed. Then checks the balance:
 *               (pv + wind - curtailed) + bessDis + gridImport = (load - unserved) + bessChg + gridExport
 * USED BY:    src/model/simulation.js, test/bus.test.js
 * DEPENDS ON: src/config.js (BUS), src/utils/units.js
 * UNITS:      all powers in MW, all >= 0 (direction is carried by which field is non-zero).
 */
import { BUS } from '../config.js';
import { safeNonNeg } from '../utils/units.js';

// Takes an out object; zeroes every field dispatch() writes. Reused to avoid per-step allocation.
export function createDispatchResult() {
  return {
    bessChgMw: 0, bessDisMw: 0,          // battery charge / discharge
    bessGridChgMw: 0,                    // part of the charge supplied by grid import (recovery)
    gridImportMw: 0, gridExportMw: 0,    // utility import / export
    curtailedMw: 0, unservedMw: 0,       // spilled renewables / dropped load
    netMw: 0,                            // renewables minus load, before dispatch
    residualMw: 0,                       // balance error, should be ~0
    balanceOk: true,                     // |residual| < tolerance
  };
}

// Takes { pvMw, windMw, loadMw, bessChgLimitMw, bessDisLimitMw, importLimitMw, exportLimitMw,
// gridChargeMw } and a result object; fills and returns the result. gridChargeMw (optional) is the
// battery recharge requested from the grid. Inputs are sanitised (NaN -> 0, negatives -> 0).
export function dispatch(input, out = createDispatchResult()) {
  // Block 1: sanitise inputs so a bad value can never reach the balance
  const pv = safeNonNeg(input.pvMw);
  const wind = safeNonNeg(input.windMw);
  const load = safeNonNeg(input.loadMw);
  const chgLimit = safeNonNeg(input.bessChgLimitMw);
  const disLimit = safeNonNeg(input.bessDisLimitMw);
  const importLimit = safeNonNeg(input.importLimitMw);
  const exportLimit = safeNonNeg(input.exportLimitMw);
  const gridCharge = safeNonNeg(input.gridChargeMw);

  // Block 2: net position of must-take renewables against load
  const net = pv + wind - load;
  out.netMw = net;
  out.bessDisMw = 0; out.gridImportMw = 0; out.gridExportMw = 0;
  out.curtailedMw = 0; out.unservedMw = 0;

  // Block 3: battery charge = renewable surplus (up to its limit), raised to any grid recovery request
  const fromSurplus = Math.min(Math.max(net, 0), chgLimit);
  out.bessChgMw = Math.max(fromSurplus, Math.min(gridCharge, chgLimit));
  const balance = net - out.bessChgMw;              // > 0 surplus left over, < 0 shortfall

  if (balance > 0) {
    // Block 4: surplus left -> export, then curtail the rest
    out.gridExportMw = Math.min(balance, exportLimit);
    out.curtailedMw = balance - out.gridExportMw;
  } else if (balance < 0) {
    // Block 5: shortfall -> discharge (only if not charging), then import, then trim any grid
    // recharge before shedding load; whatever is still missing is unserved
    let shortfall = -balance;
    if (out.bessChgMw === 0) {
      out.bessDisMw = Math.min(shortfall, disLimit);
      shortfall -= out.bessDisMw;
    }
    out.gridImportMw = Math.min(shortfall, importLimit);
    shortfall -= out.gridImportMw;
    const trim = Math.min(out.bessChgMw, shortfall);
    out.bessChgMw -= trim;
    out.unservedMw = shortfall - trim;
  }
  out.bessGridChgMw = Math.max(0, out.bessChgMw - fromSurplus);

  // Block 6: verify the bus balance
  out.residualMw = balanceResidualMw(pv, wind, load, out);
  out.balanceOk = Math.abs(out.residualMw) < BUS.residualToleranceMw;
  return out;
}

// Takes available pv, wind, load (MW) and a dispatch result; returns sources minus sinks (MW)
export function balanceResidualMw(pvMw, windMw, loadMw, r) {
  const sources = (pvMw + windMw - r.curtailedMw) + r.bessDisMw + r.gridImportMw;
  const sinks = (loadMw - r.unservedMw) + r.bessChgMw + r.gridExportMw;
  return sources - sinks;
}
