import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import {
  createDarkCanopyLobeGeometry,
  type DarkCanopyLobeVariant,
} from './dark-canopy-tree-study';
import { createFormalTreeFoliageEmitter } from './formal-tree-foliage-emitter';

type Vec3Tuple = readonly [number, number, number];
type Vec2Tuple = readonly [number, number];
type LegacyFoliageVariant = 'wide' | 'upright' | 'crown' | 'connector';
export type FoliageVariant = LegacyFoliageVariant | `dark-${DarkCanopyLobeVariant}`;

export type TreePerchCapability =
  | 'rest'
  | 'sing'
  | 'transfer'
  | 'small-bird-rest'
  | 'canopy-perch';
export type TreePerchLevel = 'low' | 'high';
export type TreePerchExposure = 'open' | 'edge' | 'inner';
export type TreePerchSupport = 'structural' | 'fine';
export type TreePerchFacing = 'along' | 'against';
export type TreePerchRouteMode = 'sidestep' | 'hop' | 'short-flight';
export type TreeFoliageVersion = 'solid' | 'emitter';

export type BranchPathSpec = {
  id: string;
  points: readonly Vec3Tuple[];
  startRadius: number;
  endRadius: number;
  tone?: number;
  radialSegments?: number;
  tubularSegmentsPerSpan?: number;
};

export type FoliageClusterSpec = {
  id: string;
  variant: FoliageVariant;
  position: Vec3Tuple;
  scale: Vec3Tuple;
  rotation: Vec3Tuple;
  tone: number;
  lobes: 1 | 2;
  seed: number;
};

export type PerchPointSpec = {
  id: string;
  level: TreePerchLevel;
  branchId: string;
  branchT: number;
  offset?: Vec3Tuple;
  facing?: TreePerchFacing;
  exposure: TreePerchExposure;
  clearance: number;
  capabilities: readonly TreePerchCapability[];
  branchLevel?: number;
  support?: TreePerchSupport;
};

export type PerchConnectionSpec = {
  from: string;
  to: string;
  mode: TreePerchRouteMode;
  bidirectional?: boolean;
};

export type TreePerchGenerationSpec = Readonly<{
  seed: number;
  targetCount: number;
  minBranchRadius: number;
  maxSlope: number;
  minSpacing: number;
  samplesPerBranch?: number;
}>;

export type TreeRecipe = {
  id: string;
  barkPalette: readonly THREE.ColorRepresentation[];
  foliagePalette: readonly THREE.ColorRepresentation[];
  trunk: BranchPathSpec;
  branches: readonly BranchPathSpec[];
  foliageClusters: readonly FoliageClusterSpec[];
  perches: readonly PerchPointSpec[];
  perchConnections: readonly PerchConnectionSpec[];
  perchGeneration?: TreePerchGenerationSpec;
  artStyle?: 'layered' | 'dark-canopy-v15';
};

export type TreeCreationOptions = Readonly<{
  perchSeed?: number;
  targetPerchCount?: number;
}>;

export type TreePerchPoint = PerchPointSpec & {
  localPosition: THREE.Vector3;
  localForward: THREE.Vector3;
};

export type TreePerchConnection = Readonly<{
  from: string;
  to: string;
  mode: TreePerchRouteMode;
}>;

export type TreeBranchFrame = Readonly<{
  position: THREE.Vector3;
  forward: THREE.Vector3;
}>;

export type TreeInstance = {
  recipeId: string;
  root: THREE.Group;
  localHeight: number;
  perches: readonly TreePerchPoint[];
  perchConnections: readonly TreePerchConnection[];
  occluders: readonly THREE.Object3D[];
  resolveBranchFrame: (branchId: string, branchT: number) => TreeBranchFrame;
  getFoliageVersion: () => TreeFoliageVersion;
  setFoliageVersion: (version: TreeFoliageVersion) => void;
  updateFoliageLighting: (
    keyLight: THREE.DirectionalLight,
    fillLight: THREE.DirectionalLight,
    rimLight: THREE.DirectionalLight,
  ) => void;
  stats: {
    branchSegments: number;
    foliageClusters: number;
    foliageLobes: number;
    emitterCards: number;
    declaredPerches: number;
    generatedPerches: number;
  };
};

const isFiniteVector = (vector: THREE.Vector3) => (
  Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z)
);

const belongsToTree = (root: THREE.Object3D, object: THREE.Object3D) => {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current === root) return true;
    current = current.parent;
  }
  return false;
};

