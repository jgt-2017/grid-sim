/*
 * PURPOSE:    The 138 kV utility line running north from the substation: lattice-style towers and
 *             three conductors with a slight sag, disappearing into the fog.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, src/config.js (WORLD), src/render/substationParts.js (MAT, box),
 *             src/render/terrain.js (heightAt)
 * UNITS:      metres.
 */
import * as THREE from 'three';
import { WORLD } from '../config.js';
import { MAT, box } from './substationParts.js';
import { heightAt } from './terrain.js';
import { circle } from './colliders.js';

const ARM_HALF_M = 4.5;     // cross-arm half length; outer phases hang here
const SAG_M = 1.6;          // mid-span conductor sag
const SAG_SAMPLES = 12;     // points per span

// Takes the scene; adds towers and strings conductors; returns { colliders } (tower footprints)
export function createGridLine(scene) {
  // Overhead points are the route points north of the gantry (z < -30)
  const towers = WORLD.cables.grid.filter((p) => p[2] < -30);
  for (const [x, y, z] of towers) scene.add(tower(x, y, z));

  // Conductors: from each tower to the next, then to the dead-end structure (z = -21, y = 12.7)
  const anchors = [...towers, [0, 12.7, -21]];
  const wireMat = new THREE.LineBasicMaterial({ color: '#4a4a48' });
  for (const offset of [-ARM_HALF_M, 0, ARM_HALF_M]) {
    const points = [];
    for (let k = 0; k < anchors.length - 1; k++) {
      const [ax, ay, az] = anchors[k];
      const [bx, by, bz] = anchors[k + 1];
      for (let s = 0; s <= SAG_SAMPLES; s++) {
        const t = s / SAG_SAMPLES;
        const sag = SAG_M * 4 * t * (1 - t);   // parabola, zero at both ends
        points.push(new THREE.Vector3(ax + offset + (bx - ax) * t, ay + (by - ay) * t - sag, az + (bz - az) * t));
      }
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), wireMat));
  }
  return { colliders: towers.map(([x, , z]) => circle(x, z, 3)) };
}

// Returns a simple tapered four-leg tower whose cross arm sits at absolute height armWorldY
function tower(x, armWorldY, z) {
  const g = new THREE.Group();
  const base = heightAt(x, z);
  g.position.set(x, base, z);
  const armY = armWorldY - base;   // arm height above this tower's footing
  const legH = armY + 3;
  for (const [lx, lz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
    const leg = box(0.3, legH, 0.3, MAT.steel, lx * 0.6, legH / 2, lz * 0.6);
    leg.rotation.z = -lx * 0.04;
    leg.rotation.x = lz * 0.04;
    g.add(leg);
  }
  // Horizontal braces every few metres give the lattice impression
  for (let y = 3; y < legH; y += 4) g.add(box(2.4 - y * 0.05, 0.15, 2.4 - y * 0.05, MAT.steel, 0, y, 0));
  g.add(box(ARM_HALF_M * 2 + 1, 0.4, 0.5, MAT.steel, 0, armY, 0));
  return g;
}
