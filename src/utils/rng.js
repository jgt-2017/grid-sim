/*
 * PURPOSE:    Seeded pseudo-random generator (mulberry32) so random tests are repeatable.
 *             The model itself never uses randomness.
 * USED BY:    test/bus.test.js
 * DEPENDS ON: nothing
 * UNITS:      returns a fraction in [0, 1).
 */

// Takes an integer seed, returns a function that yields numbers in [0, 1)
export function createRng(seed) {
  let s = seed >>> 0; // internal 32-bit state
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Uniform number in [min, max) from an rng function
export function uniform(rng, min, max) {
  return min + (max - min) * rng();
}
