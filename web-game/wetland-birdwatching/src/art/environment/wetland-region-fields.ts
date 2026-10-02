import * as THREE from 'three';
import {
  createDefaultWetlandLayoutMap,
  type WetlandLayoutMap,
} from './wetland-layout-map';

export type WetlandFieldView =
  | 'appearance'
  | 'height'
  | 'hill'
  | 'slope'
  | 'path'
  | 'bareGround'
  | 'groundGrass'
  | 'grassTone'
  | 'grass'
  | 'flower'
  | 'shrub'
  | 'coverage';

export type WetlandCoverageModel = 'unified';
export type WetlandCoverageShape = 'coherent';
export type WetlandCoverageResponse = 'single-suitability';
export type WetlandGrassDistribution = 'color-guided' | 'random';
export type WetlandGrassShape = 'rounded' | 'legacy';
export type WetlandShoreStyle = 'smooth' | 'shelf' | 'steep';

export type WetlandRegionParams = {
  terrainSeed: number;
  vegetationSeed: number;
  macroNoiseAmplitude: number;
  macroNoiseFrequency: number;
  hillHeight: number;
  bareGroundAmount: number;
  bareGroundTransition: number;
  grassSoilEdgeVariation: number;
  pathInvasion: number;
  grassColorScale: number;
  grassColorContrast: number;
  directionalBrightness: number;
  grassDensity: number;
  grassHeight: number;
  grassWidth: number;
  grassLean: number;
  grassDirectionSpread: number;
  flowerDensity: number;
};

export type WetlandBrushStroke = Readonly<{
  x: number;
  z: number;
  radius: number;
  channel: 'grass' | 'path';
  operation: 'add' | 'erase';
  group: number;
}>;

export type WetlandRegionSample = Readonly<{
  height: number;
  slope: number;
  hill: number;
  pathDistance: number;
  pathSurface: number;
  bareGround: number;
  moisture: number;
  groundGrass: number;
  grassColorBoundaryDistance: number;
  grassTone: number;
  grass: number;
  flower: number;
  shrub: number;
  pondDistance: number;
  highlandDistance: number;
}>;

export type WetlandRegionField = Readonly<{
  params: Readonly<WetlandRegionParams>;
  grassDistribution: WetlandGrassDistribution;
  coverageModel: WetlandCoverageModel;
  coverageShape: WetlandCoverageShape;
  coverageResponse: WetlandCoverageResponse;
  width: number;
  depth: number;
  pondCenter: THREE.Vector2;
  pondRadius: THREE.Vector2;
  waterLevel: number;
  shoreStyle: WetlandShoreStyle;
  pathCurve: THREE.CatmullRomCurve3;
  layoutMap: WetlandLayoutMap;
  sample: (x: number, z: number) => WetlandRegionSample;
  heightAt: (x: number, z: number) => number;
  pathDistanceAt: (x: number, z: number) => number;
  waterDistanceAt: (x: number, z: number) => number;
}>;

export const defaultWetlandRegionParams: WetlandRegionParams = {
  terrainSeed: 174,
  vegetationSeed: 913,
  macroNoiseAmplitude: 0.38,
  macroNoiseFrequency: 0.052,
  hillHeight: 5.8,
  bareGroundAmount: 0.46,
  bareGroundTransition: 0.13,
  grassSoilEdgeVariation: 0.7,
  pathInvasion: 0.82,
  grassColorScale: 0.075,
  grassColorContrast: 0.72,
  directionalBrightness: 1,
  grassDensity: 0.2,
  grassHeight: 1.08,
  grassWidth: 0.1,
  grassLean: 0.38,
  grassDirectionSpread: 1.6,
  flowerDensity: 0.32,
};

export const unifiedWetlandRegionParams: WetlandRegionParams = {
  ...defaultWetlandRegionParams,
  bareGroundTransition: 0.34,
  pathInvasion: 0.58,
  grassColorScale: 0.045,
  grassDensity: 0.139,
  grassHeight: 0.63,
  grassWidth: 0.135,
  flowerDensity: 0.16,
};

const clamp01 = (value: number) => THREE.MathUtils.clamp(value, 0, 1);

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / Math.max(edge1 - edge0, 0.00001));
  return t * t * (3 - 2 * t);
};

const hash2 = (x: number, z: number, seed: number) => {
  let value = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(z | 0, 0x5f356495) ^ seed;
  value = Math.imul(value ^ (value >>> 15), 0x2c1b3c6d);
  value = Math.imul(value ^ (value >>> 12), 0x297a2d39);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967295;
};

const valueNoise = (x: number, z: number, seed: number) => {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = THREE.MathUtils.lerp(hash2(ix, iz, seed), hash2(ix + 1, iz, seed), sx);
  const b = THREE.MathUtils.lerp(hash2(ix, iz + 1, seed), hash2(ix + 1, iz + 1, seed), sx);
  return THREE.MathUtils.lerp(a, b, sz);
};

const fbm = (x: number, z: number, seed: number, octaves = 4) => {
  let total = 0;
  let amplitude = 0.56;
  let frequency = 1;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise(x * frequency, z * frequency, seed + octave * 1013) * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return total / normalization;
};

const warpedFbm = (x: number, z: number, seed: number, warp = 1) => {
  const warpX = fbm(x + 11.3, z + 2.7, seed + 79, 3);
  const warpZ = fbm(x + 5.9, z + 17.1, seed + 151, 3);
  return fbm(
    x + (warpX - 0.5) * warp,
    z + (warpZ - 0.5) * warp,
    seed,
  );
};

