/*
 * PURPOSE:    Post-processing chain: HDR render -> ambient occlusion (GTAO: soft contact shadows in
 *             corners and under equipment) -> floating-sign overlay -> bloom (only very bright pixels: lamps, LEDs, flow
 *             particles) -> tone mapping + sRGB output. AO and bloom can be switched off by the
 *             adaptive quality manager.
 * USED BY:    src/render/world.js, src/render/quality.js (setAo / setBloom)
 * DEPENDS ON: three, three/addons postprocessing, src/config.js (SCENERY, QUALITY)
 * UNITS:      sizes in CSS pixels (pixel ratio applied by the composer); AO radius in metres.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SCENERY, QUALITY } from '../config.js';

// Takes renderer, scene, camera and an overlay scene (floating signs: drawn after AO so they stay
// crisp); returns { render(), setSize(w, h), setAo(on), setBloom(on) }
export function createPostFx(renderer, scene, camera, overlayScene) {
  const size = renderer.getSize(new THREE.Vector2());
  // Half-float keeps HDR values above 1 so bloom can pick out emissive parts. 4x MSAA on standard
  // screens only: at a high pixel ratio the extra pixels already smooth edges, and MSAA is costly.
  const samples = renderer.getPixelRatio() > 1.25 ? 0 : 4;
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  const ao = new GTAOPass(scene, camera, size.x, size.y);
  ao.updateGtaoMaterial({ radius: QUALITY.aoRadiusM, distanceExponent: 1.5, thickness: 1.5, scale: 1 });
  ao.blendIntensity = 0.85;
  composer.addPass(ao);

  // Floating signs on top of the shaded image (not darkened by AO)
  const overlay = new RenderPass(overlayScene, camera);
  overlay.clear = false;
  composer.addPass(overlay);

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y),
    SCENERY.bloomStrength, SCENERY.bloomRadius, SCENERY.bloomThreshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.setSize(size.x, size.y);

  return {
    render() {
      composer.render();
    },
    setSize(w, h) {
      composer.setSize(w, h);
    },
    setAo(on) {
      ao.enabled = on;
    },
    setBloom(on) {
      bloom.enabled = on;
    },
  };
}
