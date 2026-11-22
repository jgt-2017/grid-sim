/*
 * PURPOSE:    Runs one fixed model step (assets -> bus -> BESS -> totals -> history) and the
 *             real-time accumulator that decides how many fixed steps to run per frame.
 * USED BY:    src/main.js, scripts/sim-cli.js, test/bus.test.js, test/simulation.test.js, test/feeders.test.js
 * DEPENDS ON: src/config.js, src/state.js, src/model/{wind,solar,bess,datacenter,grid,bus,recorder}.js
 * UNITS:      time in hours (real frame time in seconds), power in MW, energy in MWh, SOC 0-1.
 */
import { SIM, DATACENTER, BESS } from '../config.js';
import { createState } from '../state.js';
import { safeNonNeg, clamp, finiteOr } from '../utils/units.js';
import { farmPowerMw, rotorRpm } from './wind.js';
import { pvAvailableMw, effectiveIrradianceWm2 } from './solar.js';
import { Bess } from './bess.js';
import { fleetUtilization, facilityLoad } from './datacenter.js';
import { gridLimits, transformerLosses, reactiveFromPf } from './grid.js';
import { dispatch, createDispatchResult } from './bus.js';
import { accumulateDaily, rollOverDay, recordHistory } from './recorder.js';

// State keys owned by the UI; reset leaves these alone
const INPUT_KEYS = new Set([
  'windSpeedMs', 'irradianceWm2', 'diurnalSunEnabled', 'dcMode', 'mixedTrainingFraction',
  'rackProfile', 'gridBreakerClosed', 'bessReserveSoc', 'speedSimHoursPerSec', 'paused', 'resetRequested',
]);

// Returns the model's private memory: the battery and reusable scratch objects
export function createSimulation() {
  return { bess: new Bess(), dispatchInput: {}, dispatchResult: createDispatchResult() };
}

// Takes state and sim; restores all outputs, time and SOC to defaults, keeps UI inputs
export function resetSimulation(state, sim) {
  const fresh = createState();
  for (const key of Object.keys(fresh)) {
    if (!INPUT_KEYS.has(key)) state[key] = fresh[key];
  }
  sim.bess.reset();
  state.soc = sim.bess.soc;
}

// Takes state; computes available generation and load for this step and writes them to state
function computeAssets(state) {
  const hour = state.hourOfDay;
  state.pWindMw = farmPowerMw(state.windSpeedMs);
  state.rotorRpm = rotorRpm(state.windSpeedMs);
  state.effectiveIrradianceWm2 = effectiveIrradianceWm2(state.irradianceWm2, hour, state.diurnalSunEnabled);
  state.pPvMw = pvAvailableMw(state.effectiveIrradianceWm2);

  state.dcUtilization = fleetUtilization(state.dcMode, hour, state.mixedTrainingFraction);
  const load = facilityLoad(state.dcUtilization, state.rackProfile);
  state.pItMw = load.itMw;
  state.pLoadMw = load.facilityMw;
  state.sLoadMva = load.facilityMva;
}

// Takes state, sim and step (h); solves the bus and writes the dispatch to state
function solveBus(state, sim, dtHours) {
  const limits = gridLimits(state.gridBreakerClosed);
  const input = sim.dispatchInput;
  input.pvMw = state.pPvMw;
  input.windMw = state.pWindMw;
  input.loadMw = state.pLoadMw;
  // Grid-tied: hold the backup reserve (no discharge below it; recharge from the grid if under it).
  // Islanded: the whole SOC window is usable and there is no grid to recharge from.
  const reserve = state.gridBreakerClosed ? clamp(finiteOr(state.bessReserveSoc, 0), 0, 0.9) : 0;
  input.bessChgLimitMw = state.bessChgLimitMw = sim.bess.chargeLimitMw(dtHours);
  input.bessDisLimitMw = state.bessDisLimitMw = sim.bess.dischargeLimitMw(dtHours, reserve);
  input.gridChargeMw = state.gridBreakerClosed ? sim.bess.gridRechargeMw(dtHours, reserve, BESS.gridRechargeMw) : 0;
  input.importLimitMw = limits.importLimitMw;
  input.exportLimitMw = limits.exportLimitMw;

  const r = dispatch(input, sim.dispatchResult);
  state.pBessChgMw = r.bessChgMw;
  state.pBessDisMw = r.bessDisMw;
  state.pBessGridChgMw = r.bessGridChgMw;
  state.pGridImportMw = r.gridImportMw;
  state.pGridExportMw = r.gridExportMw;
  state.pCurtailedMw = r.curtailedMw;
  state.pUnservedMw = r.unservedMw;
  state.busNetMw = r.netMw;
  state.busResidualMw = r.residualMw;
  state.busBalanceOk = r.balanceOk;
  state.maxAbsResidualMw = Math.max(state.maxAbsResidualMw, Math.abs(r.residualMw));
  splitCurtailment(state);
}