export const assertTreeInstanceContract = (tree: TreeInstance) => {
  const prefix = `Tree ${tree.recipeId || '<missing-recipe-id>'}`;
  if (!tree.recipeId.trim()) throw new Error('Tree contract requires a non-empty recipeId');
  if (!Number.isFinite(tree.localHeight) || tree.localHeight <= 0) {
    throw new Error(`${prefix} requires a finite positive localHeight`);
  }
  if (tree.perches.length === 0) throw new Error(`${prefix} requires at least one perch`);
  if (tree.stats.declaredPerches + tree.stats.generatedPerches !== tree.perches.length) {
    throw new Error(`${prefix} perch stats do not match its returned perches`);
  }

  const perchIds = new Set<string>();
  tree.perches.forEach((perch) => {
    if (!perch.id.trim() || perchIds.has(perch.id)) {
      throw new Error(`${prefix} contains a missing or duplicate perch id: ${perch.id}`);
    }
    perchIds.add(perch.id);
    if (!perch.branchId.trim() || !Number.isFinite(perch.branchT) || perch.branchT < 0 || perch.branchT > 1) {
      throw new Error(`${prefix} perch ${perch.id} has an invalid branch binding`);
    }
    if (!isFiniteVector(perch.localPosition) || !isFiniteVector(perch.localForward)) {
      throw new Error(`${prefix} perch ${perch.id} has a non-finite transform`);
    }
    if (!Number.isFinite(perch.clearance) || perch.clearance <= 0) {
      throw new Error(`${prefix} perch ${perch.id} requires positive clearance`);
    }
    const frame = tree.resolveBranchFrame(perch.branchId, perch.branchT);
    if (!isFiniteVector(frame.position) || !isFiniteVector(frame.forward) || frame.forward.lengthSq() < 1e-8) {
      throw new Error(`${prefix} perch ${perch.id} resolved an invalid branch frame`);
    }
    const offset = perch.offset ? tupleToVector(perch.offset) : new THREE.Vector3();
    if (!isFiniteVector(offset) || frame.position.clone().add(offset).distanceToSquared(perch.localPosition) > 1e-8) {
      throw new Error(`${prefix} perch ${perch.id} is not bound to its declared branch path`);
    }
    const expectedForward = frame.forward.clone().normalize();
    if (perch.facing === 'against') expectedForward.negate();
    const actualForward = perch.localForward.clone().normalize();
    if (actualForward.lengthSq() < 1e-8 || expectedForward.dot(actualForward) < 0.9999) {
      throw new Error(`${prefix} perch ${perch.id} facing does not match its branch path`);
    }
  });

  const connectionIds = new Set<string>();
  const connectedPerches = new Set<string>();
  tree.perchConnections.forEach((connection) => {
    if (!perchIds.has(connection.from) || !perchIds.has(connection.to)) {
      throw new Error(`${prefix} connection ${connection.from} -> ${connection.to} references an unknown perch`);
    }
    const id = `${connection.from}>${connection.to}`;
    if (connection.from === connection.to || connectionIds.has(id)) {
      throw new Error(`${prefix} contains an invalid or duplicate connection ${id}`);
    }
    connectionIds.add(id);
    connectedPerches.add(connection.from);
    connectedPerches.add(connection.to);
  });
  if (tree.perches.length > 1) {
    tree.perches.forEach((perch) => {
      if (!connectedPerches.has(perch.id)) throw new Error(`${prefix} perch ${perch.id} is isolated`);
    });
  }

  if (tree.occluders.length === 0) throw new Error(`${prefix} requires gameplay occluders`);
  const occluderIds = new Set<number>();
  tree.occluders.forEach((occluder) => {
    const role = occluder.userData.treeRole;
    if (occluderIds.has(occluder.id) || !belongsToTree(tree.root, occluder)) {
      throw new Error(`${prefix} contains a duplicate or foreign occluder`);
    }
    if (role !== 'branch-occluder' && role !== 'foliage-occluder') {
      throw new Error(`${prefix} occluder ${occluder.name || occluder.id} has an unknown role`);
    }
    occluderIds.add(occluder.id);
  });
};

const tupleToVector = ([x, y, z]: Vec3Tuple) => new THREE.Vector3(x, y, z);

const createBranchCurve = (spec: BranchPathSpec) => new THREE.CatmullRomCurve3(
  spec.points.map(tupleToVector),
  false,
  'centripetal',
);

const createTaperedPathGeometry = (spec: BranchPathSpec) => {
  const controlPoints = spec.points.map(tupleToVector);
  const curve = createBranchCurve(spec);
  const tubularSegments = Math.max(5, (controlPoints.length - 1) * (spec.tubularSegmentsPerSpan ?? 4));
  const radialSegments = spec.radialSegments ?? 7;
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring <= tubularSegments; ring += 1) {
    const t = ring / tubularSegments;
    const center = curve.getPointAt(t);
    const radius = THREE.MathUtils.lerp(spec.startRadius, spec.endRadius, Math.pow(t, 0.82));
    const normal = frames.normals[ring];
    const binormal = frames.binormals[ring];
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = side / radialSegments * Math.PI * 2;
      const offset = normal.clone().multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(binormal, Math.sin(angle) * radius);
      positions.push(center.x + offset.x, center.y + offset.y, center.z + offset.z);
    }
  }

  for (let ring = 0; ring < tubularSegments; ring += 1) {
    const ringStart = ring * radialSegments;
    const nextRingStart = (ring + 1) * radialSegments;
    for (let side = 0; side < radialSegments; side += 1) {
      const nextSide = (side + 1) % radialSegments;
      indices.push(
        ringStart + side, nextRingStart + side, nextRingStart + nextSide,
        ringStart + side, nextRingStart + nextSide, ringStart + nextSide,
      );
    }
  }

  const startCenterIndex = positions.length / 3;
  const start = curve.getPointAt(0);
  positions.push(start.x, start.y, start.z);
  const endCenterIndex = positions.length / 3;
  const end = curve.getPointAt(1);
  positions.push(end.x, end.y, end.z);
  const lastRingStart = tubularSegments * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const nextSide = (side + 1) % radialSegments;
    indices.push(startCenterIndex, side, nextSide);
    indices.push(endCenterIndex, lastRingStart + nextSide, lastRingStart + side);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const facetedGeometry = geometry.toNonIndexed();
  facetedGeometry.computeVertexNormals();
  geometry.dispose();
  return facetedGeometry;
};

