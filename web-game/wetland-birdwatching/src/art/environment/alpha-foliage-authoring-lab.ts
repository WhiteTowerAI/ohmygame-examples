import * as THREE from 'three';
import {
  type FoliageInstance,
  type FoliageGrowthMode,
  type FoliageRendererVisualMode,
} from '../rendering/foliage-card-renderer';

type AlphaFoliageUsage = 'bush' | 'branch';
export type AlphaLeafPreset = 'oval' | 'lance' | 'heart' | 'camphor';
type AlphaFoliageVisualMode = FoliageRendererVisualMode
  | 'distribution'
  | 'raw-sdf-cards';

type AlphaFoliageLabState = {
  usage: AlphaFoliageUsage;
  leafPreset: AlphaLeafPreset;
  leafScale: number;
  leafWidth: number;
  leafTip: number;
  serration: number;
  cardLeafCount: number;
  leafVariation: number;
  leafOverlap: number;
  leafSpread: number;
  sdfThickness: number;
  clusterWidth: number;
  clusterHeight: number;
  clusterDepth: number;
  density: number;
  hollow: number;
  cardScale: number;
  seed: number;
  growthMode: FoliageGrowthMode;
  outwardStrength: number;
  directionJitter: number;
  rawCardsBillboard: boolean;
  visualMode: AlphaFoliageVisualMode;
};

const MAX_CLUSTER_COUNT = 160;
const MASK_SIZE = 256;
const SDF_RANGE = 24;

