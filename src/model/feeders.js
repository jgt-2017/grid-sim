/*
 * PURPOSE:    Maps the bus dispatch onto the five feeders: MW flowing INTO the bus on each one
 *             (negative = drawn from the bus). One definition shared by the 2D SLD and 3D cables.
 * USED BY:    src/ui/sld.js, src/render/cables.js
 * DEPENDS ON: nothing (reads fields of the shared state object passed in)
 * UNITS:      MW.
 */

// Feeder keys in display order
export const FEEDER_KEYS = ['grid', 'wind', 'solar', 'bess', 'load'];

// Takes state and a feeder key; returns MW into the bus on that feeder
export function feederIntoBusMw(state, key) {
  switch (key) {
    case 'grid': return state.pGridImportMw - state.pGridExportMw;
    case 'wind': return state.pWindDeliveredMw;
    case 'solar': return state.pPvDeliveredMw;
    case 'bess': return state.pBessDisMw - state.pBessChgMw;
    case 'load': return -(state.pLoadMw - state.pUnservedMw);
    default: return 0;
  }
}
