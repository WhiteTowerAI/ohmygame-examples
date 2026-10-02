import * as THREE from 'three';
import { createAlphaFoliageBush } from './alpha-foliage-bush';
import type { EnvironmentLook } from './environment-look';
import {
  createWetlandBoonaGrassRenderer,
  type WetlandBoonaGrassRenderer,
} from './wetland-boona-grass-renderer';
import { createWetlandFlatWater } from './wetland-flat-water';
import { createWetlandFlowerField } from './wetland-flower-field';
import type { WetlandWindFrame } from './wetland-weather';
import type {
  StylizedEnvironmentFeatures,
  StylizedEnvironmentMaterialLook,
} from '../rendering/stylized-environment-material';
import type { WetlandLayoutMap } from './wetland-layout-map';
import {
  createProceduralCamphorTree,
  proceduralWillowTreeRecipe,
} from '../trees/procedural-camphor-tree';
import type { TreeInstance } from '../trees/modular-tree';
import {
  readWetlandTreeCatalog,
} from './wetland-tree-catalog';
import {
  createFoliageLightDirectionExperiment,
  type FoliageLightDirectionExperiment,
  type FoliageLightingResponse,
  type FoliageTreePaletteStyle,
} from '../../art-preview/foliage-light-direction-experiment';
import {
  createWetlandCanopyShafts,
  type WetlandCanopyShaftSettings,
  type WetlandCanopyShafts,
} from './wetland-canopy-shafts';
import {
  createWetlandRegionField,
  type WetlandBrushStroke,
  type WetlandFieldView,
  type WetlandGrassDistribution,
  type WetlandGrassShape,
  type WetlandRegionField,
  type WetlandRegionParams,
  type WetlandRegionSample,
  type WetlandShoreStyle,
} from './wetland-region-fields';

export type WetlandStudyLayer =
  | 'terrain'
  | 'water'
  | 'grass'
  | 'flowers'
  | 'shrubs'
  | 'rocks'
  | 'trees'
  | 'candidates';

export type WetlandStudyMetrics = Readonly<{
  grassBlades: number;
  flowers: number;
  shrubs: number;
  rocks: number;
  trees: number;
  camphorTrees: number;
  camphorTreePresets: number;
  willowTrees: number;
  terrainTriangles: number;
}>;

export type WetlandTerrainLightingFeatures = Readonly<{
  slopeLight: boolean;
  slopeStrength: number;
  selfShadow: boolean;
  shadowTint: boolean;
  shadowTintStrength: number;
  distanceSoftShadow: boolean;
  contactSoftness: number;
  farSoftness: number;
  contactDarkening: boolean;
  contactStrength: number;
}>;

export type WetlandStudy = Readonly<{
  root: THREE.Group;
  field: WetlandRegionField;
  treeProviders: readonly WetlandTreeProvider[];
  terrainHeightMap: THREE.Texture;
  terrainWorldSize: THREE.Vector2;
  metrics: WetlandStudyMetrics;
  rebuildGrass: (options: WetlandStudyGrassUpdate) => void;
  rebuildTrees: (palette: WetlandStudyPalette) => void;
  updateWaterPalette: (palette: WetlandStudyPalette) => void;
  updateTerrainPalette: (palette: WetlandStudyPalette) => Promise<void>;
  setLayerVisible: (layer: WetlandStudyLayer, visible: boolean) => void;
  syncLighting: (environmentLight?: THREE.HemisphereLight | THREE.AmbientLight) => void;
  setStylizedLightingFeatures: (features: Partial<StylizedEnvironmentFeatures>) => void;
  setStylizedLightingLook: (look: StylizedEnvironmentMaterialLook) => void;
  setLightingVersion: (version: 'elemental' | 'reference') => void;
  setTreeFoliageLightResponse: (enabled: boolean) => void;
  setTreeFoliageHeightInfluence: (value: number) => void;
  setTreeFoliageDetailStrength: (value: number) => void;
  setTreeFoliagePaletteStyle: (style: FoliageTreePaletteStyle) => void;
  setTreeFoliageLightingResponse: (response: Partial<FoliageLightingResponse>) => void;
  setFoliageShadowOcclusion: (enabled: boolean, strength: number) => void;
  setGrassGroundIntegration: (enabled: boolean) => void;
  setGrassGroundTipLift: (amount: number) => void;
  setGrassFinalGroundColor: (enabled: boolean) => void;
  updateGrassFinalGroundColor: (renderer: THREE.WebGLRenderer, scene: THREE.Scene) => void;
  getTreeFoliageLightSnapshot: FoliageLightDirectionExperiment['getSnapshot'];
  setTerrainLightingFeatures: (features: Partial<WetlandTerrainLightingFeatures>) => void;
  getTerrainLightingSnapshot: () => WetlandTerrainLightingFeatures;
  setCanopyShaftSettings: (settings: Partial<WetlandCanopyShaftSettings>) => void;
  setGroundDappleSettings: (settings: Readonly<{ enabled?: boolean; strength?: number }>) => void;
  getCanopyShaftSnapshot: WetlandCanopyShafts['getSnapshot'];
  update: (
    elapsed: number,
    wind: WetlandWindFrame,
    camera?: THREE.PerspectiveCamera,
    fog?: THREE.Fog | THREE.FogExp2 | null,
  ) => void;
  dispose: () => void;
}>;

export type WetlandStudyGrassUpdate = Readonly<{
  params: WetlandRegionParams;
  grassDistribution: WetlandGrassDistribution;
  grassShape: WetlandGrassShape;
  shoreStyle: WetlandShoreStyle;
  brushStrokes: readonly WetlandBrushStroke[];
  layoutMap: WetlandLayoutMap;
  palette: WetlandStudyPalette;
}>;

export type WetlandStudyGenerationProfile = Readonly<{
  terrainVertexSpacing: number;
  surfaceMapTexelSpacing: number;
  grassCandidateBudgetScale: number;
  flowerSpacing: number;
  shrubCandidateCount: number;
  plannedShrubLimit: number;
  naturalShrubLimit: number;
  rockCandidateCount: number;
  rockLimit: number;
  treeCandidateCount: number;
  camphorTreeLimit: number;
  willowTreeLimit: number;
  camphorTreeSpacing: number;
  willowTreeSpacing: number;
  treeShadowLimit: number;
  debugCandidateSpacing: number;
}>;

export const compactWetlandStudyGenerationProfile: WetlandStudyGenerationProfile = {
  terrainVertexSpacing: 0.25,
  surfaceMapTexelSpacing: 0.15625,
  grassCandidateBudgetScale: 1,
  flowerSpacing: 0.5,
  shrubCandidateCount: 900,
  plannedShrubLimit: 14,
  naturalShrubLimit: 7,
  rockCandidateCount: 420,
  rockLimit: 10,
  treeCandidateCount: 8000,
  camphorTreeLimit: 26,
  willowTreeLimit: 6,
  camphorTreeSpacing: 4.2,
  willowTreeSpacing: 1.5,
  treeShadowLimit: 32,
  debugCandidateSpacing: 0.48,
};

type WetlandWindTarget = Readonly<{
  object: THREE.Object3D;
  phase: number;
  amplitude: number;
}>;

export type WetlandStudyOptions = Readonly<{
  look: EnvironmentLook;
  hemisphereLight: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
  params: WetlandRegionParams;
  grassDistribution: WetlandGrassDistribution;
  grassShape: WetlandGrassShape;
  shoreStyle: WetlandShoreStyle;
  fieldView: WetlandFieldView;
  showCandidates: boolean;
  brushStrokes: readonly WetlandBrushStroke[];
  layoutMap: WetlandLayoutMap;
  palette: WetlandStudyPalette;
  generationProfile?: WetlandStudyGenerationProfile;
}>;

export type WetlandTreeProvider = Readonly<{
  providerId: string;
  tree: TreeInstance;
}>;

const finalGroundColorLayer = 30;

export type WetlandStudyPalette = {
  grassShadow: string;
  grassMid: string;
  grassSun: string;
  grassTransition: string;
  soil: string;
  soilLight: string;
  path: string;
  mud: string;
  bladeBase: string;
  bladeTip: string;
  bushShadow: string;
  bushMid: string;
  bushHighlight: string;
  bushStem: string;
  treeShadow: string;
  treeMid: string;
  treeHighlight: string;
  treeTrunk: string;
  waterDeep: string;
  waterMid: string;
  waterShallow: string;
  waterRipple: string;
  waterBedShallow: string;
  waterBedDeep: string;
};

export const legacyWetlandStudyPalette: WetlandStudyPalette = {
  grassShadow: '#3e6417',
  grassMid: '#557d24',
  grassSun: '#75a631',
  grassTransition: '#7da15f',
  soil: '#ad9268',
  soilLight: '#c7ad7b',
  path: '#9c805a',
  mud: '#a68d70',
  bladeBase: '#557d24',
  bladeTip: '#75a631',
  bushShadow: '#3e6417',
  bushMid: '#557d24',
  bushHighlight: '#75a631',
  bushStem: '#735b3f',
  treeShadow: '#3e6417',
  treeMid: '#557d24',
  treeHighlight: '#75a631',
  treeTrunk: '#735b3f',
  waterDeep: '#72adb8',
  waterMid: '#72cfc4',
  waterShallow: '#e8aa5d',
  waterRipple: '#edf5dd',
  waterBedShallow: '#d8ae74',
  waterBedDeep: '#84b8ac',
};

export const elementalSpringWetlandStudyPalette: WetlandStudyPalette = {
  grassShadow: '#5fa947',
  grassMid: '#92c256',
  grassSun: '#ece765',
  grassTransition: '#89bb42',
  soil: '#dbbb76',
  soilLight: '#fdd6a5',
  path: '#ceb378',
  mud: '#946947',
  bladeBase: '#78c54b',
  bladeTip: '#c6de5f',
  bushShadow: '#30781c',
  bushMid: '#56973b',
  bushHighlight: '#84c350',
  bushStem: '#b88a50',
  treeShadow: '#204616',
  treeMid: '#37721d',
  treeHighlight: '#85a03b',
  treeTrunk: '#8f6238',
  waterDeep: '#72adb8',
  waterMid: '#72cfc4',
  waterShallow: '#e8aa5d',
  waterRipple: '#edf5dd',
  waterBedShallow: '#d8ae74',
  waterBedDeep: '#84b8ac',
};

// Direct wetland mapping of environment-material-study-v001's
// forestEdgePalette. Water has no counterpart on that stage and retains the
// existing restrained teal family.
export const referenceMaterialStudyWetlandPalette: WetlandStudyPalette = {
  grassShadow: '#76985f',
  grassMid: '#8db06b',
  grassSun: '#a2ba78',
  grassTransition: '#86a36a',
  soil: '#806b59',
  soilLight: '#9a8872',
  path: '#aaa07e',
  mud: '#6d5b50',
  bladeBase: '#6f984e',
  bladeTip: '#86ad58',
  bushShadow: '#4f7f4b',
  bushMid: '#5d9053',
  bushHighlight: '#6ca15e',
  bushStem: '#805f50',
  treeShadow: '#47794c',
  treeMid: '#568a54',
  treeHighlight: '#76aa67',
  treeTrunk: '#805f50',
  waterDeep: '#527f8c',
  waterMid: '#70aaa2',
  waterShallow: '#c99d61',
  waterRipple: '#e1ead7',
  waterBedShallow: '#a58f70',
  waterBedDeep: '#789d96',
};

