/*
 * PURPOSE:    Bookkeeping after each step: daily energy totals (with midnight roll-over)
 *             and the chart ring buffers. No physics here.
 * USED BY:    src/model/simulation.js
 * DEPENDS ON: src/config.js (SIM), src/state.js (createDailyTotals)
 * UNITS:      power in MW, step in hours, energy in MWh.
 */
import { SIM } from '../config.js';
import { createDailyTotals } from '../state.js';

// Takes state and step (h); adds this step's energy to the daily totals
export function accumulateDaily(state, dtHours) {
  const d = state.daily;
  d.windMwh += state.pWindMw * dtHours;
  d.pvMwh += state.pPvMw * dtHours;
  d.loadMwh += state.pLoadMw * dtHours;
  d.importMwh += state.pGridImportMw * dtHours;
  d.exportMwh += state.pGridExportMw * dtHours;
  d.chgMwh += state.pBessChgMw * dtHours;
  d.disMwh += state.pBessDisMw * dtHours;
  d.curtailedMwh += state.pCurtailedMw * dtHours;
  d.unservedMwh += state.pUnservedMw * dtHours;
}

// Takes state (after the clock has advanced); at a new sim day, moves daily into previousDay
export function rollOverDay(state) {
  const day = Math.floor((SIM.startHourOfDay + state.simTimeH) / 24);
  if (day === state.dayIndex) return;
  Object.assign(state.previousDay, state.daily);
  Object.assign(state.daily, createDailyTotals());
  state.dayIndex = day;
}

// Takes state; appends the current outputs to the chart ring buffers
export function recordHistory(state) {
  const h = state.history;
  const i = h.head;
  h.timeH[i] = state.simTimeH;
  h.windMw[i] = state.pWindMw;
  h.pvMw[i] = state.pPvMw;
  h.loadMw[i] = state.pLoadMw;
  h.bessMw[i] = state.pBessDisMw - state.pBessChgMw;   // + discharge / - charge
  h.gridMw[i] = state.pGridImportMw - state.pGridExportMw; // + import / - export
  h.soc[i] = state.soc;
  h.head = (i + 1) % h.length;
  h.count = Math.min(h.count + 1, h.length);
}
