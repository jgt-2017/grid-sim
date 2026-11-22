# grid-sim

Walkable Three.js simulation of a grid-tied AI data center microgrid (the GT Computing Data Center). Wind, solar, BESS, the
utility and a GB300 data center all connect to one 34.5 kV bus, and the bus's real-power balance is
solved every 15-minute step.

> Status: **Stage 3 of 4**. The model, bus solver, tests, 2D HUD and the walkable 3D site are done.
> Polish and deployment come next.
> The full README (file tree, data flow, assumptions, TUNING) arrives in Stage 4.

Technical report (load-flow backend, generator models, results, vehicle and drone views):
https://claude.ai/artifact/UDVPEgka2TYeS6xhzxo5Vd

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # node --test: model unit tests + bus balance tests
npm run sim:cli      # headless 48 h run, hourly table
npm run sim:cli -- 24 4 600 inference   # hours, wind m/s, irradiance W/m2, mode
```

## Controls

Click the scene to walk · **WASD** move · **Shift** sprint · mouse look · **Esc** release pointer
**V** get in / out of the site truck · driving: **W/S** throttle / brake / reverse · **A/D** steer ·
**Space** handbrake · **Shift** boost · **R** reset · mouse orbits the chase camera
**F** launch / land the drone · flying: **W/A/S/D** move · mouse turns · **Space/E** climb ·
**C/Q** descend · **Shift** boost
**1** Wind farm · **2** Solar site · **3** BESS yard · **4** Substation · **5** Data center
**P** pause · **H** hide/show HUD

## Tuning (so far)

Every number lives in [src/config.js](src/config.js). Values tagged `assumed` there are estimates, not vendor data.

- Maker names on equipment: `BRANDS` (drawn as plain-text wordmarks, not official logos)
- GPU rack ratings: `DATACENTER.profiles.gb300` (Supermicro GB300 NVL72 datasheet, 2025: 132-140 kW/rack)
- Battery backup reserve (grid-tied): `BESS.backupReserveSoc` (default 20%, also a HUD slider) and
  `BESS.gridRechargeMw` (8 MW, assumed). Grid-tied, the battery never discharges below the reserve and
  recharges from the grid when under it; islanded it can use the full 5-100% window.
- Battery unit ratings: `MEGAPACK` (Tesla Megapack datasheet Rev 1.8: 1,264.5 kW / 2,529 kWh, RTE 87%);
  site size = `BESS.unitCount` units
- Look of the world (haze, exposure, bloom, tree count, mountains): `SCENERY`
- Truck handling and chase camera: `VEHICLE`; drone flight: `DRONE`; van / survey drone: `AMBIENT`
- Campus paving, roads, lamps and planters: `WORLD.pavedHalfM`, `WORLD.slabM`, `WORLD.roads`, `WORLD.lampSpacingM`
- Render quality: adapts automatically (`QUALITY`); pin it with `?quality=low|medium|high` in the URL
