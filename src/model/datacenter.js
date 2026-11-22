/*
 * PURPOSE:    AI data center load: GPU utilization by workload mode, rack power, facility MW/MVA.
 * USED BY:    src/model/simulation.js, test/datacenter.test.js
 * DEPENDS ON: src/config.js (DATACENTER), src/utils/units.js
 * UNITS:      utilization fraction 0-1; rack power kW; facility power MW; apparent power MVA; hour 0-24.
 */
import { DATACENTER } from '../config.js';
import { clamp, finiteOr, kwToMw } from '../utils/units.js';

// Takes hour of day, returns inference utilization (0-1): cosine wave peaking at inferencePeakHour
export function inferenceUtilization(hourOfDay, cfg = DATACENTER) {
  const h = finiteOr(hourOfDay, 0);
  const mid = (cfg.inferenceMaxUtilization + cfg.inferenceMinUtilization) / 2;
  const amplitude = (cfg.inferenceMaxUtilization - cfg.inferenceMinUtilization) / 2;
  return mid + amplitude * Math.cos((2 * Math.PI * (h - cfg.inferencePeakHour)) / 24);
}

// Takes mode ('training' | 'inference' | 'mixed'), hour of day and the training share (0-1)
// for mixed mode; returns fleet-average utilization (0-1)
export function fleetUtilization(mode, hourOfDay, mixedTrainingFraction, cfg = DATACENTER) {
  const training = cfg.trainingUtilization;
  const inference = inferenceUtilization(hourOfDay, cfg);
  if (mode === 'training') return training;
  if (mode === 'inference') return inference;

  // Mixed: weighted blend of the two workloads by rack share
  const share = clamp(finiteOr(mixedTrainingFraction, 0.5), 0, 1);
  return share * training + (1 - share) * inference;
}

// Takes utilization (0-1) and a rack profile; returns rack power (kW).
// Linear between idle and TDP, clamped to the profile's peak.
export function rackPowerKw(utilization, profile) {
  const u = clamp(finiteOr(utilization, 0), 0, 1);
  const idleKw = profile.rackTdpKw * profile.idleFraction;
  const powerKw = idleKw + (profile.rackTdpKw - idleKw) * u;
  return Math.min(powerKw, profile.rackPeakKw);
}

// Takes utilization (0-1) and a profile key; returns { itMw, facilityMw, facilityMva }
export function facilityLoad(utilization, profileKey, cfg = DATACENTER) {
  const profile = cfg.profiles[profileKey] ?? cfg.profiles[cfg.defaultProfile];
  const itMw = kwToMw(rackPowerKw(utilization, profile) * cfg.rackCount);
  const facilityMw = itMw * cfg.pue;
  return { itMw, facilityMw, facilityMva: facilityMw / cfg.powerFactor };
}
