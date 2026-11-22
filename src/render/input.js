/*
 * PURPOSE:    Keyboard and mouse input for walking and driving: which keys are held, one-shot key
 *             presses, and mouse movement while the pointer is locked. Ignores keys typed into the
 *             HUD's form fields; releases everything when the window loses focus.
 * USED BY:    src/render/player.js, src/render/controls.js
 * DEPENDS ON: nothing
 * UNITS:      mouse movement in screen pixels.
 */

// Takes the canvas; returns { isDown(code), axis(pos, neg), anyDown(codes), onPress(fn), takeMouse(out), isLocked() }
export function createInput(canvas) {
  const held = new Set();          // KeyboardEvent.code values currently held
  const pressHandlers = [];        // called once per key press with the code
  let mouseX = 0;                  // accumulated mouse movement since last takeMouse()
  let mouseY = 0;

  function fromForm(e) {
    return e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
  }
  window.addEventListener('keydown', (e) => {
    if (fromForm(e)) return;
    if (!e.repeat) for (const fn of pressHandlers) fn(e.code);
    held.add(e.code);
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();   // no page scroll
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    mouseX += e.movementX;
    mouseY += e.movementY;
  });

  // Any of the codes held?
  const any = (codes) => codes.some((c) => held.has(c));

  return {
    isDown: (code) => held.has(code),
    // Takes positive and negative key-code lists; returns +1, -1 or 0
    axis: (positive, negative) => Number(any(positive)) - Number(any(negative)),
    anyDown: any,
    onPress: (fn) => pressHandlers.push(fn),
    isLocked: () => document.pointerLockElement === canvas,
    // Copies and clears the accumulated mouse movement into out { dx, dy }
    takeMouse(out) {
      out.dx = mouseX;
      out.dy = mouseY;
      mouseX = 0;
      mouseY = 0;
      return out;
    },
  };
}
