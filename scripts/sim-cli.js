/*
 * PURPOSE:    Headless run of the model: prints an hourly table so the physics can be checked
 *             without any graphics. Usage: npm run sim:cli -- [hours] [windMs] [irradiance] [mode]
 * USED BY:    npm run sim:cli
 * DEPENDS ON: src/state.js, src/model/simulation.js, src/config.js
 * UNITS:      MW, MWh, SOC shown in %.
 */
import { createState } from '../src/state.js';
import { createSimulation, stepSimulation } from '../src/model/simulation.js';
import { SIM } from '../src/config.js';

// Command-line arguments with defaults (48 h, 6 m/s, 600 W/m2, inference, diurnal sun on)
const [hoursArg, windArg, irrArg, modeArg] = process.argv.slice(2);
const hours = Number(hoursArg ?? 48);
const state = createState();
state.windSpeedMs = Number(windArg ?? 6);
state.irradianceWm2 = Number(irrArg ?? 600);
state.dcMode = modeArg ?? 'inference';
state.diurnalSunEnabled = true;

const sim = createSimulation();
const stepsPerHour = Math.round(1 / SIM.stepHours);
const f = (x) => x.toFixed(2).padStart(7);

console.log('  hour    wind      pv    load  bessDis bessChg  import  export curtail unserv   soc%  resid');
for (let h = 0; h < hours; h++) {
  // Run one hour of fixed steps, print the state at the end of the hour
  for (let s = 0; s < stepsPerHour; s++) stepSimulation(state, sim);
  console.log(
    String(h + 1).padStart(6), f(state.pWindMw), f(state.pPvMw), f(state.pLoadMw),
    f(state.pBessDisMw), f(state.pBessChgMw), f(state.pGridImportMw), f(state.pGridExportMw),
    f(state.pCurtailedMw), f(state.pUnservedMw), (state.soc * 100).toFixed(1).padStart(6),
    state.busResidualMw.toExponential(0).padStart(6),
  );
}

console.log('\nLast full day (MWh):', state.previousDay);
console.log('Max |residual| (MW):', state.maxAbsResidualMw);
