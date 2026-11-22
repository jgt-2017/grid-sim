/*
 * PURPOSE:    Small unit conversions and numeric safety helpers (clamp, NaN guard).
 * USED BY:    src/model/*.js, (later) src/ui/*
 * DEPENDS ON: nothing
 * UNITS:      kW <-> MW, hours <-> seconds; helpers are unit-agnostic.
 */

export const KW_PER_MW = 1000;
export const SECONDS_PER_HOUR = 3600;

// kW -> MW
export function kwToMw(powerKw) {
  return powerKw / KW_PER_MW;
}

// Real seconds -> hours
export function secondsToHours(seconds) {
  return seconds / SECONDS_PER_HOUR;
}

// Clamp value into [min, max]
export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// Return value if it is a finite number, otherwise the fallback (guards NaN/Infinity)
export function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

// Finite and non-negative, otherwise 0. Used for every power input to the bus.
export function safeNonNeg(value) {
  return Math.max(0, finiteOr(value, 0));
}

// Format MW with fixed decimals for display, e.g. "12.35 MW"
export function formatMw(powerMw, decimals = 2) {
  return `${finiteOr(powerMw, 0).toFixed(decimals)} MW`;
}
