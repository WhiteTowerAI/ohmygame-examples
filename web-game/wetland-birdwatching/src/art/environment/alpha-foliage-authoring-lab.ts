import * as THREE from 'three';
import type { EnvironmentLook } from './environment-look';
import { forestEdgePalette } from './forest-edge-palette';
import {
  createFoliageCardRenderer,
  getStableFoliageOutwardRoll,
  type FoliageInstance,
  type FoliageGrowthMode,
  type FoliageRendererVisualMode,
} from '../rendering/foliage-card-renderer';

export type AlphaFoliageUsage = 'bush' | 'branch';
export type AlphaLeafPreset = 'oval' | 'lance' | 'heart' | 'camphor';
export type AlphaFoliageVisualMode = FoliageRendererVisualMode
  | 'distribution'
  | 'raw-sdf-cards';

export type AlphaFoliageLabState = {
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

const createStem = (height: number, radius: number, color: THREE.ColorRepresentation) => {
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.72, radius, height, 7),
    new THREE.MeshToonMaterial({ color }),
  );
  stem.position.y = height * 0.5;
  stem.castShadow = true;
  stem.receiveShadow = true;
  return stem;
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

const createBranchEmitterInstances = (state: AlphaFoliageLabState): FoliageInstance[] => {
  const random = mulberry32(state.seed);
  const count = THREE.MathUtils.clamp(Math.round(state.density), 8, MAX_CLUSTER_COUNT);
  const instances: FoliageInstance[] = [];
  const width = state.clusterWidth * 0.8;
  const height = state.clusterHeight * 0.42;
  const depth = state.clusterDepth * 0.48;
  const offset = new THREE.Vector3(0.2, 1.18, 0);
  for (let index = 0; index < count; index += 1) {
    const along = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const volumeRadius = Math.sqrt(random());
    const surfaceRadius = 0.86 + random() * 0.14;
    const radius = THREE.MathUtils.lerp(volumeRadius, surfaceRadius, state.hollow);
    const taper = Math.sqrt(Math.max(0.14, 1 - along * along * 0.72));
    const radialY = Math.cos(angle) * height * radius * taper;
    const radialZ = Math.sin(angle) * depth * radius * taper;
    const position = new THREE.Vector3(along * width * 0.5, radialY, radialZ).add(offset);
    const surfaceNormal = new THREE.Vector3(
      along * 0.18,
      radialY / Math.max(height * height, 0.001),
      radialZ / Math.max(depth * depth, 0.001),
    ).normalize();
    instances.push({
      position,
      surfaceNormal,
      scale: state.cardScale * (0.78 + random() * 0.4),
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

export const createAlphaFoliageAuthoringLab = (initialLook: EnvironmentLook) => {
  const state = getDefaultAlphaFoliageLabState();

  let sdfTexture = createLeafClusterSdfTexture(state);
  const foliageRenderer = createFoliageCardRenderer(sdfTexture, MAX_CLUSTER_COUNT, {
    shape: { shadow: '#2f6c3c', mid: '#2f6c3c', highlight: '#2f6c3c' },
    elemental: {
      shadow: new THREE.Color(0.003, 0.074, 0.003),
      mid: new THREE.Color(0.06, 0.23, 0),
      highlight: new THREE.Color(0.44, 0.5, 0),
      multiplier: new THREE.Color(0.46, 0.65, 0.3),
    },
    shared: {
      shadow: forestEdgePalette.bush[0],
      mid: forestEdgePalette.bush[1],
      highlight: forestEdgePalette.bush[2],
    },
  });
  foliageRenderer.setMask(sdfTexture, 'sdf');
  const referenceTextureLoader = new THREE.TextureLoader();
  const elementalAlphaTexture = referenceTextureLoader.load(
    new URL('../../assets/textures/leaf-alpha-256.png', import.meta.url).href,
  );
  elementalAlphaTexture.name = 'elemental-reference-leaf-alpha-map';
  elementalAlphaTexture.colorSpace = THREE.NoColorSpace;
  elementalAlphaTexture.minFilter = THREE.LinearMipmapLinearFilter;
  elementalAlphaTexture.magFilter = THREE.LinearFilter;
  elementalAlphaTexture.wrapS = THREE.ClampToEdgeWrapping;
  elementalAlphaTexture.wrapT = THREE.ClampToEdgeWrapping;
  foliageRenderer.setReferenceMask(elementalAlphaTexture);
  foliageRenderer.applyLook(initialLook);

  const rawSdfUniforms = {
    uSdfMap: { value: sdfTexture },
    uBillboardMix: { value: 1 },
  };
  const rawSdfMaterial = new THREE.ShaderMaterial({
    name: 'authoring-lab-toggleable-sdf-card-material',
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: rawSdfUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      attribute float instanceDisplayRoll;
      uniform float uBillboardMix;
      void main() {
        vUv = uv;
        mat4 instanceModelMatrix = modelMatrix;
        #ifdef USE_INSTANCING
          instanceModelMatrix = modelMatrix * instanceMatrix;
        #endif
        vec3 center = instanceModelMatrix[3].xyz;
        float scaleX = length(instanceModelMatrix[0].xyz);
        float scaleY = length(instanceModelMatrix[1].xyz);
        vec3 fixedPosition = (instanceModelMatrix * vec4(position, 1.0)).xyz;
        vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 cameraUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float rollCos = cos(instanceDisplayRoll);
        float rollSin = sin(instanceDisplayRoll);
        vec3 rolledRight = cameraRight * rollCos + cameraUp * rollSin;
        vec3 rolledUp = cameraUp * rollCos - cameraRight * rollSin;
        vec3 billboardPosition = center
          + rolledRight * position.x * scaleX
          + rolledUp * position.y * scaleY;
        vec3 renderedPosition = mix(fixedPosition, billboardPosition, uBillboardMix);
        gl_Position = projectionMatrix * viewMatrix * vec4(renderedPosition, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D uSdfMap;
      void main() {
        float sdf = texture2D(uSdfMap, vUv).r;
        gl_FragColor = vec4(vec3(sdf), 1.0);
      }
    `,
  });
  const rawSdfGeometry = new THREE.PlaneGeometry(1.18, 1, 1, 1);
  const rawSdfCardRolls = new Float32Array(MAX_CLUSTER_COUNT);
  rawSdfGeometry.setAttribute(
    'instanceDisplayRoll',
    new THREE.InstancedBufferAttribute(rawSdfCardRolls, 1),
  );
  const rawSdfCards = new THREE.InstancedMesh(
    rawSdfGeometry,
    rawSdfMaterial,
    MAX_CLUSTER_COUNT,
  );
  rawSdfCards.name = 'authoring-lab-fixed-generated-sdf-cards';
  rawSdfCards.count = 0;
  rawSdfCards.frustumCulled = false;
  rawSdfCards.userData.preserveStylizedMaterial = true;
  rawSdfCards.userData.facingContract = 'toggleable-runtime-billboards-or-fixed-world-planes';
  rawSdfCards.userData.source = 'current generated foliage SDF red channel';
  rawSdfCards.visible = false;

  const bushSkeleton = new THREE.Group();
  bushSkeleton.name = 'authoring-lab-bush-skeleton';
  for (let index = 0; index < 5; index += 1) {
    const stem = createStem(1.05 + index * 0.08, 0.045, forestEdgePalette.tree.bark[0]);
    stem.rotation.z = (index - 2) * 0.16;
    stem.rotation.x = (index % 2 === 0 ? -1 : 1) * 0.08;
    stem.position.x = (index - 2) * 0.045;
    bushSkeleton.add(stem);
  }

  const branchSkeleton = new THREE.Group();
  branchSkeleton.name = 'authoring-lab-tree-branch';
  const branch = createStem(2.3, 0.08, forestEdgePalette.tree.bark[1]);
  branch.rotation.z = Math.PI * 0.5;
  branch.position.set(-0.95, 1.0, 0);
  branchSkeleton.add(branch);
  for (let index = 0; index < 3; index += 1) {
    const twig = createStem(0.75, 0.03, forestEdgePalette.tree.bark[0]);
    twig.position.set(-0.4 + index * 0.55, 0.98, 0);
    twig.rotation.z = (index - 1) * 0.45;
    branchSkeleton.add(twig);
  }

  const emitterDebug = new THREE.Group();
  emitterDebug.name = 'authoring-lab-emitter-distribution';
  const emitterEnvelopeGeometry = new THREE.SphereGeometry(1, 24, 14);
  const emitterEnvelope = new THREE.Mesh(
    emitterEnvelopeGeometry,
    new THREE.MeshBasicMaterial({
      color: '#79d89b',
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  emitterEnvelope.name = 'emitter-envelope-volume';
  const emitterEnvelopeWire = new THREE.Mesh(
    emitterEnvelopeGeometry,
    new THREE.MeshBasicMaterial({
      color: '#b6f0c8',
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      wireframe: true,
    }),
  );
  emitterEnvelopeWire.name = 'emitter-envelope-wireframe';

  const emitterMarkerGeometry = new THREE.SphereGeometry(0.035, 8, 6);
  const emitterMarkers = new THREE.InstancedMesh(
    emitterMarkerGeometry,
    new THREE.MeshBasicMaterial({ color: '#ffb733', depthTest: false }),
    MAX_CLUSTER_COUNT,
  );
  emitterMarkers.name = 'emitter-instance-centers';
  emitterMarkers.frustumCulled = false;

  const emitterNormalPositions = new Float32Array(MAX_CLUSTER_COUNT * 2 * 3);
  const emitterNormalGeometry = new THREE.BufferGeometry();
  emitterNormalGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(emitterNormalPositions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  const emitterNormals = new THREE.LineSegments(
    emitterNormalGeometry,
    new THREE.LineBasicMaterial({
      color: '#185f7a',
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    }),
  );
  emitterNormals.name = 'emitter-surface-normals';
  emitterNormals.frustumCulled = false;
  emitterMarkers.renderOrder = 2;
  emitterNormals.renderOrder = 3;
  emitterDebug.add(emitterEnvelope, emitterEnvelopeWire, emitterMarkers, emitterNormals);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.65, 64),
    new THREE.MeshToonMaterial({ color: forestEdgePalette.surface.grass }),
  );
  ground.name = 'alpha-foliage-authoring-ground';
  ground.rotation.x = -Math.PI * 0.5;
  ground.position.y = -0.025;
  ground.receiveShadow = true;

  const root = new THREE.Group();
  root.name = 'alpha-foliage-authoring-lab-v001';
  root.userData.contract = 'shared-billboard-sdf-foliage-renderer-with-screen-growth-and-dual-emitters';
  root.add(
    ground,
    bushSkeleton,
    branchSkeleton,
    foliageRenderer.mesh,
    emitterDebug,
    rawSdfCards,
  );

  let distributionInstances: FoliageInstance[] = [];
  const previewInstance: FoliageInstance = {
    position: new THREE.Vector3(0, 1.05, 0),
    surfaceNormal: new THREE.Vector3(0, 1, 0),
    scale: 1.85,
    roll: 0,
  };
  const markerTransform = new THREE.Object3D();
  const rawCardTransform = new THREE.Object3D();

  const rebuildMask = () => {
    const previousTexture = sdfTexture;
    sdfTexture = createLeafClusterSdfTexture(state);
    foliageRenderer.setMask(sdfTexture, 'sdf');
    rawSdfUniforms.uSdfMap.value = sdfTexture;
    previousTexture.dispose();
  };

  const rebuildEmitterDebug = () => {
    const envelopeScale = state.usage === 'bush'
      ? new THREE.Vector3(
        state.clusterWidth * 0.5,
        state.clusterHeight * 0.5,
        state.clusterDepth * 0.5,
      )
      : new THREE.Vector3(
        state.clusterWidth * 0.8 * 0.5,
        state.clusterHeight * 0.42,
        state.clusterDepth * 0.48,
      );
    const envelopePosition = state.usage === 'bush'
      ? new THREE.Vector3(0, state.clusterHeight * 0.53, 0)
      : new THREE.Vector3(0.2, 1.18, 0);
    emitterEnvelope.position.copy(envelopePosition);
    emitterEnvelope.scale.copy(envelopeScale);
    emitterEnvelopeWire.position.copy(envelopePosition);
    emitterEnvelopeWire.scale.copy(envelopeScale);

    const normalLength = Math.max(0.12, state.cardScale * 0.42);
    distributionInstances.forEach((instance, index) => {
      markerTransform.position.copy(instance.position);
      markerTransform.scale.setScalar(1);
      markerTransform.updateMatrix();
      emitterMarkers.setMatrixAt(index, markerTransform.matrix);

      const offset = index * 6;
      emitterNormalPositions[offset] = instance.position.x;
      emitterNormalPositions[offset + 1] = instance.position.y;
      emitterNormalPositions[offset + 2] = instance.position.z;
      emitterNormalPositions[offset + 3] = instance.position.x + instance.surfaceNormal.x * normalLength;
      emitterNormalPositions[offset + 4] = instance.position.y + instance.surfaceNormal.y * normalLength;
      emitterNormalPositions[offset + 5] = instance.position.z + instance.surfaceNormal.z * normalLength;
    });
    emitterMarkers.count = distributionInstances.length;
    emitterMarkers.instanceMatrix.needsUpdate = true;
    emitterNormalGeometry.setDrawRange(0, distributionInstances.length * 2);
    emitterNormalGeometry.getAttribute('position').needsUpdate = true;
  };

  const rebuildRawSdfCards = () => {
    distributionInstances.forEach((instance, index) => {
      const jitterRoll = instance.roll * state.directionJitter * Math.PI;
      const outwardRoll = getStableFoliageOutwardRoll(instance.surfaceNormal);
      const roll = state.growthMode === 'random'
        ? instance.roll * Math.PI
        : jitterRoll + (state.growthMode === 'outward'
          ? outwardRoll * state.outwardStrength
          : 0);
      rawCardTransform.position.copy(instance.position);
      rawCardTransform.rotation.set(0, 0, roll);
      rawCardTransform.scale.setScalar(instance.scale);
      rawCardTransform.updateMatrix();
      rawSdfCards.setMatrixAt(index, rawCardTransform.matrix);
      rawSdfCardRolls[index] = roll;
    });
    rawSdfCards.count = distributionInstances.length;
    rawSdfCards.instanceMatrix.needsUpdate = true;
    rawSdfGeometry.getAttribute('instanceDisplayRoll').needsUpdate = true;
    rawSdfCards.userData.cardCount = distributionInstances.length;
    rawSdfCards.userData.usage = state.usage;
  };

  const rebuildDistribution = () => {
    distributionInstances = state.usage === 'bush'
      ? createBushEmitterInstances(state)
      : createBranchEmitterInstances(state);
    rebuildEmitterDebug();
    rebuildRawSdfCards();
    root.userData.usage = state.usage;
    root.userData.cardCount = distributionInstances.length;
    root.userData.instanceContract = 'position-surfaceNormal-scale-roll';
  };

  const applyVisualState = () => {
    const singleCard = state.visualMode === 'shape';
    const distribution = state.visualMode === 'distribution';
    const rawSdfMode = state.visualMode === 'raw-sdf-cards';
    foliageRenderer.mesh.visible = !distribution && !rawSdfMode;
    emitterDebug.visible = distribution;
    rawSdfCards.visible = rawSdfMode;
    rawSdfUniforms.uBillboardMix.value = state.rawCardsBillboard ? 1 : 0;
    bushSkeleton.visible = !singleCard
      && !distribution
      && !rawSdfMode
      && state.usage === 'bush';
    branchSkeleton.visible = !singleCard
      && !distribution
      && !rawSdfMode
      && state.usage === 'branch';
    foliageRenderer.setInstances(singleCard ? [previewInstance] : distributionInstances);
    foliageRenderer.setSdfThickness(state.sdfThickness);
    foliageRenderer.setGrowthOrientation(
      singleCard ? 'upright' : state.growthMode,
      singleCard ? 0 : state.outwardStrength,
      singleCard ? 0 : state.directionJitter,
    );
    rebuildRawSdfCards();
    foliageRenderer.setVisualMode(singleCard ? 'shape' : state.visualMode === 'elemental' ? 'elemental' : 'shared');
    root.userData.visualMode = state.visualMode;
    root.userData.sdfThickness = state.sdfThickness;
    root.userData.growthMode = state.growthMode;
    root.userData.outwardStrength = state.outwardStrength;
    root.userData.directionJitter = state.directionJitter;
    root.userData.rawCardsBillboard = state.rawCardsBillboard;
    root.userData.previewCardCount = singleCard
      ? 1
      : distribution
        ? 0
        : distributionInstances.length;
  };

  rebuildDistribution();
  applyVisualState();
  return {
    root,
    getState: () => ({ ...state }),
    update(next: Partial<AlphaFoliageLabState>) {
      const previousLeafKey = `${state.leafPreset}:${state.leafScale}:${state.leafWidth}:${state.leafTip}:${state.serration}:${state.cardLeafCount}:${state.leafVariation}:${state.leafOverlap}:${state.leafSpread}`;
      const previousDistributionKey = `${state.usage}:${state.clusterWidth}:${state.clusterHeight}:${state.clusterDepth}:${state.density}:${state.hollow}:${state.cardScale}:${state.seed}`;
      Object.assign(state, next);
      const nextLeafKey = `${state.leafPreset}:${state.leafScale}:${state.leafWidth}:${state.leafTip}:${state.serration}:${state.cardLeafCount}:${state.leafVariation}:${state.leafOverlap}:${state.leafSpread}`;
      const nextDistributionKey = `${state.usage}:${state.clusterWidth}:${state.clusterHeight}:${state.clusterDepth}:${state.density}:${state.hollow}:${state.cardScale}:${state.seed}`;
      if (previousLeafKey !== nextLeafKey) rebuildMask();
      if (previousDistributionKey !== nextDistributionKey) rebuildDistribution();
      applyVisualState();
    },
    applyLook(look: EnvironmentLook) {
      foliageRenderer.applyLook(look);
    },
    updateLighting(
      keyLight: THREE.DirectionalLight,
      fillLight: THREE.DirectionalLight,
      rimLight: THREE.DirectionalLight,
    ) {
      foliageRenderer.updateLighting(keyLight, fillLight, rimLight);
    },
  };
};
