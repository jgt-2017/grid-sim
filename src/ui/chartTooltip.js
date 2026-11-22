/*
 * PURPOSE:    Hover crosshair + tooltip box for the canvas charts.
 * USED BY:    src/ui/curveCharts.js, src/ui/timeCharts.js
 * DEPENDS ON: src/ui/chart.js (drawText, CHART_FONT), src/config.js (COLORS)
 * UNITS:      CSS pixels.
 */
import { COLORS } from '../config.js';
import { drawText, CHART_FONT } from './chart.js';

// Takes chart, crosshair x (px) and rows [{ color, text }]; draws crosshair + tooltip box
export function drawTooltip(c, px, rows) {
  const ctx = c.ctx;
  ctx.strokeStyle = COLORS.textMuted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(px) + 0.5, c.margin.top);
  ctx.lineTo(Math.round(px) + 0.5, c.heightPx - c.margin.bottom);
  ctx.stroke();

  // Box size from the widest row; flip to the left of the pointer near the right edge
  ctx.font = CHART_FONT;
  let widest = 0;
  for (const row of rows) widest = Math.max(widest, ctx.measureText(row.text).width);
  const boxW = widest + 26;
  const boxH = rows.length * 15 + 8;
  const left = px + 8 + boxW > c.widthPx ? px - 8 - boxW : px + 8;
  ctx.fillStyle = COLORS.surfaceRaised;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.roundRect(left, c.margin.top, boxW, boxH, 4);
  ctx.fill();
  ctx.stroke();
  rows.forEach((row, i) => {
    const y = c.margin.top + 5 + i * 15;
    if (row.color) {
      ctx.fillStyle = row.color;
      ctx.fillRect(left + 7, y + 2, 8, 8);
    }
    drawText(c, left + 20, y, row.text, 'left', COLORS.textPrimary);
  });
}