const mulberry32 = (seed: number) => {
  let randomState = seed >>> 0;
  return () => {
    randomState += 0x6d2b79f5;
    let value = randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const drawLeaf = (
  context: CanvasRenderingContext2D,
  state: AlphaFoliageLabState,
  x: number,
  y: number,
  length: number,
  rotation: number,
  widthScale: number,
  tipScale: number,
  bend: number,
  asymmetry: number,
) => {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  const steps = 32;
  const outline = (t: number) => {
    const base = Math.sin(Math.PI * t);
    const presetWidth = state.leafPreset === 'lance'
      ? base ** 1.8
      : state.leafPreset === 'heart'
        ? Math.min(1, base ** 0.68 + Math.exp(-(((t - 0.2) / 0.17) ** 2)) * 0.16)
        : state.leafPreset === 'camphor'
          ? base ** 0.78 * THREE.MathUtils.lerp(1.16, 0.84, t)
          : base ** 1.04;
    const pointedTip = 1 - THREE.MathUtils.clamp(state.leafTip * tipScale, 0, 1.5) * 0.32 * t ** 2.25;
    const teeth = 1 + state.serration * 0.09 * Math.sin(t * Math.PI * 18);
    return presetWidth * pointedTip * teeth * state.leafWidth * widthScale * length * 0.29;
  };
  const centerOffset = (t: number) => bend * length * Math.sin(Math.PI * t) * 0.18;
  context.beginPath();
  context.moveTo(0, length * 0.5);
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    context.lineTo(
      centerOffset(t) - outline(t) * (1 + asymmetry),
      length * (0.5 - t),
    );
  }
  for (let step = steps; step >= 0; step -= 1) {
    const t = step / steps;
    context.lineTo(
      centerOffset(t) + outline(t) * (1 - asymmetry),
      length * (0.5 - t),
    );
  }
  context.closePath();
  context.fill();
  context.restore();
};

const drawWillowLeafSpray = (
  context: CanvasRenderingContext2D,
  state: AlphaFoliageLabState,
  random: () => number,
  leafCount: number,
) => {
  const spineX = (progress: number) => 124
    + progress * 8
    + Math.sin(progress * Math.PI * 1.35 + 0.2) * 5;
  const spreadScale = state.leafSpread
    * THREE.MathUtils.lerp(0.72, 0.50, state.leafOverlap);

  context.save();
  context.strokeStyle = '#ffffff';
  context.lineWidth = THREE.MathUtils.clamp(2.2 + state.leafScale * 0.3, 2.4, 4.2);
  context.lineCap = 'round';
  context.beginPath();
  const firstLeafProgress = 0.55 / (leafCount + 0.1);
  const lastLeafProgress = (leafCount - 0.45) / (leafCount + 0.1);
  const spineStartY = THREE.MathUtils.lerp(30, 178, firstLeafProgress) + 2;
  const spineEndY = Math.min(
    222,
    THREE.MathUtils.lerp(30, 178, lastLeafProgress) + 23 * state.leafScale * 0.44,
  );
  for (let step = 0; step <= 24; step += 1) {
    const progress = step / 24;
    const y = THREE.MathUtils.lerp(spineStartY, spineEndY, progress);
    const attachmentProgress = THREE.MathUtils.clamp((y - 30) / (178 - 30), 0, 1);
    const x = spineX(attachmentProgress);
    if (step === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
  context.beginPath();
  context.ellipse(
    spineX(firstLeafProgress),
    spineStartY + 1.5,
    5.2,
    4.2,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();

  for (let index = 0; index < leafCount; index += 1) {
    const topPair = index < 2;
    const progress = topPair
      ? firstLeafProgress + index * 0.025
      : (index + 0.55) / (leafCount + 0.1);
    const centerLeaf = index >= Math.ceil(leafCount * 0.5);
    const side = centerLeaf ? 0 : index % 2 === 0 ? 1 : -1;
    const lengthVariation = (random() - 0.5) * state.leafVariation * 0.28;
    const length = 23 * state.leafScale
      * (topPair ? 0.62 : centerLeaf ? 0.94 : 0.84)
      * (1 + lengthVariation);
    const outwardLean = side === 0
      ? (random() - 0.5) * 0.08
      : topPair
        ? -side * (0.34 + random() * 0.10)
        : -side * (0.14 + spreadScale * 0.14 + random() * 0.10);
    const rotation = outwardLean
      + Math.cos(progress * Math.PI * 1.35 + 0.2) * 0.05
      + (random() - 0.5) * state.leafVariation * 0.18;
    const attachmentX = spineX(progress) + (random() - 0.5) * 2.5;
    const attachmentY = THREE.MathUtils.lerp(30, 178, progress)
      + (random() - 0.5) * 5;
    const x = attachmentX - Math.sin(rotation) * length * 0.46;
    const y = attachmentY + Math.cos(rotation) * length * 0.46;
    const widthScale = (topPair ? 1.18 : 0.88)
      + (random() - 0.5) * state.leafVariation * 0.30;
    const tipScale = 1 + (random() - 0.5) * state.leafVariation * 0.36;
    const bend = side * (0.20 + random() * 0.24)
      + (random() - 0.5) * state.leafVariation * 0.28;
    const asymmetry = (random() - 0.5) * state.leafVariation * 0.38;
    drawLeaf(
      context,
      state,
      x,
      y,
      length,
      rotation,
      widthScale,
      tipScale,
      bend,
      asymmetry,
    );
  }
};

const drawLeafClusterMask = (state: AlphaFoliageLabState) => {
  const canvas = document.createElement('canvas');
  canvas.width = MASK_SIZE;
  canvas.height = MASK_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Alpha foliage lab requires Canvas 2D');
  context.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
  context.fillStyle = '#ffffff';
  const random = mulberry32(0x4f1b);
  const leafCount = THREE.MathUtils.clamp(Math.round(state.cardLeafCount), 8, 48);
  if (state.leafPreset === 'lance') {
    drawWillowLeafSpray(context, state, random, leafCount);
    return context.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
  }
  const lobes = [
    { center: [126, 132], radius: [68, 76], weight: 0.46, phase: 0.3 },
    { center: [80, 108], radius: [46, 42], weight: 0.16, phase: 1.7 },
    { center: [180, 126], radius: [48, 40], weight: 0.15, phase: 3.1 },
    { center: [130, 65], radius: [38, 44], weight: 0.12, phase: 4.4 },
    { center: [140, 191], radius: [42, 34], weight: 0.11, phase: 5.6 },
  ] as const;
  const spreadScale = state.leafSpread
    * THREE.MathUtils.lerp(1.08, 0.78, state.leafOverlap);
  const cumulativeWeights = lobes.reduce<number[]>((weights, lobe) => {
    weights.push((weights.at(-1) ?? 0) + lobe.weight);
    return weights;
  }, []);
  for (let index = 0; index < leafCount; index += 1) {
    const lobeRoll = random();
    const lobeIndex = cumulativeWeights.findIndex((weight) => lobeRoll <= weight);
    const lobe = lobes[Math.max(0, lobeIndex)];
    const angle = random() * Math.PI * 2;
    const radialDistance = Math.sqrt(random());
    const irregularity = Math.sin(angle * 3 + lobe.phase) * 0.12 * radialDistance;
    const warpedRadius = THREE.MathUtils.clamp(radialDistance + irregularity, 0, 1.08);
    const rawX = lobe.center[0] + Math.cos(angle) * lobe.radius[0] * warpedRadius;
    const rawY = lobe.center[1] + Math.sin(angle) * lobe.radius[1] * warpedRadius;
    const normalizedRadius = THREE.MathUtils.clamp(
      Math.hypot((rawX - 128) / 102, (rawY - 128) / 108),
      0,
      1,
    );
    const edgeProgress = THREE.MathUtils.clamp((normalizedRadius - 0.72) / 0.28, 0, 1);
    const edgeBlend = edgeProgress * edgeProgress * (3 - 2 * edgeProgress);
    const edgeTaper = THREE.MathUtils.lerp(1, 0.68, edgeBlend);
    const lengthVariation = (random() - 0.5) * state.leafVariation * 0.34;
    const length = 23 * state.leafScale * (
      0.78
      + Math.sin(normalizedRadius * Math.PI) * 0.12
      + lengthVariation
    ) * edgeTaper;
    const margin = length * 0.53;
    const x = THREE.MathUtils.clamp(128 + (rawX - 128) * spreadScale, margin, MASK_SIZE - margin);
    const y = THREE.MathUtils.clamp(128 + (rawY - 128) * spreadScale, margin, MASK_SIZE - margin);
    const rotation = random() * Math.PI * 2
      + (random() - 0.5) * state.leafVariation * 0.65;
    const widthScale = 1 + (random() - 0.5) * state.leafVariation * 0.55;
    const tipScale = 1 + (random() - 0.5) * state.leafVariation * 0.5;
    const bend = (random() - 0.5) * state.leafVariation * 1.55;
    const asymmetry = (random() - 0.5) * state.leafVariation * 0.5;
    drawLeaf(
      context,
      state,
      x,
      y,
      length,
      rotation,
      widthScale,
      tipScale,
      bend,
      asymmetry,
    );
  }
  return context.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
};

const distanceToPixels = (inside: Uint8Array, targetInside: boolean) => {
  const size = MASK_SIZE;
  const distance = new Float32Array(size * size);
  const diagonal = Math.SQRT2;
  for (let index = 0; index < distance.length; index += 1) {
    distance[index] = Boolean(inside[index]) === targetInside ? 0 : 1e6;
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      let value = distance[index];
      if (x > 0) value = Math.min(value, distance[index - 1] + 1);
      if (y > 0) value = Math.min(value, distance[index - size] + 1);
      if (x > 0 && y > 0) value = Math.min(value, distance[index - size - 1] + diagonal);
      if (x + 1 < size && y > 0) value = Math.min(value, distance[index - size + 1] + diagonal);
      distance[index] = value;
    }
  }
  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = size - 1; x >= 0; x -= 1) {
      const index = y * size + x;
      let value = distance[index];
      if (x + 1 < size) value = Math.min(value, distance[index + 1] + 1);
      if (y + 1 < size) value = Math.min(value, distance[index + size] + 1);
      if (x + 1 < size && y + 1 < size) value = Math.min(value, distance[index + size + 1] + diagonal);
      if (x > 0 && y + 1 < size) value = Math.min(value, distance[index + size - 1] + diagonal);
      distance[index] = value;
    }
  }
  return distance;
};

export const createLeafClusterSdfTexture = (state: AlphaFoliageLabState) => {
  const mask = drawLeafClusterMask(state);
  const inside = new Uint8Array(MASK_SIZE * MASK_SIZE);
  for (let index = 0; index < inside.length; index += 1) {
    inside[index] = mask.data[index * 4 + 3] > 127 ? 1 : 0;
  }
  const distanceToInside = distanceToPixels(inside, true);
  const distanceToOutside = distanceToPixels(inside, false);
  const data = new Uint8Array(MASK_SIZE * MASK_SIZE * 4);
  for (let index = 0; index < inside.length; index += 1) {
    const signedDistance = distanceToOutside[index] - distanceToInside[index];
    const encoded = Math.round(THREE.MathUtils.clamp(0.5 + signedDistance / (SDF_RANGE * 2), 0, 1) * 255);
    data[index * 4] = encoded;
    data[index * 4 + 1] = encoded;
    data[index * 4 + 2] = encoded;
    data[index * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, MASK_SIZE, MASK_SIZE, THREE.RGBAFormat);
  texture.name = `generated-leaf-cluster-sdf-${state.leafPreset}`;
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.flipY = true;
  texture.needsUpdate = true;
  return texture;
};

const randomSphereDirection = (random: () => number) => {
  const y = random() * 2 - 1;
  const angle = random() * Math.PI * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
};

export const createBushEmitterInstances = (state: AlphaFoliageLabState): FoliageInstance[] => {
  const random = mulberry32(state.seed);
  const count = THREE.MathUtils.clamp(Math.round(state.density), 8, MAX_CLUSTER_COUNT);
  const instances: FoliageInstance[] = [];
  const radii = new THREE.Vector3(
    state.clusterWidth * 0.5,
    state.clusterHeight * 0.5,
    state.clusterDepth * 0.5,
  );
  const offset = new THREE.Vector3(0, state.clusterHeight * 0.53, 0);
  for (let index = 0; index < count; index += 1) {
    const direction = randomSphereDirection(random);
    const volumeRadius = Math.cbrt(random());
    const surfaceRadius = 0.88 + random() * 0.12;
    const radius = THREE.MathUtils.lerp(volumeRadius, surfaceRadius, state.hollow);
    const position = direction.clone().multiply(radii).multiplyScalar(radius).add(offset);
    const surfaceNormal = new THREE.Vector3(
      direction.x / Math.max(radii.x, 0.001),
      direction.y / Math.max(radii.y, 0.001),
      direction.z / Math.max(radii.z, 0.001),
    ).normalize();
    instances.push({
      position,
      surfaceNormal,
      scale: state.cardScale * (0.82 + random() * 0.36),
      roll: random() * 2 - 1,
    });
  }
  return instances;
};

export const getDefaultAlphaFoliageLabState = (): AlphaFoliageLabState => ({
    usage: 'bush',
    leafPreset: 'oval',
    leafScale: 1.85,
    leafWidth: 0.72,
    leafTip: 0.72,
    serration: 0.08,
    cardLeafCount: 40,
    leafVariation: 0.72,
    leafOverlap: 0.18,
    leafSpread: 0.82,
    sdfThickness: 0,
    clusterWidth: 1.75,
    clusterHeight: 1.55,
    clusterDepth: 1.35,
    density: 48,
    hollow: 0.42,
    cardScale: 1.25,
    seed: 1507,
    growthMode: 'outward',
    outwardStrength: 0.48,
    directionJitter: 0.34,
    rawCardsBillboard: true,
    visualMode: 'shared',
});

export const getCamphorAlphaFoliageState = (): AlphaFoliageLabState => ({
  ...getDefaultAlphaFoliageLabState(),
  usage: 'branch',
  leafPreset: 'camphor',
  leafScale: 1.87,
  leafWidth: 0.94,
  leafTip: 0.52,
  serration: 0.02,
  cardLeafCount: 17,
  leafVariation: 0.38,
  leafOverlap: 0.70,
  leafSpread: 0.58,
  growthMode: 'outward',
  outwardStrength: 0.62,
  directionJitter: 0.22,
});
