import * as THREE from 'three';
import type { EnvironmentLook } from '../environment/environment-look';

export type FoliageInstance = Readonly<{
  position: THREE.Vector3;
  surfaceNormal: THREE.Vector3;
  scale: number;
  roll: number;
  tone?: number;
}>;

export type FoliagePalette = Readonly<{
  shadow: THREE.ColorRepresentation;
  mid: THREE.ColorRepresentation;
  highlight: THREE.ColorRepresentation;
  multiplier?: THREE.ColorRepresentation;
}>;

type FoliageMaskMode = 'alpha' | 'sdf';
export type FoliageRendererVisualMode = 'shape' | 'elemental' | 'shared';
export type FoliageGrowthMode = 'upright' | 'outward' | 'random';

type FoliageWindDirection = Readonly<{ x: number; y: number }>;

const getStableFoliageOutwardRoll = (surfaceNormal: THREE.Vector3) => (
  Math.hypot(surfaceNormal.x, surfaceNormal.y) > 0.08
    ? Math.atan2(surfaceNormal.x, surfaceNormal.y)
    : 0
);

const vertexShader = /* glsl */ `
#include <common>
#include <fog_pars_vertex>

attribute vec3 instanceNormal;
attribute float instanceRoll;
attribute float instanceOutwardRoll;
attribute vec3 instanceShadowColor;
attribute vec3 instanceMidColor;
attribute vec3 instanceHighlightColor;
attribute vec3 instanceColorMultiplier;
attribute float instanceTone;
uniform float uGrowthMode;
uniform float uOutwardStrength;
uniform float uDirectionJitter;
uniform float uTime;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform vec2 uWindDirection;
varying vec3 vInstanceNormal;
varying vec3 vInstanceShadowColor;
varying vec3 vInstanceMidColor;
varying vec3 vInstanceHighlightColor;
varying vec3 vInstanceColorMultiplier;
varying vec2 vUv;
varying float vWorldY;
varying float vInstanceTone;

float foliageWindHash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}

float foliageWindNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  vec2 blend = local * local * (3.0 - 2.0 * local);
  return mix(
    mix(foliageWindHash(cell), foliageWindHash(cell + vec2(1.0, 0.0)), blend.x),
    mix(foliageWindHash(cell + vec2(0.0, 1.0)), foliageWindHash(cell + vec2(1.0)), blend.x),
    blend.y
  );
}

void main() {
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
  #endif

  vec3 center = m[3].xyz;
  float scaleX = length(m[0].xyz);
  float scaleY = length(m[1].xyz);
  vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 cameraUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 worldNormal = normalize(mat3(modelMatrix) * instanceNormal);
  float jitterRoll = instanceRoll * uDirectionJitter * PI;
  float finalRoll = jitterRoll;
  if (uGrowthMode > 0.5 && uGrowthMode < 1.5) {
    finalRoll += instanceOutwardRoll * uOutwardStrength;
  } else if (uGrowthMode >= 1.5) {
    finalRoll = instanceRoll * PI;
  }
  float rollCos = cos(finalRoll);
  float rollSin = sin(finalRoll);
  vec3 rolledRight = cameraRight * rollCos + cameraUp * rollSin;
  vec3 rolledUp = cameraUp * rollCos - cameraRight * rollSin;
  vec3 worldPosition = center
    + rolledRight * position.x * scaleX
    + rolledUp * position.y * scaleY;

  // Elemental-style spatial breeze and broad squall keep nearby foliage coherent.
  float windHeightMask = pow(clamp(position.y + 0.5, 0.0, 1.0), 1.5);
  vec2 windDirection = length(uWindDirection) > 0.001
    ? normalize(uWindDirection)
    : vec2(1.0, 0.0);
  vec2 windPosition = center.xz + vec2(position.x * scaleX, position.y * scaleY) * 0.18;
  float breeze = foliageWindNoise(
    windPosition * 0.72 + windDirection * uTime * uWindSpeed * 1.25
  ) - 0.5;
  float squall = foliageWindNoise(
    windPosition * 0.18 + windDirection * uTime * uWindSpeed * 0.32
  ) - 0.5;
  float flutter = sin(
    dot(windPosition, vec2(0.73, 1.17)) + uTime * uWindSpeed * 2.4
  ) * 0.12;
  float wind = (breeze * 0.72 + squall * 1.12 + flutter)
    * uWindStrength
    * windHeightMask;
  vec3 horizontalWindAxis = vec3(windDirection.x, 0.0, windDirection.y);
  worldPosition += horizontalWindAxis * wind * scaleY * 0.18;
  worldPosition += rolledUp * wind * scaleY * 0.045;

  vec4 mvPosition = viewMatrix * vec4(worldPosition, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vInstanceNormal = worldNormal;
  vInstanceShadowColor = instanceShadowColor;
  vInstanceMidColor = instanceMidColor;
  vInstanceHighlightColor = instanceHighlightColor;
  vInstanceColorMultiplier = instanceColorMultiplier;
  vUv = uv;
  vWorldY = worldPosition.y;
  vInstanceTone = instanceTone;
  #include <fog_vertex>
}
`;

