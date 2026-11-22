/*
 * PURPOSE:    Physically based sky (three.js Sky addon) with the sun placed to match the shadow
 *             light, plus an environment map baked once from that sky so metal, glass and panels
 *             reflect a believable sky.
 * USED BY:    src/render/scene.js
 * DEPENDS ON: three, three/addons Sky, src/config.js (SCENERY)
 * UNITS:      sun direction is a unit vector; sky box size in metres.
 */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { SCENERY } from '../config.js';

const SKY_SIZE_M = 4000;   // must stay inside the camera far plane

// Takes scene, renderer and a unit sun direction; adds the sky and sets scene.environment
export function createSky(scene, renderer, sunDirection) {
  const sky = new Sky();
  sky.scale.setScalar(SKY_SIZE_M);
  const u = sky.material.uniforms;
  u.turbidity.value = SCENERY.skyTurbidity;
  u.rayleigh.value = SCENERY.skyRayleigh;
  u.mieCoefficient.value = 0.0025;
  u.mieDirectionalG.value = 0.7;
  u.sunPosition.value.copy(sunDirection);
  scene.add(sky);

  // Bake reflections once: render a copy of the sky into a prefiltered (PMREM) cube map
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.copy(sky.scale);
  envSky.material = sky.material;   // same sun and haze settings
  envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene, 0, 1, SKY_SIZE_M * 2).texture;
  scene.environmentIntensity = SCENERY.environmentIntensity;
  pmrem.dispose();
  return sky;
}
