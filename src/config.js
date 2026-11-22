/*
 * PURPOSE:    The single home of every number and assumption in the sim.
 *             Edit values here; no other file should contain tunable constants.
 * USED BY:    src/state.js, src/model/*.js, (later) src/render/*, src/ui/*, test/*.test.js
 * DEPENDS ON: nothing
 * UNITS:      MW, MWh, MVA, kW (rack level), m/s, W/m2, hours, fractions 0-1.
 *             Anything tagged "assumed" is our estimate, not vendor data.
 */

// --- Simulation clock -------------------------------------------------------
// Fixed-step integration keeps the battery maths deterministic and stable.
export const SIM = {
  stepHours: 0.25,                 // fixed model step: 15 min
  defaultSpeedSimHoursPerSec: 1,   // sim hours advanced per real second
  minSpeedSimHoursPerSec: 0.25,    // slider lower bound
  maxSpeedSimHoursPerSec: 24,      // slider upper bound (one day per second)
  maxStepsPerFrame: 200,           // safety cap so a long frame cannot freeze the tab
  historyLength: 192,              // points kept for charts: 192 x 15 min = 48 h
  startHourOfDay: 0,               // sim starts at midnight
};

// --- Wind farm: 3x GE Vernova 6.0 MW-164m -----------------------------------
export const WIND = {
  turbineCount: 3,
  ratedMwPerTurbine: 6.0,          // nameplate per turbine
  cutInMs: 3,                      // below this: no power
  ratedMs: 10.5,                   // assumed rated wind speed
  cutOutMs: 25,                    // above this: turbine shuts down
  maxRotorRpm: 10,                 // assumed rotor speed at rated wind (visual only)
  sliderMaxMs: 30,                 // UI slider range 0-30 m/s
  defaultWindSpeedMs: 8,           // assumed starting wind
};

// --- Solar site: 30 MWp ------------------------------------------------------
export const SOLAR = {
  dcRatingMwp: 30,                 // array DC nameplate at STC
  stcIrradianceWm2: 1000,          // standard test condition irradiance
  performanceRatio: 0.85,          // assumed system losses (temperature, soiling, wiring)
  inverterAcLimitMw: 25,           // AC clipping limit
  irradianceLevelsWm2: { low: 200, medium: 600, high: 1000 },
  defaultLevel: 'high',
  sunriseHour: 6,                  // assumed; only used if diurnal sun is enabled
  sunsetHour: 18,                  // assumed; only used if diurnal sun is enabled
};

// --- BESS: Tesla Megapack 3 / Megablock, 2 blocks ----------------------------
export const BESS = {
  blockCount: 2,
  energyMwh: 40,                   // usable capacity, both blocks
  powerMw: 20,                     // inverter power limit, charge and discharge
  roundTripEff: 0.91,              // split evenly: eta = sqrt(0.91) ~ 0.954 each way
  socMin: 0.05,                    // lower SOC bound (5%)
  socMax: 1.0,                     // upper SOC bound (100%)
  socInitial: 0.5,                 // assumed starting SOC
  chargeTaperStartSoc: 0.8,        // charge limit starts falling here...
  chargeTaperEndFraction: 0.1,     // ...down to 10% of powerMw at socMax
  dischargeTaperStartSoc: 0.2,     // discharge limit starts falling here, to 0 at socMin
};

// --- Data center: NVIDIA rack profiles ---------------------------------------
export const DATACENTER = {
  rackCount: 100,                  // 100 racks x 72 GPUs = 7,200 GPUs
  pue: 1.25,                       // facility power / IT power
  powerFactor: 0.97,               // facility PF (display only, MVA)
  defaultProfile: 'gb300',
  profiles: {
    gb300: {
      label: 'NVIDIA GB300 NVL72',
      confirmed: true,
      gpusPerRack: 72,
      rackTdpKw: 135,              // rack TDP
      rackPeakKw: 155,             // ceiling used only as a clamp
      idleFraction: 0.25,          // assumed idle power as a fraction of TDP
    },
    rubin: {
      label: 'Vera Rubin NVL144 (projected)',
      confirmed: false,            // UI shows an "unconfirmed" badge
      gpusPerRack: 144,            // assumed GPU dies per rack (from the product name)
      rackTdpKw: 190,              // assumed placeholder, not vendor data
      rackPeakKw: 210,             // assumed placeholder, not vendor data
      idleFraction: 0.25,          // assumed
    },
  },
  trainingUtilization: 0.95,       // assumed flat utilization in TRAINING mode
  inferenceMinUtilization: 0.40,   // trough of the diurnal wave
  inferenceMaxUtilization: 0.80,   // peak of the diurnal wave
  inferencePeakHour: 14,           // assumed hour of peak inference demand
  defaultMode: 'training',
  defaultMixedTrainingFraction: 0.5,
};

// --- Grid connection: 138/34.5 kV substation (slack bus) --------------------
export const GRID = {
  hvKv: 138,
  mvKv: 34.5,
  xfmrRatingMva: 30,               // ONAN/ONAF top rating
  xfmrImpedancePu: 0.08,           // assumed %Z (display only)
  importLimitMw: 25,               // max import from the utility
  exportLimitMw: 25,               // max export to the utility
  noLoadLossFraction: 0.001,       // core loss = 0.1% of rating (display only)
  fullLoadLossFraction: 0.005,     // copper loss at rated MVA = 0.5% (display only)
  defaultBreakerClosed: true,
};

// --- Bus solver --------------------------------------------------------------
export const BUS = {
  residualToleranceMw: 1e-6,       // balance must hold to within this
};

// --- Colours (shared by UI and, later, render) --------------------------------
// Series hues in validated dark-mode order; wind/solar/load share a chart so they hold slots 1-3.
// Status colours are reserved for state and always paired with an icon + label.
export const COLORS = {
  wind: '#3987e5',                 // slot 1 blue
  solar: '#d95926',                // slot 2 orange
  load: '#199e70',                 // slot 3 aqua
  bess: '#c98500',                 // slot 4 amber
  grid: '#d55181',                 // slot 5 magenta
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  surface: '#1a1a19',              // panel / chart surface
  surfaceRaised: '#262624',        // boxes and tooltips on the surface
  page: '#0d0d0d',                 // page plane behind the HUD
  textPrimary: '#f0efec',
  textSecondary: '#c3c2b7',
  textMuted: '#898781',
  gridline: '#2c2c2a',
  axis: '#383835',
};

// --- HUD behaviour -------------------------------------------------------------
export const HUD = {
  panelRefreshMs: 100,             // bus panel text refresh interval (readability)
  sldFullScaleMw: 25,              // flow at which SLD lines reach full width and glow
  sldChevronSpeedPxPerSec: 40,     // chevron speed at full scale
  chartWindowHours: 48,            // time-series chart span
  chartTickHours: 12,              // x tick spacing on time-series charts
};
