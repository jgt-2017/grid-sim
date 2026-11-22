# src/render — the 3D world

Three.js (plus its bundled add-ons: Sky, EffectComposer with GTAO ambient occlusion and bloom,
PointerLockControls, RoundedBoxGeometry, BufferGeometryUtils) only. Reads `state` every frame, never writes it and never computes physics.
Layout numbers (zone positions, spawn points, boards, cable routes, walk speed) are in `WORLD`,
look settings (fog, exposure, bloom, trees, mountains) in `SCENERY`, and maker names in `BRANDS`,
all in `src/config.js`. Visual-only dimensions are named constants at the top of each file.
All textures are drawn procedurally on canvases at start-up: there are no image assets.
Maker names are plain-text wordmarks, not official logo artwork.

## How the files link

```
main.js ──► world.js ──┬─► scene.js ──► sky.js   renderer (pixel ratio ≤ 2), physical sky + baked
                       │                     reflections, haze, sun + shadows
                       ├─► postfx.js         HDR render → AO → sign overlay → bloom → tone map
                       ├─► quality.js        adaptive: high (AO+bloom) → medium → low by frame rate
                       ├─► terrain.js        grass beyond the campus, zone pads; heightAt(x, z), PADS
                       ├─► paving.js         concrete slab campus, edge kerb, asphalt roads, crossing
                       ├─► streetscape.js    road kerbs, street lamps, tree planters
                       ├─► mountains.js      near + distant ranges: warped ridges, slope/height materials
                       ├─► clouds.js         drifting fBm cloud layer (shader)
                       ├─► trees.js          forest + street trees: bark and alpha leaf cards, wind sway
                       │   ├─► treeGeometry.js  broadleaf / conifer wood + foliage-card geometry
                       │   └─► texFoliage.js    leaf cluster, needle branch and bark textures
                       ├─► boards.js         entrance boards per zone (maker, ratings from config)
                       ├─► specBoards.js     datasheet boards: GB300 NVL72 rack and Megapack unit
                       ├─► player.js         walk ⇄ drive (V) ⇄ fly (F), teleports 1-5
                       │   ├─► input.js      held keys, key presses, pointer-locked mouse
                       │   ├─► controls.js   first-person walking (PointerLockControls)
                       │   ├─► vehicle.js    the utility truck model (also the service van)
                       │   ├─► vehicleDynamics.js  arcade handling, terrain follow, collisions
                       │   ├─► chaseCamera.js      spring chase camera with mouse orbit
                       │   └─► flyer.js      flyable drone: momentum flight + chase camera
                       │       └─► droneModel.js   quadcopter model (also the survey drone)
                       ├─► colliders.js      boxes / circles every zone returns, push-out resolver
                       ├─► ambient.js        AnimationMixer keyframes: service van, survey drone
                       ├─► windFarm.js       3 turbines, maker on nacelles, aviation beacons;
                       │                     rotors spin at state.rotorRpm
                       ├─► solarSite.js      instanced PV tables with cell texture; inverter lamps
                       ├─► bessYard.js       instanced battery cabinets (doors, roof fans, maker on
                       │                     ends); status lamps; SOC gauges per block
                       ├─► substation.js     138/34.5 kV yard laid out HV (north) -> T1 (centre) -> MV
                       │   ├─► transformerModel.js   T1: tank, radiators + ONAF fans (>60% load),
                       │   │                         conservator, bushings, berm, nameplate
                       │   ├─► substationParts.js    insulators, disconnects, breaker, gantry
                       │   └─► substationExtras.js   dead-end, arresters, masts, switchgear, SST
                       ├─► gridLine.js       138 kV towers and conductors to the north
                       ├─► dataCenter.js     glass-front halls, rooftop maker sign (follows rack
                       │   └─► dataCenterRacks.js   profile), GPU racks with maker band and LEDs,
                       │                     chiller fans spin with load
                       ├─► cables.js         cable routes + one InstancedMesh of flow particles
                       │                     (direction/speed/size from model/feeders.js)
                       ├─► labels.js         floating zone signs (sprites) and text plates
                       └─► signage.js        decals, entrance-board and facade-sign builders
Textures: texGround.js (grass, gravel, asphalt), texPaving.js (concrete slabs and road with
normal / roughness maps), texEquipment.js (PV, cabinets, cladding)
```

## Per-frame rules

- No allocation in `update()`: matrices/vectors are created once and reused.
- Repeated objects (panels, posts, cabinets, chillers, fans, fence posts, particles) are `InstancedMesh`.
- Sign textures are only redrawn when their text changes, at most every `WORLD.labelRefreshMs`.
- Floating signs live in a separate overlay scene so ambient occlusion never darkens them.
- Equipment ratings shown on site (spec boards, entrance boards) are built from `config.js`, whose
  GPU and Megapack values are taken from the vendor datasheets named there.
- The truck and drone are game-feel motion for exploring; they never touch the grid simulation.
- Grass under the campus is sunk 1.5 m so it can never show through the concrete at a distance.
