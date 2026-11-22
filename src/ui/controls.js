/*
 * PURPOSE:    lil-gui control panel. Every control writes an input field on the shared state;
 *             the model picks it up on the next frame.
 * USED BY:    src/ui/hud.js
 * DEPENDS ON: lil-gui, src/config.js (WIND, SOLAR, SIM)
 * UNITS:      m/s, W/m2, fraction 0-1, sim hours per real second.
 */
import GUI from 'lil-gui';
import { WIND, SOLAR, SIM } from '../config.js';

// Takes state; builds the panel and returns the GUI (so the HUD can show/hide it)
export function createControls(state) {
  const gui = new GUI({ title: 'Microgrid controls', width: 290 });
  const levels = SOLAR.irradianceLevelsWm2;

  // Weather: the two renewable inputs
  const weather = gui.addFolder('Weather');
  weather.add(state, 'windSpeedMs', 0, WIND.sliderMaxMs, 0.1).name('Wind speed (m/s)');
  weather.add(state, 'irradianceWm2', {
    [`Low (${levels.low} W/m²)`]: levels.low,
    [`Medium (${levels.medium} W/m²)`]: levels.medium,
    [`High (${levels.high} W/m²)`]: levels.high,
  }).name('Irradiance');
  weather.add(state, 'diurnalSunEnabled').name('Sun follows time of day');

  // Data center: workload mode, mixed split (only active in MIXED), rack profile
  const dc = gui.addFolder('GT Computing Data Center');
  const mode = dc.add(state, 'dcMode', { TRAINING: 'training', INFERENCE: 'inference', MIXED: 'mixed' })
    .name('Workload');
  const split = dc.add(state, 'mixedTrainingFraction', 0, 1, 0.05).name('Training share (mixed)');
  mode.onChange(() => split.enable(state.dcMode === 'mixed'));
  split.enable(state.dcMode === 'mixed');
  dc.add(state, 'rackProfile', {
    'GB300 NVL72': 'gb300',
    'Vera Rubin NVL144 (projected, unconfirmed)': 'rubin',
  }).name('Rack profile');

  // Grid: breaker open = islanded
  const grid = gui.addFolder('Grid');
  grid.add(state, 'gridBreakerClosed').name('Grid breaker closed');
  // Grid-tied battery reserve: kept for outages, refilled from the grid when below it
  grid.add(state, 'bessReserveSoc', 0, 0.8, 0.05).name('Battery backup reserve');

  // Simulation clock
  const clock = gui.addFolder('Simulation');
  clock.add(state, 'speedSimHoursPerSec', SIM.minSpeedSimHoursPerSec, SIM.maxSpeedSimHoursPerSec, 0.25)
    .name('Speed (sim h per s)');
  clock.add(state, 'paused').name('Pause  [P]').listen();
  clock.add({ reset: () => { state.resetRequested = true; } }, 'reset').name('Reset simulation');

  // State is the source of truth: every control re-reads it each frame (hotkeys, console, reset)
  for (const controller of gui.controllersRecursive()) {
    if (controller.property !== 'reset') controller.listen();
  }
  return gui;
}