// Takes state; shares curtailment pro rata between PV and wind so each feeder shows what it delivers
function splitCurtailment(state) {
  const renewableMw = state.pPvMw + state.pWindMw;
  const keepFraction = renewableMw > 0 ? 1 - state.pCurtailedMw / renewableMw : 0;
  state.pPvDeliveredMw = state.pPvMw * keepFraction;
  state.pWindDeliveredMw = state.pWindMw * keepFraction;
}

// Takes state; computes transformer flow and losses (display only, never fed back to the bus)
function computeTransformer(state) {
  const gridMw = state.pGridImportMw - state.pGridExportMw;
  const servedMw = state.pLoadMw - state.pUnservedMw;
  const qMvar = reactiveFromPf(servedMw, DATACENTER.powerFactor);
  const x = transformerLosses(gridMw, qMvar, state.gridBreakerClosed);
  state.xfmrSMva = x.sMva;
  state.xfmrLoadingPu = x.loadingPu;
  state.xfmrLossMw = x.lossMw;
}

// Takes state, sim; recomputes the instantaneous outputs from current inputs and SOC without
// advancing time, SOC, totals or history. Lets the HUD react on the next frame, even when paused.
export function refreshOutputs(state, sim) {
  state.hourOfDay = (SIM.startHourOfDay + state.simTimeH) % 24;
  computeAssets(state);
  solveBus(state, sim, SIM.stepHours);
  computeTransformer(state);
}

// Takes state, sim and step (h); runs one complete fixed model step
export function stepSimulation(state, sim, dtHours = SIM.stepHours) {
  state.hourOfDay = (SIM.startHourOfDay + state.simTimeH) % 24;
  computeAssets(state);
  solveBus(state, sim, dtHours);
  state.soc = sim.bess.step(state.pBessChgMw, state.pBessDisMw, dtHours);
  computeTransformer(state);
  recordHistory(state);

  // Advance the clock, then roll the daily totals over at midnight
  accumulateDaily(state, dtHours);
  state.simTimeH += dtHours;
  state.stepCount += 1;
  rollOverDay(state);
}

// Takes state, sim and real frame time (s); runs as many fixed steps as the speed slider allows.
// Returns the number of steps run this frame.
export function advanceSimulation(state, sim, realDtSec) {
  if (state.resetRequested) {
    resetSimulation(state, sim);
    state.resetRequested = false;
  }
  if (state.paused) return 0;

  // Sim hours this frame = real seconds x (sim hours per real second); guard NaN and negatives
  const speed = clamp(finiteOr(state.speedSimHoursPerSec, 1), 0, SIM.maxSpeedSimHoursPerSec);
  state.stepAccumulatorH += safeNonNeg(realDtSec) * speed;

  let steps = 0;
  while (state.stepAccumulatorH >= SIM.stepHours && steps < SIM.maxStepsPerFrame) {
    stepSimulation(state, sim, SIM.stepHours);
    state.stepAccumulatorH -= SIM.stepHours;
    steps += 1;
  }
  // If we hit the cap, drop the backlog instead of spiralling
  if (steps === SIM.maxStepsPerFrame) state.stepAccumulatorH = 0;
  return steps;
}