const addBranchPath = (
  parent: THREE.Object3D,
  spec: BranchPathSpec,
  material: THREE.Material,
) => {
  const mesh = new THREE.Mesh(createTaperedPathGeometry(spec), material);
  mesh.name = spec.id;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.treeRole = 'branch-occluder';
  parent.add(mesh);
  return mesh;
};

type FoliageShape = {
  width: number;
  height: number;
  depth: number;
  innerScale: number;
  center: Vec2Tuple;
  contour: readonly Vec2Tuple[];
};

const foliageShapes: Record<LegacyFoliageVariant, FoliageShape> = {
  wide: {
    width: 1.14,
    height: 0.78,
    depth: 0.43,
    innerScale: 0.62,
    center: [-0.04, 0.02],
    contour: [
      [-1.00, -0.08], [-0.89, 0.24], [-0.60, 0.48], [-0.24, 0.43],
      [0.08, 0.56], [0.45, 0.48], [0.78, 0.28], [1.00, -0.02],
      [0.84, -0.30], [0.48, -0.45], [0.10, -0.39], [-0.26, -0.49],
      [-0.65, -0.40], [-0.94, -0.23],
    ],
  },
  upright: {
    width: 0.70,
    height: 0.78,
    depth: 0.44,
    innerScale: 0.60,
    center: [-0.03, 0.06],
    contour: [
      [-0.57, -0.58], [-0.78, -0.25], [-0.74, 0.12], [-0.58, 0.48],
      [-0.29, 0.78], [0.04, 1.00], [0.34, 0.79], [0.55, 0.48],
      [0.70, 0.10], [0.61, -0.27], [0.36, -0.61], [0.04, -0.78],
      [-0.28, -0.73],
    ],
  },
  crown: {
    width: 0.96,
    height: 0.88,
    depth: 0.52,
    innerScale: 0.64,
    center: [0.02, 0.07],
    contour: [
      [-0.92, -0.27], [-1.00, 0.05], [-0.82, 0.36], [-0.51, 0.54],
      [-0.20, 0.76], [0.10, 0.63], [0.43, 0.74], [0.72, 0.51],
      [0.96, 0.18], [0.90, -0.18], [0.62, -0.42], [0.28, -0.38],
      [-0.05, -0.50], [-0.40, -0.45], [-0.72, -0.38],
    ],
  },
  connector: {
    width: 0.72,
    height: 0.68,
    depth: 0.42,
    innerScale: 0.58,
    center: [0.00, 0.02],
    contour: [
      [-0.88, -0.10], [-0.71, 0.29], [-0.38, 0.54], [0.02, 0.62],
      [0.40, 0.48], [0.77, 0.25], [0.89, -0.10], [0.63, -0.40],
      [0.25, -0.53], [-0.14, -0.48], [-0.55, -0.38],
    ],
  },
};

