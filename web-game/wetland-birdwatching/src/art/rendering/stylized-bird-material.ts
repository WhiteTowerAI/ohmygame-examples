import * as THREE from 'three';

type StylizedBirdMaterialParameters = Omit<THREE.MeshToonMaterialParameters, 'color'> & {
  stylizedShading?: boolean;
  shadeColor?: THREE.ColorRepresentation;
  shadeStrength?: number;
};

const sharedUniforms = {
  enabled: { value: 1 },
  keyDirectionView: { value: new THREE.Vector3(-0.4, 0.7, 0.55).normalize() },
  threshold: { value: 0.05 },
  softness: { value: 0.04 },
};
const defaultShadeTint = new THREE.Color('#9ca6ad');

const keyWorldPosition = new THREE.Vector3();
const targetWorldPosition = new THREE.Vector3();

export const updateStylizedBirdKeyLight = (
  light: THREE.DirectionalLight,
  camera: THREE.Camera,
) => {
  light.getWorldPosition(keyWorldPosition);
  light.target.getWorldPosition(targetWorldPosition);
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  sharedUniforms.keyDirectionView.value
    .copy(keyWorldPosition)
    .sub(targetWorldPosition)
    .normalize()
    .transformDirection(camera.matrixWorldInverse);
};

export const createStylizedBirdMaterial = (
  color: THREE.ColorRepresentation,
  parameters: StylizedBirdMaterialParameters = {},
) => {
  const {
    stylizedShading = true,
    shadeColor,
    shadeStrength = shadeColor === undefined ? 0.28 : 1,
    ...materialParameters
  } = parameters;
  const material = new THREE.MeshToonMaterial({ color, ...materialParameters });
  if (!stylizedShading) return material;
  const resolvedShadeColor = shadeColor === undefined
    ? new THREE.Color(color).multiply(defaultShadeTint)
    : new THREE.Color(shadeColor);
  const shadeColorUniform = { value: resolvedShadeColor };
  const shadeStrengthUniform = { value: THREE.MathUtils.clamp(shadeStrength, 0, 1) };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.stylizedShadeEnabled = sharedUniforms.enabled;
    shader.uniforms.stylizedKeyDirectionView = sharedUniforms.keyDirectionView;
    shader.uniforms.stylizedShadeColor = shadeColorUniform;
    shader.uniforms.stylizedShadeStrength = shadeStrengthUniform;
    shader.uniforms.stylizedShadeThreshold = sharedUniforms.threshold;
    shader.uniforms.stylizedShadeSoftness = sharedUniforms.softness;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float stylizedShadeEnabled;
uniform vec3 stylizedKeyDirectionView;
uniform vec3 stylizedShadeColor;
uniform float stylizedShadeStrength;
uniform float stylizedShadeThreshold;
uniform float stylizedShadeSoftness;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `float stylizedFacing = dot(normalize(normal), normalize(stylizedKeyDirectionView));
float stylizedDarkMask = 1.0 - smoothstep(
  stylizedShadeThreshold - stylizedShadeSoftness,
  stylizedShadeThreshold + stylizedShadeSoftness,
  stylizedFacing
);
vec3 stylizedBaseColor = diffuseColor.rgb;
outgoingLight = mix(
  stylizedBaseColor,
  stylizedShadeColor,
  stylizedDarkMask * stylizedShadeStrength * stylizedShadeEnabled
);
#include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => 'stylized-bird-material-v3';
  return material;
};