const maskShader = /* glsl */ `
uniform sampler2D uAlphaMap;
uniform float uMaskMode;
uniform float uSdfThickness;

float foliageCoverage(vec2 maskUv) {
  vec4 maskSample = texture2D(uAlphaMap, maskUv);
  if (uMaskMode < 0.5) {
    return smoothstep(0.4, 0.6, maskSample.a);
  }
  float threshold = 0.5 - uSdfThickness * 0.08;
  float antialiasWidth = max(fwidth(maskSample.r) * 1.25, 0.004);
  return smoothstep(threshold - antialiasWidth, threshold + antialiasWidth, maskSample.r);
}
`;

const fragmentShader = /* glsl */ `
#include <common>
#include <fog_pars_fragment>

varying vec3 vInstanceNormal;
varying vec3 vInstanceShadowColor;
varying vec3 vInstanceMidColor;
varying vec3 vInstanceHighlightColor;
varying vec3 vInstanceColorMultiplier;
varying vec2 vUv;
varying float vWorldY;
varying float vInstanceTone;

uniform vec3 uKeyDirection;

${maskShader}

vec3 colorRamp(float t) {
  if (t < 0.5) return mix(vInstanceShadowColor, vInstanceMidColor, t * 2.0);
  return mix(vInstanceMidColor, vInstanceHighlightColor, (t - 0.5) * 2.0);
}

void main() {
  float coverage = foliageCoverage(vUv);
  if (coverage < 0.5) discard;

  vec3 normal = normalize(vInstanceNormal);
  float keyAmount = dot(normal, normalize(uKeyDirection)) * 0.6 + 0.4;
  float lightingRamp = clamp(vWorldY * 0.1 + keyAmount, 0.0, 1.0);
  float rampPosition = vInstanceTone < 0.0
    ? lightingRamp
    : mix(clamp(vInstanceTone, 0.0, 1.0), lightingRamp, 0.46);
  vec3 color = colorRamp(rampPosition) * vInstanceColorMultiplier;

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

const depthFragmentShader = /* glsl */ `
#include <packing>
varying vec2 vUv;
${maskShader}

