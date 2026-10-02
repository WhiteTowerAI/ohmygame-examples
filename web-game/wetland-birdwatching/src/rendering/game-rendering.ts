import * as THREE from 'three';
import {
  getEnvironmentLook,
  getEnvironmentLookById,
  type EnvironmentLookId,
} from '../art/environment/environment-look';
import { createEnvironmentLighting } from '../art/environment/environment-lighting';
import type { EnvironmentLightingRig } from '../art/environment/environment-lighting';
import { updateStylizedBirdKeyLight } from '../art/rendering/stylized-bird-material';
import { createStylizedBirdPipeline } from '../art/rendering/stylized-bird-pipeline';
import { createStylizedEnvironmentMaterialSystem } from '../art/rendering/stylized-environment-material';
import {
  createBinocularDepthOfField,
  type BinocularDepthOfFieldSettings,
  type BinocularDepthOfFieldSnapshot,
} from './binocular-depth-of-field';

export type EnvironmentAppearanceState = Readonly<{
  presetId: EnvironmentLookId;
  hemisphereIntensity: number;
  keyIntensity: number;
  fillIntensity: number;
  rimIntensity: number;
  fogNear: number;
  fogFar: number;
  backgroundColor: string;
  fogColor: string;
  keyColor: string;
  acesEnabled: boolean;
}>;

export type EnvironmentAppearanceControls = {
  getState: () => EnvironmentAppearanceState;
  applyPreset: (id: EnvironmentLookId) => EnvironmentAppearanceState;
  setHemisphereIntensity: (value: number) => EnvironmentAppearanceState;
  setKeyIntensity: (value: number) => EnvironmentAppearanceState;
  setFillIntensity: (value: number) => EnvironmentAppearanceState;
  setRimIntensity: (value: number) => EnvironmentAppearanceState;
  setFogRange: (near: number, far: number) => EnvironmentAppearanceState;
  setBackgroundColor: (value: string) => EnvironmentAppearanceState;
  setFogColor: (value: string) => EnvironmentAppearanceState;
  setKeyColor: (value: string) => EnvironmentAppearanceState;
  setAcesEnabled: (enabled: boolean) => EnvironmentAppearanceState;
  reset: () => EnvironmentAppearanceState;
};

export type GameRendering = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  lighting: EnvironmentLightingRig;
  keyLight: THREE.DirectionalLight;
  environment: EnvironmentAppearanceControls;
  registerStylizedEnvironment: (root: THREE.Object3D) => () => void;
  registerStylizedBird: (root: THREE.Object3D) => () => void;
  setStylizedOutlineEnabled: (enabled: boolean) => void;
  setBinocularDepthOfField: (settings: Partial<BinocularDepthOfFieldSettings>) => void;
  getBinocularDepthOfFieldSnapshot: () => BinocularDepthOfFieldSnapshot;
  render: (renderScene?: () => void) => void;
  resize: (width: number, height: number, pixelRatio: number) => void;
  dispose: () => void;
};