const createRefinedFoliageGeometry = (variant: LegacyFoliageVariant) => {
  const shape = foliageShapes[variant];
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const count = shape.contour.length;

  const addVertex = (x: number, y: number, z: number, shade: number) => {
    positions.push(x, y, z);
    colors.push(shade, shade, shade);
    return positions.length / 3 - 1;
  };

  const outerFront: number[] = [];
  const innerFront: number[] = [];
  const outerBack: number[] = [];
  const innerBack: number[] = [];
  shape.contour.forEach(([x, y], index) => {
    const edgeVariation = 0.055 + (index % 3) * 0.012;
    const innerVariation = 0.76 + ((index * 5) % 4) * 0.035;
    const px = x * shape.width;
    const py = y * shape.height;
    const innerX = (x * shape.innerScale + shape.center[0]) * shape.width;
    const innerY = (y * shape.innerScale + shape.center[1]) * shape.height;
    const topShade = THREE.MathUtils.clamp(0.93 + y * 0.045, 0.88, 1.00);
    outerFront.push(addVertex(px, py, shape.depth * edgeVariation, topShade));
    innerFront.push(addVertex(innerX, innerY, shape.depth * innerVariation, 0.98));
    outerBack.push(addVertex(px, py, -shape.depth * edgeVariation, 0.84));
    innerBack.push(addVertex(innerX, innerY, -shape.depth * innerVariation * 0.90, 0.88));
  });

  const frontCenter = addVertex(
    shape.center[0] * shape.width,
    shape.center[1] * shape.height,
    shape.depth,
    1.00,
  );
  const backCenter = addVertex(
    shape.center[0] * shape.width,
    shape.center[1] * shape.height,
    -shape.depth * 0.92,
    0.86,
  );

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    indices.push(
      frontCenter, innerFront[next], innerFront[index],
      innerFront[index], outerFront[next], outerFront[index],
      innerFront[index], innerFront[next], outerFront[next],
      backCenter, innerBack[index], innerBack[next],
      innerBack[index], outerBack[index], outerBack[next],
      innerBack[index], outerBack[next], innerBack[next],
      outerFront[index], outerFront[next], outerBack[next],
      outerFront[index], outerBack[next], outerBack[index],
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

const approvedFoliageDimensions: Record<LegacyFoliageVariant, Vec3Tuple> = {
  wide: [1.18, 0.66, 0.72],
  upright: [0.76, 1.08, 0.72],
  crown: [1.00, 0.88, 0.82],
  connector: [0.82, 0.62, 0.68],
};

const createApprovedFoliageGeometry = (variant: LegacyFoliageVariant) => {
  const [width, height, depth] = approvedFoliageDimensions[variant];
  const points = [
    [-1.00, -0.12, 0.02], [-0.78, 0.38, -0.12], [-0.28, 0.66, 0.08],
    [0.34, 0.58, -0.10], [0.88, 0.32, 0.12], [1.00, -0.18, -0.04],
    [0.52, -0.56, 0.10], [-0.18, -0.64, -0.08], [-0.82, -0.42, 0.12],
    [-0.48, 0.18, 0.56], [0.08, 0.36, 0.66], [0.58, 0.10, 0.52],
    [-0.54, -0.14, -0.50], [0.02, 0.24, -0.62], [0.60, -0.18, -0.46],
  ].map(([x, y, z]) => new THREE.Vector3(x * width, y * height, z * depth));
  return new ConvexGeometry(points);
};

export const foliageArtVersion = 'approved-v2' as const;

const createFoliageGeometry = (variant: FoliageVariant) => {
  if (variant.startsWith('dark-')) {
    return createDarkCanopyLobeGeometry(variant.slice(5) as DarkCanopyLobeVariant);
  }
  const legacyVariant = variant as LegacyFoliageVariant;
  if (foliageArtVersion === 'approved-v2') return createApprovedFoliageGeometry(legacyVariant);
  return createRefinedFoliageGeometry(legacyVariant);
};

const buildFoliage = (
  root: THREE.Group,
  clusters: readonly FoliageClusterSpec[],
  palette: readonly THREE.ColorRepresentation[],
) => {
  const geometries = new Map<FoliageVariant, THREE.BufferGeometry>();
  const transformGroups = new Map<string, THREE.Matrix4[]>();

  clusters.forEach((cluster) => {
    const key = `${cluster.variant}:${cluster.tone % palette.length}`;
    const transforms = transformGroups.get(key) ?? [];
    transformGroups.set(key, transforms);
    const position = tupleToVector(cluster.position);
    const rotation = new THREE.Euler(...cluster.rotation);
    const scale = tupleToVector(cluster.scale);
    const primaryQuaternion = new THREE.Quaternion().setFromEuler(rotation);
    transforms.push(new THREE.Matrix4().compose(position, primaryQuaternion, scale));

    if (cluster.lobes === 2) {
      const side = cluster.seed % 2 === 0 ? 1 : -1;
      const secondaryPosition = position.clone().add(new THREE.Vector3(
        side * scale.x * 0.34,
        scale.y * 0.10,
        (cluster.seed % 3 - 1) * scale.z * 0.16,
      ));
      const secondaryRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        rotation.x + 0.05,
        rotation.y + side * 0.24,
        rotation.z - side * 0.08,
      ));
      const secondaryScale = scale.clone().multiply(new THREE.Vector3(0.62, 0.72, 0.72));
      transforms.push(new THREE.Matrix4().compose(secondaryPosition, secondaryRotation, secondaryScale));
    }
  });

  const occluders: THREE.Object3D[] = [];
  transformGroups.forEach((transforms, key) => {
    const [variantName, toneName] = key.split(':') as [FoliageVariant, string];
    const geometry = geometries.get(variantName) ?? createFoliageGeometry(variantName);
    geometries.set(variantName, geometry);
    const color = palette[Number(toneName)];
    const darkCanopy = variantName.startsWith('dark-');
    const material = new THREE.MeshToonMaterial({
      color,
      vertexColors: darkCanopy,
      emissive: darkCanopy ? color : '#000000',
      emissiveIntensity: darkCanopy ? 0.13 : 0,
    });
    const foliage = new THREE.InstancedMesh(geometry, material, transforms.length);
    transforms.forEach((transform, index) => foliage.setMatrixAt(index, transform));
    foliage.instanceMatrix.needsUpdate = true;
    foliage.computeBoundingBox();
    foliage.computeBoundingSphere();
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    foliage.userData.treeRole = 'foliage-occluder';
    root.add(foliage);
    occluders.push(foliage);
  });
  return occluders;
};

const deterministicNoise = (key: string, seed: number) => {
  let hash = seed >>> 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507) >>> 0;
  hash ^= hash >>> 13;
  return (hash >>> 0) / 4294967295;
};

