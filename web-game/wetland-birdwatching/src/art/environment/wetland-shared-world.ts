import * as THREE from 'three';
import type { EnvironmentLightingRig } from './environment-lighting';
import { createDefaultWetlandLayoutMap, WetlandLayoutMap } from './wetland-layout-map';
import { wetlandMapPresets, type WetlandMapPreset } from './wetland-map-presets';
import { unifiedWetlandRegionParams } from './wetland-region-fields';
import {
  elementalSpringWetlandStudyPalette,
  type WetlandStudyGenerationProfile,
  type WetlandStudyPalette,
} from './wetland-study';
import {
  decodeWetlandLayout,
  loadPublishedWetlandScene,
  wetlandMinimumSunElevation,
} from './wetland-published-scene';

export const sharedWetlandMapPreset = wetlandMapPresets['park-third'];
const sharedWetlandSemanticMapUrl = new URL('../../assets/maps/park-layout-semantic.png', import.meta.url).href;

export const sharedWetlandGenerationDefaults = Object.freeze({
  params: unifiedWetlandRegionParams,
  grassDistribution: 'color-guided' as const,
  grassShape: 'legacy' as const,
  shoreStyle: 'smooth' as const,
  palette: elementalSpringWetlandStudyPalette as Readonly<WetlandStudyPalette>,
});

// The playable camera stays near the ground, so it can use a lighter sampling
// budget while preserving the same semantic map, terrain functions, palette,
// tree placement grammar and materials as the full art study.
export const sharedWetlandGameplayGenerationProfile: WetlandStudyGenerationProfile = {
  ...sharedWetlandMapPreset.generationProfile,
  terrainVertexSpacing: 0.56,
  surfaceMapTexelSpacing: 0.36,
  grassCandidateBudgetScale: 0.34,
  flowerSpacing: 0.9,
  shrubCandidateCount: 1000,
  rockCandidateCount: 520,
  treeCandidateCount: 11000,
  treeShadowLimit: 24,
};

export const sharedWetlandLightingDefaults = Object.freeze({
  key: { color: '#fff4e6', intensity: 2.0, position: [-28.2, 14.6, -25.4] as const },
  fill: { color: '#87ceeb', intensity: 0.6, position: [10, 5, -6] as const },
  ambient: { color: '#47daff', intensity: 0.35 },
  rim: { color: '#ffd7a3', intensity: 0.3, position: [5, 10, -12] as const },
  toneMappingExposure: 1.75,
  windStrength: 0.58,
});

export type WetlandDayLighting = Readonly<{
  progress: number;
  phase: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk';
  sunAzimuth: number;
  sunElevation: number;
  keyIntensity: number;
  keyColor: string;
  shadowStrength: number;
  shadowContrast: number;
  screenShaftStrength: number;
  canopyShaftStrength: number;
  groundDappleStrength: number;
  cloudLitColor: string;
  cloudDarkColor: string;
  cloudAmbientColor: string;
  cloudRimColor: string;
}>;

type WetlandDayKeyframe = Omit<WetlandDayLighting, 'progress'> & Readonly<{ progress: number }>;

const wetlandDayKeyframes: readonly WetlandDayKeyframe[] = [
  {
    progress: 0,
    phase: 'dawn',
    sunAzimuth: -138,
    sunElevation: 21,
    keyIntensity: 0.68,
    keyColor: '#ffd0a1',
    shadowStrength: 0.78,
    shadowContrast: 1.18,
    screenShaftStrength: 1.15,
    canopyShaftStrength: 0.92,
    groundDappleStrength: 0.48,
    cloudLitColor: '#ffe2c4',
    cloudDarkColor: '#7188a2',
    cloudAmbientColor: '#b9cee0',
    cloudRimColor: '#ffbd7f',
  },
  {
    progress: 0.25,
    phase: 'morning',
    sunAzimuth: -108,
    sunElevation: 43,
    keyIntensity: 0.94,
    keyColor: '#ffead0',
    shadowStrength: 0.94,
    shadowContrast: 1.04,
    screenShaftStrength: 0.78,
    canopyShaftStrength: 0.72,
    groundDappleStrength: 0.82,
    cloudLitColor: '#f4f4e9',
    cloudDarkColor: '#879eb7',
    cloudAmbientColor: '#c6d9e8',
    cloudRimColor: '#f4d6ae',
  },
  {
    progress: 0.5,
    phase: 'noon',
    sunAzimuth: -62,
    sunElevation: 70,
    keyIntensity: 1.08,
    keyColor: '#fff7e9',
    shadowStrength: 0.72,
    shadowContrast: 0.88,
    screenShaftStrength: 0.42,
    canopyShaftStrength: 0.38,
    groundDappleStrength: 1,
    cloudLitColor: '#ffffff',
    cloudDarkColor: '#91a9c2',
    cloudAmbientColor: '#d0e2ef',
    cloudRimColor: '#eef5f7',
  },
  {
    progress: 0.75,
    phase: 'afternoon',
    sunAzimuth: -12,
    sunElevation: 44,
    keyIntensity: 0.9,
    keyColor: '#ffe3bd',
    shadowStrength: 0.96,
    shadowContrast: 1.06,
    screenShaftStrength: 0.8,
    canopyShaftStrength: 0.7,
    groundDappleStrength: 0.8,
    cloudLitColor: '#f7ead7',
    cloudDarkColor: '#7f91aa',
    cloudAmbientColor: '#becfe0',
    cloudRimColor: '#ffc886',
  },
  {
    progress: 1,
    phase: 'dusk',
    sunAzimuth: 42,
    sunElevation: 21,
    keyIntensity: 0.6,
    keyColor: '#ffbd83',
    shadowStrength: 0.82,
    shadowContrast: 1.22,
    screenShaftStrength: 1.2,
    canopyShaftStrength: 0.96,
    groundDappleStrength: 0.42,
    cloudLitColor: '#ffd3ad',
    cloudDarkColor: '#6e7891',
    cloudAmbientColor: '#a9b8cc',
    cloudRimColor: '#ff9d5d',
  },
];

