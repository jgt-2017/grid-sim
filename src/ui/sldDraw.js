/*
 * PURPOSE:    Canvas drawing primitives for the single-line diagram: feeder flow (glow + chevrons),
 *             transformer and breaker symbols, asset boxes and the bus bar.
 * USED BY:    src/ui/sld.js
 * DEPENDS ON: src/config.js (GRID, COLORS, HUD)
 * UNITS:      MW in; CSS pixels out; time in seconds (animation only).
 */
import { GRID, COLORS, HUD } from '../config.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BOX_H = 50;      // asset box height (px)
export const BUS_Y = 116;     // bus bar y (px)
export const LOWER_Y = 156;   // top of the lower asset boxes (px)

// Draws one feeder: dim base line, glowing line scaled by |MW|, chevrons moving with the flow
export function drawFlow(ctx, x, assetY, busY, intoBusMw, color, timeSec) {
  const magnitude = Math.abs(intoBusMw);
  const frac = Math.min(magnitude / HUD.sldFullScaleMw, 1);   // 0-1 visual intensity
  ctx.save();
  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth = 2;
  line(ctx, x, assetY, x, busY);
  if (magnitude < 0.01) { ctx.restore(); return; }

  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4 + 12 * frac;
  ctx.lineWidth = 2 + 5 * frac;
  line(ctx, x, assetY, x, busY);

  // Chevrons: travel toward the bus when injecting, toward the asset when consuming
  const towardBus = intoBusMw > 0;
  const dirSign = (towardBus ? busY > assetY : assetY > busY) ? 1 : -1;  // +1 = moving down
  const spacing = 16;
  const offset = (timeSec * HUD.sldChevronSpeedPxPerSec * (0.3 + frac)) % spacing;
  const size = 3 + 3 * frac;
  ctx.shadowBlur = 0;
  ctx.strokeStyle = COLORS.textPrimary;
  ctx.lineWidth = 1.5;
  const top = Math.min(assetY, busY) + 6;
  const bottom = Math.max(assetY, busY) - 6;
  for (let y = top + (dirSign > 0 ? offset : spacing - offset); y < bottom; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(x - size, y - size * dirSign);
    ctx.lineTo(x, y);
    ctx.lineTo(x + size, y - size * dirSign);
    ctx.stroke();
  }
  ctx.restore();
}

// Draws the transformer (two linked circles) and the grid breaker on the utility feeder
export function drawGridEquipment(ctx, x, breakerClosed) {
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.textSecondary;
  ctx.fillStyle = COLORS.surface;
  for (const cy of [70, 80]) {
    ctx.beginPath();
    ctx.arc(x, cy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Breaker: filled square = closed; hollow square + "OPEN" with ✕ icon = open
  ctx.fillStyle = breakerClosed ? COLORS.textPrimary : COLORS.surface;
  ctx.strokeStyle = breakerClosed ? COLORS.textPrimary : COLORS.critical;
  ctx.fillRect(x - 5, 96, 10, 10);
  ctx.strokeRect(x - 5, 96, 10, 10);
  ctx.font = `11px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText(`${GRID.xfmrRatingMva} MVA`, x + 12, 75);
  ctx.fillStyle = breakerClosed ? COLORS.textMuted : COLORS.critical;
  ctx.fillText(breakerClosed ? '52 closed' : '✕ 52 OPEN', x + 12, 101);
  ctx.restore();
}

// Draws an asset box: colour stripe for identity, name, MW value, detail line
export function drawAssetBox(ctx, left, top, w, feeder, state) {
  ctx.save();
  ctx.fillStyle = COLORS.surfaceRaised;
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.roundRect(left, top, w, BOX_H, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = feeder.color;
  ctx.fillRect(left + 6, top + 6, 3, BOX_H - 12);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText(feeder.name, left + 15, top + 5, w - 20);
  ctx.font = `600 14px ${FONT}`;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(`${Math.abs(feeder.into(state)).toFixed(2)} MW`, left + 15, top + 19, w - 20);
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText(feeder.detail(state), left + 15, top + 36, w - 20);
  ctx.restore();
}

// Draws the bus bar with its name and the live balance check (icon + label + colour)
export function drawBus(ctx, widthPx, state) {
  ctx.save();
  ctx.strokeStyle = COLORS.textSecondary;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  line(ctx, widthPx * 0.03, BUS_Y, widthPx * 0.97, BUS_Y);
  ctx.font = `11px ${FONT}`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText(`${GRID.mvKv} kV common bus`, widthPx * 0.03, BUS_Y - 6);
  ctx.textAlign = 'right';
  ctx.fillStyle = state.busBalanceOk ? COLORS.good : COLORS.critical;
  const icon = state.busBalanceOk ? '✓' : '✕';
  ctx.fillText(`${icon} balance ${state.busResidualMw.toExponential(1)} MW`, widthPx * 0.97, BUS_Y - 6);
  ctx.restore();
}

function line(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
