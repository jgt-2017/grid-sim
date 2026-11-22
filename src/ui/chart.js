/*
 * PURPOSE:    Tiny canvas line-chart helper: sizing (pixel ratio capped at 2), scales, gridlines,
 *             series, markers, reference lines and text. Tooltip lives in chartTooltip.js.
 * USED BY:    src/ui/curveCharts.js, src/ui/timeCharts.js, src/ui/chartTooltip.js
 * DEPENDS ON: src/config.js (COLORS)
 * UNITS:      data units in, CSS pixels on screen.
 */
import { COLORS } from '../config.js';

const FONT = '11px system-ui, -apple-system, "Segoe UI", sans-serif';

export const CHART_FONT = FONT;

// Takes a canvas and { marginRight }; returns a chart object holding context, scales and hover
export function createChart(canvas, options = {}) {
  const chart = {
    canvas,
    ctx: canvas.getContext('2d'),
    margin: { left: 34, right: options.marginRight ?? 10, top: 10, bottom: 18 }, // px around plot
    widthPx: 0, heightPx: 0,                 // CSS size of the canvas
    xMin: 0, xMax: 1, yMin: 0, yMax: 1,      // current data window
    hoverPx: -1,                             // pointer x in CSS px; -1 = not hovering
  };
  canvas.addEventListener('pointermove', (e) => { chart.hoverPx = e.offsetX; });
  canvas.addEventListener('pointerleave', () => { chart.hoverPx = -1; });
  return chart;
}

// Data -> pixel and pixel -> data conversions for the plot area
export function xToPx(c, x) {
  const w = c.widthPx - c.margin.left - c.margin.right;
  return c.margin.left + ((x - c.xMin) / (c.xMax - c.xMin)) * w;
}
export function yToPx(c, y) {
  const h = c.heightPx - c.margin.top - c.margin.bottom;
  return c.margin.top + (1 - (y - c.yMin) / (c.yMax - c.yMin)) * h;
}
export function pxToX(c, px) {
  const w = c.widthPx - c.margin.left - c.margin.right;
  return c.xMin + ((px - c.margin.left) / w) * (c.xMax - c.xMin);
}

// Matches the backing store to CSS size; reallocates only when the size actually changes
function syncSize(c) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.canvas.clientWidth;
  const h = c.canvas.clientHeight;
  if (c.canvas.width !== Math.round(w * dpr) || c.canvas.height !== Math.round(h * dpr)) {
    c.canvas.width = Math.round(w * dpr);
    c.canvas.height = Math.round(h * dpr);
  }
  c.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.widthPx = w;
  c.heightPx = h;
}

// Takes chart and { xMin, xMax, yMin, yMax, xStep, yStep, formatX, formatY }; clears and draws axes.
// Recessive chrome: hairline gridlines, muted tick labels, one baseline at y = 0 (or yMin).
export function beginChart(c, axes) {
  syncSize(c);
  Object.assign(c, { xMin: axes.xMin, xMax: axes.xMax, yMin: axes.yMin, yMax: axes.yMax });
  const ctx = c.ctx;
  ctx.clearRect(0, 0, c.widthPx, c.heightPx);
  ctx.font = FONT;
  ctx.lineWidth = 1;

  // Horizontal gridlines with y labels
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let y = Math.ceil(c.yMin / axes.yStep) * axes.yStep; y <= c.yMax + 1e-9; y += axes.yStep) {
    const py = Math.round(yToPx(c, y)) + 0.5;
    ctx.strokeStyle = y === 0 ? COLORS.axis : COLORS.gridline;
    hLine(ctx, c.margin.left, c.widthPx - c.margin.right, py);
    ctx.fillText(axes.formatY(y), c.margin.left - 4, py);
  }

  // X tick labels along the bottom
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = Math.ceil(c.xMin / axes.xStep) * axes.xStep; x <= c.xMax + 1e-9; x += axes.xStep) {
    ctx.fillText(axes.formatX(x), xToPx(c, x), c.heightPx - c.margin.bottom + 4);
  }
}

function hLine(ctx, x0, x1, y) {
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

// Takes chart, point count, x(i) and y(i) accessors, colour, dashed flag; draws a 2px line
export function drawSeries(c, count, xAt, yAt, color, dashed = false) {
  if (count < 2) return;
  const ctx = c.ctx;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.setLineDash(dashed ? [5, 4] : []);
  ctx.beginPath();
  ctx.moveTo(xToPx(c, xAt(0)), yToPx(c, yAt(0)));
  for (let i = 1; i < count; i++) ctx.lineTo(xToPx(c, xAt(i)), yToPx(c, yAt(i)));
  ctx.stroke();
  ctx.setLineDash([]);
}

// Takes chart, data x, colour; draws a dashed vertical reference line with an optional top label
export function drawRefLine(c, x, color, label = '') {
  const ctx = c.ctx;
  const px = Math.round(xToPx(c, x)) + 0.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(px, c.margin.top);
  ctx.lineTo(px, c.heightPx - c.margin.bottom);
  ctx.stroke();
  ctx.setLineDash([]);
  if (label) drawText(c, px + 3, c.margin.top, label, 'left', COLORS.textMuted);
}

// Takes chart, data point, colour; draws a 9px marker with a 2px surface ring
export function drawMarker(c, x, y, color) {
  const ctx = c.ctx;
  ctx.beginPath();
  ctx.arc(xToPx(c, x), yToPx(c, y), 4.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.surface;
  ctx.stroke();
}

// Takes chart, pixel position, text, alignment, colour; draws a label (text ink, never series colour)
export function drawText(c, px, py, text, align = 'left', color = COLORS.textSecondary) {
  const ctx = c.ctx;
  ctx.font = FONT;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(text, px, py);
}