const interpolateDayColor = (from: string, to: string, amount: number) => (
  `#${new THREE.Color(from).lerp(new THREE.Color(to), amount).getHexString()}`
);

export const evaluateWetlandDayLighting = (progress: number): WetlandDayLighting => {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1);
  const upperIndex = wetlandDayKeyframes.findIndex((keyframe) => keyframe.progress >= clamped);
  const to = wetlandDayKeyframes[Math.max(0, upperIndex)];
  const from = wetlandDayKeyframes[Math.max(0, upperIndex - 1)] ?? to;
  const span = Math.max(to.progress - from.progress, 0.0001);
  const amount = THREE.MathUtils.clamp((clamped - from.progress) / span, 0, 1);
  const phaseIndex = Math.min(4, Math.floor(clamped * 5));
  const phases = ['dawn', 'morning', 'noon', 'afternoon', 'dusk'] as const;
  return {
    progress: clamped,
    phase: phases[phaseIndex],
    sunAzimuth: THREE.MathUtils.lerp(from.sunAzimuth, to.sunAzimuth, amount),
    sunElevation: Math.max(
      wetlandMinimumSunElevation,
      THREE.MathUtils.lerp(from.sunElevation, to.sunElevation, amount),
    ),
    keyIntensity: THREE.MathUtils.lerp(from.keyIntensity, to.keyIntensity, amount),
    keyColor: interpolateDayColor(from.keyColor, to.keyColor, amount),
    shadowStrength: THREE.MathUtils.lerp(from.shadowStrength, to.shadowStrength, amount),
    shadowContrast: THREE.MathUtils.lerp(from.shadowContrast, to.shadowContrast, amount),
    screenShaftStrength: THREE.MathUtils.lerp(from.screenShaftStrength, to.screenShaftStrength, amount),
    canopyShaftStrength: THREE.MathUtils.lerp(from.canopyShaftStrength, to.canopyShaftStrength, amount),
    groundDappleStrength: THREE.MathUtils.lerp(from.groundDappleStrength, to.groundDappleStrength, amount),
    cloudLitColor: interpolateDayColor(from.cloudLitColor, to.cloudLitColor, amount),
    cloudDarkColor: interpolateDayColor(from.cloudDarkColor, to.cloudDarkColor, amount),
    cloudAmbientColor: interpolateDayColor(from.cloudAmbientColor, to.cloudAmbientColor, amount),
    cloudRimColor: interpolateDayColor(from.cloudRimColor, to.cloudRimColor, amount),
  };
};

// This is the single source of truth for the accepted wetland look. The art
// study and gameplay world both consume it so approved tuning cannot drift.
export const sharedWetlandAppearanceDefaults = Object.freeze({
  dayProgress: 0.25,
  shadowStrength: 1,
  groundDappleEnabled: true,
  groundDappleStrength: 0.55,
  lightingVersion: 'elemental' as const,
  weather: 'clear' as const,
  skyVersion: 'sakura-idle' as const,
  referenceSkyEnabled: false,
  lightGizmosVisible: false,
  dropShadowEnabled: true,
  colorShadowFusionEnabled: false,
  barkRoundnessEnabled: true,
  treeFoliageLightEnabled: true,
  treeFoliagePaletteStyle: 'sakura-green' as const,
  treeFoliageHeight: 0.37,
  treeFoliageDetail: 0.28,
  treeFoliageKeyEnabled: true,
  treeFoliageKey: 1.05,
  treeFoliageSkyEnabled: true,
  treeFoliageSky: 0.65,
  treeFoliageGroundEnabled: false,
  treeFoliageGround: 2.1,
  treeFoliageBacklightEnabled: true,
  treeFoliageBacklight: 0.05,
  foliageShadowOcclusion: 0.13,
  foliageShadowOcclusionEnabled: false,
  grassGroundIntegrationEnabled: true,
  grassGroundTipLift: 0.26,
  grassFinalGroundColorEnabled: true,
  terrainSlopeLightEnabled: true,
  terrainSlopeStrength: 0.18,
  terrainSelfShadowEnabled: true,
  terrainShadowTintEnabled: true,
  terrainShadowTint: 0.23,
  terrainShadowSoftEnabled: true,
  terrainShadowContact: 0.16,
  terrainShadowFar: 0.10,
  terrainContactDarkeningEnabled: false,
  terrainContactStrength: 0.24,
  godRaysEnabled: true,
  godRaysStrength: 0.72,
  godRaysThreshold: 0.62,
  godRaysDensity: 0.78,
  godRaysDecay: 0.985,
  godRaysShape: 1.5,
  godRaysContrast: 1.5,
  godRaysAntiEnabled: true,
  godRaysAntiScale: 0.75,
  canopyShaftsEnabled: true,
  canopyShaftsStrength: 0.75,
  canopyShaftsLength: 2.4,
  canopyShaftsWidth: 0.52,
  canopyShaftsCount: 2,
  canopyShaftsForwardScatter: 2.2,
});

