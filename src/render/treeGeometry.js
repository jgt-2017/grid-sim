/*
 * PURPOSE:    Geometry for realistic trees built from wood + alpha-cut foliage cards. Broadleaf: trunk,
 *             five limbs and ~46 leaf-cluster cards filling an ellipsoid crown. Conifer: tall trunk and
 *             tiered whorls of drooping needle-branch cards forming a cone. Card normals point out from
 *             the crown so the canopy shades as one rounded mass instead of flat planes.
 * USED BY:    src/render/trees.js
 * DEPENDS ON: three, three/addons BufferGeometryUtils, src/utils/rng.js
 * UNITS:      metres (a scale-1 broadleaf is ~8 m tall, a conifer ~11 m).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRng } from '../utils/rng.js';

const up = new THREE.Vector3(0, 1, 0);

// Tapered cylinder from point a to point b (radii ra at a, rb at b)
function limb(a, b, ra, rb) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const geo = new THREE.CylinderGeometry(rb, ra, dir.length(), 7, 1, true).translate(0, dir.length() / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
  return geo.applyMatrix4(new THREE.Matrix4().compose(a, q, new THREE.Vector3(1, 1, 1)));
}

// Card: a plane placed by matrix m, with every normal set to point away from `centre`
function card(w, h, m, centre, outwardBias = up) {
  const geo = new THREE.PlaneGeometry(w, h).applyMatrix4(m);
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(centre).add(outwardBias).normalize();
    nrm.setXYZ(i, v.x, v.y, v.z);
  }
  return geo;
}

// Returns { wood, leaves } geometries for a broadleaf tree (seeded, so all instances share it)
export function broadleafGeometries(seed = 3) {
  const rng = createRng(seed);
  const wood = [limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 4.0, 0), 0.36, 0.2)];
  const crown = new THREE.Vector3(0, 5.6, 0);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + rng();
    const base = new THREE.Vector3(0.05, 3.2 + rng() * 0.8, 0);
    const tip = new THREE.Vector3(Math.cos(a) * 2.2, 5.4 + rng() * 1.2, Math.sin(a) * 2.2);
    wood.push(limb(base, tip, 0.14, 0.05));
  }
  const leaves = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < 46; i++) {
    // Points spread through an ellipsoid crown, a bit denser near the surface
    const u = rng() * Math.PI * 2;
    const v = Math.acos(2 * rng() - 1);
    const r = 0.55 + 0.45 * Math.cbrt(rng());
    const p = new THREE.Vector3(Math.sin(v) * Math.cos(u) * 2.9 * r, Math.cos(v) * 2.3 * r, Math.sin(v) * Math.sin(u) * 2.9 * r).add(crown);
    q.setFromEuler(e.set(rng() * Math.PI, rng() * Math.PI * 2, rng() * Math.PI));
    const s = 2.2 + rng() * 1.0;
    leaves.push(card(s, s, m.compose(p, q, new THREE.Vector3(1, 1, 1)), crown, new THREE.Vector3(0, 0.3, 0)));
  }
  return { wood: mergeGeometries(wood), leaves: mergeGeometries(leaves) };
}

// Returns { wood, leaves } geometries for a conifer (spruce-like cone of drooping branch whorls)
export function coniferGeometries(seed = 5) {
  const rng = createRng(seed);
  const height = 11;
  const wood = [limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, height, 0), 0.3, 0.05)];
  const leaves = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let y = 1.4; y < height - 0.6; y += 0.62) {
    const t = (y - 1.4) / (height - 2);                  // 0 at the bottom whorl, 1 near the top
    const length = 3.4 * (1 - t) + 0.5;
    const count = t < 0.7 ? 7 : 5;
    const offset = rng() * Math.PI;
    for (let k = 0; k < count; k++) {
      const a = offset + (k / count) * Math.PI * 2;
      const droop = -0.35 - rng() * 0.2;
      const centre = new THREE.Vector3(Math.cos(a) * length / 2, y - length * 0.12, Math.sin(a) * length / 2);
      const axis = new THREE.Vector3(0, y, 0);
      const lift = new THREE.Vector3(0, 0.5, 0);
      // Flat drooping spray: plane laid horizontal, tipped down toward the tip, turned around the trunk
      q.setFromEuler(e.set(-Math.PI / 2, -a, droop, 'YZX'));
      leaves.push(card(length, length * 0.6, m.compose(centre, q, new THREE.Vector3(1, 1, 1)), axis, lift));
      // Every other branch also gets an upright card so the tree has volume from the side
      if (k % 2) {
        q.setFromEuler(e.set(0, -a, droop, 'YZX'));
        leaves.push(card(length, length * 0.45, m.compose(centre, q, new THREE.Vector3(1, 1, 1)), axis, lift));
      }
    }
  }
  return { wood: mergeGeometries(wood), leaves: mergeGeometries(leaves) };
}