export const defaultWetlandStudyPalette = legacyWetlandStudyPalette;

const fixedPalette = {
  rock: ['#d6b66f', '#e6c786', '#7d6f39'],
} as const;

const mulberry32 = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const fieldValue = (view: WetlandFieldView, sample: WetlandRegionSample) => {
  switch (view) {
    case 'height': return THREE.MathUtils.clamp((sample.height + 1.05) / 7.2, 0, 1);
    case 'slope': return THREE.MathUtils.clamp(sample.slope / 0.9, 0, 1);
    case 'hill': return sample.hill;
    case 'path': return sample.pathSurface;
    case 'bareGround': return sample.bareGround;
    case 'groundGrass': return sample.groundGrass;
    case 'grassTone': return sample.grassTone;
    case 'grass': return sample.grass;
    case 'flower': return sample.flower;
    case 'shrub': return sample.shrub;
    case 'coverage': return sample.groundGrass;
    default: return 0;
  }
};

const grassSurfaceColor = (
  sample: WetlandRegionSample,
  palette: WetlandStudyPalette,
  target: THREE.Color,
) => {
  const shadow = new THREE.Color(palette.grassShadow);
  const mid = new THREE.Color(palette.grassMid);
  const sun = new THREE.Color(palette.grassSun);
  if (sample.grassTone < 0.5) {
    return target.copy(shadow).lerp(mid, sample.grassTone * 2);
  }
  return target.copy(mid).lerp(sun, (sample.grassTone - 0.5) * 2);
};

const debugColor = (view: WetlandFieldView, value: number, target: THREE.Color) => {
  const low = new THREE.Color('#243e40');
  const mid = new THREE.Color('#63a86b');
  const high = new THREE.Color('#f3d477');
  if (view === 'slope') {
    low.set('#e0d88e');
    mid.set('#df9c60');
    high.set('#b84f55');
  } else if (view === 'coverage') {
    low.set('#94744a');
    mid.set('#7f8a34');
    high.set('#75a631');
  } else if (view === 'height') {
    low.set('#4e8a96');
    mid.set('#7eab66');
    high.set('#e6cf82');
  } else if (view === 'hill') {
    low.set('#6e775f');
    mid.set('#9cad54');
    high.set('#f0d176');
  }
  if (value < 0.5) return target.copy(low).lerp(mid, value * 2);
  return target.copy(mid).lerp(high, (value - 0.5) * 2);
};

const appearanceColor = (
  sample: WetlandRegionSample,
  x: number,
  z: number,
  palette: WetlandStudyPalette,
  waterLevel: number,
  target: THREE.Color,
) => {
  const soil = new THREE.Color(palette.soil).lerp(
    new THREE.Color(palette.soilLight),
    THREE.MathUtils.clamp(0.5 + Math.sin(x * 0.31 - z * 0.23) * 0.18, 0, 1) * 0.24,
  );
  const cliffExposure = THREE.MathUtils.smoothstep(sample.slope, 0.72, 1.6);
  const cliffSoil = new THREE.Color(palette.soil).lerp(
    new THREE.Color(palette.soilLight),
    0.42,
  );
  soil.lerp(cliffSoil, cliffExposure * 0.62);
  const shoreMoisture = 1 - THREE.MathUtils.smoothstep(sample.pondDistance, 0, 0.72);
  soil.lerp(new THREE.Color(palette.mud), shoreMoisture * 0.42);
  const waterDepth = Math.max(0, -sample.pondDistance);
  const pondBed = new THREE.Color(palette.waterShallow).lerp(
    new THREE.Color(palette.waterMid),
    THREE.MathUtils.smoothstep(waterDepth, 0.08, 0.92),
  ).lerp(
    new THREE.Color(palette.waterDeep),
    THREE.MathUtils.smoothstep(waterDepth, 0.78, 2.9),
  );
  const waterVariation = Math.sin(x * 0.21 - z * 0.17) * 0.5
    + Math.sin(x * 0.07 + z * 0.11 + 1.3) * 0.5;
  pondBed.lerp(
    new THREE.Color(palette.waterMid),
    THREE.MathUtils.clamp(waterVariation * 0.035 + 0.018, 0, 0.055),
  );
  const submerged = 1 - THREE.MathUtils.smoothstep(
    sample.height,
    waterLevel - 0.025,
    waterLevel + 0.01,
  );
  const pondBedCoverage = (
    1 - THREE.MathUtils.smoothstep(sample.pondDistance, -0.05, 0.24)
  ) * submerged;
  soil.lerp(pondBed, pondBedCoverage);
  const grass = grassSurfaceColor(sample, palette, new THREE.Color());
  const transition = new THREE.Color(palette.grassTransition);
  const t = sample.groundGrass;
  const inverseT = 1 - t;
  const soilWeight = inverseT * inverseT;
  const transitionWeight = 2 * inverseT * t;
  const grassWeight = t * t;
  target.r = soil.r * soilWeight + transition.r * transitionWeight + grass.r * grassWeight;
  target.g = soil.g * soilWeight + transition.g * transitionWeight + grass.g * grassWeight;
  target.b = soil.b * soilWeight + transition.b * transitionWeight + grass.b * grassWeight;
  const pathCoverage = THREE.MathUtils.smoothstep(sample.pathSurface, 0.08, 0.76)
    * (1 - pondBedCoverage);
  target.lerp(new THREE.Color(palette.path), pathCoverage * 0.94);
  return target;
};

const terrainHeightAt = (field: WetlandRegionField, x: number, z: number) => field.heightAt(x, z);

