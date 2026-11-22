/*
 * PURPOSE:    Builds the four chart cards (title, legend, canvas) and redraws them each frame.
 * USED BY:    src/ui/hud.js
 * DEPENDS ON: src/ui/curveCharts.js, src/ui/timeCharts.js, src/config.js (COLORS)
 * UNITS:      none of its own; see the individual charts.
 */
import { COLORS } from '../config.js';
import { createWindCurveChart, createTaperChart } from './curveCharts.js';
import { createGenerationChart, createSocChart } from './timeCharts.js';

// Takes container, title and legend items [{ name, color, dashed }]; returns the card's canvas
function makeCard(container, title, legendItems = []) {
  const card = document.createElement('section');
  card.className = 'panel chart-card';

  const header = document.createElement('header');
  const h = document.createElement('h3');
  h.textContent = title;
  header.appendChild(h);

  // Legend: always present for 2+ series; swatch style mirrors the line (solid / dashed)
  if (legendItems.length > 1) {
    const legend = document.createElement('div');
    legend.className = 'legend';
    for (const item of legendItems) {
      const entry = document.createElement('span');
      const swatch = document.createElement('i');
      swatch.style.borderTopColor = item.color;
      if (item.dashed) swatch.classList.add('dashed');
      entry.append(swatch, item.name);
      legend.appendChild(entry);
    }
    header.appendChild(legend);
  }

  const canvas = document.createElement('canvas');
  card.append(header, canvas);
  container.appendChild(card);
  return canvas;
}

// Takes the charts container and state; returns { draw(state) }
export function createCharts(container, state) {
  const charts = [
    createWindCurveChart(makeCard(container, 'Wind farm power curve (MW vs m/s)')),
    createGenerationChart(makeCard(container, 'Generation and load (MW)', [
      { name: 'Wind', color: COLORS.wind },
      { name: 'Solar', color: COLORS.solar },
      { name: 'Load', color: COLORS.load },
    ]), state),
    createSocChart(makeCard(container, 'Battery state of charge (%)'), state),
    createTaperChart(makeCard(container, 'BESS power limit vs SOC (MW)', [
      { name: 'Discharge +', color: COLORS.bess },
      { name: 'Charge −', color: COLORS.bess, dashed: true },
    ])),
  ];

  return {
    draw(s) {
      for (const chart of charts) chart.draw(s);
    },
  };
}
