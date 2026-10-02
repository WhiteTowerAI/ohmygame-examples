import * as THREE from 'three';
import {
  type DarkCanopyLobeVariant,
} from './dark-canopy-tree-study';

type Vec3Tuple = readonly [number, number, number];
type LegacyFoliageVariant = 'wide' | 'upright' | 'crown' | 'connector';
export type FoliageVariant = LegacyFoliageVariant | `dark-${DarkCanopyLobeVariant}`;

export type TreePerchCapability =
  | 'rest'
  | 'sing'
  | 'transfer'
  | 'small-bird-rest'
  | 'canopy-perch';
type TreePerchLevel = 'low' | 'high';
export type TreePerchExposure = 'open' | 'edge' | 'inner';
export type TreePerchSupport = 'structural' | 'fine';
type TreePerchFacing = 'along' | 'against';
export type TreePerchRouteMode = 'sidestep' | 'hop' | 'short-flight';
export type TreeFoliageVersion = 'solid' | 'emitter';

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