const createTerrainHeightMap = (field: WetlandRegionField) => {
  const worldWidth = field.width;
  const worldDepth = field.depth;
  const width = 192;
  const height = Math.max(2, Math.round(width * worldDepth / worldWidth));
  const data = new Float32Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const z = THREE.MathUtils.lerp(-worldDepth * 0.5, worldDepth * 0.5, row / (height - 1));
    for (let column = 0; column < width; column += 1) {
      const x = THREE.MathUtils.lerp(-worldWidth * 0.5, worldWidth * 0.5, column / (width - 1));
      const offset = (row * width + column) * 4;
      data[offset] = terrainHeightAt(field, x, z);
      data[offset + 3] = 1;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.name = 'wetland-terrain-height-map';
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
};

const createTerrain = (
  field: WetlandRegionField,
  view: WetlandFieldView,
  palette: WetlandStudyPalette,
  generationProfile: WetlandStudyGenerationProfile,
) => {
  const useSurfaceMap = view === 'appearance';
  const worldWidth = field.width;
  const worldDepth = field.depth;
  const terrainVertexSpacing = generationProfile.terrainVertexSpacing;
  const widthSegments = Math.max(1, Math.round(worldWidth / terrainVertexSpacing));
  const depthSegments = Math.max(1, Math.round(worldDepth / terrainVertexSpacing));
  const geometry = new THREE.PlaneGeometry(worldWidth, worldDepth, widthSegments, depthSegments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position');
  if (field.layoutMap.domainShape === 'ellipse' && geometry.index) {
    const sourceIndex = geometry.index;
    const clippedIndices: number[] = [];
    for (let offset = 0; offset < sourceIndex.count; offset += 3) {
      const a = sourceIndex.getX(offset);
      const b = sourceIndex.getX(offset + 1);
      const c = sourceIndex.getX(offset + 2);
      const centerX = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
      const centerZ = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
      if (field.layoutMap.containsWorldPoint(centerX, centerZ)) {
        clippedIndices.push(a, b, c);
      }
    }
    geometry.setIndex(clippedIndices);
  }
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    if (useSurfaceMap) {
      position.setY(index, terrainHeightAt(field, x, z));
      color.setRGB(1, 1, 1);
    } else {
      const sample = field.sample(x, z);
      position.setY(index, terrainHeightAt(field, x, z));
      debugColor(view, fieldValue(view, sample), color);
    }
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const cavity = new Float32Array(position.count);
  const rowSize = widthSegments + 1;
  for (let row = 1; row < depthSegments; row += 1) {
    for (let column = 1; column < widthSegments; column += 1) {
      const index = row * rowSize + column;
      const neighborMean = (
        position.getY(index - 1)
        + position.getY(index + 1)
        + position.getY(index - rowSize)
        + position.getY(index + rowSize)
      ) * 0.25;
      cavity[index] = THREE.MathUtils.clamp((neighborMean - position.getY(index)) / 0.035, 0, 1);
    }
  }
  geometry.setAttribute('terrainCavity', new THREE.BufferAttribute(cavity, 1));
  geometry.computeVertexNormals();

  let surfaceMap: THREE.DataTexture | null = null;
  if (useSurfaceMap) {
    surfaceMap = createTerrainSurfaceMap(field, palette, generationProfile);
  }

  const material = new THREE.MeshStandardMaterial({
    map: surfaceMap,
    vertexColors: !useSurfaceMap,
    roughness: 0.98,
    metalness: 0,
  });
  const heightMap = createTerrainHeightMap(field);
  const terrainLighting = {
    keyDirection: { value: new THREE.Vector3(0, 1, 0) },
    slopeEnabled: { value: 1 },
    slopeStrength: { value: 0.18 },
    selfShadowEnabled: { value: 1 },
    shadowTintEnabled: { value: 1 },
    shadowTintStrength: { value: 0.24 },
    shadowTint: { value: new THREE.Vector3(0.78, 0.88, 0.92) },
    distanceSoftShadowEnabled: { value: 1 },
    contactSoftness: { value: 0.08 },
    farSoftness: { value: 0.10 },
    shadowDepthSpan: { value: 200 },
    shadowTexelsPerWorldUnit: { value: 8 },
    heightMap: { value: heightMap },
    worldSize: { value: new THREE.Vector2(worldWidth, worldDepth) },
    waterLevel: { value: field.waterLevel },
    contactEnabled: { value: 0 },
    contactStrength: { value: 0.12 },
    finalGroundCaptureEnabled: { value: 0 },
    groundDappleEnabled: { value: 1 },
    groundDappleStrength: { value: 0.55 },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTerrainKeyDirection: terrainLighting.keyDirection,
      uTerrainSlopeEnabled: terrainLighting.slopeEnabled,
      uTerrainSlopeStrength: terrainLighting.slopeStrength,
      uTerrainSelfShadowEnabled: terrainLighting.selfShadowEnabled,
      uTerrainShadowTintEnabled: terrainLighting.shadowTintEnabled,
      uTerrainShadowTintStrength: terrainLighting.shadowTintStrength,
      uTerrainShadowTint: terrainLighting.shadowTint,
      uTerrainDistanceSoftShadowEnabled: terrainLighting.distanceSoftShadowEnabled,
      uTerrainShadowContactSoftness: terrainLighting.contactSoftness,
      uTerrainShadowFarSoftness: terrainLighting.farSoftness,
      uTerrainShadowDepthSpan: terrainLighting.shadowDepthSpan,
      uTerrainShadowTexelsPerWorldUnit: terrainLighting.shadowTexelsPerWorldUnit,
      uTerrainHeightMap: terrainLighting.heightMap,
      uTerrainWorldSize: terrainLighting.worldSize,
      uTerrainWaterLevel: terrainLighting.waterLevel,
      uTerrainContactEnabled: terrainLighting.contactEnabled,
      uTerrainContactStrength: terrainLighting.contactStrength,
      uTerrainFinalGroundCaptureEnabled: terrainLighting.finalGroundCaptureEnabled,
      uTerrainGroundDappleEnabled: terrainLighting.groundDappleEnabled,
      uTerrainGroundDappleStrength: terrainLighting.groundDappleStrength,
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float terrainCavity;\nvarying float vTerrainCavity;\nvarying vec3 vTerrainWorldNormal;\nvarying vec3 vTerrainWorldPosition;',
      )
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nvTerrainWorldNormal = normalize(mat3(modelMatrix) * objectNormal);',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvTerrainCavity = terrainCavity;\nvTerrainWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uTerrainKeyDirection;
uniform float uTerrainSlopeEnabled;
uniform float uTerrainSlopeStrength;
uniform float uTerrainSelfShadowEnabled;
uniform float uTerrainShadowTintEnabled;
uniform float uTerrainShadowTintStrength;
uniform vec3 uTerrainShadowTint;
uniform float uTerrainDistanceSoftShadowEnabled;
uniform float uTerrainShadowContactSoftness;
uniform float uTerrainShadowFarSoftness;
uniform float uTerrainShadowDepthSpan;
uniform float uTerrainShadowTexelsPerWorldUnit;
uniform sampler2D uTerrainHeightMap;
uniform vec2 uTerrainWorldSize;
uniform float uTerrainWaterLevel;
uniform float uTerrainContactEnabled;
uniform float uTerrainContactStrength;
uniform float uTerrainFinalGroundCaptureEnabled;
uniform float uTerrainGroundDappleEnabled;
uniform float uTerrainGroundDappleStrength;
varying float vTerrainCavity;
varying vec3 vTerrainWorldNormal;
varying vec3 vTerrainWorldPosition;`,
      )
      .replace(
        '#include <shadowmap_pars_fragment>',
        `#include <shadowmap_pars_fragment>
float wetlandTerrainReceivedShadow = 1.0;

#if defined(USE_SHADOWMAP)
float wetlandTerrainShadow(
  sampler2D shadowMap,
  vec2 shadowMapSize,
  float shadowIntensity,
  float shadowBias,
  float shadowRadius,
  vec4 shadowCoord
) {
  float receivedShadow = 1.0;
  float lightingShadow = 1.0;
  if (uTerrainDistanceSoftShadowEnabled < 0.5) {
    receivedShadow = getShadow(
      shadowMap,
      shadowMapSize,
      shadowIntensity,
      shadowBias,
      shadowRadius,
      shadowCoord
    );
    lightingShadow = receivedShadow;
  } else {
    vec3 projected = shadowCoord.xyz / shadowCoord.w;
    projected.z += shadowBias;
    bool inFrustum = projected.x >= 0.0 && projected.x <= 1.0
      && projected.y >= 0.0 && projected.y <= 1.0 && projected.z <= 1.0;
    if (inFrustum) {
      float searchTexels = clamp(
        uTerrainShadowContactSoftness * uTerrainShadowTexelsPerWorldUnit * 1.75,
        1.5,
        5.0
      );
      vec2 searchRadius = vec2(searchTexels) / shadowMapSize;
      float blockerDepth0 = unpackRGBAToDepth(texture2D(shadowMap, projected.xy));
      float blockerDepth1 = unpackRGBAToDepth(texture2D(
        shadowMap,
        projected.xy + vec2(searchRadius.x, 0.0)
      ));
      float blockerDepth2 = unpackRGBAToDepth(texture2D(
        shadowMap,
        projected.xy - vec2(searchRadius.x, 0.0)
      ));
      float blockerDepth3 = unpackRGBAToDepth(texture2D(
        shadowMap,
        projected.xy + vec2(0.0, searchRadius.y)
      ));
      float blockerDepth4 = unpackRGBAToDepth(texture2D(
        shadowMap,
        projected.xy - vec2(0.0, searchRadius.y)
      ));
      float blocked0 = step(blockerDepth0, projected.z);
      float blocked1 = step(blockerDepth1, projected.z);
      float blocked2 = step(blockerDepth2, projected.z);
      float blocked3 = step(blockerDepth3, projected.z);
      float blocked4 = step(blockerDepth4, projected.z);
      float blockerDepth = blockerDepth0 * blocked0
        + blockerDepth1 * blocked1
        + blockerDepth2 * blocked2
        + blockerDepth3 * blocked3
        + blockerDepth4 * blocked4;
      float blockerCount = blocked0 + blocked1 + blocked2 + blocked3 + blocked4;

      if (blockerCount >= 0.5) {
        blockerDepth /= blockerCount;
        float blockerDistance = max(projected.z - blockerDepth, 0.0) * uTerrainShadowDepthSpan;
        float penumbraWorld = uTerrainShadowContactSoftness
          + blockerDistance * uTerrainShadowFarSoftness;
        float penumbraTexels = clamp(
          penumbraWorld * uTerrainShadowTexelsPerWorldUnit,
          1.0,
          8.5
        );
        // Three's full PCFSoft interpolation, widened by the blocker-distance
        // penumbra. Every widened cell is interpolated continuously, so the
        // result stays soft without random grain or visible snapped bands.
        vec2 softTexel = vec2(penumbraTexels) / shadowMapSize;
        float softDx = softTexel.x;
        float softDy = softTexel.y;
        vec2 softUv = projected.xy;
        vec2 softFraction = fract(softUv / softTexel + 0.5);
        softUv -= softFraction * softTexel;
        float filteredShadow = (
          texture2DCompare(shadowMap, softUv, projected.z)
          + texture2DCompare(shadowMap, softUv + vec2(softDx, 0.0), projected.z)
          + texture2DCompare(shadowMap, softUv + vec2(0.0, softDy), projected.z)
          + texture2DCompare(shadowMap, softUv + softTexel, projected.z)
          + mix(
            texture2DCompare(shadowMap, softUv + vec2(-softDx, 0.0), projected.z),
            texture2DCompare(shadowMap, softUv + vec2(2.0 * softDx, 0.0), projected.z),
            softFraction.x
          )
          + mix(
            texture2DCompare(shadowMap, softUv + vec2(-softDx, softDy), projected.z),
            texture2DCompare(shadowMap, softUv + vec2(2.0 * softDx, softDy), projected.z),
            softFraction.x
          )
          + mix(
            texture2DCompare(shadowMap, softUv + vec2(0.0, -softDy), projected.z),
            texture2DCompare(shadowMap, softUv + vec2(0.0, 2.0 * softDy), projected.z),
            softFraction.y
          )
          + mix(
            texture2DCompare(shadowMap, softUv + vec2(softDx, -softDy), projected.z),
            texture2DCompare(shadowMap, softUv + vec2(softDx, 2.0 * softDy), projected.z),
            softFraction.y
          )
          + mix(
            mix(
              texture2DCompare(shadowMap, softUv + vec2(-softDx, -softDy), projected.z),
              texture2DCompare(shadowMap, softUv + vec2(2.0 * softDx, -softDy), projected.z),
              softFraction.x
            ),
            mix(
              texture2DCompare(shadowMap, softUv + vec2(-softDx, 2.0 * softDy), projected.z),
              texture2DCompare(shadowMap, softUv + vec2(2.0 * softDx, 2.0 * softDy), projected.z),
              softFraction.x
            ),
            softFraction.y
          )
        ) * (1.0 / 9.0);
        receivedShadow = mix(1.0, clamp(filteredShadow, 0.0, 1.0), shadowIntensity);
      }
    }
    lightingShadow = receivedShadow;
  }
  wetlandTerrainReceivedShadow = receivedShadow;
  return lightingShadow;
}
#endif`,
      )
      .replace(
        '#include <lights_fragment_begin>',
        `wetlandTerrainReceivedShadow = 1.0;
${THREE.ShaderChunk.lights_fragment_begin.replace(
    'getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )',
    'wetlandTerrainShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )',
  )}`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
// The authored grass/soil surface is matte. Standard's grazing-angle GGX
// highlight is view-dependent, so an overhead grass-color capture cannot
// reproduce it at the player's low backlit view.
reflectedLight.directSpecular = vec3(0.0);
reflectedLight.indirectSpecular = vec3(0.0);`,
      )
      .replace(
        '#include <opaque_fragment>',
        `float terrainKeyFacing = max(dot(normalize(vTerrainWorldNormal), normalize(uTerrainKeyDirection)), 0.0);
float terrainFlatFacing = max(normalize(uTerrainKeyDirection).y, 0.15);
float terrainBackSlope = max(terrainFlatFacing - terrainKeyFacing, 0.0) / terrainFlatFacing;
float terrainSlopeShade = 1.0 - smoothstep(0.02, 0.62, terrainBackSlope)
  * uTerrainSlopeStrength * uTerrainSlopeEnabled;
float terrainContactShade = 1.0 - vTerrainCavity * uTerrainContactStrength * uTerrainContactEnabled;
float terrainMacroShadow = 0.0;
vec2 terrainLightHorizontal = uTerrainKeyDirection.xz;
float terrainLightHorizontalLength = length(terrainLightHorizontal);
if (uTerrainSelfShadowEnabled > 0.5 && terrainLightHorizontalLength > 0.02) {
  vec2 terrainRayDirection = terrainLightHorizontal / terrainLightHorizontalLength;
  float terrainRaySlope = max(uTerrainKeyDirection.y, 0.0) / terrainLightHorizontalLength;
  for (int terrainShadowStep = 1; terrainShadowStep <= 10; terrainShadowStep++) {
    float terrainRayDistance = float(terrainShadowStep) * 3.0;
    vec2 terrainSampleWorld = vTerrainWorldPosition.xz + terrainRayDirection * terrainRayDistance;
    vec2 terrainSampleUv = terrainSampleWorld / uTerrainWorldSize + 0.5;
    float terrainInside = step(0.0, terrainSampleUv.x) * step(terrainSampleUv.x, 1.0)
      * step(0.0, terrainSampleUv.y) * step(terrainSampleUv.y, 1.0);
    float terrainOccluderHeight = texture2D(uTerrainHeightMap, terrainSampleUv).r;
    float terrainRayHeight = vTerrainWorldPosition.y + terrainRayDistance * terrainRaySlope + 0.08;
    float terrainBlocked = smoothstep(0.02, 0.55, terrainOccluderHeight - terrainRayHeight)
      * terrainInside;
    terrainMacroShadow = max(terrainMacroShadow, terrainBlocked);
  }
}
// Height-field ray marching is meaningful on broad upward-facing slopes, but
// a near-vertical cliff can intersect its own coarse height samples halfway
// down the face and produce a false horizontal shadow split.
float terrainSelfShadowReceiver = smoothstep(
  0.24,
  0.68,
  normalize(vTerrainWorldNormal).y
);
// Height-field self-shadowing describes broad landform occlusion. It must not
// darken the submerged bed, where the ray boundary reads as a false waterline.
float terrainAboveWater = smoothstep(
  uTerrainWaterLevel - 0.015,
  uTerrainWaterLevel + 0.035,
  vTerrainWorldPosition.y
);
terrainSelfShadowReceiver *= terrainAboveWater;
float terrainMacroShadowShade = 1.0
  - terrainMacroShadow * 0.24 * terrainSelfShadowReceiver;
outgoingLight *= terrainSlopeShade * terrainContactShade * terrainMacroShadowShade;
// Stylized cliff soil should retain its authored warm color even when a
// near-vertical normal receives little Key/Fill Lambert light. This is a
// receiver-side bounce floor, not an emissive override, so cast shadows can
// still tint the result below.
float terrainCliffBounce = 1.0 - smoothstep(
  0.42,
  0.92,
  normalize(vTerrainWorldNormal).y
);
vec3 terrainCliffBounceFloor = diffuseColor.rgb * 0.62;
outgoingLight = max(
  outgoingLight,
  terrainCliffBounceFloor * terrainCliffBounce
);
float terrainCastShadow = smoothstep(0.015, 0.985, clamp(wetlandTerrainReceivedShadow, 0.0, 1.0));
float terrainCastShadowAmount = 1.0 - terrainCastShadow;
vec3 terrainTintTarget = outgoingLight * uTerrainShadowTint;
outgoingLight = mix(
  outgoingLight,
  terrainTintTarget,
  terrainCastShadowAmount * uTerrainShadowTintStrength * uTerrainShadowTintEnabled
);
// Ground dapple represents sparse canopy light gaps, not map-wide color noise.
// The key shadow map supplies the canopy footprint, while the light direction
// rotates the stable pattern so it remains related to the canopy shafts.
float terrainCanopyShadowMask = smoothstep(
  0.03,
  0.78,
  1.0 - terrainCastShadow
) * terrainSelfShadowReceiver;
if (uTerrainGroundDappleEnabled > 0.5
  && uTerrainGroundDappleStrength > 0.001
  && terrainCanopyShadowMask > 0.001) {
  vec2 dappleLightAxis = normalize(uTerrainKeyDirection.xz + vec2(1e-4));
  vec2 dappleLightPerp = vec2(-dappleLightAxis.y, dappleLightAxis.x);
  vec2 dapplePosition = vec2(
    dot(vTerrainWorldPosition.xz, dappleLightAxis),
    dot(vTerrainWorldPosition.xz, dappleLightPerp)
  );
  vec2 dappleCell = dapplePosition * 0.085;
  vec2 dappleGrid = floor(dappleCell);
  vec2 dappleLocal = fract(dappleCell) - 0.5;
  float dappleHash = fract(sin(dot(dappleGrid, vec2(127.1, 311.7))) * 43758.5453);
  float dappleShape = smoothstep(0.46, 0.02, length(dappleLocal - vec2(
    dappleHash * 0.22 - 0.11,
    fract(dappleHash * 7.31) * 0.22 - 0.11
  )));
  float dapple = dappleShape * 0.20
    * uTerrainGroundDappleStrength
    * terrainCanopyShadowMask;
  outgoingLight *= 1.0 + dapple;
}
#include <opaque_fragment>`,
      )
      .replace(
        '#include <tonemapping_fragment>',
        `if (uTerrainFinalGroundCaptureEnabled < 0.5) {
  #include <tonemapping_fragment>
}`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <colorspace_fragment>',
      `if (uTerrainFinalGroundCaptureEnabled < 0.5) {
  #include <colorspace_fragment>
}`,
    );
  };
  material.customProgramCacheKey = () => 'wetland-terrain-lighting-v173-canopy-dapple';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `wetland-logical-terrain-${view}`;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return { mesh, lighting: terrainLighting, heightMap };
};

