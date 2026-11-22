/*
 * PURPOSE:    A drifting cloud layer: one large plane at altitude whose fragment shader builds cumulus
 *             shapes from fractal noise, shades their undersides, brightens them toward the sun, and
 *             fades them into the horizon haze. Cheap (one draw, no textures) and animated by wind.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, src/config.js (SCENERY, WORLD)
 * UNITS:      metres, seconds.
 */
import * as THREE from 'three';
import { SCENERY, WORLD } from '../config.js';

const SIZE_M = 9000;

// Passes world position to the fragment shader
const VERTEX_SHADER = `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`;

// Cumulus from fractal noise: coverage threshold, darker thick cores, sun-side glow, horizon fade
const FRAGMENT_SHADER = `
      uniform float uTime, uCoverage, uDrift;
      uniform vec3 uSunDir;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float s = 0.0, a = 0.5;
        for (int o = 0; o < 6; o++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
        return s;
      }
      void main() {
        vec2 p = (vWorld.xz + vec2(uTime * uDrift, uTime * uDrift * 0.4)) * 0.0009;
        float d = fbm(p);
        float density = smoothstep(1.0 - uCoverage, 1.0 - uCoverage + 0.28, d);
        if (density < 0.01) discard;
        // Thicker cores are darker underneath; the sun side glows
        vec3 viewDir = normalize(vWorld - cameraPosition);
        float sunGlow = pow(max(dot(viewDir, uSunDir), 0.0), 6.0);
        vec3 colour = mix(vec3(0.97, 0.98, 1.0), vec3(0.72, 0.76, 0.82), smoothstep(0.4, 1.0, density) * 0.6);
        colour += vec3(1.0, 0.95, 0.85) * sunGlow * 0.5;
        colour *= 2.2;   // HDR: as bright as the sky around it after tone mapping
        // Fade toward the horizon so the layer melts into the haze
        float dist = length(vWorld.xz - cameraPosition.xz);
        float fade = 1.0 - smoothstep(2200.0, 4300.0, dist);
        gl_FragColor = vec4(colour, density * 0.9 * fade);
      }`;

// Takes the scene; returns { update(timeSec) }
export function createClouds(scene) {
  const uniforms = {
    uTime: { value: 0 },
    uCoverage: { value: SCENERY.cloudCoverage },
    uDrift: { value: SCENERY.cloudDriftMs },
    uSunDir: { value: new THREE.Vector3(...WORLD.sunDirection).normalize() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,

  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(SIZE_M, SIZE_M).rotateX(Math.PI / 2), material);
  plane.position.y = SCENERY.cloudAltitudeM;
  plane.frustumCulled = false;
  plane.renderOrder = -1;
  scene.add(plane);
  return {
    update(timeSec) {
      uniforms.uTime.value = timeSec;
    },
  };
}