const resolvePerchPoint = (
  perch: PerchPointSpec,
  branchById: ReadonlyMap<string, BranchPathSpec>,
): TreePerchPoint => {
  const branch = branchById.get(perch.branchId);
  if (!branch) throw new Error(`Perch ${perch.id} references unknown branch ${perch.branchId}`);
  if (perch.branchT < 0 || perch.branchT > 1) {
    throw new Error(`Perch ${perch.id} branchT must stay between 0 and 1`);
  }
  const curve = createBranchCurve(branch);
  const localPosition = curve.getPointAt(perch.branchT);
  if (perch.offset) localPosition.add(tupleToVector(perch.offset));
  const localForward = curve.getTangentAt(perch.branchT).normalize();
  if (perch.facing === 'against') localForward.negate();
  return { ...perch, localPosition, localForward };
};

const classifyCanopyExposure = (
  position: THREE.Vector3,
  clusters: readonly FoliageClusterSpec[],
): TreePerchExposure => {
  let closestNormalizedDistance = Number.POSITIVE_INFINITY;
  clusters.forEach((cluster) => {
    const center = tupleToVector(cluster.position);
    const scale = tupleToVector(cluster.scale);
    const offset = position.clone().sub(center);
    const normalizedDistance = Math.sqrt(
      (offset.x / Math.max(scale.x, 0.1)) ** 2
      + (offset.y / Math.max(scale.y, 0.1)) ** 2
      + (offset.z / Math.max(scale.z, 0.1)) ** 2,
    );
    closestNormalizedDistance = Math.min(closestNormalizedDistance, normalizedDistance);
  });
  if (closestNormalizedDistance < 0.72) return 'inner';
  if (closestNormalizedDistance < 1.28) return 'edge';
  return 'open';
};

const generatePerchSpecs = (
  recipe: TreeRecipe,
  branchById: ReadonlyMap<string, BranchPathSpec>,
  localHeight: number,
  options: TreeCreationOptions,
) => {
  const generation = recipe.perchGeneration;
  if (!generation) return [];
  const seed = options.perchSeed ?? generation.seed;
  const targetCount = Math.max(recipe.perches.length, options.targetPerchCount ?? generation.targetCount);
  const requiredCount = targetCount - recipe.perches.length;
  if (requiredCount <= 0) return [];

  const declaredPoints = recipe.perches.map((perch) => resolvePerchPoint(perch, branchById).localPosition);
  const samplesPerBranch = generation.samplesPerBranch ?? 7;
  const candidates: Array<PerchPointSpec & { score: number; localPosition: THREE.Vector3 }> = [];

  recipe.branches.forEach((branch) => {
    const curve = createBranchCurve(branch);
    for (let index = 0; index < samplesPerBranch; index += 1) {
      const baseT = samplesPerBranch === 1 ? 0.55 : 0.24 + index / (samplesPerBranch - 1) * 0.58;
      const noiseKey = `${recipe.id}:${branch.id}:${index}`;
      const branchT = THREE.MathUtils.clamp(
        baseT + (deterministicNoise(noiseKey, seed) - 0.5) * 0.055,
        0.18,
        0.88,
      );
      const tangent = curve.getTangentAt(branchT).normalize();
      const slope = Math.abs(tangent.y);
      const radius = THREE.MathUtils.lerp(
        branch.startRadius,
        branch.endRadius,
        Math.pow(branchT, 0.82),
      );
      if (radius < generation.minBranchRadius || slope > generation.maxSlope) continue;

      const localPosition = curve.getPointAt(branchT).add(new THREE.Vector3(0, radius + 0.025, 0));
      if (localPosition.y < localHeight * 0.27) continue;
      const exposure = classifyCanopyExposure(localPosition, recipe.foliageClusters);
      const clearanceBase = exposure === 'open' ? 0.59 : exposure === 'edge' ? 0.51 : 0.43;
      const clearance = THREE.MathUtils.clamp(clearanceBase + radius * 0.22 - slope * 0.09, 0.34, 0.64);
      const level: TreePerchLevel = localPosition.y < localHeight * 0.61 ? 'low' : 'high';
      const capabilities: TreePerchCapability[] = ['rest', 'transfer'];
      if (level === 'high' && exposure !== 'inner') capabilities.push('sing');
      candidates.push({
        id: `auto-${branch.id}-${index + 1}`,
        level,
        branchId: branch.id,
        branchT,
        offset: [0, radius + 0.025, 0],
        exposure,
        clearance,
        capabilities,
        localPosition,
        score: radius * 2.2 + (1 - slope) * 0.7 + clearance
          + deterministicNoise(`${noiseKey}:score`, seed) * 0.28,
      });
    }
  });

  candidates.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  const selected: typeof candidates = [];
  const branchCounts = new Map<string, number>();
  const canSelect = (candidate: typeof candidates[number], minimumSpacing: number) => {
    if (selected.includes(candidate) || (branchCounts.get(candidate.branchId) ?? 0) >= 2) return false;
    const occupied = [...declaredPoints, ...selected.map((perch) => perch.localPosition)];
    return occupied.every((position) => position.distanceTo(candidate.localPosition) >= minimumSpacing);
  };
  const selectCandidate = (candidate: typeof candidates[number]) => {
    selected.push(candidate);
    branchCounts.set(candidate.branchId, (branchCounts.get(candidate.branchId) ?? 0) + 1);
  };
  const diversityBuckets: ReadonlyArray<readonly [TreePerchLevel, TreePerchExposure]> = [
    ['high', 'inner'], ['high', 'edge'], ['high', 'open'],
    ['low', 'inner'], ['low', 'edge'], ['low', 'open'],
  ];
  diversityBuckets.forEach(([level, exposure]) => {
    if (selected.length >= requiredCount) return;
    const candidate = candidates.find((item) => (
      item.level === level
      && item.exposure === exposure
      && canSelect(item, generation.minSpacing * 0.82)
    ));
    if (candidate) selectCandidate(candidate);
  });
  const trySelect = (minimumSpacing: number) => {
    candidates.forEach((candidate) => {
      if (selected.length >= requiredCount || !canSelect(candidate, minimumSpacing)) return;
      selectCandidate(candidate);
    });
  };
  trySelect(generation.minSpacing);
  if (selected.length < requiredCount) trySelect(generation.minSpacing * 0.68);

  return selected.slice(0, requiredCount).map<PerchPointSpec>(({ score: _score, localPosition: _position, ...perch }) => perch);
};