const createTerrainSurfaceMap = (
  field: WetlandRegionField,
  palette: WetlandStudyPalette,
  generationProfile: WetlandStudyGenerationProfile,
) => {
  const worldWidth = field.width;
  const worldDepth = field.depth;
  const width = Math.round(worldWidth / generationProfile.surfaceMapTexelSpacing);
  const height = Math.round(width * worldDepth / worldWidth);
  const data = new Uint8Array(width * height * 4);
  const color = new THREE.Color();
  for (let row = 0; row < height; row += 1) {
    const z = worldDepth * (0.5 - row / (height - 1));
    for (let column = 0; column < width; column += 1) {
      const x = worldWidth * (column / (width - 1) - 0.5);
      appearanceColor(
        field.sample(x, z),
        x,
        z,
        palette,
        field.waterLevel,
        color,
      );
      const offset = (row * width + column) * 4;
      data[offset] = Math.round(THREE.MathUtils.clamp(color.r, 0, 1) * 255);
      data[offset + 1] = Math.round(THREE.MathUtils.clamp(color.g, 0, 1) * 255);
      data[offset + 2] = Math.round(THREE.MathUtils.clamp(color.b, 0, 1) * 255);
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

const createTerrainSurfaceMapAsync = async (
  field: WetlandRegionField,
  palette: WetlandStudyPalette,
  generationProfile: WetlandStudyGenerationProfile,
  isCurrent: () => boolean,
) => {
  const worldWidth = field.width;
  const worldDepth = field.depth;
  const width = Math.round(worldWidth / generationProfile.surfaceMapTexelSpacing);
  const height = Math.round(width * worldDepth / worldWidth);
  const data = new Uint8Array(width * height * 4);
  const color = new THREE.Color();
  for (let row = 0; row < height; row += 1) {
    const z = worldDepth * (0.5 - row / (height - 1));
    for (let column = 0; column < width; column += 1) {
      const x = worldWidth * (column / (width - 1) - 0.5);
      appearanceColor(
        field.sample(x, z),
        x,
        z,
        palette,
        field.waterLevel,
        color,
      );
      const offset = (row * width + column) * 4;
      data[offset] = Math.round(THREE.MathUtils.clamp(color.r, 0, 1) * 255);
      data[offset + 1] = Math.round(THREE.MathUtils.clamp(color.g, 0, 1) * 255);
      data[offset + 2] = Math.round(THREE.MathUtils.clamp(color.b, 0, 1) * 255);
      data[offset + 3] = 255;
    }
    if (row % 8 === 7) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (!isCurrent()) return null;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

const createWater = (field: WetlandRegionField, palette: WetlandStudyPalette) => {
  const waterDistance = new Float32Array(field.layoutMap.columns * field.layoutMap.rows);
  for (let row = 0; row < field.layoutMap.rows; row += 1) {
    const z = field.depth * (row / (field.layoutMap.rows - 1) - 0.5);
    for (let column = 0; column < field.layoutMap.columns; column += 1) {
      const x = field.width * (column / (field.layoutMap.columns - 1) - 0.5);
      waterDistance[row * field.layoutMap.columns + column] = field.waterDistanceAt(x, z);
    }
  }
  return createWetlandFlatWater({
    radius: field.pondRadius,
    waterLevel: field.waterLevel,
    center: field.pondCenter,
    geometryMargin: 0,
    colors: {
      deep: palette.waterDeep,
      mid: palette.waterMid,
      shallow: palette.waterShallow,
      ripple: palette.waterRipple,
    },
    semanticDistanceField: {
      data: waterDistance,
      width: field.layoutMap.columns,
      height: field.layoutMap.rows,
      worldWidth: field.layoutMap.worldWidth,
      worldDepth: field.layoutMap.worldDepth,
      distanceScale: 2.4,
    },
  });
};

const createShrubs = (
  field: WetlandRegionField,
  options: WetlandStudyOptions,
  generationProfile: WetlandStudyGenerationProfile,
) => {
  const random = mulberry32(field.params.vegetationSeed ^ 0x5a3b);
  const candidates: Array<{
    x: number;
    z: number;
    score: number;
    planned: boolean;
    rotation: number;
  }> = [];
  for (let index = 0; index < generationProfile.shrubCandidateCount; index += 1) {
    const x = (random() - 0.5) * (field.width - 4);
    const z = (random() - 0.5) * (field.depth - 4);
    if (!field.layoutMap.containsWorldPoint(x, z, 1.2)
      || !field.layoutMap.containsDetailPoint(x, z, 1.2)) continue;
    const sample = field.sample(x, z);
    const layoutSample = field.layoutMap.sample(x, z);
    const shrublandInfluence = 1 - THREE.MathUtils.smoothstep(
      layoutSample.shrublandDistance,
      -1.8,
      2.8,
    );
    const forestInfluence = 1 - THREE.MathUtils.smoothstep(
      layoutSample.forestDistance,
      -3.5,
      4.5,
    );
    const planned = shrublandInfluence > 0.22;
    const naturalHabitat = Math.max(
      THREE.MathUtils.smoothstep(sample.groundGrass, 0.58, 0.9),
      forestInfluence * 0.82,
    );
    const score = sample.shrub
      * Math.max(shrublandInfluence, naturalHabitat * 0.42)
      * (0.74 + random() * 0.26);
    if (score < 0.018) continue;

    let rotation = random() * Math.PI * 2;
    if (planned) {
      const step = 0.5;
      const gradientX = field.layoutMap.sample(x + step, z).shrublandDistance
        - field.layoutMap.sample(x - step, z).shrublandDistance;
      const gradientZ = field.layoutMap.sample(x, z + step).shrublandDistance
        - field.layoutMap.sample(x, z - step).shrublandDistance;
      rotation = Math.atan2(gradientZ, gradientX) + Math.PI * 0.5 + (random() - 0.5) * 0.32;
    }
    candidates.push({ x, z, score, planned, rotation });
  }
  const placements: typeof candidates = [];
  const selectGroup = (planned: boolean, limit: number, spacing: number) => {
    candidates
      .filter((candidate) => candidate.planned === planned)
      .sort((a, b) => b.score - a.score)
      .some((candidate) => {
        if (placements.some((placed) => Math.hypot(
          placed.x - candidate.x,
          placed.z - candidate.z,
        ) < (placed.planned === candidate.planned ? spacing : 2.8))) return false;
        placements.push(candidate);
        return placements.filter((placed) => placed.planned === planned).length >= limit;
      });
  };
  selectGroup(true, generationProfile.plannedShrubLimit, 2.6);
  selectGroup(false, generationProfile.naturalShrubLimit, 4.4);

  const layer = new THREE.Group();
  layer.name = 'wetland-field-driven-shrubs';
  const windTargets: WetlandWindTarget[] = [];
  const foliageWindUpdates: Array<(elapsed: number, wind: WetlandWindFrame) => void> = [];
  const lightingUpdates: Array<() => void> = [];
  placements.forEach((placement, index) => {
    const elongated = placement.planned && index % 3 !== 2;
    const bush = createAlphaFoliageBush({
      variant: elongated || index % 3 === 1 ? 'open' : 'rounded',
      seed: field.params.vegetationSeed + index * 97,
      palette: {
        shadow: options.palette.bushShadow,
        mid: options.palette.bushMid,
        highlight: options.palette.bushHighlight,
      },
      stemColor: options.palette.bushStem,
    });
    bush.root.position.set(placement.x, field.heightAt(placement.x, placement.z), placement.z);
    if (elongated) {
      bush.root.scale.set(1.65 + random() * 0.65, 0.82 + random() * 0.22, 0.68 + random() * 0.2);
    } else {
      const scale = placement.planned ? 0.62 + random() * 0.32 : 0.72 + random() * 0.42;
      bush.root.scale.setScalar(scale);
    }
    bush.root.rotation.y = placement.rotation;
    bush.applyLook(options.look);
    bush.updateLighting(options.keyLight, options.fillLight, options.rimLight);
    windTargets.push({ object: bush.root, phase: index * 1.93 + 0.4, amplitude: 0.026 });
    foliageWindUpdates.push((elapsed, wind) => {
      bush.updateWind(elapsed, wind.strength, wind.speed, wind.direction);
    });
    lightingUpdates.push(() => bush.updateLighting(options.keyLight, options.fillLight, options.rimLight));
    layer.add(bush.root);
  });
  return { layer, count: placements.length, windTargets, foliageWindUpdates, lightingUpdates };
};

const createRocks = (
  field: WetlandRegionField,
  generationProfile: WetlandStudyGenerationProfile,
) => {
  const random = mulberry32(field.params.vegetationSeed ^ 0x702c);
  const placements: Array<{ x: number; z: number; score: number }> = [];
  for (let index = 0; index < generationProfile.rockCandidateCount; index += 1) {
    const x = (random() - 0.5) * (field.width - 2);
    const z = (random() - 0.5) * (field.depth - 2);
    if (!field.layoutMap.containsWorldPoint(x, z, 0.8)
      || !field.layoutMap.containsDetailPoint(x, z, 0.8)) continue;
    const sample = field.sample(x, z);
    const pathEdge = THREE.MathUtils.smoothstep(
      sample.pathDistance,
      1.25 * 0.9,
      1.25 * 1.45,
    ) * (1 - THREE.MathUtils.smoothstep(
      sample.pathDistance,
      1.25 * 1.45,
      1.25 * 2.4,
    ));
    const shoreEdge = THREE.MathUtils.smoothstep(sample.pondDistance, 0.18, 0.3)
      * (1 - THREE.MathUtils.smoothstep(sample.pondDistance, 0.3, 0.58));
    const score = Math.max(pathEdge * 0.62, shoreEdge * 0.9) * (0.4 + random() * 0.6);
    if (score > 0.12) placements.push({ x, z, score });
  }
  placements.sort((a, b) => b.score - a.score);
  const selected: typeof placements = [];
  for (const placement of placements) {
    if (selected.some((other) => Math.hypot(other.x - placement.x, other.z - placement.z) < 1.25)) continue;
    selected.push(placement);
    if (selected.length >= generationProfile.rockLimit) break;
  }
  const geometry = new THREE.DodecahedronGeometry(0.42, 0);
  const material = new THREE.MeshToonMaterial({ color: '#ffffff' });
  const mesh = new THREE.InstancedMesh(geometry, material, selected.length);
  mesh.name = 'wetland-path-and-shore-rocks';
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  selected.forEach((placement, index) => {
    position.set(placement.x, field.heightAt(placement.x, placement.z) + 0.14, placement.z);
    quaternion.setFromEuler(new THREE.Euler(random() * 0.25, random() * Math.PI, random() * 0.2));
    const size = 0.46 + random() * 0.72;
    scale.set(size, size * (0.48 + random() * 0.28), size * (0.72 + random() * 0.25));
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    color.set(fixedPalette.rock[index % fixedPalette.rock.length]);
    mesh.setColorAt(index, color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();

  const layer = new THREE.Group();
  layer.name = 'wetland-rock-layer';
  layer.add(mesh);
  return {
    mesh: layer,
    count: selected.length,
  };
};

type WetlandTreeSpecies = 'camphor' | 'willow';

type WetlandTreePlacement = Readonly<{
  x: number;
  z: number;
  score: number;
  species: WetlandTreeSpecies;
  forestInfluence: number;
  clearanceRadius: number;
  camphorPresetSlot: number;
}>;

const applyWetlandTreePalette = (
  root: THREE.Object3D,
  palette: WetlandStudyPalette,
  colorVariation: number,
) => {
  const foliageBand = [
    new THREE.Color(palette.treeShadow),
    new THREE.Color(palette.treeMid),
    new THREE.Color(palette.treeHighlight),
  ] as const;
  const sampleFoliageBand = (position: number) => {
    const clamped = THREE.MathUtils.clamp(position, 0, 1);
    if (clamped < 0.5) return foliageBand[0].clone().lerp(foliageBand[1], clamped * 2);
    return foliageBand[1].clone().lerp(foliageBand[2], (clamped - 0.5) * 2);
  };
  const bandShift = colorVariation * 0.06;
  const foliageColors = {
    instanceShadowColor: sampleFoliageBand(0.08 + bandShift),
    instanceMidColor: sampleFoliageBand(0.50 + bandShift),
    instanceHighlightColor: sampleFoliageBand(0.90 + bandShift),
  } as const;
  const barkMid = new THREE.Color(palette.treeTrunk);
  const barkShadow = barkMid.clone().multiplyScalar(0.92);
  const barkHighlight = barkMid.clone().lerp(new THREE.Color('#ffffff'), 0.08);
  const sourceColor = new THREE.Color();
  const outputColor = new THREE.Color();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object.name === 'procedural-tree-r05-foliage-clusters') {
      for (const [attributeName, color] of Object.entries(foliageColors)) {
        const attribute = object.geometry.getAttribute(attributeName);
        if (!attribute) continue;
        for (let index = 0; index < object.count; index += 1) {
          attribute.setXYZ(index, color.r, color.g, color.b);
        }
        attribute.needsUpdate = true;
      }
      return;
    }
    if (!object.name.startsWith('procedural-tree-level-')) return;
    const colors = object.geometry.getAttribute('color');
    if (!colors) return;
    for (let index = 0; index < colors.count; index += 1) {
      sourceColor.fromBufferAttribute(colors, index);
      const brightness = THREE.MathUtils.clamp(
        (sourceColor.r * 0.22 + sourceColor.g * 0.7 + sourceColor.b * 0.08 - 0.06) / 0.34,
        0,
        1,
      );
      if (brightness < 0.5) outputColor.copy(barkShadow).lerp(barkMid, brightness * 2);
      else outputColor.copy(barkMid).lerp(barkHighlight, (brightness - 0.5) * 2);
      colors.setXYZ(index, outputColor.r, outputColor.g, outputColor.b);
    }
    colors.needsUpdate = true;
  });
};

const applyWetlandBarkMaterial = (root: THREE.Object3D) => {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)
      || !object.name.startsWith('procedural-tree-level-')
      || !(object.material instanceof THREE.MeshToonMaterial)) return;
    const material = object.material.clone();
    material.name = `${material.name || 'tree-bark'}-wetland-bark`;
    (material as THREE.MeshToonMaterial & { flatShading: boolean }).flatShading = true;
    material.userData.wetlandBarkMaterial = true;
    material.needsUpdate = true;
    object.material = material;
    object.userData.wetlandBarkMaterial = true;
  });
};

const cloneSharedTreePrototype = (prototype: THREE.Object3D) => {
  const cloneObject = (source: THREE.Object3D): THREE.Object3D => {
    let clone: THREE.Object3D;
    const sharedUserData = source.userData;
    source.userData = {};
    try {
      if (source instanceof THREE.InstancedMesh) {
        const sharedInstance = new THREE.InstancedMesh(source.geometry, source.material, 1);
        THREE.Object3D.prototype.copy.call(sharedInstance, source, false);
        sharedInstance.instanceMatrix = source.instanceMatrix;
        sharedInstance.instanceColor = source.instanceColor;
        sharedInstance.morphTexture = source.morphTexture;
        sharedInstance.customDepthMaterial = source.customDepthMaterial;
        sharedInstance.customDistanceMaterial = source.customDistanceMaterial;
        sharedInstance.count = source.count;
        sharedInstance.boundingBox = source.boundingBox;
        sharedInstance.boundingSphere = source.boundingSphere;
        clone = sharedInstance;
      } else {
        clone = source.clone(false);
      }
    } finally {
      source.userData = sharedUserData;
    }
    clone.userData = sharedUserData;
    source.children.forEach((child) => clone.add(cloneObject(child)));
    return clone;
  };
  return cloneObject(prototype);
};

const createTrees = (
  field: WetlandRegionField,
  options: WetlandStudyOptions,
  generationProfile: WetlandStudyGenerationProfile,
) => {
  const camphorTreeCatalog = readWetlandTreeCatalog();
  const random = mulberry32(field.params.vegetationSeed ^ 0x31da);
  const candidates: WetlandTreePlacement[] = [];
  for (let index = 0; index < generationProfile.treeCandidateCount; index += 1) {
    const x = (random() - 0.5) * (field.width - 5);
    const z = (random() - 0.5) * (field.depth - 5);
    if (!field.layoutMap.containsWorldPoint(x, z, 3.5)
      || !field.layoutMap.containsDetailPoint(x, z, 3.5)) continue;
    const sample = field.sample(x, z);
    if (sample.pathSurface > 0.05) continue;

    if (sample.slope <= 0.12) {
      const forestInfluence = 1 - THREE.MathUtils.smoothstep(
        field.layoutMap.sample(x, z).forestDistance,
        -2.5,
        2.5,
      );
      const pathsideBand = THREE.MathUtils.smoothstep(sample.pathDistance, 2.7, 3.5)
        * (1 - THREE.MathUtils.smoothstep(sample.pathDistance, 5.6, 7.2));
      const parkInterior = THREE.MathUtils.smoothstep(sample.pathDistance, 7.5, 11)
        * (1 - THREE.MathUtils.smoothstep(sample.pathDistance, 16, 23));
      const flatness = 1 - THREE.MathUtils.smoothstep(sample.slope, 0.055, 0.12);
      const camphorScore = flatness
        * Math.max(forestInfluence, pathsideBand * 0.42, parkInterior * 0.16)
        * THREE.MathUtils.smoothstep(sample.pondDistance, 0.48, 1.05)
        * THREE.MathUtils.smoothstep(sample.groundGrass, 0.08, 0.58)
        * (0.9 + random() * 0.1);
      if (camphorScore > 0.12) {
        candidates.push({
          x,
          z,
          score: camphorScore,
          species: 'camphor',
          forestInfluence,
          clearanceRadius: 0,
          camphorPresetSlot: -1,
        });
      }
    }

    if (sample.slope <= 0.32) {
      const shoreRing = THREE.MathUtils.smoothstep(sample.pondDistance, 0.08, 0.3)
        * (1 - THREE.MathUtils.smoothstep(sample.pondDistance, 0.85, 1.55));
      const willowFlatness = 1 - THREE.MathUtils.smoothstep(sample.slope, 0.16, 0.32);
      const willowScore = shoreRing
        * willowFlatness
        * (0.64 + sample.moisture * 0.36)
        * (0.78 + random() * 0.22);
      if (willowScore > 0.14) {
        candidates.push({
          x,
          z,
          score: willowScore,
          species: 'willow',
          forestInfluence: 0,
          clearanceRadius: 0,
          camphorPresetSlot: -1,
        });
      }
    }
  }

  const placements: WetlandTreePlacement[] = [];
  candidates
    .filter((candidate) => candidate.species === 'willow')
    .sort((a, b) => b.score - a.score)
    .some((candidate) => {
      if (placements.some((placed) => Math.hypot(
        placed.x - candidate.x,
        placed.z - candidate.z,
      ) < generationProfile.willowTreeSpacing)) return false;
      placements.push({
        ...candidate,
        clearanceRadius: 2.4,
      });
      return placements.filter((placed) => placed.species === 'willow').length
        >= generationProfile.willowTreeLimit;
    });
  candidates
    .filter((candidate) => candidate.species === 'camphor' && candidate.forestInfluence > 0.08)
    .sort((a, b) => b.score - a.score)
    .some((candidate) => {
      const camphorCount = placements.filter((placed) => placed.species === 'camphor').length;
      const camphorPresetSlot = camphorCount % camphorTreeCatalog.length;
      const clearanceRadius = camphorTreeCatalog[camphorPresetSlot]?.clearanceRadius
        ?? generationProfile.camphorTreeSpacing * 0.5;
      if (placements.some((placed) => Math.hypot(
        placed.x - candidate.x,
        placed.z - candidate.z,
      ) < clearanceRadius + placed.clearanceRadius)) return false;
      placements.push({
        ...candidate,
        clearanceRadius,
        camphorPresetSlot,
      });
      return camphorCount + 1 >= generationProfile.camphorTreeLimit;
    });

  const layer = new THREE.Group();
  layer.name = 'wetland-field-driven-trees';
  const windTargets: WetlandWindTarget[] = [];
  const foliageWindUpdates: Array<(elapsed: number, wind: WetlandWindFrame) => void> = [];
  const lightingUpdates: Array<() => void> = [];
  const treePrototypes = new Map<string, Readonly<{
    root: THREE.Object3D;
    tree: TreeInstance;
  }>>();
  const gameplayTrees: WetlandTreeProvider[] = [];
  placements.forEach((placement, index) => {
    const camphorPresetSlot = Math.max(0, placement.camphorPresetSlot);
    const recipe = placement.species === 'willow'
      ? proceduralWillowTreeRecipe
      : camphorTreeCatalog[camphorPresetSlot].recipe;
    let treePrototype = treePrototypes.get(recipe.id);
    if (!treePrototype) {
      const result = createProceduralCamphorTree(recipe);
      treePrototype = { root: result.tree.root, tree: result.tree };
      const paletteVariation = placement.species === 'willow'
        ? -0.25
        : (camphorPresetSlot - (camphorTreeCatalog.length - 1) * 0.5)
          / Math.max(1, (camphorTreeCatalog.length - 1) * 0.5);
      applyWetlandTreePalette(treePrototype.root, options.palette, paletteVariation);
      applyWetlandBarkMaterial(treePrototype.root);
      result.updateLighting(options.keyLight, options.fillLight, options.rimLight);
      lightingUpdates.push(() => result.updateLighting(
        options.keyLight,
        options.fillLight,
        options.rimLight,
      ));
      foliageWindUpdates.push((elapsed, wind) => {
        result.updateWind(elapsed, wind.strength, wind.speed, wind.direction);
      });
      treePrototypes.set(recipe.id, treePrototype);
    }
    const treeRoot = cloneSharedTreePrototype(treePrototype.root) as THREE.Group;
    treeRoot.name = `wetland-${placement.species}-tree-${index}`;
    treeRoot.position.set(placement.x, field.heightAt(placement.x, placement.z), placement.z);
    treeRoot.rotation.y = (index * 2.399963 + (placement.species === 'willow' ? 0.6 : 0))
      % (Math.PI * 2);
    treeRoot.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = index < generationProfile.treeShadowLimit;
      object.receiveShadow = true;
    });
    treeRoot.traverse((object) => {
      if (object.name !== 'procedural-tree-r05-foliage-clusters') return;
      windTargets.push({
        object,
        phase: index * 1.67 + (placement.species === 'willow' ? 0.8 : 0.2),
        amplitude: placement.species === 'willow' ? 0.018 : 0.012,
      });
    });
    const occluders: THREE.Object3D[] = [];
    treeRoot.traverse((object) => {
      if (object.userData.treeRole === 'branch-occluder'
        || object.userData.treeRole === 'foliage-occluder') occluders.push(object);
    });
    const sourceTree = treePrototype.tree;
    gameplayTrees.push({
      providerId: `wetland-tree-${index.toString().padStart(2, '0')}`,
      tree: {
        recipeId: sourceTree.recipeId,
        root: treeRoot,
        localHeight: sourceTree.localHeight,
        perches: sourceTree.perches,
        perchConnections: sourceTree.perchConnections,
        occluders,
        resolveBranchFrame: sourceTree.resolveBranchFrame,
        getFoliageVersion: sourceTree.getFoliageVersion,
        setFoliageVersion: sourceTree.setFoliageVersion,
        updateFoliageLighting: sourceTree.updateFoliageLighting,
        stats: sourceTree.stats,
      },
    });
    layer.add(treeRoot);
  });
  return {
    layer,
    count: placements.length,
    camphorCount: placements.filter((placement) => placement.species === 'camphor').length,
    willowCount: placements.filter((placement) => placement.species === 'willow').length,
    gameplayTrees,
    windTargets,
    foliageWindUpdates,
    lightingUpdates,
    camphorPresetCount: camphorTreeCatalog.length,
  };
};

