# src/utils — small pure helpers

| File | Used for |
|---|---|
| `units.js` | kW/MW and time conversions, `clamp`, NaN / negative guards used on every bus input |
| `rng.js` | Seeded random numbers, so random tests and procedural scenery are repeatable |
| `noise.js` | Value noise, fBm and ridged noise for terrain, mountains and texture detail |

No imports from the rest of the project, so model, render and tests can all use them.
