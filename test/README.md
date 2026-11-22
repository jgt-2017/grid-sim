# test — node --test suites

Run with `npm test`. Every suite imports the pure model directly (no browser, no three.js).

| File | What it checks |
|---|---|
| `wind.test.js`, `solar.test.js`, `datacenter.test.js`, `grid.test.js`, `bess.test.js` | Hand-calculated values for each model (datasheet ratings included) |
| `bus.test.js` | Hand dispatch cases, 10,000 seeded random dispatches (residual, limits, non-negativity), a 30-day randomised run |
| `feeders.test.js` | Feeder sign conventions; the five feeder flows sum to zero every step |
| `recharge.test.js` | Battery drains to the reserve, recharges when generation returns, refills from the grid after islanding |
| `simulation.test.js` | Real-time accumulator, pause, reset and midnight roll-over |