export const createModularTree = (
  recipe: TreeRecipe,
  options: TreeCreationOptions = {},
): TreeInstance => {
  const root = new THREE.Group();
  root.name = recipe.id;
  const occluders: THREE.Object3D[] = [];
  const barkMaterials = recipe.barkPalette.map((color) => new THREE.MeshToonMaterial({
    color,
    emissive: recipe.artStyle === 'dark-canopy-v15' ? color : '#000000',
    emissiveIntensity: recipe.artStyle === 'dark-canopy-v15' ? 0.10 : 0,
  }));

  [recipe.trunk, ...recipe.branches].forEach((branch) => {
    const material = barkMaterials[(branch.tone ?? 0) % barkMaterials.length];
    occluders.push(addBranchPath(root, branch, material));
  });
  const solidFoliage = buildFoliage(root, recipe.foliageClusters, recipe.foliagePalette);
  occluders.push(...solidFoliage);
  const foliageEmitter = createFormalTreeFoliageEmitter(recipe.foliageClusters);
  root.add(foliageEmitter.mesh);
  let foliageVersion: TreeFoliageVersion = 'solid';
  const setFoliageVersion = (version: TreeFoliageVersion) => {
    foliageVersion = version;
    solidFoliage.forEach((foliage) => { foliage.visible = version === 'solid'; });
    foliageEmitter.mesh.visible = version === 'emitter';
    root.userData.foliageVersion = version;
  };
  setFoliageVersion('solid');

  const branchById = new Map(
    [recipe.trunk, ...recipe.branches].map((branch) => [branch.id, branch] as const),
  );
  const branchHeight = [recipe.trunk, ...recipe.branches]
    .flatMap((branch) => branch.points.map((point) => point[1]))
    .reduce((maximum, height) => Math.max(maximum, height), 0);
  const foliageHeight = recipe.foliageClusters.reduce((maximum, cluster) => (
    Math.max(maximum, cluster.position[1] + cluster.scale[1])
  ), 0);
  const localHeight = Math.max(branchHeight, foliageHeight);
  const generatedPerchSpecs = generatePerchSpecs(recipe, branchById, localHeight, options);
  const perches = [...recipe.perches, ...generatedPerchSpecs]
    .map<TreePerchPoint>((perch) => resolvePerchPoint(perch, branchById));
  const perchIds = new Set(perches.map((perch) => perch.id));
  const perchConnections = recipe.perchConnections.flatMap<TreePerchConnection>((connection) => {
    if (!perchIds.has(connection.from) || !perchIds.has(connection.to)) {
      throw new Error(`Perch connection ${connection.from} -> ${connection.to} references an unknown perch`);
    }
    const routes: TreePerchConnection[] = [{
      from: connection.from,
      to: connection.to,
      mode: connection.mode,
    }];
    if (connection.bidirectional) {
      routes.push({ from: connection.to, to: connection.from, mode: connection.mode });
    }
    return routes;
  });
  const connectionKeys = new Set(perchConnections.map((connection) => `${connection.from}>${connection.to}`));
  const addGeneratedConnection = (from: TreePerchPoint, to: TreePerchPoint) => {
    const distance = from.localPosition.distanceTo(to.localPosition);
    const mode: TreePerchRouteMode = from.branchId === to.branchId && distance <= 1.05
      ? 'sidestep'
      : distance <= 1.45 ? 'hop' : 'short-flight';
    [[from.id, to.id], [to.id, from.id]].forEach(([fromId, toId]) => {
      const key = `${fromId}>${toId}`;
      if (connectionKeys.has(key)) return;
      connectionKeys.add(key);
      perchConnections.push({ from: fromId, to: toId, mode });
    });
  };
  for (let index = recipe.perches.length; index < perches.length; index += 1) {
    const perch = perches[index];
    const nearest = perches.slice(0, index).sort((left, right) => (
      perch.localPosition.distanceToSquared(left.localPosition)
      - perch.localPosition.distanceToSquared(right.localPosition)
    ))[0];
    if (nearest) addGeneratedConnection(perch, nearest);
  }
  const pathSegments = [recipe.trunk, ...recipe.branches]
    .reduce((total, branch) => total + branch.points.length - 1, 0);

  root.userData.treeRecipeId = recipe.id;
  root.userData.perchSeed = options.perchSeed ?? recipe.perchGeneration?.seed;
  const tree: TreeInstance = {
    recipeId: recipe.id,
    root,
    localHeight,
    perches,
    perchConnections,
    occluders,
    resolveBranchFrame(branchId, branchT) {
      const branch = branchById.get(branchId);
      if (!branch) throw new Error(`Tree ${recipe.id} references unknown branch ${branchId}`);
      if (!Number.isFinite(branchT) || branchT < 0 || branchT > 1) {
        throw new Error(`Tree ${recipe.id} branchT must stay between 0 and 1`);
      }
      const curve = createBranchCurve(branch);
      return {
        position: curve.getPointAt(branchT),
        forward: curve.getTangentAt(branchT).normalize(),
      };
    },
    getFoliageVersion: () => foliageVersion,
    setFoliageVersion,
    updateFoliageLighting: foliageEmitter.updateLighting,
    stats: {
      branchSegments: pathSegments,
      foliageClusters: recipe.foliageClusters.length,
      foliageLobes: recipe.foliageClusters.reduce((total, cluster) => total + cluster.lobes, 0),
      emitterCards: foliageEmitter.cardCount,
      declaredPerches: recipe.perches.length,
      generatedPerches: generatedPerchSpecs.length,
    },
  };
  assertTreeInstanceContract(tree);
  return tree;
};

