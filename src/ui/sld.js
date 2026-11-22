/*
 * PURPOSE:    Single-line diagram HUD: every asset hangs off the 34.5 kV bus; glowing lines with
 *             moving chevrons show direction (toward bus = injecting) and size of each MW flow.
 * USED BY:    src/ui/hud.js
 * DEPENDS ON: src/config.js (WIND, SOLAR, BESS, GRID, COLORS), src/ui/sldDraw.js, src/model/feeders.js
 * UNITS:      MW from state; canvas in CSS pixels; time in seconds (animation only).
 */
import { WIND, SOLAR, BESS, GRID, COLORS } from '../config.js';
import { BOX_H, BUS_Y, LOWER_Y, drawFlow, drawGridEquipment, drawAssetBox, drawBus } from './sldDraw.js';
import { feederIntoBusMw } from '../model/feeders.js';

// Static layout. into(state) returns MW flowing INTO the bus (negative = drawn from the bus).
const FEEDERS = [
  { name: `Utility ${GRID.hvKv} kV`, color: COLORS.grid, xFrac: 0.5, above: true,
    into: (s) => feederIntoBusMw(s, 'grid'), detail: gridDetail },
  { name: `Wind ${WIND.turbineCount * WIND.ratedMwPerTurbine} MW`, color: COLORS.wind, xFrac: 0.125,
    into: (s) => feederIntoBusMw(s, 'wind'), detail: (s) => `${s.windSpeedMs.toFixed(1)} m/s` },
  { name: `Solar ${SOLAR.dcRatingMwp} MWp`, color: COLORS.solar, xFrac: 0.375,
    into: (s) => feederIntoBusMw(s, 'solar'), detail: (s) => `${s.effectiveIrradianceWm2.toFixed(0)} W/m²` },
  { name: `BESS ${BESS.powerMw} MW / ${BESS.energyMwh} MWh`, color: COLORS.bess, xFrac: 0.625,
    into: (s) => feederIntoBusMw(s, 'bess'), detail: bessDetail },
  { name: 'GT Computing DC', color: COLORS.load, xFrac: 0.875,
    into: (s) => feederIntoBusMw(s, 'load'), detail: (s) => `${(s.dcUtilization * 100).toFixed(0)}% GPU util` },
];

function gridDetail(s) {
  if (!s.gridBreakerClosed) return 'Breaker open · islanded';
  if (s.pGridImportMw > 0) return 'Importing';
  return s.pGridExportMw > 0 ? 'Exporting' : 'Idle';
}

function bessDetail(s) {
  const holding = s.gridBreakerClosed && s.soc <= s.bessReserveSoc + 0.005;
  const mode = s.pBessDisMw > 0 ? 'Discharging'
    : s.pBessGridChgMw > 0.005 ? 'Grid recharge'
      : s.pBessChgMw > 0 ? 'Charging' : holding ? 'Reserve' : 'Idle';
  return `SOC ${(s.soc * 100).toFixed(0)}% · ${mode}`;
}

// Takes the SLD canvas; returns { draw(state, timeSec) }
export function createSld(canvas) {
  const ctx = canvas.getContext('2d');
  let widthPx = 0;

  function syncSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    widthPx = w;
  }

  function draw(state, timeSec) {
    syncSize();
    const boxW = Math.min(150, widthPx / 4 - 10);
    for (const f of FEEDERS) {
      const x = Math.round(f.xFrac * widthPx);
      const assetEndY = f.above ? 8 + BOX_H : LOWER_Y;
      drawFlow(ctx, x, assetEndY, BUS_Y, f.into(state), f.color, timeSec);
      if (f.above) drawGridEquipment(ctx, x, state.gridBreakerClosed);
      drawAssetBox(ctx, x - boxW / 2, f.above ? 8 : LOWER_Y, boxW, f, state);
    }
    drawBus(ctx, widthPx, state);
  }
  return { draw };
}
