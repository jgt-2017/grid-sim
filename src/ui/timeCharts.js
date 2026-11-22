/*
 * PURPOSE:    Time-series charts over the last 48 sim hours, read from the state's ring buffers:
 *             (1) wind, solar and load MW, (2) battery SOC.
 * USED BY:    src/ui/charts.js
 * DEPENDS ON: src/ui/chart.js, src/ui/chartTooltip.js, src/config.js (SIM, BESS, COLORS, HUD)
 * UNITS:      sim hours on x; MW or % on y.
 */
import { SIM, BESS, COLORS, HUD } from '../config.js';
import { createChart, beginChart, drawSeries, drawMarker, drawText,
  pxToX, xToPx, yToPx } from './chart.js';
import { drawTooltip } from './chartTooltip.js';

// Takes sim hours; returns a "HH:00" clock label
function clockLabel(simHours) {
  const hour = Math.floor((SIM.startHourOfDay + simHours) % 24);
  return `${String(hour).padStart(2, '0')}:00`;
}

// Takes state; returns the visible window { xMin, xMax } in sim hours (fixed 48 h, scrolling)
function timeWindow(state) {
  const xMax = Math.max(state.simTimeH, HUD.chartWindowHours);
  return { xMin: xMax - HUD.chartWindowHours, xMax };
}

// Takes history and a pixel-derived time; returns the ring-buffer offset (0..count-1) nearest to it
function nearestOffset(h, t, idx) {
  let best = 0;
  for (let i = 1; i < h.count; i++) {
    if (Math.abs(h.timeH[idx(i)] - t) < Math.abs(h.timeH[idx(best)] - t)) best = i;
  }
  return best;
}

// Takes the canvas and state; returns { draw(state) } for wind / solar / load MW vs time
export function createGenerationChart(canvas, state) {
  const c = createChart(canvas, { marginRight: 40 });
  const h = state.history;
  const idx = (i) => (h.head - h.count + i + h.length) % h.length; // oldest-first ring index
  const tAt = (i) => h.timeH[idx(i)];
  const series = [
    { name: 'Wind', color: COLORS.wind, data: h.windMw },
    { name: 'Solar', color: COLORS.solar, data: h.pvMw },
    { name: 'Load', color: COLORS.load, data: h.loadMw },
  ];
  for (const s of series) s.yAt = (i) => s.data[idx(i)];
  const labelY = new Float32Array(series.length); // direct-label positions (px), reused
  const order = series.map((_, k) => k);          // label draw order, re-sorted in place

  function draw() {
    // Y range: round the largest visible value up to the next 10 MW
    let peak = 10;
    for (const s of series) for (let i = 0; i < h.count; i++) peak = Math.max(peak, s.yAt(i));
    const axes = { ...timeWindow(state), yMin: 0, yMax: Math.ceil(peak / 10) * 10,
      xStep: HUD.chartTickHours, yStep: 10, formatX: clockLabel, formatY: (v) => v.toFixed(0) };
    beginChart(c, axes);
    for (const s of series) drawSeries(c, h.count, tAt, s.yAt, s.color);
    if (h.count > 0) drawEndLabels();
    if (c.hoverPx >= 0 && h.count > 0) drawHover();
  }

  // Direct labels at the right end of each line, nudged apart so they never overlap
  function drawEndLabels() {
    series.forEach((s, k) => { labelY[k] = yToPx(c, s.yAt(h.count - 1)); });
    // Walk labels bottom-up: keep each 12 px above the one below, and clear of the x-axis labels
    order.sort((a, b) => labelY[b] - labelY[a]);
    let floorPx = c.heightPx - c.margin.bottom - 8;
    for (const k of order) {
      labelY[k] = Math.min(labelY[k], floorPx);
      floorPx = labelY[k] - 12;
    }
    const x = xToPx(c, tAt(h.count - 1)) + 4;
    series.forEach((s, k) => drawText(c, x, labelY[k] - 6, s.name));
  }

  function drawHover() {
    const i = nearestOffset(h, pxToX(c, c.hoverPx), idx);
    const rows = [{ color: null, text: `Day ${Math.floor(tAt(i) / 24) + 1} ${clockLabel(tAt(i))}` }];
    for (const s of series) rows.push({ color: s.color, text: `${s.name} ${s.yAt(i).toFixed(2)} MW` });
    drawTooltip(c, xToPx(c, tAt(i)), rows);
  }
  return { draw };
}

// Takes the canvas and state; returns { draw(state) } for battery SOC vs time
export function createSocChart(canvas, state) {
  const c = createChart(canvas, { marginRight: 18 });
  const h = state.history;
  const idx = (i) => (h.head - h.count + i + h.length) % h.length;
  const tAt = (i) => h.timeH[idx(i)];
  const socAt = (i) => h.soc[idx(i)] * 100;

  function draw() {
    const axes = { ...timeWindow(state), yMin: 0, yMax: 100, xStep: HUD.chartTickHours, yStep: 25,
      formatX: clockLabel, formatY: (v) => `${v}` };
    beginChart(c, axes);
    // Dashed floor at the minimum SOC so the usable window is visible
    c.ctx.strokeStyle = COLORS.textMuted;
    c.ctx.setLineDash([2, 3]);
    c.ctx.beginPath();
    c.ctx.moveTo(c.margin.left, yToPx(c, BESS.socMin * 100));
    c.ctx.lineTo(c.widthPx - c.margin.right, yToPx(c, BESS.socMin * 100));
    c.ctx.stroke();
    c.ctx.setLineDash([]);

    drawSeries(c, h.count, tAt, socAt, COLORS.bess);
    if (h.count > 0) {
      const last = h.count - 1;
      drawMarker(c, tAt(last), socAt(last), COLORS.bess);
      drawText(c, xToPx(c, tAt(last)) - 6, yToPx(c, socAt(last)) - 16, `${socAt(last).toFixed(0)}%`,
        'right', COLORS.textPrimary);
    }
    if (c.hoverPx >= 0 && h.count > 0) {
      const i = nearestOffset(h, pxToX(c, c.hoverPx), idx);
      drawTooltip(c, xToPx(c, tAt(i)), [
        { color: null, text: `Day ${Math.floor(tAt(i) / 24) + 1} ${clockLabel(tAt(i))}` },
        { color: COLORS.bess, text: `SOC ${socAt(i).toFixed(1)}%` },
      ]);
    }
  }
  return { draw };
}
