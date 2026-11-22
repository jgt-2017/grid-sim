# grid-sim

Walkable Three.js simulation of a grid-tied AI data center microgrid. Wind, solar, BESS, the
utility and a GB300 data center all connect to one 34.5 kV bus, and the bus's real-power balance is
solved every 15-minute step.

> Status: **Stage 2 of 4**. The model, bus solver, tests and 2D HUD (controls, single-line diagram, bus panel,
> charts) are done. The 3D scene and polish come next.
> The full README (file tree, data flow, assumptions, TUNING) arrives in Stage 4.

## Run

```bash
npm install
npm run dev          # http://localhost:5173 — HUD; P = pause, H = hide HUD
npm test             # node --test: model unit tests + bus balance tests
npm run sim:cli      # headless 48 h run, hourly table
npm run sim:cli -- 24 4 600 inference   # hours, wind m/s, irradiance W/m2, mode
```

## Tuning (so far)

Every number lives in [src/config.js](src/config.js). Values tagged `assumed` there are estimates, not vendor data.