const loadWetlandLayoutMapImage = async (
  layoutMap: WetlandLayoutMap,
  url = sharedWetlandSemanticMapUrl,
) => {
  const response = await fetch(url);
  if (!response.ok) return false;
  const bitmap = await createImageBitmap(await response.blob());
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = bitmap.width;
  sourceCanvas.height = bitmap.height;
  const sourceContext = sourceCanvas.getContext('2d');
  if (!sourceContext) {
    bitmap.close();
    return false;
  }
  sourceContext.drawImage(bitmap, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, bitmap.width, bitmap.height);
  layoutMap.importRgba(pixels.data, bitmap.width, bitmap.height);
  bitmap.close();
  return true;
};

export const createSharedWetlandLayoutMap = async (
  preset: WetlandMapPreset = sharedWetlandMapPreset,
) => {
  const published = loadPublishedWetlandScene();
  if (published) {
    const domain = published.domain;
    const layoutMap = new WetlandLayoutMap(
      published.layout.columns,
      published.layout.rows,
      domain?.visualWorldWidth ?? preset.worldWidth,
      domain?.visualWorldDepth ?? preset.worldDepth,
      domain?.shape ?? 'rectangle',
      domain?.detailWorldWidth ?? preset.worldWidth,
      domain?.detailWorldDepth ?? preset.worldDepth,
    );
    const data = decodeWetlandLayout(published.layout.data);
    if (data.length === layoutMap.data.length) {
      layoutMap.restore(data);
      return layoutMap;
    }
  }
  const layoutMap = createDefaultWetlandLayoutMap(
    published?.params.terrainSeed ?? sharedWetlandGenerationDefaults.params.terrainSeed,
    {
    width: preset.worldWidth,
    depth: preset.worldDepth,
    },
  );
  await loadWetlandLayoutMapImage(layoutMap);
  return layoutMap;
};

export const applySharedWetlandLighting = (
  lighting: EnvironmentLightingRig,
  renderer: THREE.WebGLRenderer,
  preset: WetlandMapPreset = sharedWetlandMapPreset,
) => {
  const defaults = sharedWetlandLightingDefaults;
  lighting.hemisphereLight.intensity = 0;
  lighting.keyLight.color.set(defaults.key.color);
  lighting.keyLight.intensity = defaults.key.intensity;
  lighting.keyLight.position.set(...defaults.key.position);
  lighting.fillLight.color.set(defaults.fill.color);
  lighting.fillLight.intensity = defaults.fill.intensity;
  lighting.fillLight.position.set(...defaults.fill.position);
  lighting.rimLight.color.set(defaults.rim.color);
  lighting.rimLight.intensity = defaults.rim.intensity;
  lighting.rimLight.position.set(...defaults.rim.position);
  lighting.keyLight.target.position.set(0, 0, 0);
  lighting.fillLight.target.position.set(0, 0, 0);
  lighting.rimLight.target.position.set(0, 0, 0);

  const mapHalfDiagonal = Math.hypot(preset.worldWidth, preset.worldDepth) * 0.5;
  const shadowExtent = Math.max(preset.shadowExtent, mapHalfDiagonal * 1.1);
  const keyDirection = lighting.keyLight.position.clone().normalize();
  const keyDistance = shadowExtent * 1.5 + 24;
  lighting.keyLight.position.copy(keyDirection.multiplyScalar(keyDistance));
  const shadowCamera = lighting.keyLight.shadow.camera;
  shadowCamera.left = -shadowExtent;
  shadowCamera.right = shadowExtent;
  shadowCamera.top = shadowExtent;
  shadowCamera.bottom = -shadowExtent;
  shadowCamera.near = 1;
  shadowCamera.far = Math.max(240, keyDistance + mapHalfDiagonal + 40);
  shadowCamera.updateProjectionMatrix();
  lighting.keyLight.shadow.bias = -0.0001;
  lighting.keyLight.shadow.normalBias = 0.02;
  lighting.keyLight.shadow.radius = 2;

  const fogScale = preset.worldWidth / 9.4;
  lighting.fog.near = 36 * fogScale;
  lighting.fog.far = 72 * fogScale;
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = defaults.toneMappingExposure;
  renderer.shadowMap.type = THREE.PCFShadowMap;
};
