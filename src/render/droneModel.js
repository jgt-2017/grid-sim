/*
 * PURPOSE:    Quadcopter model shared by the survey drone (ambient.js) and the drone you fly
 *             (flyer.js): rounded body, four arms with spinning props, landing skids, camera gimbal
 *             and a blinking status LED.
 * USED BY:    src/render/ambient.js, src/render/flyer.js
 * DEPENDS ON: three, three/addons RoundedBoxGeometry
 * UNITS:      metres (before scaling); time in seconds.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Takes { shellColor, accentColor, scale }; returns { group, tilt, animate(timeSec) }
export function createDroneModel({ shellColor = '#e9ebee', accentColor = '#e07a1f', scale = 1 } = {}) {
  const group = new THREE.Group();        // positioned and yawed by the caller
  const tilt = new THREE.Group();         // pitched / banked to show motion
  group.add(tilt);
  const shell = new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.35, metalness: 0.3 });
  const accent = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#24272b', roughness: 0.5 });

  tilt.add(new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.24, 0.9, 2, 0.08), shell));
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.3), accent);
  stripe.position.set(0, 0.1, 0.2);
  tilt.add(stripe);

  // Arms, motor pods and two-blade props
  const props = [];
  for (const [x, z] of [[0.75, 0.75], [-0.75, 0.75], [0.75, -0.75], [-0.75, -0.75]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(Math.SQRT2 * 0.75, 0.06, 0.08), darkMat);
    arm.rotation.y = -Math.atan2(z, x);
    arm.position.set(x / 2, 0, z / 2);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 10), darkMat);
    motor.position.set(x, 0.05, z);
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.015, 0.07), darkMat);
    prop.position.set(x, 0.13, z);
    tilt.add(arm, motor, prop);
    props.push(prop);
  }
  // Landing skids and a camera gimbal under the nose
  for (const x of [-0.3, 0.3]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.8), darkMat);
    skid.position.set(x, -0.28, 0);
    tilt.add(skid);
  }
  const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), darkMat);
  gimbal.position.set(0, -0.15, 0.38);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 0.3, 0.2), toneMapped: false }));
  led.position.set(0, -0.12, -0.42);
  tilt.add(gimbal, led);
  tilt.traverse((o) => { o.castShadow = true; });
  group.scale.setScalar(scale);

  return {
    group,
    tilt,
    // Spins the props and blinks the LED
    animate(timeSec) {
      for (let i = 0; i < props.length; i++) props[i].rotation.y = timeSec * (45 + i * 3) * (i % 2 ? 1 : -1);
      led.visible = timeSec % 1.2 < 0.3;
    },
  };
}