export const createWetlandRegionField = (
  input: WetlandRegionParams,
  inputBrushStrokes: readonly WetlandBrushStroke[] = [],
  grassDistribution: WetlandGrassDistribution = 'color-guided',
  shoreStyle: WetlandShoreStyle = 'smooth',
  inputLayoutMap?: WetlandLayoutMap,
): WetlandRegionField => {
  const params = { ...input };
  const brushStrokes = inputBrushStrokes.map((stroke) => ({ ...stroke }));
  const layoutMap = inputLayoutMap ?? createDefaultWetlandLayoutMap(params.terrainSeed);
  layoutMap.compile();
  const width = layoutMap.worldWidth;
  const depth = layoutMap.worldDepth;
  const layoutLinearScale = Math.min(width / 120, depth / 84);
  const largeWorldBlend = smoothstep(1.05, 3.5, layoutLinearScale);
  const basePathWidth = 1.25;
  const fixedPathDepth = 0.1;
  const coverageNoiseScale = 0.13;
  const bareTransition = params.bareGroundTransition;
  const transitionControl = clamp01((bareTransition - 0.06) / 0.44);
  const baseBoundaryWidth = THREE.MathUtils.lerp(0.04, 0.075, transitionControl);
  const grassSoilTransitionSpan = THREE.MathUtils.lerp(2.6, 6, transitionControl);
  const cliffTransitionWidth = THREE.MathUtils.lerp(0.08, 0.46, transitionControl);
  const grassSoilEdgeVariation = clamp01(params.grassSoilEdgeVariation);
  const broadBareExpansion = smoothstep(0.46, 0.82, params.bareGroundAmount);

  const coverageAt = (x: number, z: number) => {
    const coverageWarpX = fbm(
      x * coverageNoiseScale * 0.58 + 14.1,
      z * coverageNoiseScale * 0.58 - 6.7,
      params.vegetationSeed + 2503,
      3,
    );
    const coverageWarpZ = fbm(
      x * coverageNoiseScale * 0.58 - 8.9,
      z * coverageNoiseScale * 0.58 + 12.4,
      params.vegetationSeed + 2591,
      3,
    );
    const coverageX = x + (coverageWarpX - 0.5) * 5.2;
    const coverageZ = z + (coverageWarpZ - 0.5) * 5.2;
    const coverageMacro = fbm(
      coverageX * coverageNoiseScale,
      coverageZ * coverageNoiseScale,
      params.vegetationSeed + 2671,
      4,
    );
    const coverageMass = fbm(
      coverageX * coverageNoiseScale * 0.38 + 22.4,
      coverageZ * coverageNoiseScale * 0.38 - 16.8,
      params.vegetationSeed + 2693,
      4,
    );
    const coverageEdge = fbm(
      coverageX * coverageNoiseScale * 2.35 + 3.7,
      coverageZ * coverageNoiseScale * 2.35 - 9.2,
      params.vegetationSeed + 2741,
      3,
    );
    const coverageDetail = fbm(
      coverageX * coverageNoiseScale * 14 - 4.2,
      coverageZ * coverageNoiseScale * 14 + 19.6,
      params.vegetationSeed + 2819,
      2,
    );
    const naturalCoverageMacro = THREE.MathUtils.lerp(
      coverageMacro,
      coverageMass,
      broadBareExpansion * 0.82,
    );
    return {
      coverageMacro,
      coverageEdge,
      coverageDetail,
      naturalCoverageMacro,
      coherentNaturalStructure: naturalCoverageMacro * 0.96 + coverageEdge * 0.04,
    };
  };

  // Calibrate the threshold against this seed's actual noise distribution.
  // The slider then controls visible area instead of moving linearly through a
  // strongly non-uniform FBM value range.
  const calibrationSamples = Array.from({ length: 48 * 34 }, (_, index) => {
    const column = index % 48;
    const row = Math.floor(index / 48);
    return coverageAt(
      -width / 2 + (column + 0.5) * width / 48,
      -depth / 2 + (row + 0.5) * depth / 34,
    );
  });
  const targetNaturalBareCoverage = params.bareGroundAmount
    * params.bareGroundAmount
    * 0.95;
  const naturalBareCoverageAt = (threshold: number) => {
    let coverage = 0;
    for (const coverageSample of calibrationSamples) {
      const boundaryNoiseGate = 1 - smoothstep(
        baseBoundaryWidth * 0.7,
        baseBoundaryWidth * 3.8,
        Math.abs(coverageSample.coherentNaturalStructure - threshold),
      );
      const signal = coverageSample.coherentNaturalStructure + boundaryNoiseGate * (
        (coverageSample.coverageEdge - 0.5) * 0.08
        + (coverageSample.coverageDetail - 0.5) * 0.02
      );
      const boundaryDistance = (threshold - clamp01(signal))
        / Math.max(baseBoundaryWidth * 0.975, 0.00001);
      coverage += 1 - smoothstep(-5, 5, boundaryDistance);
    }
    return coverage / calibrationSamples.length;
  };
  let lowerBareThreshold = -0.5;
  let upperBareThreshold = 1.5;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const candidate = (lowerBareThreshold + upperBareThreshold) * 0.5;
    if (naturalBareCoverageAt(candidate) > targetNaturalBareCoverage) {
      lowerBareThreshold = candidate;
    } else {
      upperBareThreshold = candidate;
    }
  }
  const naturalBareThreshold = (lowerBareThreshold + upperBareThreshold) * 0.5;
  const worldScaleX = width / 76;
  const worldScaleZ = depth / 54;
  const pondCenter = new THREE.Vector2(24.2 * worldScaleX, -5.4 * worldScaleZ);
  const pondRadius = new THREE.Vector2(8.5 * worldScaleX, 5.9 * worldScaleZ);
  const waterLevel = -0.14;
  const pathCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-60, 0, 34.5),
    new THREE.Vector3(-43.4, 0, 35.9),
    new THREE.Vector3(-24, 0, 37.3),
    new THREE.Vector3(-3.8, 0, 37.8),
    new THREE.Vector3(18.6, 0, 36.6),
    new THREE.Vector3(39.8, 0, 32.2),
    new THREE.Vector3(60, 0, 28.9),
  ]);
  const rawHighlandProfiles = Array.from({ length: layoutMap.rows }, (_, row) => {
    let firstColumn = layoutMap.columns;
    let lastColumn = -1;
    for (let column = 0; column < layoutMap.columns; column += 1) {
      if (layoutMap.semanticAt(column, row) !== 'highland') continue;
      firstColumn = Math.min(firstColumn, column);
      lastColumn = Math.max(lastColumn, column);
    }
    if (lastColumn < firstColumn) return { minX: -width * 0.5, maxX: -width * 0.5, span: 0 };
    const minX = width * (firstColumn / (layoutMap.columns - 1) - 0.5);
    const maxX = width * (lastColumn / (layoutMap.columns - 1) - 0.5);
    return { minX, maxX, span: Math.max(0, maxX - minX) };
  });
  const activeHighlandRows = rawHighlandProfiles
    .map((profile, row) => ({ profile, row }))
    .filter(({ profile }) => profile.span > 0.5);
  const firstHighlandRow = activeHighlandRows[0]?.row ?? 0;
  const lastHighlandRow = activeHighlandRows.at(-1)?.row ?? layoutMap.rows - 1;
  const highlandCenterZ = depth * (
    ((firstHighlandRow + lastHighlandRow) * 0.5) / (layoutMap.rows - 1) - 0.5
  );
  const highlandHalfDepth = Math.max(
    depth * (lastHighlandRow - firstHighlandRow) * 0.5 / (layoutMap.rows - 1),
    1,
  );
  const highlandFaceCenterZ = highlandCenterZ
    + (hash2(7, 29, params.terrainSeed) - 0.5) * highlandHalfDepth * 0.28;
  const maxHighlandSpan = rawHighlandProfiles.reduce(
    (largest, profile) => Math.max(largest, profile.span),
    0,
  );
  const minHighlandX = activeHighlandRows.reduce(
    (smallest, { profile }) => Math.min(smallest, profile.minX),
    width * 0.5,
  );
  const maxHighlandX = activeHighlandRows.reduce(
    (largest, { profile }) => Math.max(largest, profile.maxX),
    -width * 0.5,
  );

  const semanticEdgeNoise = (x: number, z: number, seedOffset: number) => (
    (fbm(x * 0.16, z * 0.16, params.terrainSeed + seedOffset, 3) - 0.5) * 2
  );
  const grassSoilEdgeNoiseAt = (x: number, z: number, seedOffset = 0) => {
    const broad = fbm(
      x * 0.23 + 17.3,
      z * 0.23 - 11.7,
      params.vegetationSeed + 6101 + seedOffset,
      3,
    ) - 0.5;
    const detail = fbm(
      x * 0.62 - 8.1,
      z * 0.62 + 19.4,
      params.vegetationSeed + 6203 + seedOffset,
      2,
    ) - 0.5;
    return (broad * 0.76 + detail * 0.24) * 2;
  };
  const waterDistanceAt = (x: number, z: number) => (
    layoutMap.sample(x, z).waterDistance + semanticEdgeNoise(x, z, 4319) * 0.62
  );
  const pathDistanceAt = (x: number, z: number) => (
    layoutMap.sample(x, z).pathDistance + semanticEdgeNoise(x, z, 4421) * 0.48
  );
  const highlandBaseDistanceAt = (x: number, z: number) => (
    layoutMap.sample(x, z).highlandDistance
  );
  const highlandDistanceAt = (x: number, z: number) => (
    highlandBaseDistanceAt(x, z) + semanticEdgeNoise(x, z, 4591) * 0.72
  );
  const pondDistance = (x: number, z: number) => waterDistanceAt(x, z) / 2.4;

  const highlandModel = {
    sideFullHeightUntil: 0.18,
    sideGroundAt: 1.06,
    roundedFaceInner: -5.8,
    roundedFaceOuter: 8.6,
    cliffFaceInner: -0.64,
    cliffFaceOuter: -0.02,
    rampStartOffset: -6.8,
    rampEndOffset: -0.8,
    rampPower: 1.22,
    faceShare: 0.36,
    soilCoverage: 0.72,
    grassCap: 0.08,
    flankSteepness: 0.86,
  } as const;
  const faceShare = highlandModel.faceShare;
  const faceReach = THREE.MathUtils.lerp(0.04, 1.08, faceShare);
  const forwardProfileFloor = smoothstep(0.02, 0.22, faceShare) * 0.46;
  const highlandFaceIntentAt = (x: number, z: number, profileFloor = 0) => {
    const faceArcCoordinate = Math.abs(z - highlandFaceCenterZ) / highlandHalfDepth;
    const faceArc = 1 - smoothstep(
      Math.max(0, faceReach - 0.46),
      faceReach + 0.46,
      faceArcCoordinate,
    );
    const flankCliffArc = 1 - smoothstep(
      faceReach + 0.02,
      faceReach + 0.66,
      faceArcCoordinate,
    );
    const edgeSampleStep = 0.65;
    const edgeDx = highlandBaseDistanceAt(x + edgeSampleStep, z)
      - highlandBaseDistanceAt(x - edgeSampleStep, z);
    const edgeDz = highlandBaseDistanceAt(x, z + edgeSampleStep)
      - highlandBaseDistanceAt(x, z - edgeSampleStep);
    const edgeGradientLength = Math.max(Math.hypot(edgeDx, edgeDz), 0.0001);
    const eastFacingEdge = clamp01(edgeDx / edgeGradientLength);
    const forwardEdge = smoothstep(0.42, 0.88, eastFacingEdge);
    const roundedFaceProfile = THREE.MathUtils.lerp(profileFloor, 1, faceArc);
    const flankFaceProfile = flankCliffArc * highlandModel.flankSteepness;
    const flankRampStart = minHighlandX + highlandModel.rampStartOffset;
    const flankRampEnd = maxHighlandX + highlandModel.rampEndOffset;
    const flankRampProgress = clamp01(
      (x - flankRampStart) / Math.max(flankRampEnd - flankRampStart, 0.001),
    );
    const flankFrontGate = smoothstep(0.48, 0.78, flankRampProgress);
    return Math.max(
      roundedFaceProfile * forwardEdge,
      flankFaceProfile * flankFrontGate,
    );
  };

  const highlandSideHeightAt = (z: number) => {
    const sideCoordinate = Math.abs(z - highlandFaceCenterZ) / highlandHalfDepth;
    return 1 - smoothstep(
      highlandModel.sideFullHeightUntil,
      highlandModel.sideGroundAt,
      sideCoordinate,
    );
  };

  const highlandForwardProfileAt = (
    x: number,
    z: number,
    inputSideHeight?: number,
  ) => {
    const sideHeight = inputSideHeight ?? highlandSideHeightAt(z);
    return highlandFaceIntentAt(x, z, forwardProfileFloor * sideHeight);
  };

  const hillElevationAt = (
    x: number,
    z: number,
    inputCliffIntent?: number,
    inputSideHeight?: number,
  ) => {
    if (maxHighlandSpan < 0.5 || params.hillHeight <= 0) return 0;
    const sideHeight = inputSideHeight ?? highlandSideHeightAt(z);
    const cliffIntent = inputCliffIntent
      ?? highlandForwardProfileAt(x, z, sideHeight);
    const transitionCleanup = Math.max(cliffIntent, (1 - sideHeight) * 0.55);
    const faceCleanup = smoothstep(0.08, 0.38, transitionCleanup);
    const highlandDistance = THREE.MathUtils.lerp(
      highlandDistanceAt(x, z),
      highlandBaseDistanceAt(x, z),
      faceCleanup,
    );
    const innerSlopeIntent = 1 - Math.pow(1 - cliffIntent, 3);
    const outerFootInset = 1 - Math.pow(1 - cliffIntent, 5);
    const faceInnerEdge = THREE.MathUtils.lerp(
      highlandModel.roundedFaceInner,
      highlandModel.cliffFaceInner,
      innerSlopeIntent,
    );
    const faceOuterEdge = THREE.MathUtils.lerp(
      highlandModel.roundedFaceOuter,
      highlandModel.cliffFaceOuter,
      outerFootInset,
    );
    const highlandMask = 1 - smoothstep(faceInnerEdge, faceOuterEdge, highlandDistance);
    const rampStart = minHighlandX + highlandModel.rampStartOffset;
    const rampEnd = maxHighlandX + highlandModel.rampEndOffset;
    const rampProgress = clamp01((x - rampStart) / Math.max(rampEnd - rampStart, 0.001));
    const eastwardRise = Math.pow(rampProgress, highlandModel.rampPower);
    const footprintHeight = Math.max(0, maxHighlandSpan - 2) * 0.17;
    const finalHeight = Math.min(params.hillHeight, footprintHeight);
    return highlandMask * eastwardRise * finalHeight * sideHeight;
  };

  const hillInfluenceAt = (x: number, z: number) => (
    Math.max(
      hillElevationAt(x, z) / Math.max(params.hillHeight, 0.001),
      randomMoundElevationAt(x, z) / Math.max(params.hillHeight / 3, 0.001),
    )
  );

  type RandomMound = Readonly<{
    x: number;
    z: number;
    radiusX: number;
    radiusZ: number;
    height: number;
    rotation: number;
    seed: number;
  }>;
  const randomMounds: RandomMound[] = [];
  const moundHeightLimit = params.hillHeight / 3;
  const moundRadiusScale = THREE.MathUtils.lerp(1, 2.25, largeWorldBlend);
  const moundLimit = Math.round(THREE.MathUtils.lerp(3, 6, largeWorldBlend));
  for (let index = 0; index < 144 && randomMounds.length < moundLimit; index += 1) {
    const radiusX = (26 + hash2(index, 17, params.terrainSeed + 8111) * 12)
      * moundRadiusScale;
    const radiusZ = (18 + hash2(index, 31, params.terrainSeed + 8167) * 8)
      * moundRadiusScale;
    const x = THREE.MathUtils.lerp(
      -width * 0.5 + radiusX + 3,
      width * 0.5 - radiusX - 3,
      hash2(index, 47, params.terrainSeed + 8219),
    );
    const z = THREE.MathUtils.lerp(
      -depth * 0.5 + radiusZ + 3,
      depth * 0.5 - radiusZ - 3,
      hash2(index, 59, params.terrainSeed + 8291),
    );
    const semantic = layoutMap.sample(x, z);
    if (semantic.waterDistance < 4 || semantic.pathDistance < 4 || semantic.highlandDistance < 7) continue;
    if (randomMounds.some((mound) => (
      Math.hypot(mound.x - x, mound.z - z) < 24 * moundRadiusScale
    ))) continue;
    randomMounds.push({
      x,
      z,
      radiusX,
      radiusZ,
      height: moundHeightLimit * (1.08 + hash2(index, 71, params.terrainSeed + 8363) * 0.24),
      rotation: hash2(index, 83, params.terrainSeed + 8429) * Math.PI,
      seed: params.terrainSeed + index * 197 + 8513,
    });
  }

  function randomMoundElevationAt(x: number, z: number) {
    let elevation = 0;
    for (const mound of randomMounds) {
      const dx = x - mound.x;
      const dz = z - mound.z;
      const cosine = Math.cos(mound.rotation);
      const sine = Math.sin(mound.rotation);
      const localX = dx * cosine + dz * sine;
      const localZ = -dx * sine + dz * cosine;
      const normalizedX = localX / mound.radiusX;
      const normalizedZ = localZ / mound.radiusZ;
      const shoulderWarp = (fbm(
        localX * 0.035 + 13.7,
        localZ * 0.035 - 9.2,
        mound.seed,
        3,
      ) - 0.5) * 0.18;
      const radial = Math.hypot(
        normalizedX + normalizedZ * normalizedZ * 0.12,
        normalizedZ,
      ) + shoulderWarp;
      if (radial >= 1) continue;
      const broadShoulder = 1 - smoothstep(-0.08, 1, radial);
      const semantic = layoutMap.sample(x, z);
      const semanticClearance = smoothstep(2, 8, semantic.waterDistance)
        * smoothstep(2, 7, semantic.pathDistance)
        * smoothstep(5, 13, semantic.highlandDistance);
      elevation = Math.max(
        elevation,
        Math.min(moundHeightLimit, broadShoulder * mound.height * semanticClearance),
      );
    }
    return elevation;
  }

  const pondBasinAt = (distance: number) => {
    if (shoreStyle === 'shelf') {
      const deepBasin = 1 - smoothstep(-0.72, -0.30, distance);
      const shallowShelf = 1 - smoothstep(-0.08, 0.075, distance);
      return deepBasin * 0.76 + shallowShelf * 0.24;
    }
    if (shoreStyle === 'steep') return 1 - smoothstep(-0.22, 0.045, distance);
    return 1 - smoothstep(-0.72, 0.08, distance);
  };

  const shoreLandDescentAt = (distance: number) => {
    const landGate = smoothstep(-0.03, 0.02, distance);
    if (shoreStyle === 'shelf') {
      const innerShelf = landGate
        * (1 - smoothstep(0.18, 0.40, distance))
        * 0.10;
      const outerShelf = smoothstep(0.30, 0.46, distance)
        * (1 - smoothstep(0.72, 0.95, distance))
        * 0.035;
      return Math.max(innerShelf, outerShelf);
    }
    if (shoreStyle === 'steep') return 0;
    return landGate * (1 - smoothstep(0.24, 0.84, distance)) * 0.06;
  };

  const nearestPathPoint = (x: number, z: number) => {
    return {
      point: { x, z },
      distance: pathDistanceAt(x, z),
      progress: 0,
    };
  };

  const applyBrushAt = (
    channel: WetlandBrushStroke['channel'],
    x: number,
    z: number,
    baseValue: number,
  ) => {
    let value = baseValue;
    for (const stroke of brushStrokes) {
      if (stroke.channel !== channel) continue;
      const distance = Math.hypot(x - stroke.x, z - stroke.z);
      if (distance >= stroke.radius) continue;
      const influence = 1 - smoothstep(stroke.radius * 0.62, stroke.radius, distance);
      if (stroke.operation === 'add') value = Math.max(value, influence);
      else value *= 1 - influence;
    }
    return clamp01(value);
  };

  const rawHeightAt = (x: number, z: number) => {
    const broadSlope = 0.12 - x * 0.0015 + z * 0.0025;
    const macroFrequency = params.macroNoiseFrequency
      * THREE.MathUtils.lerp(1, 0.43, largeWorldBlend);
    const macroAmplitude = params.macroNoiseAmplitude
      * THREE.MathUtils.lerp(1, 1.65, largeWorldBlend);
    const macro = (fbm(
      x * macroFrequency,
      z * macroFrequency,
      params.terrainSeed,
      3,
    ) - 0.5) * macroAmplitude * 2;
    const distance = pondDistance(x, z);
    const basin = pondBasinAt(distance);
    const shoreLandDescent = shoreLandDescentAt(distance);
    const sideHeight = highlandSideHeightAt(z);
    const faceProfile = highlandForwardProfileAt(x, z, sideHeight);
    const hillElevation = hillElevationAt(x, z, faceProfile, sideHeight)
      * smoothstep(0.08, 0.7, distance);
    const transitionCleanup = Math.max(faceProfile, (1 - sideHeight) * 0.55);
    const faceSurfaceCleanup = smoothstep(
      0.08,
      0.38,
      transitionCleanup,
    ) * smoothstep(0.005, 0.08, hillElevation / Math.max(params.hillHeight, 0.001));
    const cleanedMacro = macro * (1 - faceSurfaceCleanup * 0.82);
    const randomMoundElevation = randomMoundElevationAt(x, z);
    const naturalHeight = broadSlope + cleanedMacro
      + Math.max(hillElevation, randomMoundElevation);
    if (shoreStyle === 'smooth') {
      // Keep the water bed nearly level. A short, deep bowl is visible through
      // the transparent ripple layer as a stepped underwater embankment.
      const interiorDepth = THREE.MathUtils.lerp(
        0.035,
        0.20,
        smoothstep(0.10, 4.2, -distance),
      );
      const shallowBedHeight = waterLevel - interiorDepth;
      const naturalTerrainBlend = smoothstep(-0.12, 2.7, distance);
      return THREE.MathUtils.lerp(shallowBedHeight, naturalHeight, naturalTerrainBlend);
    }
    return naturalHeight - shoreLandDescent - basin * 1.05;
  };

  const heightAt = (x: number, z: number) => {
    const base = rawHeightAt(x, z);
    const nearest = nearestPathPoint(x, z);
    const basePathMask = 1 - smoothstep(-0.28, basePathWidth * 1.16, nearest.distance);
    const pathMask = applyBrushAt('path', x, z, basePathMask);
    const pathGuideHeight = base - fixedPathDepth;
    return THREE.MathUtils.lerp(base, pathGuideHeight, pathMask * 0.88);
  };

  const sample = (x: number, z: number): WetlandRegionSample => {
    const height = heightAt(x, z);
    const hill = hillInfluenceAt(x, z);
    const step = 0.16;
    const dx = (heightAt(x + step, z) - heightAt(x - step, z)) / (step * 2);
    const dz = (heightAt(x, z + step) - heightAt(x, z - step)) / (step * 2);
    const slope = Math.hypot(dx, dz);
    const nearest = nearestPathPoint(x, z);
    const distance = pondDistance(x, z);
    const land = shoreStyle === 'smooth'
      ? smoothstep(-0.035, 0.06, distance)
      : smoothstep(-0.1, 0.72, distance);
    const normalizedHeight = clamp01((height + 0.18) / 0.72);
    const moisture = clamp01(
      0.34
      + (1 - normalizedHeight) * 0.18
      + (1 - smoothstep(0.22, 0.9, distance)) * 0.42
      + (fbm(x * 0.16, z * 0.16, params.terrainSeed + 2039, 3) - 0.5) * 0.24,
    );

    const {
      coverageMacro,
      coverageEdge,
      coverageDetail,
      naturalCoverageMacro,
      coherentNaturalStructure,
    } = coverageAt(x, z);
    const coverageSignal = naturalCoverageMacro * 0.78
      + coverageEdge * 0.18
      + coverageDetail * 0.04;

    const crossPath = Math.max(0, nearest.distance) / basePathWidth;
    const pathMapBase = 1 - smoothstep(-0.34, basePathWidth * 1.72, nearest.distance);
    const pathSurface = applyBrushAt('path', x, z, pathMapBase);

    const defaultBareAmount = 0.46;
    const defaultBoundaryCenter = THREE.MathUtils.lerp(0.61, 0.37, defaultBareAmount) + 0.17;
    // Keep only a narrow wet-soil core at the waterline. The weaker shoulder
    // carries the shoreline influence farther out so the land reads as a
    // continuous shallow-green transition instead of a broad bare ring.
    const shoreCore = shoreStyle === 'smooth'
      ? 0
      : 1 - smoothstep(0.035, 0.14, distance);
    const shoreShoulder = shoreStyle === 'smooth'
      ? 0
      : 1 - smoothstep(
        0.1,
        0.94 + (coverageEdge - 0.5) * 0.24,
        distance,
      );
    const pathMapSlope = clamp01(pathSurface * (1 - pathSurface) * 4);
    const pathMap = pathSurface * (0.34 + coverageMacro * 0.07)
      + pathMapSlope * (
        (coverageMacro - 0.5) * 0.18
        + (coverageEdge - 0.5) * 0.22
      ) * params.pathInvasion;
    // Shift the grass/soil boundary in both directions without adding a net
    // bare-ground bias. Sampling along the path keeps the variation broad and
    // coherent: positive stretches push soil outward, negative stretches let
    // grass enter the path.
    const pathInvasionFlow = fbm(
      nearest.point.x * coverageNoiseScale * 0.52 + 31.7,
      nearest.point.z * coverageNoiseScale * 0.52 - 18.3,
      params.vegetationSeed + 2957,
      3,
    );
    const pathMutualInvasion = Math.exp(-Math.pow(crossPath / 2.65, 2))
      * (pathInvasionFlow - 0.5)
      * 2
      * params.pathInvasion;
    const shoreMap = shoreCore * 0.16
      + clamp01(shoreShoulder - shoreCore) * (0.045 + coverageEdge * 0.07);
    const mapNoise = (coverageEdge - 0.5) * 0.1 + (coverageDetail - 0.5) * 0.05;
    const pathBareSemantic = pathMap + pathSurface * 0.15;
    const semanticBareBias = Math.max(pathBareSemantic, shoreMap);
    const pathSemanticInfluence = Math.exp(-Math.pow(crossPath / 2.9, 2));
    const semanticInfluence = clamp01(Math.max(pathSemanticInfluence, shoreShoulder));
    const coherentSemanticStructure = coverageMacro * 0.96
      + coverageEdge * 0.04
      + semanticBareBias
      + pathMutualInvasion * 0.24;
    const boundaryNoiseGate = 1 - smoothstep(
      baseBoundaryWidth * 0.7,
      baseBoundaryWidth * 3.8,
      Math.abs(coherentNaturalStructure - naturalBareThreshold),
    );
    const coherentNaturalSignal = coherentNaturalStructure + boundaryNoiseGate * (
      (coverageEdge - 0.5) * 0.08
      + (coverageDetail - 0.5) * 0.02
    );
    const semanticBoundaryNoiseGate = 1 - smoothstep(
      baseBoundaryWidth * 0.7,
      baseBoundaryWidth * 3.8,
      Math.abs(coherentSemanticStructure - defaultBoundaryCenter),
    );
    const coherentSemanticSignal = coherentSemanticStructure + semanticBoundaryNoiseGate * (
      (coverageEdge - 0.5) * 0.11
      + (coverageDetail - 0.5) * 0.035
      + Math.max(pathSurface, shoreShoulder) * mapNoise
    );
    const bareCoreCenter = naturalBareThreshold;
    const semanticBareCoreCenter = defaultBoundaryCenter + baseBoundaryWidth * 2.125;
    const bareCoreHalfWidth = baseBoundaryWidth * 0.975;
    const naturalBoundaryDistance = (bareCoreCenter - clamp01(coherentNaturalSignal))
      / Math.max(bareCoreHalfWidth, 0.00001);
    const semanticBoundaryDistance = (
      semanticBareCoreCenter - clamp01(coherentSemanticSignal)
    ) / Math.max(bareCoreHalfWidth, 0.00001);
    // Semantics may only reduce suitability. They cannot paint a green
    // protection halo over terrain that the natural field already made bare.
    const unifiedBoundaryJitter = grassSoilEdgeNoiseAt(x, z)
      * grassSoilEdgeVariation
      * 1.3;
    const grassColorBoundaryDistance = Math.min(
      naturalBoundaryDistance,
      THREE.MathUtils.lerp(5, semanticBoundaryDistance, semanticInfluence),
    ) + unifiedBoundaryJitter;
    const sideHeight = highlandSideHeightAt(z);
    const soilProfile = highlandForwardProfileAt(x, z, sideHeight);
    const soilCleanup = smoothstep(
      0.08,
      0.38,
      Math.max(soilProfile, (1 - sideHeight) * 0.55),
    );
    const soilDistance = THREE.MathUtils.lerp(
      highlandDistanceAt(x, z),
      highlandBaseDistanceAt(x, z),
      soilCleanup,
    );
    const soilBandCenter = (
      highlandModel.cliffFaceInner + highlandModel.cliffFaceOuter
    ) * 0.5;
    const maximumSoilHalfWidth = (
      highlandModel.cliffFaceOuter - highlandModel.cliffFaceInner
    ) * 0.525;
    const sideSoilTaper = smoothstep(0.18, 0.92, sideHeight);
    const soilBandHalfWidth = THREE.MathUtils.lerp(
      0.18,
      maximumSoilHalfWidth,
      highlandModel.soilCoverage,
    ) * THREE.MathUtils.lerp(0.1, 1, sideSoilTaper);
    const grassCapInset = highlandModel.grassCap
      * 1.05
      * THREE.MathUtils.lerp(0.35, 1, sideHeight);
    const innerEdgeNoise = grassSoilEdgeNoiseAt(x, z, 149)
      * grassSoilEdgeVariation
      * 0.72;
    const outerEdgeNoise = grassSoilEdgeNoiseAt(x, z, 307)
      * grassSoilEdgeVariation
      * 0.56;
    const soilInnerEdge = soilBandCenter - soilBandHalfWidth
      + grassCapInset
      + innerEdgeNoise;
    const soilOuterEdgeWithoutGroundContact = soilBandCenter + soilBandHalfWidth;
    const soilOuterEdge = Math.max(
      soilOuterEdgeWithoutGroundContact,
      highlandModel.cliffFaceOuter + cliffTransitionWidth * 0.65,
    ) + Math.max(0, outerEdgeNoise);
    const fullFaceBand = smoothstep(
      soilInnerEdge - cliffTransitionWidth,
      soilInnerEdge + cliffTransitionWidth,
      soilDistance,
    ) * (1 - smoothstep(
      soilOuterEdge - cliffTransitionWidth,
      soilOuterEdge + cliffTransitionWidth,
      soilDistance,
    ));
    const faceDirectionGate = smoothstep(0.003, 0.08, soilProfile);
    const sideCoordinate = Math.abs(z - highlandFaceCenterZ) / highlandHalfDepth;
    const materialFaceReach = THREE.MathUtils.lerp(0.04, 1.08, faceShare);
    const materialArcGate = 1 - smoothstep(
      Math.max(0, materialFaceReach - 0.34),
      materialFaceReach + 0.34,
      sideCoordinate,
    );
    const singleFaceGate = faceDirectionGate
      * Math.max(
        smoothstep(0.18, 0.52, materialArcGate),
        smoothstep(0.54, 0.78, soilProfile),
      );
    const sideSoilHeightGate = smoothstep(0.12, 0.28, sideHeight);
    const fullSoilGate = singleFaceGate
      * sideSoilHeightGate;
    const mainHillInfluence = hillElevationAt(x, z, soilProfile, sideHeight)
      / Math.max(params.hillHeight, 0.001);
    const faceHeightGate = smoothstep(0.00001, 0.0015, mainHillInfluence);
    const explicitFaceBare = fullFaceBand
      * fullSoilGate
      * faceHeightGate;
    const steepFaceBare = smoothstep(0.8, 2, slope)
      * faceDirectionGate
      * faceHeightGate;
    const cliffBare = Math.max(
      smoothstep(0.025, 0.3, explicitFaceBare),
      steepFaceBare,
    );
    const cliffVegetationExclusion = Math.max(
      smoothstep(0.012, 0.2, explicitFaceBare),
      steepFaceBare,
    );
    const vegetationAllowance = 1 - cliffVegetationExclusion;
    const groundGrass = applyBrushAt(
      'grass',
      x,
      z,
      smoothstep(
        -grassSoilTransitionSpan,
        grassSoilTransitionSpan,
        grassColorBoundaryDistance,
      ) * land,
    ) * (1 - cliffBare);
    const bareGround = clamp01(land * (1 - groundGrass));
    const lightDirection = clamp01(0.52 + x * 0.012 - z * 0.008);
    const unifiedColorNoise = fbm(
      x * params.grassColorScale,
      z * params.grassColorScale,
      params.vegetationSeed + 3011,
      3,
    );
    const restoredColorSource = params.directionalBrightness > 0.5
      ? unifiedColorNoise * 0.78 + lightDirection * 0.22
      : unifiedColorNoise;
    const colorSource = restoredColorSource;
    const transitionWidth = THREE.MathUtils.lerp(0.16, 0.035, params.grassColorContrast);
    const grassTone = clamp01(
      smoothstep(0.38 - transitionWidth, 0.38 + transitionWidth, colorSource) * 0.5
      + smoothstep(0.62 - transitionWidth, 0.62 + transitionWidth, colorSource) * 0.5,
    );
    const slopeAllowance = 1 - smoothstep(0.34, 0.82, slope);
    const darkGrassColor = 1 - smoothstep(0.06, 0.5, grassTone);
    const grassClusterNoise = fbm(
      x * params.grassColorScale * 1.45 + 7.3,
      z * params.grassColorScale * 1.45 - 11.7,
      params.vegetationSeed + 7027,
      2,
    );
    const densityExpansion = smoothstep(0.03, 8, params.grassDensity);
    const clusterStart = THREE.MathUtils.lerp(0.44, 0.24, densityExpansion);
    const clusterEnd = THREE.MathUtils.lerp(0.6, 0.5, densityExpansion);
    const grassCluster = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(0.02, 0.004, densityExpansion),
      1,
      smoothstep(clusterStart, clusterEnd, grassClusterNoise),
    );
    const grassCoreSuitability = smoothstep(0.46, 0.9, groundGrass)
      * slopeAllowance
      * (0.8 + moisture * 0.2);
    const grassDensityResponse = Math.sqrt(params.grassDensity);
    const densityExpandedColor = Math.max(darkGrassColor, densityExpansion * 0.48);
    const colorGuidedDistribution = densityExpandedColor * grassCluster
      + (1 - densityExpandedColor) * 0.006;
    const colorGuidedGrass = clamp01(
      grassCoreSuitability
      * colorGuidedDistribution
      * grassDensityResponse
      * 12,
    );
    const randomGrass = clamp01(
      grassCoreSuitability
      * params.grassDensity
      * 0.28,
    );
    const grass = grassDistribution === 'random' ? randomGrass : colorGuidedGrass;
    const flower = clamp01(
      smoothstep(0.14, 0.42, groundGrass)
      * (1 - smoothstep(0.82, 0.98, groundGrass) * 0.72)
      * slopeAllowance
      * params.flowerDensity
      * 0.42,
    ) * vegetationAllowance;
    const layoutSample = layoutMap.sample(x, z);
    const shrublandInfluence = 1 - smoothstep(-2.2, 2.8, layoutSample.shrublandDistance);
    const forestInfluence = 1 - smoothstep(-3.5, 4.5, layoutSample.forestDistance);
    const randomShrubHabitat = smoothstep(0.56, 0.92, groundGrass)
      * THREE.MathUtils.lerp(0.08, 0.16, forestInfluence);
    const shrub = clamp01(
      Math.max(shrublandInfluence, randomShrubHabitat)
      * smoothstep(0.38, 0.82, groundGrass)
      * (0.72 + moisture * 0.28)
      * slopeAllowance,
    ) * vegetationAllowance;
    return {
      height,
      slope,
      hill,
      pathDistance: nearest.distance,
      pathSurface,
      bareGround,
      moisture,
      groundGrass,
      grassColorBoundaryDistance,
      grassTone,
      grass,
      flower,
      shrub,
      pondDistance: distance,
      highlandDistance: highlandDistanceAt(x, z),
    };
  };

  return {
    params,
    grassDistribution,
    coverageModel: 'unified',
    coverageShape: 'coherent',
    coverageResponse: 'single-suitability',
    width,
    depth,
    pondCenter,
    pondRadius,
    waterLevel,
    shoreStyle,
    pathCurve,
    layoutMap,
    sample,
    heightAt,
    pathDistanceAt,
    waterDistanceAt,
  };
};
