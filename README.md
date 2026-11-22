# GT Computing Microgrid

A browser-based, walkable, real-time simulation of a grid-tied AI data center microgrid. Wind, solar, a
battery (BESS), the GT Computing Data Center and a 138/34.5 kV utility connection all meet on **one
34.5 kV bus**, and the simulation solves the real-power balance on that bus every 15 simulated minutes.
The model drives a 3D site (three.js) that you can walk, drive in a sports jeep, or fly over
with a drone, with a heads-up display showing the single-line diagram, bus panel and live charts.

**Live simulation:** https://grid-sim-cfoa.vercel.app

**Technical report** (load-flow backend, generator models, results, vehicle and drone views):
https://claude.ai/artifact/UDVPEgka2TYeS6xhzxo5Vd

## What it models

| Asset | Configuration | Rating |
|---|---|---|
| Wind farm | 3 × 6.0 MW-164 m turbines | 18 MW; cut-in 3, rated 10.5 (assumed), cut-out 25 m/s; cubic power curve |
| Solar PV | 30 MWp DC | 25 MW AC inverter limit; PR 0.85; Low / Medium / High = 200 / 600 / 1000 W/m² |
| Battery | 16 × Tesla Megapack 2-Hour Standard | 40.46 MWh / 20.23 MW; RTE 87%; SOC window 5–100% with charge / discharge taper |
| Data center | 100 × GB300 NVL72 racks (7,200 GPUs) | 132–140 kW per rack (datasheet); PUE 1.25; PF 0.97; training / inference / mixed |
| Grid | 138/34.5 kV, 30 MVA ONAN/ONAF transformer (Z 8%, assumed) | Slack bus, ±25 MW; breaker can open (islanded) |

GPU rack ratings come from the Supermicro GB300 NVL72 datasheet (2025); Megapack ratings from the Tesla
Megapack datasheet (Rev 1.8, June 2020). Everything else marked *assumed* is listed below.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # node --test: 36 model, bus balance and battery recovery tests
npm run build        # production build into dist/
npm run preview      # serve dist/ locally
npm run sim:cli      # headless 48 h run, hourly table
npm run sim:cli -- 24 4 600 inference   # hours, wind m/s, irradiance W/m², mode
```

Append `?quality=low|medium|high` to the URL to pin render quality (otherwise it adapts to the frame rate).

## Controls

| Mode | Keys |
|---|---|
| Walk (default) | Click the scene to capture the mouse · **WASD** move · mouse look · **Shift** sprint · **Esc** release |
| Drive (**V**) | **W/S** throttle / brake / reverse · **A/D** steer · **Space** handbrake · **Shift** boost · **R** reset · mouse orbits the camera |
| Fly (**F**) | **WASD** move · mouse turns · **Space/E** climb · **C/Q** descend · **Shift** boost |
| Anywhere | **1** Wind · **2** Solar · **3** BESS · **4** Substation · **5** Data center · **P** pause · **H** hide HUD |

The HUD controls (top right) set wind speed, irradiance, sun-follows-time-of-day, workload, rack profile,
grid breaker, battery backup reserve and simulation speed.

## Data flow

```
 UI (controls, hotkeys)
   │ write inputs
   ▼
 state.js  ◄──────────────────────────────── outputs written back every step ───┐
   │ read inputs                                                                 │
   ▼                                                                             │
 model/  wind · solar · datacenter · grid · bess  ── available MW, limits ──►  bus.js (dispatch +
                                                                               residual check)
                                                                                 │
 simulation.js: fixed 15-min steps, SOC integration, daily totals, chart history ┘
   │ read outputs (never write)
   ├──► render/  3D world: flows, rotors, gauges, signs, transformer fans …
   └──► ui/      HUD: single-line diagram, bus panel, charts
 config.js feeds every layer (all numbers and assumptions live there)
