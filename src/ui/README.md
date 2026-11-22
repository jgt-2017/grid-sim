# src/ui — HUD, controls and charts

DOM and 2D canvas only. Writes **inputs** to `state`; reads **outputs** from `state`. Never imports
Three.js and never changes physics. It may call pure model functions (e.g. `farmPowerMw`) to draw
static curves.

## How the files link

```
main.js ──► hud.js ──┬─► controls.js     lil-gui; every control writes a state input (and .listen()s)
                     ├─► busPanel.js     live MW / SOC / balance / clock / daily MWh (the table view)
                     ├─► sld.js          single-line diagram layout; sldDraw.js draws flows/symbols
                     └─► charts.js ──┬─► curveCharts.js   wind power curve, BESS taper vs SOC
                                     └─► timeCharts.js    gen/load MW and SOC vs time (ring buffers)
                                            both use chart.js + chartTooltip.js
hud.css   layout; colours arrive as --c-* tokens set from config.COLORS by hud.js
```

Hotkeys: **P** pause, **H** hide/show the HUD.

Colour rule: each entity keeps one hue everywhere (wind blue, solar orange, load aqua,
BESS amber, grid magenta). Status colours (good / warning / critical) only mark state,
always with an icon (✓ ⚠ ✕) and a word.