export const getWorldPerchPosition = (
  tree: TreeInstance,
  perchId: string,
  target = new THREE.Vector3(),
) => {
  const perch = tree.perches.find((candidate) => candidate.id === perchId);
  if (!perch) throw new Error(`Unknown perch: ${perchId}`);
  tree.root.updateWorldMatrix(true, false);
  return target.copy(perch.localPosition).applyMatrix4(tree.root.matrixWorld);
};

export const getWorldPerchForward = (
  tree: TreeInstance,
  perchId: string,
  target = new THREE.Vector3(),
) => {
  const perch = tree.perches.find((candidate) => candidate.id === perchId);
  if (!perch) throw new Error(`Unknown perch: ${perchId}`);
  tree.root.updateWorldMatrix(true, false);
  return target.copy(perch.localForward).transformDirection(tree.root.matrixWorld).normalize();
};

export const layeredCanopyTreeRecipe: TreeRecipe = {
  id: 'layered-canopy-tree-v001',
  barkPalette: ['#574337', '#44362f', '#342b28'],
  foliagePalette: ['#486542', '#56744a', '#38563b', '#68804f'],
  trunk: {
    id: 'trunk',
    points: [[0, 0, 0], [0.04, 0.9, 0], [-0.03, 1.75, 0.02], [0.04, 2.55, 0.03], [0.15, 3.45, 0.08], [0.08, 4.60, 0.12]],
    startRadius: 0.40,
    endRadius: 0.055,
  },
  branches: [
    { id: 'root-left', points: [[0, 0.20, 0], [-0.26, 0.08, 0.08], [-0.72, 0.02, 0.18]], startRadius: 0.17, endRadius: 0.025, tone: 1 },
    { id: 'root-right', points: [[0, 0.18, 0], [0.28, 0.07, 0.04], [0.66, 0.02, -0.14]], startRadius: 0.16, endRadius: 0.022, tone: 1 },
    { id: 'low-perch-branch', points: [[0.00, 1.38, 0.02], [0.48, 1.62, 0.22], [0.96, 1.82, 0.36], [1.48, 2.02, 0.44]], startRadius: 0.15, endRadius: 0.035, tone: 1 },
    { id: 'left-main', points: [[0.00, 2.10, 0.02], [-0.45, 2.78, 0.12], [-1.12, 3.45, 0.28], [-1.92, 4.00, 0.42]], startRadius: 0.23, endRadius: 0.050 },
    { id: 'left-high', points: [[0.05, 2.55, 0.04], [-0.32, 3.28, -0.02], [-0.68, 4.08, 0.02], [-0.70, 4.55, 0.08]], startRadius: 0.18, endRadius: 0.035, tone: 1 },
    { id: 'left-edge', points: [[-0.98, 3.34, 0.25], [-1.52, 3.48, 0.40], [-2.22, 3.42, 0.54]], startRadius: 0.105, endRadius: 0.028, tone: 2 },
    { id: 'right-main', points: [[0.02, 1.98, 0.02], [0.48, 2.58, -0.06], [1.08, 3.28, -0.16], [1.86, 3.88, -0.28]], startRadius: 0.22, endRadius: 0.050 },
    { id: 'right-high', points: [[0.12, 3.00, 0.07], [0.58, 3.65, 0.13], [1.05, 4.22, 0.06], [1.20, 4.58, -0.02]], startRadius: 0.14, endRadius: 0.032, tone: 1 },
    { id: 'right-edge', points: [[0.86, 3.10, -0.12], [1.42, 3.13, 0.00], [2.12, 3.38, 0.14]], startRadius: 0.10, endRadius: 0.026, tone: 2 },
    { id: 'crown-left', points: [[0.12, 3.55, 0.09], [-0.24, 4.06, 0.32], [-0.42, 4.42, 0.38]], startRadius: 0.075, endRadius: 0.020, tone: 2 },
    { id: 'crown-right', points: [[0.12, 3.70, 0.10], [0.44, 4.18, 0.30], [0.72, 4.45, 0.34]], startRadius: 0.070, endRadius: 0.020, tone: 2 },
  ],
  foliageClusters: [
    { id: 'left-lower', variant: 'wide', position: [-1.82, 3.48, 0.44], scale: [0.86, 0.58, 0.68], rotation: [0.04, -0.22, -0.05], tone: 1, lobes: 2, seed: 211 },
    { id: 'left-middle', variant: 'wide', position: [-1.28, 3.96, 0.26], scale: [0.92, 0.62, 0.70], rotation: [-0.02, 0.18, 0.08], tone: 0, lobes: 2, seed: 307 },
    { id: 'left-upper', variant: 'crown', position: [-0.72, 4.50, 0.08], scale: [0.78, 0.70, 0.70], rotation: [0.04, -0.18, -0.06], tone: 1, lobes: 2, seed: 401 },
    { id: 'crown-top', variant: 'upright', position: [0.10, 4.64, 0.12], scale: [0.72, 0.74, 0.70], rotation: [-0.03, 0.14, 0.04], tone: 2, lobes: 2, seed: 503 },
    { id: 'crown-center', variant: 'wide', position: [0.04, 4.12, -0.30], scale: [0.88, 0.54, 0.66], rotation: [0.02, -0.12, 0.02], tone: 0, lobes: 1, seed: 601 },
    { id: 'right-upper', variant: 'crown', position: [0.92, 4.42, 0.20], scale: [0.82, 0.68, 0.70], rotation: [-0.04, 0.22, 0.06], tone: 1, lobes: 2, seed: 701 },
    { id: 'right-middle', variant: 'wide', position: [1.52, 3.94, -0.20], scale: [0.94, 0.60, 0.72], rotation: [0.03, -0.18, -0.05], tone: 0, lobes: 2, seed: 809 },
    { id: 'right-edge', variant: 'wide', position: [2.05, 3.42, 0.12], scale: [0.84, 0.54, 0.66], rotation: [-0.02, 0.24, 0.07], tone: 1, lobes: 2, seed: 907 },
    { id: 'inner-left', variant: 'connector', position: [-0.92, 3.46, 0.10], scale: [0.60, 0.48, 0.54], rotation: [0.04, 0.16, -0.04], tone: 3, lobes: 1, seed: 1009 },
    { id: 'perch-screen', variant: 'connector', position: [1.18, 3.28, 0.24], scale: [0.48, 0.40, 0.46], rotation: [-0.02, -0.24, 0.05], tone: 3, lobes: 1, seed: 1103 },
  ],
  perches: [
    {
      id: 'low-rest', level: 'low', branchId: 'low-perch-branch', branchT: 0.6365,
      exposure: 'open', clearance: 0.34, capabilities: ['rest', 'transfer'],
    },
    {
      id: 'high-song', level: 'high', branchId: 'right-main', branchT: 0.5976,
      offset: [0, 0, 0.01], exposure: 'edge', clearance: 0.44,
      capabilities: ['rest', 'sing', 'transfer'],
    },
  ],
  perchConnections: [
    { from: 'low-rest', to: 'high-song', mode: 'short-flight', bidirectional: true },
  ],
};

export const shelteredCanopyTreeRecipe: TreeRecipe = {
  ...layeredCanopyTreeRecipe,
  id: 'sheltered-canopy-tree-v001',
  barkPalette: ['#665044', '#4d3d35', '#392f2c'],
  foliagePalette: ['#3f603f', '#4e7048', '#304f39', '#607c50'],
  foliageClusters: layeredCanopyTreeRecipe.foliageClusters.map((cluster, index) => ({
    ...cluster,
    id: `sheltered-${cluster.id}`,
    position: [
      cluster.position[0] * (index % 2 === 0 ? 1.12 : 0.94),
      cluster.position[1] + (index < 4 ? 0.16 : 0.04),
      cluster.position[2] + ((index % 3) - 1) * 0.22,
    ],
    scale: [cluster.scale[0] * 1.08, cluster.scale[1] * 1.06, cluster.scale[2] * 1.18],
    rotation: [cluster.rotation[0], cluster.rotation[1] + (index % 2 ? 0.16 : -0.12), cluster.rotation[2]],
  })),
  perches: layeredCanopyTreeRecipe.perches.map((perch) => ({
    ...perch,
    exposure: perch.level === 'high' ? 'inner' : 'edge',
    clearance: perch.clearance + 0.06,
  })),
};
