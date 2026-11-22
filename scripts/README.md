# scripts

`sim-cli.js` runs the model headless and prints an hourly table (wind, solar, load, battery, grid,
curtailed, unserved, SOC, residual) plus the last full day's energy totals:

    npm run sim:cli -- [hours] [wind m/s] [irradiance W/m2] [mode]
