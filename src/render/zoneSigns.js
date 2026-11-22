/*
 * PURPOSE:    The floating sign above each zone: live value text (redrawn a few times a second at
 *             most) and a fade-out when the camera gets close, since signs draw on top of the scene.
 * USED BY:    src/render/world.js
 * DEPENDS ON: src/config.js (WORLD, COLORS), src/render/labels.js (createSign)
 * UNITS:      MW, m/s, W/m2, % from state; distances in metres.
 */
import { WORLD, COLORS } from '../config.js';
import { createSign } from './labels.js';

const FADE = { nearM: 20, farM: 45 };    // fully hidden nearer than nearM, fully shown beyond farM

function bessDetail(s) {
  const soc = `SOC ${(s.soc * 100).toFixed(0)}%`;
  if (s.pBessDisMw > 0) return `${soc} · −${s.pBessDisMw.toFixed(1)} MW`;
  if (s.pBessChgMw > 0) return `${soc} · +${s.pBessChgMw.toFixed(1)} MW`;
  return `${soc} · idle`;
}

function gridDetail(s) {
  if (!s.gridBreakerClosed) return 'Islanded';
  if (s.pGridImportMw > 0) return `Import ${s.pGridImportMw.toFixed(1)} MW`;
  if (s.pGridExportMw > 0) return `Export ${s.pGridExportMw.toFixed(1)} MW`;
  return 'Grid idle';
}

// Accent colour and live detail line for each zone's sign
const SIGN_TEXT = {
  wind: { color: COLORS.wind, detail: (s) => `${s.pWindDeliveredMw.toFixed(1)} MW · ${s.windSpeedMs.toFixed(1)} m/s` },
  solar: { color: COLORS.solar, detail: (s) => `${s.pPvDeliveredMw.toFixed(1)} MW · ${s.effectiveIrradianceWm2.toFixed(0)} W/m²` },
  bess: { color: COLORS.bess, detail: bessDetail },
  substation: { color: COLORS.grid, detail: gridDetail },
  datacenter: { color: COLORS.load, detail: (s) => `${s.pLoadMw.toFixed(1)} MW · ${(s.dcUtilization * 100).toFixed(0)}% util` },
};

// Takes the overlay scene and the camera; returns { update(state, dtSec, timeSec) }
export function createZoneSigns(labelScene, camera) {
  const signs = WORLD.zoneOrder.map((key) => {
    const zone = WORLD.zones[key];
    const sign = createSign({ title: zone.label, accentColor: SIGN_TEXT[key].color });
    sign.sprite.position.set(...zone.sign);
    labelScene.add(sign.sprite);
    return { key, label: zone.label, sign };
  });
  let lastTextMs = -Infinity;

  return {
    update(state, dtSec, timeSec) {
      // Text changes a few times a second at most: each change re-uploads a texture
      const refresh = timeSec * 1000 - lastTextMs > WORLD.labelRefreshMs;
      if (refresh) lastTextMs = timeSec * 1000;
      for (let i = 0; i < signs.length; i++) {
        const s = signs[i];
        if (refresh) s.sign.setText(s.label, SIGN_TEXT[s.key].detail(state));
        const d = s.sign.sprite.position.distanceTo(camera.position);
        s.sign.sprite.material.opacity = Math.min(1, Math.max(0, (d - FADE.nearM) / (FADE.farM - FADE.nearM)));
      }
    },
  };
}
