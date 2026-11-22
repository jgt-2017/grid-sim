/*
 * PURPOSE:    The single home of every number and assumption in the sim.
 *             Edit values here; no other file should contain tunable constants.
 * USED BY:    src/state.js, src/model/*.js, src/render/*.js, src/ui/*.js, test/*.test.js
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

// --- BESS: 16 x Tesla Megapack (2-Hour Standard), two blocks of 8 -------------
// Unit ratings from the Tesla Megapack datasheet, Rev 1.8 (June 23, 2020), "2-Hour Standard".
// Energy and RTE per the sheet: at 25 C, including thermal management loads, day 1.
export const MEGAPACK = {
  model: 'Megapack 2-Hour Standard',
  datasheet: 'Tesla Megapack datasheet Rev 1.8, June 2020',
  powerKw: 1264.5,                 // AC power available per Megapack
  energyKwh: 2529,                 // AC energy available per Megapack
  roundTripEff: 0.87,              // round-trip system efficiency (2-hour variants)
  dimsMm: [7168, 1659, 2522],      // W x D x H of the enclosure
  weightKg: 25400,                 // maximum shipping weight, standard
  acVoltage: '380-505 V AC, 3-phase, 50/60 Hz',
  inverterKva: 1573,               // inverter size at 480 V AC, 2-hour
  batteryModules: 17,              // "up to 17 independent battery modules"
  ingress: 'IP66 / NEMA 3R',
  ambientC: [-30, 50],             // operating ambient temperature range
  warrantyYears: 15,               // "standard system warranty of up to 15 years"
};
const MEGAPACK_COUNT = 16;         // site sizing: 16 x 2,529 kWh = 40.46 MWh (spec asked for ~40 MWh)

export const BESS = {
  unitCount: MEGAPACK_COUNT,
  blockCount: 2,                   // laid out as two blocks of 8 (layout only)
  energyMwh: (MEGAPACK_COUNT * MEGAPACK.energyKwh) / 1000,   // 40.464 MWh usable
  powerMw: (MEGAPACK_COUNT * MEGAPACK.powerKw) / 1000,       // 20.232 MW, charge and discharge
  roundTripEff: MEGAPACK.roundTripEff,   // split evenly: eta = sqrt(0.87) ~ 0.933 each way
  socMin: 0.05,                    // lower SOC bound (5%)
  socMax: 1.0,                     // upper SOC bound (100%)
  socInitial: 0.5,                 // assumed starting SOC
  chargeTaperStartSoc: 0.8,        // charge limit starts falling here...
  chargeTaperEndFraction: 0.1,     // ...down to 10% of powerMw at socMax
  dischargeTaperStartSoc: 0.2,     // discharge limit starts falling here, to 0 at socMin
  // Backup reserve (grid-tied only): the battery keeps this much for outages and, if it is below it
  // (e.g. after running islanded), recharges from the grid. Islanded, the full window is usable.
  backupReserveSoc: 0.2,           // assumed default; adjustable in the HUD
  gridRechargeMw: 8,               // assumed maximum recharge rate from the grid (within the import limit)
};

// --- GT Computing Data Center: GPU rack profiles ------------------------------
export const DATACENTER = {
  rackCount: 100,                  // 100 racks x 72 GPUs = 7,200 GPUs
  pue: 1.25,                       // facility power / IT power
  powerFactor: 0.97,               // facility PF (display only, MVA)
  defaultProfile: 'gb300',
  profiles: {
    // Ratings from the Supermicro GB300 NVL72 datasheet (SRS-GB300-NVL72-M1/-M0, 2025)
    gb300: {
      label: 'GB300 NVL72',
      confirmed: true,
      datasheet: 'Supermicro GB300 NVL72 datasheet, 2025',
      gpusPerRack: 72,             // "72x B300 Tensor Core GPUs"
      cpusPerRack: 36,             // "36x 72-core Grace ARM Neoverse V2 CPUs"
      computeTrays: 18,            // "18x 1U ARS-121GL-NB3-LC" (4 GPUs + 2 CPUs each)
      nvlinkSwitchTrays: 9,
      rackTdpKw: 140,              // "Operating Power 132kW to 140kW": full load = top of the range
      rackPeakKw: 140,             // clamp at the datasheet maximum
      rackShelfKw: 132,            // "8x 1U 33kW ... power shelves, total 132kW"
      idleFraction: 0.25,          // assumed idle power as a fraction of full load
      hbmPerGpuGb: 288,            // HBM3e per GPU; 21 TB per rack
      hbmPerRackTb: 21,
      nvlinkTBs: 1.8,              // GPU-to-GPU NVLink bandwidth
      nicGbps: 800,                // ConnectX-8 SuperNIC
      rackDimsMm: [2236, 600, 1068],   // H x W x D
      cduRacksPerInRowUnit: 8,     // "In-Row CDU: Up to 1.8MW ... supports up to 8 racks"
      cduInRowMw: 1.8,
    },
    rubin: {
      label: 'Vera Rubin NVL144 (projected)',
      confirmed: false,            // UI shows an "unconfirmed" badge
      gpusPerRack: 144,            // assumed GPU dies per rack (from the product name)
      rackTdpKw: 190,              // assumed placeholder, not vendor data
      rackPeakKw: 210,             // assumed placeholder, not vendor data
      idleFraction: 0.25,          // assumed
      rackDimsMm: [2236, 600, 1068],   // assumed same rack form factor
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

// --- 3D world (not to physical scale) -----------------------------------------
// Coordinates in metres: x east, z south, y up. Substation at the origin.
// Points are [x, z] on the ground, or [x, y, z] where height matters.
export const WORLD = {
  halfSizeM: 200,                  // walkable half-extent: the site is ~400 m across
  eyeHeightM: 1.7,                 // camera height above ground
  walkSpeedMs: 14,                 // brisk walk; not realistic, keeps 400 m to ~30 s
  sprintMultiplier: 3,             // hold Shift
  pixelRatioMax: 2,
  shadowMapSize: 2048,
  sunDirection: [0.45, 0.8, 0.55], // direction toward the sun (normalised in render)
  zoneOrder: ['wind', 'solar', 'bess', 'substation', 'datacenter'], // hotkeys 1-5
  // Each zone: floating sign [x,y,z], walk spawn [x,z], look target [x,y,z], entrance board [x,z],
  // optional datasheet board [x,z]
  zones: {
    wind:       { label: 'Wind farm',   sign: [105, 30, -88], spawn: [70, -30], lookAt: [105, 40, -125], board: [86, -52] },
    solar:      { label: 'Solar site',  sign: [-110, 12, -8], spawn: [-48, -6], lookAt: [-105, -2, -50], board: [-58, -20] },
    bess:       { label: 'BESS yard',   sign: [-75, 18, 78],  spawn: [-40, 115], lookAt: [-75, 2, 78], board: [-50, 101], specBoard: [-36, 95] },
    substation: { label: 'Substation',  sign: [0, 22, -4],    spawn: [32, 55], lookAt: [0, 4, 0], board: [26, 37] },
    datacenter: { label: 'GT Computing Data Center', sign: [105, 36, 70],  spawn: [50, 135], lookAt: [105, 8, 72], board: [66, 125], specBoard: [74, 136] },
  },
  windTurbines: [[50, -125], [105, -145], [160, -125]], // tower base positions
  solarArray: { center: [-110, -55], rows: 10, tablesPerRow: 14, rowPitchM: 7, tablePitchM: 7.5 },
  bessYard: { center: [-75, 78], unitsPerBlock: 8, blockGapM: 14 },   // 2 x 8 = 16 Megapacks
  dataCenter: { center: [105, 72] },
  busBar: { from: [-12, 26], to: [12, 26] },      // 34.5 kV bus in the substation
  // Paved campus: concrete slabs out to pavedHalfM; natural grass and hills beyond
  pavedHalfM: 205,
  slabM: 6,                        // concrete slab size between saw-cut joints
  // Asphalt roads (axis-aligned): main east-west road and the north-south access road
  roads: {
    widthM: 8,
    eastWest: { z: 112, fromX: -205, toX: 205 },
    northSouth: { x: 0, fromZ: 31, toZ: 205 },
  },
  lampSpacingM: 30,                // street lamps along both sides of each road
  planterSpacingM: 40,             // tree planters along the main road
  // Cable routes from each asset to its bus tap; flow particles move along these
  cables: {
    wind:  [[105, -105], [105, 40], [8, 40], [8, 26]],
    solar: [[-52, -30], [-30, -30], [-30, 40], [-8, 40], [-8, 26]],
    bess:  [[-52, 64], [-4, 64], [-4, 26]],
    load:  [[72, 60], [4, 60], [4, 26]],
    // Grid: overhead line -> dead-end (z -21) -> disconnect -> breaker -> T1 HV bushings -> T1 LV ->
    // rigid bus -> switchgear -> 34.5 kV bus
    grid:  [[0, 18, -200], [0, 18, -125], [0, 18, -60], [0, 12.7, -21], [0, 5.4, -13], [0, 5.8, -7],
            [0, 7.5, 2], [0, 5.7, 4.5], [0, 5.7, 15.5], [0, 3.3, 17], [0, 1.6, 26]],
  },
  particlesPerCable: 48,
  particleBaseSpeedMs: 4,          // speed of flow particles at zero-ish flow
  particleSpeedPerMw: 1.2,         // extra speed per MW
  labelRefreshMs: 250,             // in-world sign text refresh
};

// --- Branding (render only) ------------------------------------------------------
// Maker names drawn on equipment as plain-text wordmarks, not official logo artwork.
// accent: colour of the maker band on entrance boards and signs
export const BRANDS = {
  wind: { maker: 'GE Vernova', model: '6.0 MW-164m', accent: '#005f6b' },
  bess: { maker: 'TESLA', model: 'Megapack', accent: '#c8102e' },
  gpu: { maker: 'GT COMPUTING', name: 'GT Computing Data Center', accent: '#2563c9' }, // site operator; rack model from the profile
  solar: { maker: '', model: 'Utility-scale PV', accent: '#d95926' }, // the spec names no PV vendor
};

// --- Scenery and look (render only) -----------------------------------------------
export const SCENERY = {
  seed: 20261122,                  // fixes tree placement and mountain shape
  treeCount: 1600,
  treeMaxRadiusM: 640,             // trees scattered out to here
  mountainInnerRadiusM: 640,       // near range starts rising here...
  mountainOuterRadiusM: 1500,      // ...and ends here
  mountainHeightM: 380,
  farRangeRadiusM: [1700, 2700],   // distant range, hazed blue by the atmosphere
  farRangeHeightM: 650,
  snowLineFraction: 0.68,          // snow above this share of the peak height (on gentle slopes)
  cloudAltitudeM: 700,
  cloudCoverage: 0.62,             // 0 clear .. 1 overcast
  cloudDriftMs: 6,                 // wind speed of the cloud layer
  fogDensity: 0.0005,              // exponential haze; ~22% at 1 km
  fogColor: '#adc2d6',
  exposure: 0.62,                  // tone-mapping exposure (applied after bloom)
  skyTurbidity: 4,
  skyRayleigh: 1.2,
  environmentIntensity: 0.8,       // sky reflections on metal and glass
  bloomStrength: 0.35,
  bloomRadius: 0.35,
  bloomThreshold: 3.2,             // HDR level; sunlit white stays below, lamps / LEDs / particles go above
};

// --- Drivable site vehicle (render only: arcade handling, not real vehicle dynamics) ---
export const VEHICLE = {
  maxSpeedMs: 22,                  // ~80 km/h
  boostSpeedMs: 32,                // hold Shift
  reverseSpeedMs: 7,
  engineAccelMs2: 9,
  boostAccelMs2: 15,
  brakeDecelMs2: 20,
  dragPerS: 0.25,                  // fraction of speed lost per second (air + rolling)
  maxSteerRad: 0.55,
  steerRatePerS: 4,                // how fast the wheels turn toward the requested angle
  wheelbaseM: 3.2,
  trackM: 1.9,
  wheelRadiusM: 0.45,
  collisionRadiusM: 1.3,           // two circles along the body
  driveHalfSizeM: 560,             // drivable area: well past the site, up to the foothills
  camera: { distanceM: 10, heightM: 3.6, lookAheadM: 4, stiffness: 5 },
  startSpawn: [40, 66],            // where the jeep is parked at start [x, z]
  style: { paint: '#c9400a', trim: '#141518' },   // sports jeep: body paint and black trim
};

// --- Flyable drone (render only: arcade flight for exploring) ----------------------
export const DRONE = {
  cruiseSpeedMs: 18,
  boostSpeedMs: 40,                // hold Shift
  climbSpeedMs: 8,                 // Space / E up, C / Q down
  responsiveness: 3,               // how quickly velocity follows the sticks (1/s)
  minClearanceM: 1.2,              // never closer to the ground than this
  maxAltitudeM: 320,
  flyHalfSizeM: 900,               // can fly out over the mountains
  launchHeightM: 4,
  camera: { distanceM: 7, heightM: 2.2, stiffness: 6 },
  scale: 1.6,                      // model scale (readable from the chase camera)
};

// --- Keyframe-animated site life (render only) ------------------------------------
export const AMBIENT = {
  vanLoopS: 66,                    // service van patrol along the east-west road
  droneAltitudeM: 16,              // inspection drone over the solar field
  droneLoopS: 84,
};

// --- Render quality (adaptive) -----------------------------------------------------
// high: ambient occlusion + bloom; medium: bloom only; low: no post effects, pixel ratio 1.
// Steps down automatically if the frame rate stays below minFps. Override with ?quality=low|medium|high
export const QUALITY = {
  start: 'high',
  minFps: 48,
  warmupS: 3,                      // ignore the first seconds (shader compile, texture upload)
  sampleS: 2,                      // averaging window
  aoRadiusM: 2.2,                  // ambient occlusion reach
};

// --- HUD behaviour -------------------------------------------------------------
export const HUD = {
  panelRefreshMs: 100,             // bus panel text refresh interval (readability)
  sldFullScaleMw: 25,              // flow at which SLD lines reach full width and glow
  sldChevronSpeedPxPerSec: 40,     // chevron speed at full scale
  chartWindowHours: 48,            // time-series chart span
  chartTickHours: 12,              // x tick spacing on time-series charts
};
