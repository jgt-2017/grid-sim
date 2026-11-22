/*
 * PURPOSE:    Root of the 2D HUD: pushes colour tokens to CSS, creates controls, bus panel, SLD and
 *             charts, binds HUD hotkeys, and redraws everything once per frame.
 * USED BY:    src/main.js
 * DEPENDS ON: src/ui/{controls,busPanel,sld,charts}.js, src/ui/hud.css, src/config.js (COLORS)
 * UNITS:      frame time in ms / s; everything else comes from state.
 */
import './hud.css';
import { COLORS } from '../config.js';
import { createControls } from './controls.js';
import { createBusPanel } from './busPanel.js';
import { createSld } from './sld.js';
import { createCharts } from './charts.js';

// Publishes config colours as CSS custom properties (--c-wind, --c-surface, ...) so CSS and canvas match
function applyColorTokens() {
  const root = document.documentElement.style;
  for (const [key, value] of Object.entries(COLORS)) root.setProperty(`--c-${key}`, value);
}

// Binds P = pause and H = hide/show HUD; ignores keys typed into form fields
function bindKeys(state, hudEl, gui) {
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.code === 'KeyP') state.paused = !state.paused;
    if (e.code === 'KeyH') {
      const hidden = hudEl.classList.toggle('hidden');
      gui.show(!hidden);
    }
  });
}

// Hides the walk hint while the pointer is locked (render/controls.js owns the lock itself)
function bindPointerLockHint() {
  const hint = document.getElementById('hint');
  document.addEventListener('pointerlockchange', () => {
    hint.classList.toggle('locked', document.pointerLockElement !== null);
  });
}

// Takes state; builds the HUD and returns { update(state, nowMs) }
export function createHud(state) {
  applyColorTokens();
  const hudEl = document.getElementById('hud');
  const gui = createControls(state);
  const panel = createBusPanel(document.getElementById('bus-panel'));
  const sld = createSld(document.getElementById('sld'));
  const charts = createCharts(document.getElementById('charts'), state);
  bindKeys(state, hudEl, gui);
  bindPointerLockHint();

  return {
    update(s, nowMs) {
      if (hudEl.classList.contains('hidden')) return;
      panel.update(s, nowMs);
      sld.draw(s, nowMs / 1000);
      charts.draw(s);
    },
  };
}
