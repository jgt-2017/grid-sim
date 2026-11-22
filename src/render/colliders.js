/*
 * PURPOSE:    Simple 2D (ground-plane) collision shapes for the drivable vehicle: axis-aligned boxes
 *             and circles, plus a push-out resolver for a circle against all of them.
 * USED BY:    src/render/world.js and every zone builder (they return their colliders),
 *             src/render/vehicleDynamics.js
 * DEPENDS ON: nothing
 * UNITS:      metres.
 */

const BOX = 0;
const CIRCLE = 1;

// Takes centre and half sizes (m); returns an axis-aligned box collider
export function aabb(cx, cz, halfX, halfZ) {
  return { type: BOX, x: cx, z: cz, hx: halfX, hz: halfZ, reach: Math.hypot(halfX, halfZ) };
}

// Takes centre and radius (m); returns a circle collider
export function circle(x, z, r) {
  return { type: CIRCLE, x, z, r, reach: r };
}

// Takes colliders, a circle (x, z, r) and an out object; accumulates the push-out vector into
// out.x / out.z. Returns true when the circle overlaps anything.
export function resolveCircle(colliders, x, z, r, out) {
  out.x = 0;
  out.z = 0;
  let hit = false;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const dx = x - c.x;
    const dz = z - c.z;
    const reach = c.reach + r;
    if (dx * dx + dz * dz > reach * reach) continue;      // cheap broad-phase reject
    if (c.type === CIRCLE) {
      hit = pushFromCircle(c, dx, dz, r, out) || hit;
    } else {
      hit = pushFromBox(c, dx, dz, r, out) || hit;
    }
  }
  return hit;
}

// Circle vs circle: push straight away from the centre
function pushFromCircle(c, dx, dz, r, out) {
  const d = Math.hypot(dx, dz) || 1e-6;
  const overlap = c.r + r - d;
  if (overlap <= 0) return false;
  out.x += (dx / d) * overlap;
  out.z += (dz / d) * overlap;
  return true;
}

// Circle vs box: push away from the closest point on the box (or out along the shallow axis)
function pushFromBox(c, dx, dz, r, out) {
  const px = Math.max(-c.hx, Math.min(c.hx, dx));
  const pz = Math.max(-c.hz, Math.min(c.hz, dz));
  const ex = dx - px;
  const ez = dz - pz;
  const d = Math.hypot(ex, ez);
  if (d === 0) {
    // Centre is inside the box: leave by the nearest face
    const outX = c.hx - Math.abs(dx);
    const outZ = c.hz - Math.abs(dz);
    if (outX < outZ) out.x += Math.sign(dx || 1) * (outX + r);
    else out.z += Math.sign(dz || 1) * (outZ + r);
    return true;
  }
  if (d >= r) return false;
  out.x += (ex / d) * (r - d);
  out.z += (ez / d) * (r - d);
  return true;
}
