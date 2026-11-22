/*
 * PURPOSE:    The single shared state object. UI writes inputs, model writes outputs,
 *             render reads both. Nothing else holds simulation data.
 * USED BY:    src/model/simulation.js, (later) src/main.js, src/ui/*, src/render/*, test/*
 * DEPENDS ON: src/config.js
 * UNITS:      noted per field. Powers in MW (all >= 0; direction is in the field name).
 */
import { SIM, WIND, SOLAR, BESS, DATACENTER, GRID } from './config.js';

// Returns a fresh daily-energy accumulator; every field in MWh
export function createDailyTotals() {
  return {
    windMwh: 0, pvMwh: 0, loadMwh: 0,        // available renewables, facility demand
    importMwh: 0, exportMwh: 0,              // utility exchange
    chgMwh: 0, disMwh: 0,                    // battery throughput at the bus
    curtailedMwh: 0, unservedMwh: 0,         // spilled generation, dropped load
  };
}

// Returns preallocated ring buffers for charts (no allocation while running)
function createHistory(length) {
  return {
    length,                                  // capacity (points)
    count: 0,                                // points written so far (<= length)
    head: 0,                                 // next write index
    timeH: new Float64Array(length),         // sim time of each point (h)
    windMw: new Float32Array(length),        // wind output (MW)
    pvMw: new Float32Array(length),          // PV output (MW)
    loadMw: new Float32Array(length),        // facility load (MW)
    bessMw: new Float32Array(length),        // battery power, + discharge / - charge (MW)
    gridMw: new Float32Array(length),        // grid power, + import / - export (MW)
    soc: new Float32Array(length),           // battery SOC (0-1)
  };
}

// Returns a complete state object populated with config defaults
export function createState() {
  return {
    // --- Inputs (written by UI) ---
    windSpeedMs: WIND.defaultWindSpeedMs,                              // hub-height wind (m/s)
    irradianceWm2: SOLAR.irradianceLevelsWm2[SOLAR.defaultLevel],      // peak irradiance (W/m2)
    diurnalSunEnabled: false,                                          // shape irradiance over the day
    dcMode: DATACENTER.defaultMode,                                    // 'training' | 'inference' | 'mixed'
    mixedTrainingFraction: DATACENTER.defaultMixedTrainingFraction,    // training share in mixed (0-1)
    rackProfile: DATACENTER.defaultProfile,                            // 'gb300' | 'rubin'
    gridBreakerClosed: GRID.defaultBreakerClosed,                      // false = islanded
    speedSimHoursPerSec: SIM.defaultSpeedSimHoursPerSec,               // sim hours per real second
    paused: false,                                                     // halt the clock
    resetRequested: false,                                             // one-shot; loop clears it

    // --- Time (written by simulation) ---
    simTimeH: 0,                                                       // elapsed sim time (h)
    hourOfDay: SIM.startHourOfDay,                                     // 0-24 (h)
    dayIndex: 0,                                                       // whole days elapsed
    stepAccumulatorH: 0,                                               // unspent real time (h)

    // --- Outputs (written by model) ---
    pWindMw: 0,            // wind available (MW)
    pPvMw: 0,              // PV available after clipping (MW)
    effectiveIrradianceWm2: 0, // irradiance actually used this step (W/m2)
    rotorRpm: 0,           // turbine rotor speed (rpm, visual)
    dcUtilization: 0,      // fleet GPU utilization (0-1)
    pItMw: 0,              // IT load (MW)
    pLoadMw: 0,            // facility load = IT x PUE (MW)
    sLoadMva: 0,           // facility apparent power (MVA)
    pBessChgMw: 0,         // battery charging (MW)
    pBessDisMw: 0,         // battery discharging (MW)
    bessChgLimitMw: 0,     // charge limit after taper and headroom (MW)
    bessDisLimitMw: 0,     // discharge limit after taper and energy (MW)
    soc: BESS.socInitial,  // battery state of charge (0-1)
    pGridImportMw: 0,      // from utility (MW)
    pGridExportMw: 0,      // to utility (MW)
    pCurtailedMw: 0,       // spilled renewables (MW)
    pWindDeliveredMw: 0,   // wind actually injected = available minus its curtailment share (MW)
    pPvDeliveredMw: 0,     // PV actually injected = available minus its curtailment share (MW)
    pUnservedMw: 0,        // load not supplied (MW)
    xfmrSMva: 0,           // transformer apparent power (MVA, display)
    xfmrLoadingPu: 0,      // transformer loading (pu of 30 MVA, display)
    xfmrLossMw: 0,         // transformer losses (MW, display only, not in balance)
    busNetMw: 0,           // renewables minus load before dispatch (MW)
    busResidualMw: 0,      // balance error this step (MW), should be ~0
    busBalanceOk: true,    // |residual| < tolerance this step
    maxAbsResidualMw: 0,   // worst |residual| since reset (MW)
    stepCount: 0,          // fixed steps since reset

    daily: createDailyTotals(),             // current sim day (MWh)
    previousDay: createDailyTotals(),       // last completed day (MWh)
    history: createHistory(SIM.historyLength),
  };
}

// The app-wide instance. Tests create their own with createState().
export const state = createState();
