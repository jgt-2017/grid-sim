/*
 * PURPOSE:    Renderer, camera, physical sky, haze and lights (soft sky fill + shadowing sun).
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, src/config.js (WORLD, SCENERY), src/render/sky.js
 * UNITS:      metres; colours as hex.
 */
import * as THREE from 'three';
import { WORLD, SCENERY } from '../config.js';
import { createSky } from './sky.js';

const CAMERA_FAR_M = 5000;   // far enough for the sky box and the mountain ring

// Takes the container element; returns { renderer, scene, camera, resize(), onResize(fn) }
export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, WORLD.pixelRatioMax));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = SCENERY.exposure;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(SCENERY.fogColor, SCENERY.fogDensity);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.3, CAMERA_FAR_M);

  const sunDirection = new THREE.Vector3(...WORLD.sunDirection).normalize();
  createSky(scene, renderer, sunDirection);
  addLights(scene, sunDirection);

  // Keep the drawing buffer (and anything registered, e.g. post-processing) matched to the window
  const listeners = [];
  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const fn of listeners) fn(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera, resize, onResize: (fn) => listeners.push(fn) };
}

// Adds sky fill plus a directional sun whose shadow camera covers the whole site
function addLights(scene, sunDirection) {
  scene.add(new THREE.HemisphereLight('#cfe0ff', '#4f5a33', 0.5));

  const sun = new THREE.DirectionalLight('#fff1dc', 3.2);
  sun.position.copy(sunDirection).multiplyScalar(400);
  sun.castShadow = true;
  sun.shadow.mapSize.set(WORLD.shadowMapSize, WORLD.shadowMapSize);
  const extent = WORLD.pavedHalfM + 60;    // shadow box half-size (m): the campus plus its edge
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent,
    near: 20, far: 900 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
}
