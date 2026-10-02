import * as THREE from 'three';
// @ts-expect-error SakuraIdle is local JavaScript reference source without declarations.
import { makeSkyNoiseTextures, SKY_FRAG, SKY_VERT } from '../../vendor/sakura-idle/sky-shaders.js';
import type { WetlandSkyPreset } from './wetland-sky';
import type { WetlandDayLighting } from './wetland-shared-world';

export type WetlandSakuraIdleSky = Readonly<{
  root: THREE.Group;
  sunDirection: THREE.Vector3;
  applyPreset: (preset: WetlandSkyPreset) => void;
  setDayLighting: (lighting: WetlandDayLighting) => void;
  setWind: (direction: THREE.Vector2, driftTime: number) => void;
  setCameraPosition: (position: THREE.Vector3, cameraQuaternion?: THREE.Quaternion, cameraFov?: number, viewportHeight?: number) => void;
  dispose: () => void;
}>;

// Day-only adapter for SakuraIdle's original sky shader. It deliberately keeps
// its cloud projection, relief shading and procedural noise instead of copying
// the later wetland painted-cloud experiment.
export const createWetlandSakuraIdleSky = (): WetlandSakuraIdleSky => {
  const { texA, texB, texC, gradScale } = makeSkyNoiseTextures(THREE, 256);
  const sunDirection = new THREE.Vector3(-0.62, 0.62, -0.48).normalize();
  const colors = {
    zenith: new THREE.Color('#4e86d4'),
    mid: new THREE.Color('#5f9fd6'),
    horizon: new THREE.Color('#82b8d8'),
    haze: new THREE.Color('#8fbfdd'),
    sun: new THREE.Color('#ffebcb'),
    glow: new THREE.Color('#c38348'),
    fog: new THREE.Color('#91bdd9'),
    cloudLit: new THREE.Color('#e8f1f7'),
    cloudDark: new THREE.Color('#91a9c6'),
    cloudAmb: new THREE.Color('#c4d9ea'),
    cloudRim: new THREE.Color('#f7d9b0'),
  };
  const uniforms = {
    uNoiseA: { value: texA }, uNoiseB: { value: texB }, uNoiseC: { value: texC },
    uGradScale: { value: new THREE.Vector3(...gradScale) }, uTime: { value: 0 },
    uZenith: { value: colors.zenith }, uMid: { value: colors.mid },
    uHorizon: { value: colors.horizon }, uHaze: { value: colors.haze },
    uHazeWarm: { value: colors.haze }, uHazeWarmK: { value: 0.22 },
    uHazeAmt: { value: 0.36 }, uHazeH: { value: 0.055 },
    uZenithPow: { value: 0.42 }, uMidAmt: { value: 0.16 }, uZenDeep: { value: 0.8 },
    // Kept separate from the physical key vector: the shader receives the
    // camera-visible presentation ray each frame, while callers keep the
    // world-space direction used by lighting and shadows.
    uSunDir: { value: sunDirection.clone() }, uGlowTint: { value: colors.glow },
    uMieG: { value: 0.72 }, uMieAmt: { value: 0.1 },
    uFogColor: { value: colors.fog }, uMoonDir: { value: new THREE.Vector3(0.42, 0.68, 0.6).normalize() },
    uMoonRender: { value: new THREE.Vector3(0.42, 0.3, 0.6).normalize() },
    uShadowTint: { value: new THREE.Color('#6e76a8') },
    uWindDir: { value: new THREE.Vector2(-0.62, -0.48).normalize() }, uWindTime: { value: 0 }, uWindGust: { value: 0 },
    uGroundFade: { value: 1 }, uPxRad: { value: 0.0012 },
    // Direct-output wetland preview has no SakuraIdle bloom/ACES lift. Keep
    // the same physical direction, but give the disc enough display energy
    // to remain legible against the pale daytime gradient.
    uSunTint: { value: colors.sun }, uSunSize: { value: 0.026 }, uSunI: { value: 2.5 },
    uCovL: { value: new THREE.Vector4(0.58, 0.67, 0.75, 0.83) },
    uScaleL: { value: new THREE.Vector4(1.05, 1.55, 2.6, 3.6) },
    uSpeedL: { value: new THREE.Vector4(0.0135, 0.0115, 0.009, 0.0062) },
    uKfL: { value: new THREE.Vector4(0.3, 0.22, 0.15, 0.09) },
    uPwL: { value: new THREE.Vector4(0.55, 0.58, 0.62, 0.72) },
    uBumpL: { value: new THREE.Vector4(1.6, 1.4, 0.95, 0.45) },
    uWarpL: { value: new THREE.Vector4(0.15, 0.13, 0.1, 0.07) },
    uDetL: { value: new THREE.Vector4(0.075, 0.09, 0.115, 0.13) },
    uStretchL: { value: new THREE.Vector4(1, 1.1, 1.3, 1.7) },
    uAmtL: { value: new THREE.Vector4(0.56, 0.28, 0.12, 0.03) },
    uZenCovL: { value: new THREE.Vector4(0.03, 0.048, 0.078, 0.115) },
    uZenAmtL: { value: new THREE.Vector4(0.72, 0.64, 0.5, 0.36) },
    uAerL: { value: new THREE.Vector4(0.55, 0.52, 0.46, 0.4) },
    uRimL: { value: new THREE.Vector4(1, 0.9, 0.72, 0.55) },
    uCloudLit: { value: colors.cloudLit }, uCloudDark: { value: colors.cloudDark },
    uCloudAmb: { value: colors.cloudAmb }, uCloudRim: { value: colors.cloudRim },
    uCloudAmt: { value: 0.34 }, uCloudRimAmt: { value: 0.38 },
    uStars: { value: 0 }, uMilky: { value: 0 }, uMoonCol: { value: new THREE.Color('#9fb6e8') },
    uMoonSize: { value: 0.0234 }, uMoonBright: { value: 0 }, uMoonMaria: { value: 0.42 },
    uMoonHalo: { value: 0 }, uDither: { value: 0.008 },
    uNightCloudV: { value: 0.66 }, uNightCloudA: { value: 0.72 }, uNightCloudR: { value: 0.34 },
    uCloudLitK: { value: 0.78 }, uCloudShadeK: { value: 0.48 }, uCloudCoreK: { value: 0.62 }, uCloudFormK: { value: 0.7 },
  };
  const material = new THREE.ShaderMaterial({
    name: 'wetland-sakura-idle-original-sky', uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: true,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(600, 96, 48), material);
  dome.name = 'wetland-sakura-idle-sky-dome';
  dome.frustumCulled = false;
  dome.renderOrder = -10000;
  const root = new THREE.Group();
  root.name = 'wetland-sakura-idle-sky';
  root.add(dome);
  const discCanvas = document.createElement('canvas');
  discCanvas.width = 128;
  discCanvas.height = 128;
  const discContext = discCanvas.getContext('2d');
  if (!discContext) throw new Error('Unable to create SakuraIdle sun disc texture');
  const discGradient = discContext.createRadialGradient(64, 64, 4, 64, 64, 64);
  discGradient.addColorStop(0, '#fffbe3');
  discGradient.addColorStop(0.18, '#fff4b3');
  discGradient.addColorStop(0.36, '#f6cf63');
  discGradient.addColorStop(0.54, 'rgba(255, 211, 98, 0.08)');
  discGradient.addColorStop(1, 'rgba(255, 211, 98, 0)');
  discContext.fillStyle = discGradient;
  discContext.fillRect(0, 0, 128, 128);
  const discTexture = new THREE.CanvasTexture(discCanvas);
  discTexture.colorSpace = THREE.SRGBColorSpace;
  const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({
    map: discTexture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  }));
  sunDisc.name = 'wetland-sakura-idle-world-sun-disc';
  sunDisc.scale.setScalar(26);
  sunDisc.renderOrder = -9998;
  sunDisc.frustumCulled = false;
  root.add(sunDisc);
  let sunVisible = true;
  let dayLighting: WetlandDayLighting | null = null;
  const applyDayLighting = () => {
    if (!dayLighting) return;
    uniforms.uCloudLit.value.set(dayLighting.cloudLitColor);
    uniforms.uCloudDark.value.set(dayLighting.cloudDarkColor);
    uniforms.uCloudAmb.value.set(dayLighting.cloudAmbientColor);
    uniforms.uCloudRim.value.set(dayLighting.cloudRimColor);
  };

  return {
    root,
    sunDirection,
    applyPreset(preset) {
      const isClear = preset.sunIntensity > 0.5;
      sunVisible = isClear;
      sunDisc.visible = isClear;
      const elevation = THREE.MathUtils.degToRad(preset.elevation);
      const azimuth = THREE.MathUtils.degToRad(preset.azimuth);
      sunDirection.setFromSphericalCoords(1, Math.PI / 2 - elevation, azimuth);
      uniforms.uSunDir.value.copy(sunDirection);
      if (isClear) {
        uniforms.uZenith.value.set('#4e86d4');
        uniforms.uMid.value.set('#5f9fd6');
        uniforms.uHorizon.value.set('#82b8d8');
        uniforms.uHaze.value.set('#8fbfdd');
        uniforms.uHazeWarm.value.set('#d99a61');
        uniforms.uFogColor.value.set('#91bdd9');
        uniforms.uSunTint.value.set('#ffebcb');
        uniforms.uGlowTint.value.set('#c38348');
        uniforms.uCloudLit.value.set('#e8f1f7');
        uniforms.uCloudDark.value.set('#91a9c6');
        uniforms.uCloudAmb.value.set('#c4d9ea');
        uniforms.uCloudRim.value.set('#f7d9b0');
        // SakuraIdle uses ACES/bloom; wetland is a direct-output study page.
        // This is the matching display-space energy, not a different sun model.
        uniforms.uSunI.value = 2.5;
        uniforms.uSunSize.value = 0.026;
        uniforms.uCloudAmt.value = 0.34;
        uniforms.uCovL.value.set(0.58, 0.67, 0.75, 0.83);
        uniforms.uAmtL.value.set(0.56, 0.28, 0.12, 0.03);
      } else {
        uniforms.uZenith.value.set(preset.zenithColor);
        uniforms.uMid.value.set(preset.midColor);
        uniforms.uHorizon.value.set(preset.horizonColor);
        uniforms.uHaze.value.set(preset.hazeColor);
        uniforms.uHazeWarm.value.set(preset.hazeColor).lerp(uniforms.uSunTint.value, 0.16);
        uniforms.uFogColor.value.set(preset.fogColor);
        uniforms.uSunTint.value.set(preset.sunColor);
        uniforms.uGlowTint.value.set(preset.sunGlowColor);
        uniforms.uCloudLit.value.set(preset.cloudLitColor);
        uniforms.uCloudDark.value.set(preset.cloudDarkColor);
        uniforms.uCloudAmb.value.set(preset.cloudAmbientColor);
        uniforms.uCloudRim.value.set(preset.cloudRimColor);
        uniforms.uSunI.value = preset.sunIntensity * 1.6;
        uniforms.uSunSize.value = Math.max(0.012, preset.sunSize * 0.82);
        uniforms.uCloudAmt.value = 1;
        uniforms.uCovL.value.set(0.56, 0.61, 0.67, 0.72);
        uniforms.uAmtL.value.set(1, 0.65, 0.35, 0.12);
      }
      applyDayLighting();
    },
    setDayLighting(lighting) {
      dayLighting = lighting;
      applyDayLighting();
    },
    setWind(direction, driftTime) {
      uniforms.uWindDir.value.copy(direction).normalize();
      uniforms.uWindTime.value = driftTime;
    },
    setCameraPosition(position, _cameraQuaternion, cameraFov = 42, viewportHeight = 1080) {
      dome.position.copy(position);
      uniforms.uSunDir.value.copy(sunDirection);
      sunDisc.position.copy(position).addScaledVector(sunDirection, 480);
      sunDisc.visible = sunVisible;
      uniforms.uPxRad.value = 2 * Math.tan(THREE.MathUtils.degToRad(cameraFov) * 0.5) / Math.max(1, viewportHeight);
      uniforms.uTime.value = uniforms.uWindTime.value;
    },
    dispose() {
      dome.geometry.dispose();
      material.dispose();
      sunDisc.material.dispose();
      discTexture.dispose();
      texA.dispose(); texB.dispose(); texC.dispose();
    },
  };
};
