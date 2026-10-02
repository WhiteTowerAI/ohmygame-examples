import * as THREE from 'three';
import type { EnvironmentLook } from './environment-look';

export type EnvironmentLightingRig = Readonly<{
  background: THREE.Color;
  fog: THREE.Fog;
  hemisphereLight: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
  applyLook: (look: EnvironmentLook) => void;
  dispose: () => void;
}>;

export const createEnvironmentLighting = (
  scene: THREE.Scene,
  initialLook: EnvironmentLook,
): EnvironmentLightingRig => {
  const background = new THREE.Color(initialLook.background);
  const fog = new THREE.Fog(
    initialLook.fog.color,
    initialLook.fog.near,
    initialLook.fog.far,
  );
  scene.background = background;
  scene.fog = fog;

  const hemisphereLight = new THREE.HemisphereLight();
  hemisphereLight.name = 'environment-hemisphere-light';
  const keyLight = new THREE.DirectionalLight();
  keyLight.name = 'environment-key-light';
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -14;
  keyLight.shadow.camera.right = 14;
  keyLight.shadow.camera.top = 14;
  keyLight.shadow.camera.bottom = -8;
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 60;
  keyLight.shadow.bias = -0.0001;
  keyLight.shadow.normalBias = 0.02;
  keyLight.shadow.radius = 2;

  const fillLight = new THREE.DirectionalLight();
  fillLight.name = 'environment-fill-light';
  const rimLight = new THREE.DirectionalLight();
  rimLight.name = 'environment-rim-light';
  scene.add(hemisphereLight, keyLight, fillLight, rimLight);

  const applyLook = (look: EnvironmentLook) => {
    background.set(look.background);
    fog.color.set(look.fog.color);
    fog.near = look.fog.near;
    fog.far = look.fog.far;
    hemisphereLight.color.set(look.hemisphere.skyColor);
    hemisphereLight.groundColor.set(look.hemisphere.groundColor);
    hemisphereLight.intensity = look.hemisphere.intensity;
    keyLight.color.set(look.key.color);
    keyLight.intensity = look.key.intensity;
    keyLight.position.set(...look.key.position);
    fillLight.color.set(look.fill.color);
    fillLight.intensity = look.fill.intensity;
    fillLight.position.set(...look.fill.position);
    rimLight.color.set(look.rim.color);
    rimLight.intensity = look.rim.intensity;
    rimLight.position.set(...look.rim.position);
    scene.userData.environmentLook = look.id;
  };
  applyLook(initialLook);

  return {
    background,
    fog,
    hemisphereLight,
    keyLight,
    fillLight,
    rimLight,
    applyLook,
    dispose() {
      scene.remove(hemisphereLight, keyLight, fillLight, rimLight);
      hemisphereLight.dispose();
      keyLight.dispose();
      fillLight.dispose();
      rimLight.dispose();
    },
  };
};
