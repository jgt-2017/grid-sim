# src/model — pure physics

Plain JavaScript only: no Three.js, no DOM, no randomness. Every number comes from `src/config.js`.

## How the files link

```
wind.js ──────┐
solar.js ─────┤  available MW
datacenter.js ┤  load MW
              ▼
bess.js ──► limits ──►  bus.js  (one-pass dispatch + residual check)
grid.js ──► limits ──►    │
              ▲           ▼
              └──── simulation.js  (fixed 15-min step: assets → bus → BESS SOC →
                                    transformer losses → daily totals → history)
```

| File | Role |
|---|---|
| `wind.js` | Cubic power curve per turbine, farm total, rotor rpm |
| `solar.js` | PV output = 30 MWp × G/1000 × PR, clipped at 25 MW AC; optional diurnal half-sine |
| `bess.js` | Taper curves and the `Bess` class (SOC memory, limits, SOC integration) |
| `datacenter.js` | Utilization by mode, rack kW, facility MW and MVA |
| `grid.js` | Import/export limits (breaker-gated); transformer losses for display |
| `bus.js` | `dispatch()`: must-take renewables → BESS → grid → curtail/unserved, plus grid recharge of the battery up to the backup reserve; residual |
| `recorder.js` | Daily MWh totals (midnight roll-over) and chart ring buffers |
| `simulation.js` | `stepSimulation()` one fixed step; `advanceSimulation()` real-time accumulator |

Only `simulation.js` and `recorder.js` touch `src/state.js`; every other file is a pure function of its arguments
(plus the `Bess` object's SOC).