```

Dependencies point one way: `model/` never imports `render/` or `ui/`; `render/` never changes physics;
`ui/` never calls three.js; `main.js` only wires modules and runs the loop.

### How the bus is solved

Each step, with generation and discharge positive:

`P_pv + P_wind − P_curt + P_dis + P_imp = P_load − P_unserved + P_chg + P_exp`

Single pass, no iteration: renewables are must-take; a surplus charges the battery, then exports (≤ 25 MW),
then curtails; a shortfall discharges the battery, then imports (≤ 25 MW), then sheds load. Grid-tied, the
battery holds a **backup reserve** (default 20%): it does not discharge below it, and if it is below it
(for example after an islanded period) it recharges from the grid at up to 8 MW, trimmed before any load
would be shed. The residual is checked every step (< 1e-6 MW). Transformer losses are display only.

## Project structure

```
index.html                 Page shell: 3D canvas, HUD containers, report link, walk hint
vite.config.js             Build config (three.js in its own chunk)
vercel.json                Vercel build settings (npm run build → dist/)
scripts/sim-cli.js         Headless run: hourly table without graphics
src/
  config.js                Every number and assumption (ratings, layout, look, quality)
  state.js                 The one shared state object: inputs, time, outputs
  main.js                  Wires model, 3D world and HUD; runs the frame loop (no physics)
  model/                   Pure physics, no three.js, no DOM            (see model/README.md)
    wind.js                Turbine power curve and rotor speed
    solar.js               PV output with PR and inverter clipping; optional diurnal shape
    bess.js                Battery class: SOC, taper limits, reserve floor, grid-recharge request
    datacenter.js          GPU utilization by workload, rack power, facility MW / MVA
    grid.js                Import / export limits (breaker), transformer loading and losses
    bus.js                 Single-pass dispatch with reserve recharge; residual check
    feeders.js             MW into the bus per feeder (shared by SLD and 3D cables)
    recorder.js            Daily MWh totals and chart ring buffers
    simulation.js          Fixed-step model, live refresh between steps, real-time accumulator
  render/                  three.js only; reads state, never writes it  (see render/README.md)
    world.js               Builds the site and runs every animated part each frame
    scene.js, sky.js       Renderer, camera, physical sky, baked reflections, haze, sun
    postfx.js, quality.js  GTAO → sign overlay → bloom → tone map; adaptive quality
    terrain.js, paving.js, streetscape.js, mountains.js, clouds.js, trees.js
                           Ground, concrete campus, roads and furniture, backdrop, sky, forest
    windFarm.js, solarSite.js, bessYard.js, dataCenter.js, dataCenterHalls.js, dataCenterRacks.js
                           The generating, storage and load zones
    substation.js, substationParts.js, substationExtras.js, substationYard.js, transformerModel.js
                           The 138/34.5 kV yard with transformer T1 at the centre
    gridLine.js, cables.js The 138 kV line and the live flow particles on every feeder
    labels.js, signage.js, boards.js, specBoards.js, zoneSigns.js
                           Floating signs, entrance boards and datasheet boards
    player.js, playerModes.js, input.js, controls.js
                           Walk / drive / fly modes, keys and mouse, first-person walking
    jeep.js, vehicle.js, vehicleDynamics.js, chaseCamera.js, colliders.js
                           Sports jeep you drive, van model + pose helper, arcade handling, chase camera, collisions
    flyer.js, droneModel.js, ambient.js
                           Flyable drone; keyframe-animated service van and survey drone
    tex*.js, treeGeometry.js
                           Procedural textures (ground, concrete, road, equipment, foliage) and tree geometry
  ui/                      DOM and 2D canvas only; writes inputs, reads outputs (see ui/README.md)
    hud.js, hud.css        HUD root, layout, hotkeys (P, H)
    controls.js            lil-gui panel bound to state inputs
    busPanel.js            Live bus values, balance check, clock, daily MWh
    sld.js, sldDraw.js     Single-line diagram with animated flows
    charts.js, curveCharts.js, timeCharts.js, chart.js, chartTooltip.js
                           Four live charts and the tiny canvas chart helper
  utils/                   units.js (clamp, NaN guard), rng.js (seeded), noise.js (value / fBm / ridged)
test/                      node --test suites (see test/README.md)
```

## Testing

`npm test` runs 36 tests: hand-calculated checks for each model (for example, 12 m/s gives 6 MW per
turbine; a GB300 rack at 95% utilization draws 134.75 kW; 10 MWh in returns 8.7 MWh out), 10,000 seeded
random dispatches checking the residual and every limit, a 30-day randomised run checking every state
value at every step, and battery-recovery scenarios (drain to reserve, recharge when generation returns,
refill the reserve from the grid after islanding).

## Assumptions

Values that are estimates rather than vendor data (all in `src/config.js`):

- Wind: rated speed 10.5 m/s; rotor speed 10 rpm at rated (visual); starting wind 8 m/s.
- Solar: performance ratio 0.85; daylight 06:00–18:00 when the diurnal option is on.
- Battery: starting SOC 50%; backup reserve 20%; grid recharge rate 8 MW; RTE split evenly between charge and discharge.
- Data center: idle rack power 25% of full load; training utilization 0.95; inference 0.40–0.80 peaking at 14:00; PUE 1.25 and PF 0.97 (from the brief).
- Vera Rubin NVL144 profile: every value is a placeholder and shown as "unconfirmed" in the HUD and on site.
- Grid: transformer impedance 8%; core loss 0.1% and copper loss 0.5% of rating (display only).
- Visual scale: the site is not to physical scale (turbines and distances are compressed).

## Tuning

| To change | Edit |
|---|---|
| Turbine count, curve, rated speed | `WIND` in `src/config.js` |
| PV size, PR, inverter limit, irradiance levels | `SOLAR` |
| Battery unit ratings | `MEGAPACK`; number of units: `MEGAPACK_COUNT` |
| Battery taper, SOC window, reserve, grid recharge rate | `BESS` |
| Rack count, rack profiles, PUE, workload shapes | `DATACENTER` |
| Grid limits, transformer rating and losses | `GRID` |
| Time step, speed range, chart history | `SIM` |
| Zone positions, spawn points, roads, cable routes, campus size | `WORLD` |
| Maker names shown on equipment | `BRANDS` |
| Haze, exposure, bloom, trees, mountains, clouds | `SCENERY` |
| Truck handling and chase camera | `VEHICLE` |
| Drone flight | `DRONE` |
| Van and survey drone animation | `AMBIENT` |
| Render quality thresholds | `QUALITY` |
| Colours (HUD and 3D) | `COLORS` |

## Deploying to Vercel

The project is a static Vite build. `vercel.json` sets the build command (`npm run build`) and output
directory (`dist`). Either run `npx vercel --prod` from this folder, or push the repository to GitHub and
import it in the Vercel dashboard (framework preset: Vite).

## Sources

1. Supermicro, GB300 NVL72 SuperCluster datasheet (SRS-GB300-NVL72-M1 / -M0), 2025.
2. Tesla, Megapack datasheet, Rev. 1.8, June 23, 2020.
3. GE Vernova 6.0 MW-164 m onshore wind turbine platform (rated wind speed assumed).
4. three.js r170 and its add-ons (Sky, EffectComposer, GTAOPass, UnrealBloomPass, PointerLockControls, RoundedBoxGeometry).
