/*
 * PURPOSE:    Entry point. Wires state, model and UI together and runs the frame loop.
 *             Contains no physics.
 * USED BY:    index.html
 * DEPENDS ON: src/state.js, src/model/simulation.js, src/ui/hud.js
 * UNITS:      frame time in ms (browser) converted to seconds for the model.
 */
import { state } from './state.js';
import { createSimulation, advanceSimulation, refreshOutputs } from './model/simulation.js';
import { createHud } from './ui/hud.js';

const MAX_FRAME_SEC = 0.1; // clamp long frames (tab switch) so the sim does not jump ahead

const sim = createSimulation();
const hud = createHud(state);
refreshOutputs(state, sim);

let lastMs = performance.now();

// One frame: advance the fixed-step model, refresh instantaneous outputs, redraw the HUD
function frame(nowMs) {
  const dtSec = Math.min((nowMs - lastMs) / 1000, MAX_FRAME_SEC);
  lastMs = nowMs;
  advanceSimulation(state, sim, dtSec);
  refreshOutputs(state, sim);
  hud.update(state, nowMs);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Exposed for debugging in the browser console
window.gridSim = { state, sim };