const updateWindTargets = (
  targets: readonly WetlandWindTarget[],
  elapsed: number,
  wind: WetlandWindFrame,
) => {
  targets.forEach((target) => {
    const localWave = Math.sin(elapsed * wind.speed * 0.83 + target.phase)
      + Math.sin(elapsed * wind.speed * 0.37 + target.phase * 1.7) * 0.36;
    const bend = (wind.sway * 0.72 + localWave * wind.strength * 0.28) * target.amplitude;
    target.object.rotation.x = wind.direction.y * bend;
    target.object.rotation.z = -wind.direction.x * bend;
  });
};

const createCandidatePoints = (
  field: WetlandRegionField,
  view: WetlandFieldView,
  spacing = 0.48,
) => {
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  const random = mulberry32(field.params.vegetationSeed ^ 0xcad1);
  const halfWidth = field.width * 0.5;
  const halfDepth = field.depth * 0.5;
  for (let x = -halfWidth + spacing * 0.5; x < halfWidth; x += spacing) {
    for (let z = -halfDepth + spacing * 0.5; z < halfDepth; z += spacing) {
      const px = x + (random() - 0.5) * spacing * 0.85;
      const pz = z + (random() - 0.5) * spacing * 0.85;
      if (!field.layoutMap.containsWorldPoint(px, pz, spacing)
        || !field.layoutMap.containsDetailPoint(px, pz, spacing)) continue;
      const sample = field.sample(px, pz);
      const weight = fieldValue(view, sample);
      if (weight <= 0 || random() > weight) continue;
      positions.push(px, sample.height + 0.07, pz);
      debugColor(view, Math.max(0.24, weight), color);
      colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 4.5,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.94,
    depthTest: false,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = `wetland-${view}-candidate-points`;
  points.renderOrder = 7;
  return points;
};

const disposeTree = (root: THREE.Object3D) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;
    geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.forEach((material) => {
      materials.add(material);
      if ('map' in material && material.map instanceof THREE.Texture) textures.add(material.map);
      if (material instanceof THREE.ShaderMaterial) {
        Object.values(material.uniforms).forEach((uniform) => {
          if (uniform.value instanceof THREE.Texture) textures.add(uniform.value);
        });
      }
    });
    if (object.customDepthMaterial) materials.add(object.customDepthMaterial);
    if (object.customDistanceMaterial) materials.add(object.customDistanceMaterial);
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
};

const createGrassLayer = (
  field: WetlandRegionField,
  params: WetlandRegionParams,
  grassDistribution: WetlandGrassDistribution,
  grassShape: WetlandGrassShape,
  palette: WetlandStudyPalette,
  generationProfile: WetlandStudyGenerationProfile,
  look: EnvironmentLook,
): WetlandBoonaGrassRenderer => {
  const grassSamplingDensity = THREE.MathUtils.smoothstep(
    THREE.MathUtils.clamp(params.grassDensity / 8, 0, 1),
    0,
    1,
  );
  const grassSpacing = THREE.MathUtils.lerp(
    0.42,
    0.25,
    grassSamplingDensity,
  ) * Math.sqrt(
    (field.width * field.depth) / (120 * 84)
      / generationProfile.grassCandidateBudgetScale,
  );
  const rootColor = new THREE.Color();
  const grassNormal = new THREE.Vector3();
  const normalStep = 0.14;
  const randomDistribution = grassDistribution === 'random';
  const legacyShape = grassShape === 'legacy';

  return createWetlandBoonaGrassRenderer({
    minX: -field.width * 0.5,
    maxX: field.width * 0.5,
    minZ: -field.depth * 0.5,
    maxZ: field.depth * 0.5,
    spacing: grassSpacing,
    sample(x, z) {
      const sample = field.sample(x, z);
      const detailInset = field.layoutMap.domainShape === 'ellipse' ? 0.8 : 0.15;
      const insideDomain = field.layoutMap.containsWorldPoint(x, z, 0.15)
        && field.layoutMap.containsDetailPoint(x, z, detailInset);
      appearanceColor(sample, x, z, palette, field.waterLevel, rootColor);
      grassNormal.set(
        field.heightAt(x - normalStep, z) - field.heightAt(x + normalStep, z),
        normalStep * 2,
        field.heightAt(x, z - normalStep) - field.heightAt(x, z + normalStep),
      ).normalize();
      return {
        height: sample.height,
        meadow: insideDomain ? sample.grass : 0,
        growth: insideDomain ? (randomDistribution
          ? THREE.MathUtils.smoothstep(sample.groundGrass, 0.46, 0.9)
          : Math.max(
            THREE.MathUtils.smoothstep(sample.groundGrass, 0.46, 0.9)
              * (1 - THREE.MathUtils.smoothstep(sample.grassTone, 0.06, 0.5)),
            THREE.MathUtils.smoothstep(sample.grass, 0.04, 0.5) * 0.82,
          )) : 0,
        shore: 1,
        path: sample.pathSurface > 0.03 ? 0 : 1,
        slope: sample.slope,
        normal: [grassNormal.x, grassNormal.y, grassNormal.z] as const,
        rootColor: rootColor.getHex(),
      };
    },
  }, {
    name: 'grass',
    seed: params.vegetationSeed ^ 0x7a11,
    bladeCount: 1,
    shape: legacyShape ? 'legacy' : 'rounded',
    segments: legacyShape ? 4 : 6,
    bladeWidth: params.grassWidth * (legacyShape ? 1 : 2.05),
    heightRange: legacyShape
      ? [params.grassHeight * 0.78, params.grassHeight * 1.58]
      : [params.grassHeight * 0.68, params.grassHeight * 1.28],
    widthRange: legacyShape ? [0.35, 1.6] : [0.62, 1.42],
    growthMin: legacyShape
      ? randomDistribution ? [0.48, 0.34, 0.34] : [0.68, 0.58, 0.68]
      : randomDistribution
        ? [0.42, 0.22, 0.42]
        : [0.72, 0.62, 0.72],
    bendStrength: params.grassLean,
    bendResponse: 0.72,
    directionSpread: params.grassDirectionSpread,
    colors: { base: palette.bladeBase, tip: palette.bladeTip },
    stylizedLook: look.material,
  });
};

export const createWetlandStudy = async (options: WetlandStudyOptions): Promise<WetlandStudy> => {
  const generationProfile = options.generationProfile
    ?? compactWetlandStudyGenerationProfile;
  const field = createWetlandRegionField(
    options.params,
    options.brushStrokes,
    options.grassDistribution,
    options.shoreStyle,
    options.layoutMap,
  );
  const root = new THREE.Group();
  root.name = 'wetland-logical-region-study-v012';
  const terrainSurface = createTerrain(
    field,
    options.fieldView,
    options.palette,
    generationProfile,
  );
  const terrain = terrainSurface.mesh;
  const finalGroundCaptureSize = new THREE.Vector2(
    512,
    Math.max(1, Math.round(512 * terrainSurface.lighting.worldSize.value.y
      / terrainSurface.lighting.worldSize.value.x)),
  );
  const finalGroundColorTarget = new THREE.WebGLRenderTarget(
    finalGroundCaptureSize.x,
    finalGroundCaptureSize.y,
    {
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
    },
  );
  finalGroundColorTarget.texture.name = 'wetland-final-ground-lighting-color';
  finalGroundColorTarget.texture.colorSpace = THREE.NoColorSpace;
  const finalGroundCamera = new THREE.OrthographicCamera(
    -terrainSurface.lighting.worldSize.value.x * 0.5,
    terrainSurface.lighting.worldSize.value.x * 0.5,
    terrainSurface.lighting.worldSize.value.y * 0.5,
    -terrainSurface.lighting.worldSize.value.y * 0.5,
    0.1,
    1200,
  );
  finalGroundCamera.position.set(0, 500, 0);
  finalGroundCamera.up.set(0, 0, -1);
  finalGroundCamera.lookAt(0, 0, 0);
  finalGroundCamera.layers.set(finalGroundColorLayer);
  let grassFinalGroundColorEnabled = true;
  let finalGroundColorDirty = true;
  const layers: Record<WetlandStudyLayer, THREE.Object3D> = {
    terrain,
    water: new THREE.Group(),
    grass: new THREE.Group(),
    flowers: new THREE.Group(),
    shrubs: new THREE.Group(),
    rocks: new THREE.Group(),
    trees: new THREE.Group(),
    candidates: new THREE.Group(),
  };
  const canopyShafts = createWetlandCanopyShafts();
  root.add(canopyShafts.root);

  const water = createWater(field, options.palette);
  layers.water.add(water.mesh);
  let grass = createGrassLayer(
    field,
    options.params,
    options.grassDistribution,
    options.grassShape,
    options.palette,
    generationProfile,
    options.look,
  );
  layers.grass.add(grass.object);
  const flowers = createWetlandFlowerField(field, generationProfile.flowerSpacing);
  layers.flowers.add(flowers.root);
  const shrubs = createShrubs(field, options, generationProfile);
  layers.shrubs.add(shrubs.layer);
  const rocks = createRocks(field, generationProfile);
  layers.rocks.add(rocks.mesh);
  let trees = createTrees(field, options, generationProfile);
  layers.trees.add(trees.layer);
  if (options.showCandidates) {
    layers.candidates.add(createCandidatePoints(
      field,
      options.fieldView,
      generationProfile.debugCandidateSpacing,
    ));
  }

  const appearance = options.fieldView === 'appearance';
  layers.water.visible = appearance;
  layers.grass.visible = appearance;
  layers.flowers.visible = appearance;
  layers.shrubs.visible = appearance;
  layers.rocks.visible = appearance;
  layers.trees.visible = appearance;
  layers.candidates.visible = options.showCandidates && !appearance;
  for (const layer of Object.values(layers)) root.add(layer);
  canopyShafts.rebuild(root);

  const terrainGeometry = (layers.terrain as THREE.Mesh).geometry;
  const metrics = {
    grassBlades: grass.count,
    flowers: flowers.count,
    shrubs: shrubs.count,
    rocks: rocks.count,
    trees: trees.count,
    camphorTrees: trees.camphorCount,
    camphorTreePresets: trees.camphorPresetCount,
    willowTrees: trees.willowCount,
    terrainTriangles: terrainGeometry.index ? terrainGeometry.index.count / 3 : 0,
  };
  let treeLightingUpdates = trees.lightingUpdates;
  let treeWindTargets = trees.windTargets;
  let treeFoliageWindUpdates = trees.foliageWindUpdates;
  let treeProviders = trees.gameplayTrees;
  let treeFoliageLightEnabled = true;
  let treeFoliageHeightInfluence = 0.20;
  let treeFoliageDetailStrength = 0.28;
  let treeFoliagePaletteStyle: FoliageTreePaletteStyle = 'authored-three-color';
  let treeFoliageLightingResponse: FoliageLightingResponse = {
    keyEnabled: true, keyStrength: 1,
    skyEnabled: true, skyStrength: 1,
    groundEnabled: true, groundStrength: 1,
    backlightEnabled: true, backlightStrength: 1,
  };
  let treeEnvironmentLight: THREE.HemisphereLight | THREE.AmbientLight = options.hemisphereLight;
  let foliageShadowOcclusionEnabled = true;
  let foliageShadowOcclusionStrength = 0.13;
  let grassGroundIntegrationEnabled = true;
  let grassGroundTipLift = 0.26;
  grass.setFinalGroundColor(
    finalGroundColorTarget.texture,
    terrainSurface.lighting.worldSize.value,
    grassFinalGroundColorEnabled,
  );
  const createTreeFoliageLightExperiment = () => {
    const experiment = createFoliageLightDirectionExperiment(
      [
        ...trees.layer.children.map((treeRoot) => ({ kind: 'tree' as const, root: treeRoot })),
        ...shrubs.layer.children.map((bushRoot) => ({ kind: 'bush' as const, root: bushRoot })),
      ],
      treeFoliageHeightInfluence,
    );
    experiment.setTreeColorMode('gradient-detail');
    experiment.setDetailStrength(treeFoliageDetailStrength);
    experiment.setTreePaletteStyle(treeFoliagePaletteStyle);
    experiment.setForestOcclusion(foliageShadowOcclusionEnabled, foliageShadowOcclusionStrength);
    experiment.setLightingResponse(treeFoliageLightingResponse);
    experiment.updateLighting(
      options.keyLight,
      options.fillLight,
      options.rimLight,
      treeEnvironmentLight,
    );
    experiment.setActive(treeFoliageLightEnabled);
    return experiment;
  };
  let treeFoliageLightExperiment = createTreeFoliageLightExperiment();
  let terrainPaletteRevision = 0;
  let stylizedLightingFeatures: StylizedEnvironmentFeatures = {
    coreShadow: false,
    dropShadow: true,
    groundBounce: false,
  };
  let lightingVersion: 'elemental' | 'reference' = 'elemental';
  let terrainLightingFeatures: WetlandTerrainLightingFeatures = {
    slopeLight: true,
    slopeStrength: 0.18,
    selfShadow: true,
    shadowTint: true,
    shadowTintStrength: 0.24,
    distanceSoftShadow: true,
    contactSoftness: 0.08,
    farSoftness: 0.10,
    contactDarkening: false,
    contactStrength: 0.12,
  };
  const syncLighting = (environmentLight = treeEnvironmentLight) => {
    treeEnvironmentLight = environmentLight;
    grass.syncLighting(
      options.hemisphereLight,
      options.keyLight,
      options.fillLight,
      options.rimLight,
    );
    shrubs.lightingUpdates.forEach((updateLighting) => updateLighting());
    treeLightingUpdates.forEach((updateLighting) => updateLighting());
    treeFoliageLightExperiment.updateLighting(
      options.keyLight,
      options.fillLight,
      options.rimLight,
      treeEnvironmentLight,
    );
    treeFoliageLightExperiment.update();
    terrainSurface.lighting.keyDirection.value
      .copy(options.keyLight.position)
      .sub(options.keyLight.target.position)
      .normalize();
    const shadowCamera = options.keyLight.shadow.camera;
    terrainSurface.lighting.shadowDepthSpan.value = Math.max(
      shadowCamera.far - shadowCamera.near,
      1,
    );
    terrainSurface.lighting.shadowTexelsPerWorldUnit.value = Math.max(
      options.keyLight.shadow.mapSize.x / Math.max(shadowCamera.right - shadowCamera.left, 1),
      0.01,
    );
    finalGroundColorDirty = true;
  };
  syncLighting();

  return {
    root,
    get field() {
      return field;
    },
    get treeProviders() {
      return treeProviders;
    },
    get terrainHeightMap() {
      return terrainSurface.heightMap;
    },
    get terrainWorldSize() {
      return terrainSurface.lighting.worldSize.value;
    },
    get metrics() {
      return metrics;
    },
    rebuildGrass(updateOptions) {
      const grassField = createWetlandRegionField(
        updateOptions.params,
        updateOptions.brushStrokes,
        updateOptions.grassDistribution,
        updateOptions.shoreStyle,
        updateOptions.layoutMap,
      );
      const nextGrass = createGrassLayer(
        grassField,
        updateOptions.params,
        updateOptions.grassDistribution,
        updateOptions.grassShape,
        updateOptions.palette,
        generationProfile,
        options.look,
      );
      const visible = layers.grass.visible;
      layers.grass.remove(grass.object);
      grass.dispose();
      grass = nextGrass;
      layers.grass.add(grass.object);
      layers.grass.visible = visible;
      metrics.grassBlades = grass.count;
      grass.syncLighting(
        options.hemisphereLight,
        options.keyLight,
        options.fillLight,
        options.rimLight,
      );
      grass.setStylizedFeatures(stylizedLightingFeatures);
      grass.setLightingVersion(lightingVersion);
      grass.setGroundIntegration(grassGroundIntegrationEnabled);
      grass.setGroundTipLift(grassGroundTipLift);
      grass.setFinalGroundColor(
        finalGroundColorTarget.texture,
        terrainSurface.lighting.worldSize.value,
        grassFinalGroundColorEnabled,
      );
    },
    rebuildTrees(palette) {
      const visible = layers.trees.visible;
      treeFoliageLightExperiment.dispose();
      disposeTree(trees.layer);
      layers.trees.clear();
      const nextTrees = createTrees(field, { ...options, palette }, generationProfile);
      trees = nextTrees;
      treeLightingUpdates = trees.lightingUpdates;
      treeWindTargets = trees.windTargets;
      treeFoliageWindUpdates = trees.foliageWindUpdates;
      treeProviders = trees.gameplayTrees;
      treeFoliageLightExperiment = createTreeFoliageLightExperiment();
      layers.trees.add(trees.layer);
      canopyShafts.rebuild(root);
      layers.trees.visible = visible;
      metrics.trees = trees.count;
      metrics.camphorTrees = trees.camphorCount;
      metrics.camphorTreePresets = trees.camphorPresetCount;
      metrics.willowTrees = trees.willowCount;
      treeLightingUpdates.forEach((updateLighting) => updateLighting());
      treeFoliageLightExperiment.updateLighting(
        options.keyLight,
        options.fillLight,
        options.rimLight,
        treeEnvironmentLight,
      );
      treeFoliageLightExperiment.update();
      finalGroundColorDirty = true;
    },
    updateWaterPalette(palette) {
      water.setColors({
        deep: palette.waterDeep,
        mid: palette.waterMid,
        shallow: palette.waterShallow,
        ripple: palette.waterRipple,
      });
    },
    async updateTerrainPalette(palette) {
      const revision = ++terrainPaletteRevision;
      const terrainMaterial = (layers.terrain as THREE.Mesh).material;
      if (!(terrainMaterial instanceof THREE.MeshStandardMaterial) || !terrainMaterial.map) return;
      const nextMap = await createTerrainSurfaceMapAsync(
        field,
        { ...palette },
        generationProfile,
        () => revision === terrainPaletteRevision,
      );
      if (!nextMap || revision !== terrainPaletteRevision) return;
      const previousMap = terrainMaterial.map;
      terrainMaterial.map = nextMap;
      terrainMaterial.needsUpdate = true;
      previousMap.dispose();
      finalGroundColorDirty = true;
    },
    setLayerVisible(layer, visible) {
      layers[layer].visible = visible;
    },
    syncLighting(environmentLight) {
      syncLighting(environmentLight);
    },
    setStylizedLightingFeatures(features) {
      stylizedLightingFeatures = { ...stylizedLightingFeatures, ...features };
      grass.setStylizedFeatures(features);
    },
    setStylizedLightingLook(nextLook) {
      grass.setStylizedLook(nextLook);
    },
    setLightingVersion(version) {
      lightingVersion = version;
      grass.setLightingVersion(version);
    },
    setTreeFoliageLightResponse(enabled) {
      treeFoliageLightEnabled = enabled;
      treeFoliageLightExperiment.setActive(enabled);
    },
    setTreeFoliageHeightInfluence(value) {
      treeFoliageHeightInfluence = THREE.MathUtils.clamp(value, 0, 1);
      treeFoliageLightExperiment.setHeightInfluence(treeFoliageHeightInfluence);
    },
    setTreeFoliageDetailStrength(value) {
      treeFoliageDetailStrength = THREE.MathUtils.clamp(value, 0, 1);
      treeFoliageLightExperiment.setDetailStrength(treeFoliageDetailStrength);
    },
    setTreeFoliagePaletteStyle(style) {
      treeFoliagePaletteStyle = style;
      treeFoliageLightExperiment.setTreePaletteStyle(treeFoliagePaletteStyle);
    },
    setTreeFoliageLightingResponse(response) {
      treeFoliageLightingResponse = { ...treeFoliageLightingResponse, ...response };
      treeFoliageLightExperiment.setLightingResponse(treeFoliageLightingResponse);
    },
    setFoliageShadowOcclusion(enabled, strength) {
      foliageShadowOcclusionEnabled = enabled;
      foliageShadowOcclusionStrength = THREE.MathUtils.clamp(strength, 0, 1);
      treeFoliageLightExperiment.setForestOcclusion(
        foliageShadowOcclusionEnabled,
        foliageShadowOcclusionStrength,
      );
    },
    setGrassGroundIntegration(enabled) {
      grassGroundIntegrationEnabled = enabled;
      grass.setGroundIntegration(enabled);
    },
    setGrassGroundTipLift(amount) {
      grassGroundTipLift = THREE.MathUtils.clamp(amount, 0, 0.35);
      grass.setGroundTipLift(grassGroundTipLift);
    },
    setGrassFinalGroundColor(enabled) {
      grassFinalGroundColorEnabled = enabled;
      grass.setFinalGroundColor(
        finalGroundColorTarget.texture,
        terrainSurface.lighting.worldSize.value,
        grassFinalGroundColorEnabled,
      );
      finalGroundColorDirty = true;
    },
    updateGrassFinalGroundColor(renderer, scene) {
      if (!grassFinalGroundColorEnabled || !finalGroundColorDirty) return;
      const previousTarget = renderer.getRenderTarget();
      const previousAutoUpdate = renderer.shadowMap.autoUpdate;
      const previousShadowNeedsUpdate = renderer.shadowMap.needsUpdate;
      const previousFog = scene.fog;
      const previousClearColor = renderer.getClearColor(new THREE.Color());
      const previousClearAlpha = renderer.getClearAlpha();
      const terrainLayerMask = terrain.layers.mask;
      const terrainVisible = terrain.visible;
      const captureLights: Array<{ light: THREE.Light; layerMask: number }> = [];
      const captureCasters: Array<{ object: THREE.Object3D; layerMask: number }> = [];
      scene.traverse((object) => {
        if (object instanceof THREE.Light) {
          captureLights.push({ light: object, layerMask: object.layers.mask });
          object.layers.enable(finalGroundColorLayer);
        }
        if ((object instanceof THREE.Mesh
          || object instanceof THREE.Line
          || object instanceof THREE.Points) && object.castShadow) {
          captureCasters.push({ object, layerMask: object.layers.mask });
          object.layers.enable(finalGroundColorLayer);
        }
      });
      renderer.shadowMap.autoUpdate = true;
      renderer.shadowMap.needsUpdate = true;
      scene.fog = null;
      // Alpha marks whether the overhead pixel was written by terrain. Grass
      // uses it to reject clear pixels at map edges and sparse capture gaps.
      renderer.setClearColor(0x000000, 0);
      terrain.layers.set(finalGroundColorLayer);
      terrain.visible = true;
      terrainSurface.lighting.finalGroundCaptureEnabled.value = 1;
      renderer.setRenderTarget(finalGroundColorTarget);
      // First pass refreshes the light's shadow map with tree/rock casters on
      // the capture camera layer. Its colour is discarded immediately.
      renderer.render(scene, finalGroundCamera);
      captureCasters.forEach(({ object, layerMask }) => {
        object.layers.mask = layerMask;
      });
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = false;
      renderer.clear();
      // Second pass writes only the fully lit, already shadowed terrain. Grass
      // roots sample this texture, so cast shadows are part of their base.
      renderer.render(scene, finalGroundCamera);
      renderer.setRenderTarget(previousTarget);
      terrainSurface.lighting.finalGroundCaptureEnabled.value = 0;
      terrain.layers.mask = terrainLayerMask;
      terrain.visible = terrainVisible;
      captureLights.forEach(({ light, layerMask }) => {
        light.layers.mask = layerMask;
      });
      scene.fog = previousFog;
      renderer.setClearColor(previousClearColor, previousClearAlpha);
      renderer.shadowMap.autoUpdate = previousAutoUpdate;
      renderer.shadowMap.needsUpdate = previousShadowNeedsUpdate;
      finalGroundColorDirty = false;
    },
    getTreeFoliageLightSnapshot: () => treeFoliageLightExperiment.getSnapshot(),
    setTerrainLightingFeatures(features) {
      terrainLightingFeatures = { ...terrainLightingFeatures, ...features };
      terrainSurface.lighting.slopeEnabled.value = terrainLightingFeatures.slopeLight ? 1 : 0;
      terrainSurface.lighting.slopeStrength.value = THREE.MathUtils.clamp(
        terrainLightingFeatures.slopeStrength,
        0,
        1,
      );
      terrainSurface.lighting.contactEnabled.value = terrainLightingFeatures.contactDarkening ? 1 : 0;
      terrainSurface.lighting.contactStrength.value = THREE.MathUtils.clamp(
        terrainLightingFeatures.contactStrength,
        0,
        1,
      );
      terrainSurface.lighting.selfShadowEnabled.value = terrainLightingFeatures.selfShadow ? 1 : 0;
      terrainSurface.lighting.shadowTintEnabled.value = terrainLightingFeatures.shadowTint ? 1 : 0;
      terrainSurface.lighting.shadowTintStrength.value = THREE.MathUtils.clamp(
        terrainLightingFeatures.shadowTintStrength,
        0,
        1,
      );
      terrainSurface.lighting.distanceSoftShadowEnabled.value = terrainLightingFeatures.distanceSoftShadow ? 1 : 0;
      terrainSurface.lighting.contactSoftness.value = THREE.MathUtils.clamp(
        terrainLightingFeatures.contactSoftness,
        0.01,
        1,
      );
      terrainSurface.lighting.farSoftness.value = THREE.MathUtils.clamp(
        terrainLightingFeatures.farSoftness,
        0,
        1,
      );
      finalGroundColorDirty = true;
    },
    getTerrainLightingSnapshot: () => ({ ...terrainLightingFeatures }),
    setCanopyShaftSettings(settings) {
      canopyShafts.setSettings(settings);
    },
    setGroundDappleSettings(settings) {
      if (settings.enabled !== undefined) {
        terrainSurface.lighting.groundDappleEnabled.value = settings.enabled ? 1 : 0;
      }
      if (settings.strength !== undefined) {
        terrainSurface.lighting.groundDappleStrength.value = THREE.MathUtils.clamp(settings.strength, 0, 1.5);
      }
      finalGroundColorDirty = true;
    },
    getCanopyShaftSnapshot: () => canopyShafts.getSnapshot(),
    update(elapsed, wind, camera, fog = null) {
      water.update(elapsed, wind);
      grass.update(elapsed, wind);
      flowers.update(elapsed, wind);
      updateWindTargets(shrubs.windTargets, elapsed, wind);
      updateWindTargets(treeWindTargets, elapsed, wind);
      shrubs.foliageWindUpdates.forEach((updateWind) => updateWind(elapsed, wind));
      treeFoliageWindUpdates.forEach((updateWind) => updateWind(elapsed, wind));
      treeFoliageLightExperiment.update();
      if (camera) canopyShafts.update(elapsed, camera, options.keyLight, fog);
    },
    dispose() {
      terrainPaletteRevision += 1;
      terrainSurface.heightMap.dispose();
      finalGroundColorTarget.dispose();
      layers.grass.remove(grass.object);
      grass.dispose();
      treeFoliageLightExperiment.dispose();
      canopyShafts.dispose();
      disposeTree(root);
    },
  };
};
