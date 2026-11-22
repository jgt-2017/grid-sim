/*
 * PURPOSE:    The two static-curve charts: wind farm power curve with live operating point,
 *             and BESS power limit vs SOC (taper) with the live operating point.
 * USED BY:    src/ui/charts.js
 * DEPENDS ON: src/ui/chart.js, src/ui/chartTooltip.js, src/model/wind.js, src/model/bess.js (pure curve functions),
 *             src/config.js (WIND, BESS, COLORS)
 * UNITS:      wind m/s and MW; SOC in % and MW (discharge +, charge -).
 */
import { WIND, BESS, COLORS } from '../config.js';
import { farmPowerMw } from '../model/wind.js';
import { chargeTaperFraction, dischargeTaperFraction } from '../model/bess.js';
import {
  createChart, beginChart, drawSeries, drawMarker, drawRefLine, drawText,
  pxToX, xToPx, yToPx,
} from './chart.js';
import { drawTooltip } from './chartTooltip.js';

const WIND_SAMPLES = 121;   // 0-30 m/s at 0.25 m/s
const SOC_SAMPLES = 101;    // 0-100 % at 1 %
const farmRatedMw = WIND.turbineCount * WIND.ratedMwPerTurbine;

// Precomputed curves (built once; the model functions are pure so this never goes stale)
const windSpeedMs = new Float32Array(WIND_SAMPLES);
const windFarmMw = new Float32Array(WIND_SAMPLES);
for (let i = 0; i < WIND_SAMPLES; i++) {
  windSpeedMs[i] = (i * WIND.sliderMaxMs) / (WIND_SAMPLES - 1);
  windFarmMw[i] = farmPowerMw(windSpeedMs[i]);
}
const socPct = new Float32Array(SOC_SAMPLES);
const dischargeLimitMw = new Float32Array(SOC_SAMPLES);  // plotted positive
const chargeLimitMw = new Float32Array(SOC_SAMPLES);     // plotted negative
for (let i = 0; i < SOC_SAMPLES; i++) {
  socPct[i] = i;
  dischargeLimitMw[i] = BESS.powerMw * dischargeTaperFraction(i / 100);
  chargeLimitMw[i] = -BESS.powerMw * chargeTaperFraction(i / 100);
}

const fmt0 = (v) => v.toFixed(0);

// Takes the wind-curve canvas; returns { draw(state) }
export function createWindCurveChart(canvas) {
  const c = createChart(canvas);
  const xAt = (i) => windSpeedMs[i];
  const yAt = (i) => windFarmMw[i];
  const axes = { xMin: 0, xMax: WIND.sliderMaxMs, yMin: 0, yMax: 20, xStep: 5, yStep: 5,
    formatX: fmt0, formatY: fmt0 };

  function draw(state) {
    beginChart(c, axes);
    drawRefLine(c, WIND.cutInMs, COLORS.axis, 'in');
    drawRefLine(c, WIND.ratedMs, COLORS.axis, 'rated');
    drawRefLine(c, WIND.cutOutMs, COLORS.axis, 'out');
    drawSeries(c, WIND_SAMPLES, xAt, yAt, COLORS.wind);

    // Live operating point, labelled with its value
    drawMarker(c, state.windSpeedMs, state.pWindMw, COLORS.wind);
    const label = `${state.windSpeedMs.toFixed(1)} m/s · ${state.pWindMw.toFixed(1)} MW`;
    const px = xToPx(c, state.windSpeedMs);
    drawText(c, px > c.widthPx / 2 ? px - 8 : px + 8, yToPx(c, state.pWindMw) + 6, label,
      px > c.widthPx / 2 ? 'right' : 'left', COLORS.textPrimary);

    if (c.hoverPx >= 0) {
      const v = Math.min(Math.max(pxToX(c, c.hoverPx), 0), WIND.sliderMaxMs);
      drawTooltip(c, xToPx(c, v), [
        { color: null, text: `${v.toFixed(1)} m/s` },
        { color: COLORS.wind, text: `Farm ${farmPowerMw(v).toFixed(2)} of ${farmRatedMw} MW` },
      ]);
    }
  }
  return { draw };
}

// Takes the taper canvas; returns { draw(state) }
export function createTaperChart(canvas) {
  const c = createChart(canvas);
  const xAt = (i) => socPct[i];
  const disAt = (i) => dischargeLimitMw[i];
  const chgAt = (i) => chargeLimitMw[i];
  const axes = { xMin: 0, xMax: 100, yMin: -BESS.powerMw, yMax: BESS.powerMw, xStep: 20, yStep: 10,
    formatX: (v) => `${v}%`, formatY: fmt0 };

  function draw(state) {
    beginChart(c, axes);
    drawRefLine(c, BESS.socMin * 100, COLORS.axis, 'min');
    drawSeries(c, SOC_SAMPLES, xAt, disAt, COLORS.bess);
    drawSeries(c, SOC_SAMPLES, xAt, chgAt, COLORS.bess, true);
    drawText(c, xToPx(c, 45), yToPx(c, BESS.powerMw) + 3, 'Discharge limit', 'center');
    drawText(c, xToPx(c, 45), yToPx(c, -BESS.powerMw) - 15, 'Charge limit', 'center');

    // Operating point: actual battery power at the current SOC (discharge +, charge -)
    const socNow = state.soc * 100;
    const powerNowMw = state.pBessDisMw - state.pBessChgMw;
    drawRefLine(c, socNow, COLORS.textMuted);
    drawMarker(c, socNow, powerNowMw, COLORS.bess);

    if (c.hoverPx >= 0) {
      const soc = Math.min(Math.max(pxToX(c, c.hoverPx), 0), 100);
      drawTooltip(c, xToPx(c, soc), [
        { color: null, text: `SOC ${soc.toFixed(0)}%` },
        { color: COLORS.bess, text: `Discharge ≤ ${(BESS.powerMw * dischargeTaperFraction(soc / 100)).toFixed(1)} MW` },
        { color: COLORS.bess, text: `Charge ≤ ${(BESS.powerMw * chargeTaperFraction(soc / 100)).toFixed(1)} MW` },
      ]);
    }
  }
  return { draw };
}
