/*
 * PURPOSE:    Entry point. Wires state, model, 3D world and HUD together and runs the frame loop.
 *             Contains no physics.
 * USED BY:    index.html
 * DEPENDS ON: src/state.js, src/model/simulation.js, src/render/world.js, src/ui/hud.js
 * UNITS:      frame time in ms (browser) converted to seconds.
 */
import { state } from './state.js';
import { createSimulation, advanceSimulation, refreshOutputs } from './model/simulation.js';
import { createWorld } from './render/world.js';
import { createHud } from './ui/hud.js';

const MAX_FRAME_SEC = 0.1; // clamp long frames (tab switch) so the sim and walking do not jump

const sim = createSimulation();
refreshOutputs(state, sim);
// Optional ?quality=low|medium|high pins the render quality (otherwise it adapts to the frame rate)
const forcedQuality = new URLSearchParams(window.location.search).get('quality') ?? undefined;
const world = createWorld(document.getElementById('scene'), { quality: forcedQuality });
const hud = createHud(state);

let lastMs = performance.now();

// One frame: advance the fixed-step model, refresh instantaneous outputs, draw 3D, draw HUD
function frame(nowMs) {
  const dtSec = Math.min((nowMs - lastMs) / 1000, MAX_FRAME_SEC);
  lastMs = nowMs;
  advanceSimulation(state, sim, dtSec);
  refreshOutputs(state, sim);
  world.update(state, dtSec, nowMs / 1000);
  hud.update(state, nowMs);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Exposed for debugging in the browser console
window.gridSim = { state, sim, world };
