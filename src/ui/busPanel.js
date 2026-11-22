/*
 * PURPOSE:    The bus panel: live MW on the common bus, SOC, transformer, balance check, the sim
 *             clock, today's and yesterday's MWh totals, and the rack-profile badge.
 *             Doubles as the table view of everything the charts and SLD show.
 * USED BY:    src/ui/hud.js
 * DEPENDS ON: src/config.js (DATACENTER, COLORS, HUD)
 * UNITS:      MW, MWh, %, sim hours (shown as Day N HH:MM).
 */
import { DATACENTER, COLORS, HUD } from '../config.js';

// Rows: [key, label, swatch colour or null]. Keys map to text produced in liveValues().
const NOW_ROWS = [
  ['gen', 'Renewables delivered', null],
  ['wind', 'Wind', COLORS.wind],
  ['solar', 'Solar', COLORS.solar],
  ['load', 'GT Computing DC load', COLORS.load],
  ['bess', 'Battery', COLORS.bess],
  ['soc', 'State of charge', COLORS.bess],
  ['grid', 'Grid', COLORS.grid],
  ['curtailed', 'Curtailed', null],
  ['unserved', 'Unserved', null],
  ['xfmr', 'Transformer', null],
];
const DAY_ROWS = [
  ['windMwh', 'Wind'], ['pvMwh', 'Solar'], ['loadMwh', 'Load'], ['importMwh', 'Import'],
  ['exportMwh', 'Export'], ['chgMwh', 'Charged'], ['disMwh', 'Discharged'],
  ['curtailedMwh', 'Curtailed'], ['unservedMwh', 'Unserved'],
];

const mw = (v) => `${v.toFixed(2)} MW`;

// Takes state; returns { key: text } for the "now" rows
function liveValues(s) {
  const bessMw = s.pBessDisMw - s.pBessChgMw;
  const gridMw = s.pGridImportMw - s.pGridExportMw;
  return {
    gen: mw(s.pWindDeliveredMw + s.pPvDeliveredMw),
    wind: mw(s.pWindDeliveredMw),
    solar: mw(s.pPvDeliveredMw),
    load: `${mw(s.pLoadMw)} · IT ${s.pItMw.toFixed(1)}`,
    bess: bessMw > 0 ? `Discharge ${mw(bessMw)}`
      : bessMw < 0 ? `Charge ${mw(-bessMw)}${s.pBessGridChgMw > 0.005 ? ' (grid)' : ''}`
        : (s.gridBreakerClosed && s.soc <= s.bessReserveSoc + 0.005 ? 'Holding reserve' : 'Idle'),
    soc: `${(s.soc * 100).toFixed(1)} %`,
    grid: !s.gridBreakerClosed ? '⚠ Islanded'
      : gridMw > 0 ? `Import ${mw(gridMw)}` : gridMw < 0 ? `Export ${mw(-gridMw)}` : 'Idle',
    curtailed: s.pCurtailedMw > 0.005 ? `⚠ ${mw(s.pCurtailedMw)}` : mw(0),
    unserved: s.pUnservedMw > 0.005 ? `✕ ${mw(s.pUnservedMw)}` : mw(0),
    xfmr: `${(s.xfmrLoadingPu * 100).toFixed(0)} % · loss ${s.xfmrLossMw.toFixed(3)} MW`,
  };
}

// Takes parent, label and swatch colour; appends a row and returns its value element
function addRow(parent, label, color) {
  const row = document.createElement('div');
  row.className = 'row';
  const name = document.createElement('span');
  if (color) {
    const swatch = document.createElement('i');
    swatch.className = 'swatch';
    swatch.style.background = color;
    name.appendChild(swatch);
  }
  name.append(label);
  const value = document.createElement('b');
  row.append(name, value);
  parent.appendChild(row);
  return value;
}

// Takes parent and text; appends a section heading
function addHeading(parent, text) {
  const h = document.createElement('h3');
  h.textContent = text;
  parent.appendChild(h);
}

// Sets text only when it changed (avoids needless DOM work)
function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

// Takes the panel element; builds rows once and returns { update(state, nowMs) }
export function createBusPanel(root) {
  const clock = document.createElement('div');
  clock.className = 'clock';
  const badge = document.createElement('div');
  badge.className = 'profile';
  root.append(clock, badge);

  addHeading(root, 'Bus now');
  const now = {};
  for (const [key, label, color] of NOW_ROWS) now[key] = addRow(root, label, color);
  const balance = addRow(root, 'Balance', null);

  addHeading(root, 'Today (MWh) · yesterday');
  const day = {};
  for (const [key, label] of DAY_ROWS) day[key] = addRow(root, label, null);

  let lastMs = -Infinity;
  function update(s, nowMs) {
    if (nowMs - lastMs < HUD.panelRefreshMs) return;
    lastMs = nowMs;

    const hh = String(Math.floor(s.hourOfDay)).padStart(2, '0');
    const mm = String(Math.round((s.hourOfDay % 1) * 60)).padStart(2, '0');
    setText(clock, `Day ${s.dayIndex + 1} · ${hh}:${mm}${s.paused ? ' · paused' : ''}`);

    const profile = DATACENTER.profiles[s.rackProfile];
    setText(badge, `${DATACENTER.rackCount} × ${profile.label}${profile.confirmed ? '' : '  ⚠ UNCONFIRMED'}`);
    badge.classList.toggle('unconfirmed', !profile.confirmed);

    const values = liveValues(s);
    for (const key in now) setText(now[key], values[key]);
    now.curtailed.className = s.pCurtailedMw > 0.005 ? 'warn' : '';
    now.unserved.className = s.pUnservedMw > 0.005 ? 'crit' : '';
    now.grid.className = s.gridBreakerClosed ? '' : 'warn';
    setText(balance, `${s.busBalanceOk ? '✓' : '✕'} ${s.busResidualMw.toExponential(1)} MW`);
    balance.className = s.busBalanceOk ? 'good' : 'crit';

    for (const key in day) {
      setText(day[key], `${s.daily[key].toFixed(1)} · ${s.previousDay[key].toFixed(1)}`);
    }
  }
  return { update };
}
