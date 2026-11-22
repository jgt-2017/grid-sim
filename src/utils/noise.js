/*
 * PURPOSE:    Deterministic 2D value noise, fractal (fBm) and ridged noise for terrain, mountains
 *             and texture detail. Same seed -> same world, every time.
 * USED BY:    src/render/terrain.js, src/render/mountains.js, src/render/texGround.js
 * DEPENDS ON: nothing
 * UNITS:      inputs in arbitrary noise space (callers scale metres); outputs are fractions 0-1.
 */

// Takes integer lattice coordinates and a seed; returns a pseudo-random number in [0, 1)
function hash(ix, iz, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smoothstep-style fade so lattice cells blend without visible creases
function fade(t) {
  return t * t * (3 - 2 * t);
}

// Takes a point and a seed; returns smooth value noise in [0, 1]
export function valueNoise(x, z, seed = 0) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const u = fade(x - ix);
  const v = fade(z - iz);
  const a = hash(ix, iz, seed);
  const b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed);
  const d = hash(ix + 1, iz + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

// Takes a point, octave count and seed; returns fractal noise in [0, 1] (detail at every scale)
export function fbm(x, z, octaves = 4, seed = 0) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * valueNoise(x * frequency, z * frequency, seed + o * 17);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / norm;
}

// Takes a point, octave count and seed; returns ridged noise in [0, 1] (sharp crests, for peaks)
export function ridged(x, z, octaves = 5, seed = 0) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(2 * valueNoise(x * frequency, z * frequency, seed + o * 31) - 1);
    sum += amplitude * n * n;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }
  return sum / norm;
}