export const createGameRendering = (canvas: HTMLCanvasElement): GameRendering => {
  const params = new URLSearchParams(window.location.search);
  const environmentLook = getEnvironmentLook(params.get('environmentLook'));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const environmentLighting = createEnvironmentLighting(scene, environmentLook);
  const {
    background: backgroundColor,
    fog,
    hemisphereLight,
    keyLight,
    fillLight,
    rimLight,
  } = environmentLighting;
  // The shared wetland sky is a 600 m camera-centred dome. Keep the gameplay
  // camera's far plane aligned with the wetland study so the dome and sun are
  // not clipped before they reach the render pass.
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 900);

  const acesParam = params.get('aces');
  const acesEnabled = acesParam === 'on'
    || (acesParam !== 'off' && environmentLook.defaultAcesEnabled);
  const stylizedBirdPipeline = createStylizedBirdPipeline(renderer, scene, camera, {
    outlineEnabled: params.get('birdOutline') !== 'off',
    acesEnabled,
  });
  const binocularDepthOfField = createBinocularDepthOfField(renderer, scene, camera);
  let stylizedOutlineEnabled = params.get('birdOutline') !== 'off';
  const stylizedEnvironment = createStylizedEnvironmentMaterialSystem(environmentLook.material);

  let selectedPresetId = environmentLook.id;
  const syncStylizedEnvironment = () => {
    const look = getEnvironmentLookById(selectedPresetId);
    const keyRatio = look.key.intensity > 0 ? keyLight.intensity / look.key.intensity : 1;
    const hemisphereRatio = look.hemisphere.intensity > 0
      ? hemisphereLight.intensity / look.hemisphere.intensity
      : 1;
    stylizedEnvironment.applyLook({
      ...look.material,
      litTint: keyLight.color,
      litIntensity: look.material.litIntensity * THREE.MathUtils.clamp(keyRatio, 0.65, 1.45),
      shadowBaseStrength: look.material.shadowBaseStrength
        * THREE.MathUtils.clamp(0.7 + hemisphereRatio * 0.3, 0.72, 1.28),
    });
    scene.userData.stylizedEnvironmentMaterial = stylizedEnvironment.isEnabled();
  };
  const getState = (): EnvironmentAppearanceState => ({
    presetId: selectedPresetId,
    hemisphereIntensity: hemisphereLight.intensity,
    keyIntensity: keyLight.intensity,
    fillIntensity: fillLight.intensity,
    rimIntensity: rimLight.intensity,
    fogNear: fog.near,
    fogFar: fog.far,
    backgroundColor: `#${backgroundColor.getHexString()}`,
    fogColor: `#${fog.color.getHexString()}`,
    keyColor: `#${keyLight.color.getHexString()}`,
    acesEnabled: stylizedBirdPipeline.isAcesEnabled(),
  });
  const applyPreset = (id: EnvironmentLookId) => {
    const look = getEnvironmentLookById(id);
    selectedPresetId = id;
    environmentLighting.applyLook(look);
    stylizedBirdPipeline.setAcesEnabled(look.defaultAcesEnabled);
    syncStylizedEnvironment();
    return getState();
  };
  const environment: EnvironmentAppearanceControls = {
    getState,
    applyPreset,
    setHemisphereIntensity(value) {
      hemisphereLight.intensity = THREE.MathUtils.clamp(value, 0, 4);
      syncStylizedEnvironment();
      return getState();
    },
    setKeyIntensity(value) {
      keyLight.intensity = THREE.MathUtils.clamp(value, 0, 5);
      syncStylizedEnvironment();
      return getState();
    },
    setFillIntensity(value) {
      fillLight.intensity = THREE.MathUtils.clamp(value, 0, 2);
      return getState();
    },
    setRimIntensity(value) {
      rimLight.intensity = THREE.MathUtils.clamp(value, 0, 2);
      return getState();
    },
    setFogRange(near, far) {
      fog.near = THREE.MathUtils.clamp(near, 0, 119);
      fog.far = THREE.MathUtils.clamp(Math.max(far, fog.near + 1), fog.near + 1, 120);
      return getState();
    },
    setBackgroundColor(value) {
      backgroundColor.set(value);
      return getState();
    },
    setFogColor(value) {
      fog.color.set(value);
      return getState();
    },
    setKeyColor(value) {
      keyLight.color.set(value);
      syncStylizedEnvironment();
      return getState();
    },
    setAcesEnabled(enabled) {
      stylizedBirdPipeline.setAcesEnabled(enabled);
      return getState();
    },
    reset() {
      return applyPreset(selectedPresetId);
    },
  };
  syncStylizedEnvironment();

  const resize = (width: number, height: number, pixelRatio: number) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(pixelRatio, 1.75));
    renderer.setSize(width, height);
    stylizedBirdPipeline.setSize(width, height, renderer.getPixelRatio());
    binocularDepthOfField.setSize(width, height, renderer.getPixelRatio());
  };

  return {
    scene,
    camera,
    renderer,
    lighting: environmentLighting,
    keyLight,
    environment,
    registerStylizedEnvironment: stylizedEnvironment.register,
    registerStylizedBird: stylizedBirdPipeline.registerBird,
    setStylizedOutlineEnabled(enabled) {
      stylizedOutlineEnabled = enabled;
      stylizedBirdPipeline.setOutlineEnabled(enabled);
    },
    setBinocularDepthOfField: binocularDepthOfField.setSettings,
    getBinocularDepthOfFieldSnapshot: binocularDepthOfField.getSnapshot,
    render(renderScene) {
      stylizedEnvironment.updateLighting(keyLight, fillLight, rimLight);
      updateStylizedBirdKeyLight(keyLight, camera);
      binocularDepthOfField.render(() => {
        if (stylizedOutlineEnabled) stylizedBirdPipeline.render();
        else if (renderScene) renderScene();
        else renderer.render(scene, camera);
      });
    },
    resize,
    dispose() {
      stylizedEnvironment.dispose();
      stylizedBirdPipeline.dispose();
      binocularDepthOfField.dispose();
      environmentLighting.dispose();
      renderer.dispose();
    },
  };
};