void main() {
  if (foliageCoverage(vUv) < 0.5) discard;
  gl_FragColor = packDepthToRGBA(gl_FragCoord.z);
}
`;

export const createFoliageCardRenderer = (
  maskTexture: THREE.Texture,
  maxCount: number,
  palettes: Readonly<{
    shape: FoliagePalette;
    elemental: FoliagePalette;
    shared: FoliagePalette;
  }>,
) => {
  const sharedMaskUniforms = {
    uAlphaMap: { value: maskTexture },
    uMaskMode: { value: 1 },
    uSdfThickness: { value: 0 },
  };
  const sharedOrientationUniforms = {
    uGrowthMode: { value: 1 },
    uOutwardStrength: { value: 0.72 },
    uDirectionJitter: { value: 0.18 },
  };
  const sharedWindUniforms = {
    uTime: { value: 0 },
    uWindStrength: { value: 0 },
    uWindSpeed: { value: 0.74 },
    uWindDirection: { value: new THREE.Vector2(0.53, 0.85).normalize() },
  };
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    ...sharedMaskUniforms,
    ...sharedOrientationUniforms,
    ...sharedWindUniforms,
    uKeyDirection: { value: new THREE.Vector3(-0.42, 0.76, 0.49).normalize() },
  };
  const material = new THREE.ShaderMaterial({
    name: 'shared-foliage-card-color-material',
    side: THREE.DoubleSide,
    fog: true,
    uniforms,
    vertexShader,
    fragmentShader,
    depthTest: true,
    depthWrite: true,
  });
  const depthMaterial = new THREE.ShaderMaterial({
    name: 'shared-foliage-card-depth-material',
    side: THREE.DoubleSide,
    uniforms: { ...sharedMaskUniforms, ...sharedOrientationUniforms, ...sharedWindUniforms },
    vertexShader,
    fragmentShader: depthFragmentShader,
    depthTest: true,
    depthWrite: true,
  });

  const geometry = new THREE.PlaneGeometry(1.18, 1, 1, 1);
  const instanceNormals = new Float32Array(maxCount * 3);
  const instanceRolls = new Float32Array(maxCount);
  const instanceOutwardRolls = new Float32Array(maxCount);
  const instanceShadowColors = new Float32Array(maxCount * 3);
  const instanceMidColors = new Float32Array(maxCount * 3);
  const instanceHighlightColors = new Float32Array(maxCount * 3);
  const instanceColorMultipliers = new Float32Array(maxCount * 3);
  const instanceTones = new Float32Array(maxCount);
  geometry.setAttribute('instanceNormal', new THREE.InstancedBufferAttribute(instanceNormals, 3));
  geometry.setAttribute('instanceRoll', new THREE.InstancedBufferAttribute(instanceRolls, 1));
  geometry.setAttribute(
    'instanceOutwardRoll',
    new THREE.InstancedBufferAttribute(instanceOutwardRolls, 1),
  );
  geometry.setAttribute('instanceShadowColor', new THREE.InstancedBufferAttribute(instanceShadowColors, 3));
  geometry.setAttribute('instanceMidColor', new THREE.InstancedBufferAttribute(instanceMidColors, 3));
  geometry.setAttribute('instanceHighlightColor', new THREE.InstancedBufferAttribute(instanceHighlightColors, 3));
  geometry.setAttribute('instanceColorMultiplier', new THREE.InstancedBufferAttribute(instanceColorMultipliers, 3));
  geometry.setAttribute('instanceTone', new THREE.InstancedBufferAttribute(instanceTones, 1));

  const mesh = new THREE.InstancedMesh(geometry, material, maxCount);
  mesh.name = 'shared-camera-facing-foliage-cards';
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.customDepthMaterial = depthMaterial;
  mesh.customDistanceMaterial = depthMaterial;
  mesh.userData.preserveStylizedMaterial = true;
  mesh.userData.rendererContract = 'single-billboard-card-screen-growth-instance-normal-three-color-shared-mask-shadow';

  const instanceObject = new THREE.Object3D();
  let visualMode: FoliageRendererVisualMode = 'shared';
  let currentCount = 0;
  let authoringMask: THREE.Texture = maskTexture;
  let referenceMask: THREE.Texture | undefined;

  const writeColor = (target: Float32Array, index: number, color: THREE.Color) => {
    target[index * 3] = color.r;
    target[index * 3 + 1] = color.g;
    target[index * 3 + 2] = color.b;
  };

  const applyPalette = (palette: FoliagePalette) => {
    const shadow = new THREE.Color(palette.shadow);
    const mid = new THREE.Color(palette.mid);
    const highlight = new THREE.Color(palette.highlight);
    const multiplier = new THREE.Color(palette.multiplier ?? '#ffffff');
    for (let index = 0; index < currentCount; index += 1) {
      writeColor(instanceShadowColors, index, shadow);
      writeColor(instanceMidColors, index, mid);
      writeColor(instanceHighlightColors, index, highlight);
      writeColor(instanceColorMultipliers, index, multiplier);
    }
    geometry.getAttribute('instanceShadowColor').needsUpdate = true;
    geometry.getAttribute('instanceMidColor').needsUpdate = true;
    geometry.getAttribute('instanceHighlightColor').needsUpdate = true;
    geometry.getAttribute('instanceColorMultiplier').needsUpdate = true;
  };

  const applyMaskForMode = () => {
    const useReference = visualMode === 'elemental' && referenceMask !== undefined;
    sharedMaskUniforms.uAlphaMap.value = useReference ? referenceMask as THREE.Texture : authoringMask;
    sharedMaskUniforms.uMaskMode.value = useReference ? 0 : 1;
  };

  return {
    mesh,
    setInstances(instances: readonly FoliageInstance[]) {
      const count = Math.min(instances.length, maxCount);
      for (let index = 0; index < count; index += 1) {
        const instance = instances[index];
        instanceObject.position.copy(instance.position);
        instanceObject.rotation.set(0, 0, 0);
        instanceObject.scale.setScalar(instance.scale);
        instanceObject.updateMatrix();
        mesh.setMatrixAt(index, instanceObject.matrix);
        instanceNormals[index * 3] = instance.surfaceNormal.x;
        instanceNormals[index * 3 + 1] = instance.surfaceNormal.y;
        instanceNormals[index * 3 + 2] = instance.surfaceNormal.z;
        instanceRolls[index] = instance.roll;
        instanceOutwardRolls[index] = getStableFoliageOutwardRoll(instance.surfaceNormal);
        instanceTones[index] = instance.tone ?? -1;
      }
      mesh.count = count;
      currentCount = count;
      mesh.instanceMatrix.needsUpdate = true;
      geometry.getAttribute('instanceNormal').needsUpdate = true;
      geometry.getAttribute('instanceRoll').needsUpdate = true;
      geometry.getAttribute('instanceOutwardRoll').needsUpdate = true;
      geometry.getAttribute('instanceTone').needsUpdate = true;
      applyPalette(palettes[visualMode]);
      mesh.userData.cardCount = count;
    },
    setMask(texture: THREE.Texture, mode: FoliageMaskMode) {
      authoringMask = texture;
      sharedMaskUniforms.uMaskMode.value = mode === 'sdf' ? 1 : 0;
      applyMaskForMode();
    },
    setReferenceMask(texture: THREE.Texture) {
      referenceMask = texture;
      applyMaskForMode();
    },
    setSdfThickness(thickness: number) {
      sharedMaskUniforms.uSdfThickness.value = THREE.MathUtils.clamp(thickness, -1, 1);
    },
    setGrowthOrientation(
      mode: FoliageGrowthMode,
      outwardStrength: number,
      directionJitter: number,
    ) {
      sharedOrientationUniforms.uGrowthMode.value = mode === 'upright' ? 0 : mode === 'outward' ? 1 : 2;
      sharedOrientationUniforms.uOutwardStrength.value = THREE.MathUtils.clamp(outwardStrength, 0, 1);
      sharedOrientationUniforms.uDirectionJitter.value = THREE.MathUtils.clamp(directionJitter, 0, 1);
      mesh.userData.growthMode = mode;
      mesh.userData.outwardStrength = sharedOrientationUniforms.uOutwardStrength.value;
      mesh.userData.directionJitter = sharedOrientationUniforms.uDirectionJitter.value;
    },
    setVisualMode(mode: FoliageRendererVisualMode) {
      visualMode = mode;
      applyPalette(palettes[mode]);
      applyMaskForMode();
      mesh.userData.visualMode = mode;
    },
    applyLook(_look: EnvironmentLook) {
      if (visualMode === 'shared') applyPalette(palettes.shared);
    },
    updateLighting(
      keyLight: THREE.DirectionalLight,
      fillLight: THREE.DirectionalLight,
      rimLight: THREE.DirectionalLight,
    ) {
      uniforms.uKeyDirection.value.copy(keyLight.position).sub(keyLight.target.position).normalize();
      void fillLight;
      void rimLight;
    },
    updateWind(
      elapsed: number,
      strength: number,
      speed: number,
      direction: FoliageWindDirection,
    ) {
      sharedWindUniforms.uTime.value = Math.max(0, elapsed);
      sharedWindUniforms.uWindStrength.value = THREE.MathUtils.clamp(strength, 0, 1.5);
      sharedWindUniforms.uWindSpeed.value = THREE.MathUtils.clamp(speed, 0, 1.5);
      sharedWindUniforms.uWindDirection.value.set(direction.x, direction.y);
      if (sharedWindUniforms.uWindDirection.value.lengthSq() < 0.0001) {
        sharedWindUniforms.uWindDirection.value.set(1, 0);
      } else {
        sharedWindUniforms.uWindDirection.value.normalize();
      }
      mesh.userData.windStrength = sharedWindUniforms.uWindStrength.value;
      mesh.userData.windSpeed = sharedWindUniforms.uWindSpeed.value;
      mesh.userData.windDirection = sharedWindUniforms.uWindDirection.value.toArray();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      depthMaterial.dispose();
    },
  };
};
