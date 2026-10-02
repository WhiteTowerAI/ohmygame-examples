import * as THREE from 'three';
import type {
  HabitatCapability,
  HabitatKind,
  HabitatLevel,
  HabitatNode,
  SpatialPoint,
} from '../birds/contracts';
import {
  assertTreeInstanceContract,
  getWorldPerchForward,
  getWorldPerchPosition,
  type TreeInstance,
  type TreePerchExposure,
  type TreePerchRouteMode,
  type TreePerchSupport,
} from '../../art/trees/modular-tree';

type HabitatMovementMode = TreePerchRouteMode | 'tree-flight';

export type RegisteredTreePerch = HabitatNode & Readonly<{
  kind: 'perch';
  treeInstanceId: string;
  perchId: string;
  branchId: string;
  branchLevel?: number;
  perchSupport: TreePerchSupport;
  structuralExposure: TreePerchExposure;
  treeHeight: number;
}>;

export type RegisteredHabitatNode = HabitatNode | RegisteredTreePerch;

type HabitatConnection = Readonly<{
  from: string;
  to: string;
  mode: HabitatMovementMode;
  distance: number;
}>;

type HabitatQuery = Readonly<{
  kind?: HabitatKind;
  level?: HabitatLevel;
  capability?: HabitatCapability;
  excludeNodeId?: string;
  origin?: SpatialPoint;
  maxDistance?: number;
  avoidPosition?: SpatialPoint;
}>;

type RelocationQuery = HabitatQuery & Readonly<{
  currentNodeId?: string;
  observerPosition: SpatialPoint;
  preferHigher?: boolean;
  preferCover?: boolean;
  preferDifferentTree?: boolean;
  preferSameTree?: boolean;
  minHeightGain?: number;
  minClearance?: number;
  minObserverDistance?: number;
  minObserverDistanceGain?: number;
  maxArrivalPressure?: number;
  minPressureReduction?: number;
  currentObserverPressure?: number;
  observerPressureRadius?: number;
  excludeNodeIds?: readonly string[];
  seed: number;
}>;

export type HabitatCandidateScore = Readonly<{
  node: RegisteredHabitatNode;
  score: number;
  observerDistance: number;
  heightGain: number;
  visualTransmission: number;
  arrivalPressure: number;
  clearance: number;
  crossTree: boolean;
  randomTieBreak: number;
}>;

type RegisteredTree = {
  providerId: string;
  tree: TreeInstance;
  matrixWorld: readonly number[];
};

const distanceSquared = (a: SpatialPoint, b: SpatialPoint) => {
  const x = a.x - b.x;
  const y = a.y - b.y;
  const z = a.z - b.z;
  return x * x + y * y + z * z;
};

const spatialPoint = (vector: THREE.Vector3): SpatialPoint => ({
  x: vector.x,
  y: vector.y,
  z: vector.z,
});

const matrixChanged = (previous: readonly number[], next: readonly number[]) => (
  previous.length !== next.length
  || previous.some((value, index) => Math.abs(value - next[index]) > 1e-7)
);

const deterministicNoise = (id: string, seed: number) => {
  let hash = seed >>> 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507) >>> 0;
  hash ^= hash >>> 13;
  return (hash >>> 0) / 4294967295;
};

export class HabitatRegistry {
  readonly #trees = new Map<string, RegisteredTree>();
  readonly #staticProviders = new Map<string, readonly HabitatNode[]>();
  readonly #nodes = new Map<string, RegisteredHabitatNode>();
  readonly #connections = new Map<string, HabitatConnection[]>();
  readonly #crossTreeConnectionDistance: number;

  constructor(crossTreeConnectionDistance = 14) {
    this.#crossTreeConnectionDistance = crossTreeConnectionDistance;
  }

  registerTree(providerId: string, tree: TreeInstance) {
    if (this.#trees.has(providerId) || this.#staticProviders.has(providerId)) {
      throw new Error(`Habitat provider already registered: ${providerId}`);
    }
    assertTreeInstanceContract(tree);
    tree.root.updateWorldMatrix(true, false);
    this.#trees.set(providerId, {
      providerId,
      tree,
      matrixWorld: [...tree.root.matrixWorld.elements],
    });
    this.#rebuild();
    return this.getProviderNodes(providerId);
  }

  registerNodes(providerId: string, nodes: readonly HabitatNode[]) {
    if (this.#trees.has(providerId) || this.#staticProviders.has(providerId)) {
      throw new Error(`Habitat provider already registered: ${providerId}`);
    }
    nodes.forEach((node) => {
      if (node.providerId !== providerId) {
        throw new Error(`Habitat node ${node.id} must use providerId ${providerId}`);
      }
    });
    this.#staticProviders.set(providerId, nodes);
    this.#rebuild();
    return this.getProviderNodes(providerId);
  }

  unregisterProvider(providerId: string) {
    const removed = this.#trees.delete(providerId) || this.#staticProviders.delete(providerId);
    if (!removed) return false;
    this.#rebuild();
    return true;
  }

  getNodes(): readonly RegisteredHabitatNode[] {
    this.#synchronizeTransforms();
    return [...this.#nodes.values()];
  }

  getProviderNodes(providerId: string): readonly RegisteredHabitatNode[] {
    return this.getNodes().filter((node) => node.providerId === providerId);
  }

  getNode(nodeId: string) {
    this.#synchronizeTransforms();
    return this.#nodes.get(nodeId);
  }

  getConnections(nodeId: string): readonly HabitatConnection[] {
    this.#synchronizeTransforms();
    return this.#connections.get(nodeId) ?? [];
  }

  query(query: HabitatQuery = {}): readonly RegisteredHabitatNode[] {
    const maxDistanceSquared = query.maxDistance === undefined
      ? Number.POSITIVE_INFINITY
      : query.maxDistance * query.maxDistance;
    const candidates = this.getNodes().filter((node) => (
      (!query.kind || node.kind === query.kind)
      && (!query.level || node.level === query.level)
      && (!query.capability || node.capabilities.includes(query.capability))
      && (!query.excludeNodeId || node.id !== query.excludeNodeId)
      && (!query.origin || distanceSquared(node.position, query.origin) <= maxDistanceSquared)
    ));

    return candidates.sort((a, b) => {
      if (query.avoidPosition) {
        return distanceSquared(b.position, query.avoidPosition)
          - distanceSquared(a.position, query.avoidPosition);
      }
      if (query.origin) {
        return distanceSquared(a.position, query.origin)
          - distanceSquared(b.position, query.origin);
      }
      return a.id.localeCompare(b.id);
    });
  }

  measureVisualTransmission(observer: SpatialPoint, target: SpatialPoint) {
    this.#synchronizeTransforms();
    const origin = new THREE.Vector3(observer.x, observer.y, observer.z);
    const direction = new THREE.Vector3(
      target.x - observer.x,
      target.y - observer.y,
      target.z - observer.z,
    );
    const distance = direction.length();
    if (distance <= 0.3) return 1;
    direction.normalize();
    const raycaster = new THREE.Raycaster(origin, direction, 0.08, Math.max(0.08, distance - 0.24));
    const occluders = [...this.#trees.values()].flatMap((provider) => provider.tree.occluders);
    const hits = raycaster.intersectObjects(occluders, false);
    const counted = new Set<string>();
    let transmission = 1;
    for (const hit of hits) {
      const key = `${hit.object.uuid}:${hit.instanceId ?? 'mesh'}`;
      if (counted.has(key)) continue;
      counted.add(key);
      const role = hit.object.userData.treeRole as string | undefined;
      transmission *= role === 'branch-occluder' ? 0.16 : 0.68;
      if (transmission <= 0.08) return 0.08;
    }
    return Math.max(0.08, transmission);
  }

  rankRelocation(query: RelocationQuery): readonly HabitatCandidateScore[] {
    const current = query.currentNodeId ? this.getNode(query.currentNodeId) : undefined;
    const currentHeight = current?.position.y ?? 0;
    const currentTree = current && 'treeInstanceId' in current ? current.treeInstanceId : undefined;
    const currentObserverDistance = current
      ? Math.sqrt(distanceSquared(current.position, query.observerPosition))
      : 0;
    const excludedNodeIds = new Set(query.excludeNodeIds ?? []);
    const candidates = this.query(query).filter((node) => (
      node.id !== query.currentNodeId
      && !excludedNodeIds.has(node.id)
      && node.clearance >= (query.minClearance ?? 0)
      && (!query.minHeightGain || node.position.y >= currentHeight + query.minHeightGain)
    ));

    return candidates.map<HabitatCandidateScore>((node) => {
      const observerDistance = Math.sqrt(distanceSquared(node.position, query.observerPosition));
      const visualTransmission = this.measureVisualTransmission(query.observerPosition, node.position);
      const distancePressure = THREE.MathUtils.clamp(
        1 - observerDistance / Math.max(0.1, query.observerPressureRadius ?? 11),
        0,
        1,
      );
      const arrivalPressure = distancePressure * (0.42 + visualTransmission * 0.58);
      const heightGain = node.position.y - currentHeight;
      const nodeTree = 'treeInstanceId' in node ? node.treeInstanceId : undefined;
      const crossTree = Boolean(currentTree && nodeTree && currentTree !== nodeTree);
      const randomTieBreak = deterministicNoise(node.id, query.seed);
      const distanceScore = Math.min(observerDistance / 18, 1) * (query.avoidPosition ? 2.8 : 0.65);
      const heightScore = query.preferHigher ? Math.max(-0.5, Math.min(heightGain / 5, 1)) * 1.8 : 0;
      const coverScore = query.preferCover ? (1 - visualTransmission) * 1.45 : 0;
      const clearanceScore = Math.min(node.clearance / 0.7, 1) * 0.45;
      const differentTreeScore = query.preferDifferentTree && crossTree ? 0.85 : 0;
      const sameTreeScore = query.preferSameTree && currentTree && nodeTree === currentTree ? 0.75 : 0;
      const travelPenalty = query.origin
        ? Math.min(Math.sqrt(distanceSquared(node.position, query.origin)) / 18, 1) * 0.38
        : 0;
      return {
        node,
        score: distanceScore + heightScore + coverScore + clearanceScore
          + differentTreeScore + sameTreeScore + randomTieBreak * 0.22 - travelPenalty,
        observerDistance,
        heightGain,
        visualTransmission,
        arrivalPressure,
        clearance: node.clearance,
        crossTree,
        randomTieBreak,
      };
    }).filter((candidate) => (
      candidate.observerDistance >= (query.minObserverDistance ?? 0)
      && candidate.observerDistance >= currentObserverDistance + (query.minObserverDistanceGain ?? 0)
      && candidate.arrivalPressure <= (query.maxArrivalPressure ?? 1)
      && (query.currentObserverPressure === undefined
        || candidate.arrivalPressure <= query.currentObserverPressure - (query.minPressureReduction ?? 0))
    )).sort((left, right) => right.score - left.score || left.node.id.localeCompare(right.node.id));
  }

  #synchronizeTransforms() {
    let changed = false;
    this.#trees.forEach((provider) => {
      provider.tree.root.updateWorldMatrix(true, false);
      const nextMatrix = provider.tree.root.matrixWorld.elements;
      if (!matrixChanged(provider.matrixWorld, nextMatrix)) return;
      provider.matrixWorld = [...nextMatrix];
      changed = true;
    });
    if (changed) this.#rebuild();
  }

  #rebuild() {
    this.#nodes.clear();
    this.#connections.clear();
    this.#staticProviders.forEach((nodes) => {
      nodes.forEach((node) => {
        if (this.#nodes.has(node.id)) throw new Error(`Duplicate habitat node: ${node.id}`);
        this.#nodes.set(node.id, node);
        this.#connections.set(node.id, []);
      });
    });
    this.#trees.forEach(({ providerId, tree }) => {
      const worldScale = tree.root.getWorldScale(new THREE.Vector3());
      const treeHeight = tree.localHeight * worldScale.y;
      tree.perches.forEach((perch) => {
        const id = `${providerId}:${perch.id}`;
        const node: RegisteredTreePerch = {
          id,
          providerId,
          kind: 'perch',
          level: perch.level,
          capabilities: perch.capabilities,
          position: spatialPoint(getWorldPerchPosition(tree, perch.id)),
          forward: spatialPoint(getWorldPerchForward(tree, perch.id)),
          clearance: perch.clearance,
          treeInstanceId: providerId,
          perchId: perch.id,
          branchId: perch.branchId,
          branchLevel: perch.branchLevel,
          perchSupport: perch.support ?? 'structural',
          structuralExposure: perch.exposure,
          treeHeight,
        };
        this.#nodes.set(id, node);
        this.#connections.set(id, []);
      });

      tree.perchConnections.forEach((connection) => {
        const from = `${providerId}:${connection.from}`;
        const to = `${providerId}:${connection.to}`;
        this.#addConnection(from, to, connection.mode);
      });
    });

    const transferNodes = [...this.#nodes.values()]
      .filter((node): node is RegisteredTreePerch => (
        node.kind === 'perch'
        && 'treeInstanceId' in node
        && node.capabilities.includes('transfer')
      ));
    for (let leftIndex = 0; leftIndex < transferNodes.length; leftIndex += 1) {
      const left = transferNodes[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < transferNodes.length; rightIndex += 1) {
        const right = transferNodes[rightIndex];
        if (left.providerId === right.providerId) continue;
        const distance = Math.sqrt(distanceSquared(left.position, right.position));
        if (distance > this.#crossTreeConnectionDistance) continue;
        this.#addConnection(left.id, right.id, 'tree-flight', distance);
        this.#addConnection(right.id, left.id, 'tree-flight', distance);
      }
    }
  }

  #addConnection(from: string, to: string, mode: HabitatMovementMode, knownDistance?: number) {
    const fromNode = this.#nodes.get(from);
    const toNode = this.#nodes.get(to);
    if (!fromNode || !toNode) throw new Error(`Unknown habitat connection: ${from} -> ${to}`);
    const connections = this.#connections.get(from) ?? [];
    if (connections.some((connection) => connection.to === to && connection.mode === mode)) return;
    connections.push({
      from,
      to,
      mode,
      distance: knownDistance ?? Math.sqrt(distanceSquared(fromNode.position, toNode.position)),
    });
    this.#connections.set(from, connections);
  }
}
