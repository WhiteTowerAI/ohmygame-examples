import * as THREE from 'three';
import {
  assertTreeInstanceContract,
  type TreeInstance,
  type TreePerchCapability,
  type TreePerchConnection,
  type TreePerchExposure,
  type TreePerchPoint,
  type TreePerchRouteMode,
  type TreePerchSupport,
} from './modular-tree';
import {
  createProceduralTreeBuilder,
  getDefaultProceduralTreeFoliageParameters,
  getDefaultWillowFoliageParameters,
  type ProceduralTreeFoliageParameters,
  type ProceduralTreeFoliageRole,
} from './procedural-tree-builder';
import {
  getProceduralTreePreset,
  type ProceduralBranchPath,
  type ProceduralTreeGenerationVersion,
  type ProceduralTreeParameters,
  type ProceduralTreeSkeleton,
} from './procedural-tree-skeleton';

type ProceduralTreePerchAnchor = Readonly<{
  id: string;
  targetHeightRatio: number;
  preferredExposure: TreePerchExposure;
  capabilities: readonly TreePerchCapability[];
  branchLevels?: readonly number[];
}>;

export type ProceduralTreePerchGeneration = Readonly<{
  targetCount: number;
  branchSampling: readonly Readonly<{
    level: number;
    samples: number;
    branchRange?: readonly [number, number];
    maxSlope?: number;
    minBranchRadius?: number;
  }>[];
  branchRange: readonly [number, number];
  heightRange: readonly [number, number];
  maxSlope: number;
  minBranchRadius: number;
  surfaceOffset: number;
  preferredSpacing: number;
  exposureMismatchPenalty: number;
  spacingPenaltyScale: number;
  exposureDepth: Readonly<{ innerMax: number; edgeMax: number }>;
  levelSplitHeightRatio: number;
  clearance: Readonly<{
    base: number;
    radiusScale: number;
    min: number;
    max: number;
  }>;
  requiredAnchors: readonly ProceduralTreePerchAnchor[];
  automaticHeightRange: readonly [number, number];
  automaticExposureCycle: readonly TreePerchExposure[];
  automaticBranchLevels?: readonly number[];
  connections: Readonly<{
    nearestCount: number;
    sidestepMaxDistance: number;
    hopMaxDistance: number;
  }>;
}>;

export type ProceduralTreeRecipe = Readonly<{
  id: string;
  generationVersion: ProceduralTreeGenerationVersion;
  skeleton: ProceduralTreeParameters;
  foliage: ProceduralTreeFoliageParameters;
  visibleFoliageRoles?: readonly ProceduralTreeFoliageRole[];
  bounceEnabled?: boolean;
  crownIntegrationEnabled?: boolean;
  perchGeneration: ProceduralTreePerchGeneration;
}>;

export const proceduralCamphorTreeRecipe: ProceduralTreeRecipe = {
  id: 'procedural-camphor-v003',
  generationVersion: 'legacy-v003',
  skeleton: getProceduralTreePreset('dome'),
  foliage: getDefaultProceduralTreeFoliageParameters(),
  perchGeneration: {
    targetCount: 10,
    branchSampling: [
      { level: 1, samples: 6 },
      { level: 2, samples: 4 },
    ],
    branchRange: [0.24, 0.88],
    heightRange: [0.34, 0.88],
    maxSlope: 0.76,
    minBranchRadius: 0.025,
    surfaceOffset: 0.035,
    preferredSpacing: 0.75,
    exposureMismatchPenalty: 0.9,
    spacingPenaltyScale: 2,
    exposureDepth: { innerMax: 0.66, edgeMax: 1.08 },
    levelSplitHeightRatio: 0.56,
    clearance: { base: 0.38, radiusScale: 1.35, min: 0.40, max: 0.64 },
    requiredAnchors: [
      {
        id: 'low-rest',
        targetHeightRatio: 0.44,
        preferredExposure: 'open',
        capabilities: ['rest', 'transfer'],
      },
      {
        id: 'mid-shelter',
        targetHeightRatio: 0.61,
        preferredExposure: 'inner',
        capabilities: ['rest', 'transfer'],
      },
      {
        id: 'high-song',
        targetHeightRatio: 0.76,
        preferredExposure: 'edge',
        capabilities: ['rest', 'sing', 'transfer'],
      },
    ],
    automaticHeightRange: [0.40, 0.82],
    automaticExposureCycle: ['open', 'edge', 'inner'],
    connections: {
      nearestCount: 2,
      sidestepMaxDistance: 1.1,
      hopMaxDistance: 1.65,
    },
  },
};

export const proceduralWillowTreeRecipe: ProceduralTreeRecipe = {
  id: 'procedural-willow-v001',
  generationVersion: 'willow-v001',
  skeleton: getProceduralTreePreset('willow'),
  foliage: getDefaultWillowFoliageParameters(),
  perchGeneration: {
    targetCount: 14,
    branchSampling: [
      { level: 1, samples: 8 },
      { level: 2, samples: 6 },
      {
        level: 3,
        samples: 8,
        branchRange: [0.12, 0.74],
        maxSlope: 0.98,
        minBranchRadius: 0.006,
      },
    ],
    branchRange: [0.20, 0.84],
    heightRange: [0.30, 0.84],
    maxSlope: 0.84,
    minBranchRadius: 0.024,
    surfaceOffset: 0.035,
    preferredSpacing: 0.72,
    exposureMismatchPenalty: 0.9,
    spacingPenaltyScale: 2,
    exposureDepth: { innerMax: 0.66, edgeMax: 1.08 },
    levelSplitHeightRatio: 0.55,
    clearance: { base: 0.38, radiusScale: 1.35, min: 0.40, max: 0.64 },
    requiredAnchors: [
      {
        id: 'low-rest',
        targetHeightRatio: 0.40,
        preferredExposure: 'open',
        capabilities: ['rest', 'transfer'],
        branchLevels: [1, 2],
      },
      {
        id: 'mid-shelter',
        targetHeightRatio: 0.58,
        preferredExposure: 'inner',
        capabilities: ['rest', 'transfer'],
        branchLevels: [1, 2],
      },
      {
        id: 'high-song',
        targetHeightRatio: 0.72,
        preferredExposure: 'edge',
        capabilities: ['rest', 'sing', 'transfer'],
        branchLevels: [1, 2],
      },
      {
        id: 'fine-canopy-1',
        targetHeightRatio: 0.78,
        preferredExposure: 'edge',
        capabilities: ['small-bird-rest', 'canopy-perch'],
        branchLevels: [3],
      },
      {
        id: 'fine-canopy-2',
        targetHeightRatio: 0.70,
        preferredExposure: 'open',
        capabilities: ['small-bird-rest', 'canopy-perch'],
        branchLevels: [3],
      },
      {
        id: 'fine-curtain-1',
        targetHeightRatio: 0.60,
        preferredExposure: 'edge',
        capabilities: ['small-bird-rest'],
        branchLevels: [3],
      },
      {
        id: 'fine-curtain-2',
        targetHeightRatio: 0.50,
        preferredExposure: 'open',
        capabilities: ['small-bird-rest'],
        branchLevels: [3],
      },
    ],
    automaticHeightRange: [0.38, 0.78],
    automaticExposureCycle: ['open', 'edge', 'inner'],
    automaticBranchLevels: [1, 2],
    connections: {
      nearestCount: 2,
      sidestepMaxDistance: 1.15,
      hopMaxDistance: 1.72,
    },
  },
};

type PerchCandidate = Readonly<{
  branch: ProceduralBranchPath;
  branchT: number;
  position: THREE.Vector3;
  forward: THREE.Vector3;
  radius: number;
  exposure: TreePerchExposure;
  support: TreePerchSupport;
}>;

type PerchSelectionTarget = Readonly<{
  id: string;
  targetHeightRatio: number;
  preferredExposure: TreePerchExposure;
  capabilities?: readonly TreePerchCapability[];
  branchLevels?: readonly number[];
}>;

const sampleBranch = (branch: ProceduralBranchPath, branchT: number) => {
  const scaled = THREE.MathUtils.clamp(branchT, 0, 1) * (branch.points.length - 1);
  const index = Math.min(branch.points.length - 2, Math.floor(scaled));
  const localT = scaled - index;
  const position = branch.points[index].clone().lerp(branch.points[index + 1], localT);
  const tangent = branch.points[index + 1].clone().sub(branch.points[index]).normalize();
  const radius = THREE.MathUtils.lerp(branch.radii[index], branch.radii[index + 1], localT);
  return { position, tangent, radius };
};

const classifyExposure = (
  position: THREE.Vector3,
  skeleton: ProceduralTreeSkeleton,
  recipe: ProceduralTreePerchGeneration,
): TreePerchExposure => {
  const crownDepth = skeleton.crownLobes.reduce((minimum, lobe) => {
    const offset = position.clone().sub(lobe.position);
    const depth = Math.sqrt(
      (offset.x / Math.max(0.01, lobe.radii.x)) ** 2
      + (offset.y / Math.max(0.01, lobe.radii.y)) ** 2
      + (offset.z / Math.max(0.01, lobe.radii.z)) ** 2,
    );
    return Math.min(minimum, depth);
  }, Number.POSITIVE_INFINITY);
  if (crownDepth <= recipe.exposureDepth.innerMax) return 'inner';
  if (crownDepth <= recipe.exposureDepth.edgeMax) return 'edge';
  return 'open';
};

const collectPerchCandidates = (
  skeleton: ProceduralTreeSkeleton,
  recipe: ProceduralTreePerchGeneration,
) => {
  const candidates: PerchCandidate[] = [];
  const treeHeight = skeleton.bounds.max.y;
  const samplingByLevel = new Map(recipe.branchSampling.map((item) => [item.level, item]));
  skeleton.branches.forEach((branch) => {
    const sampling = samplingByLevel.get(branch.level);
    if (!sampling) return;
    const branchRange = sampling.branchRange ?? recipe.branchRange;
    for (let index = 1; index <= sampling.samples; index += 1) {
      const branchT = THREE.MathUtils.lerp(
        branchRange[0],
        branchRange[1],
        index / sampling.samples,
      );
      const sample = sampleBranch(branch, branchT);
      if (
        sample.position.y < treeHeight * recipe.heightRange[0]
        || sample.position.y > treeHeight * recipe.heightRange[1]
      ) continue;
      if (
        Math.abs(sample.tangent.y) > (sampling.maxSlope ?? recipe.maxSlope)
        || sample.radius < (sampling.minBranchRadius ?? recipe.minBranchRadius)
      ) {
        continue;
      }
      const forward = sample.tangent.clone().setY(0);
      if (forward.lengthSq() < 0.0001) forward.copy(sample.position).setY(0);
      forward.normalize();
      candidates.push({
        branch,
        branchT,
        position: sample.position.clone().add(
          new THREE.Vector3(0, sample.radius + recipe.surfaceOffset, 0),
        ),
        forward,
        radius: sample.radius,
        exposure: classifyExposure(sample.position, skeleton, recipe),
        support: branch.level >= 3 ? 'fine' : 'structural',
      });
    }
  });
  return candidates;
};

const createPerches = (
  skeleton: ProceduralTreeSkeleton,
  recipe: ProceduralTreePerchGeneration,
): readonly TreePerchPoint[] => {
  if (recipe.targetCount < recipe.requiredAnchors.length) {
    throw new Error('Procedural tree targetCount cannot be smaller than its required anchors');
  }
  if (recipe.automaticExposureCycle.length === 0) {
    throw new Error('Procedural tree automatic exposure cycle cannot be empty');
  }

  const candidates = collectPerchCandidates(skeleton, recipe);
  const selected: PerchCandidate[] = [];
  const height = skeleton.bounds.max.y;
  const select = (target: PerchSelectionTarget): TreePerchPoint => {
    const targetHeight = height * target.targetHeightRatio;
    const candidate = candidates
      .filter((item) => (
        !selected.includes(item)
        && (!target.branchLevels || target.branchLevels.includes(item.branch.level))
      ))
      .sort((left, right) => {
        const score = (item: PerchCandidate) => (
          Math.abs(item.position.y - targetHeight)
          + (item.exposure === target.preferredExposure ? 0 : recipe.exposureMismatchPenalty)
          + selected.reduce((penalty, existing) => (
            penalty + Math.max(
              0,
              recipe.preferredSpacing - item.position.distanceTo(existing.position),
            ) * recipe.spacingPenaltyScale
          ), 0)
        );
        return score(left) - score(right)
          || left.branch.id.localeCompare(right.branch.id)
          || left.branchT - right.branchT;
      })[0];
    if (!candidate) throw new Error(`Procedural tree could not generate perch ${target.id}`);
    selected.push(candidate);
    const level = candidate.position.y < height * recipe.levelSplitHeightRatio ? 'low' : 'high';
    const capabilities = target.capabilities ?? (
      level === 'high' && candidate.exposure !== 'inner'
        ? ['rest', 'sing', 'transfer'] as const
        : ['rest', 'transfer'] as const
    );
    return {
      id: target.id,
      level,
      branchId: candidate.branch.id,
      branchT: candidate.branchT,
      offset: [0, candidate.radius + recipe.surfaceOffset, 0],
      facing: 'along',
      exposure: candidate.exposure,
      clearance: THREE.MathUtils.clamp(
        recipe.clearance.base + candidate.radius * recipe.clearance.radiusScale,
        recipe.clearance.min,
        recipe.clearance.max,
      ),
      capabilities,
      branchLevel: candidate.branch.level,
      support: candidate.support,
      localPosition: candidate.position.clone(),
      localForward: candidate.forward.clone(),
    };
  };

  const perches = recipe.requiredAnchors.map((anchor) => select(anchor));
  const automaticCount = recipe.targetCount - perches.length;
  for (let index = 0; index < automaticCount; index += 1) {
    const distributionT = (index + 1) / (automaticCount + 1);
    perches.push(select({
      id: `auto-${index + 1}`,
      targetHeightRatio: THREE.MathUtils.lerp(
        recipe.automaticHeightRange[0],
        recipe.automaticHeightRange[1],
        distributionT,
      ),
      preferredExposure: recipe.automaticExposureCycle[
        index % recipe.automaticExposureCycle.length
      ],
      branchLevels: recipe.automaticBranchLevels,
    }));
  }
  return perches;
};

const createConnections = (
  perches: readonly TreePerchPoint[],
  recipe: ProceduralTreePerchGeneration['connections'],
) => {
  const connections: TreePerchConnection[] = [];
  const keys = new Set<string>();
  const connect = (from: TreePerchPoint, to: TreePerchPoint) => {
    const key = `${from.id}>${to.id}`;
    if (keys.has(key)) return;
    keys.add(key);
    const distance = from.localPosition.distanceTo(to.localPosition);
    const mode: TreePerchRouteMode = (
      from.branchId === to.branchId && distance <= recipe.sidestepMaxDistance
    )
      ? 'sidestep'
      : distance <= recipe.hopMaxDistance ? 'hop' : 'short-flight';
    connections.push({ from: from.id, to: to.id, mode });
  };
  perches.forEach((perch) => {
    const nearest = perches
      .filter((candidate) => candidate !== perch)
      .sort((left, right) => (
        perch.localPosition.distanceToSquared(left.localPosition)
        - perch.localPosition.distanceToSquared(right.localPosition)
        || left.id.localeCompare(right.id)
      ))
      .slice(0, recipe.nearestCount);
    nearest.forEach((candidate) => {
      connect(perch, candidate);
      connect(candidate, perch);
    });
  });
  return connections;
};

const createProceduralTreePerchLayout = (
  skeleton: ProceduralTreeSkeleton,
  recipe: ProceduralTreeRecipe,
) => {
  const perches = createPerches(skeleton, recipe.perchGeneration);
  const connections = createConnections(perches, recipe.perchGeneration.connections);
  return {
    perches,
    connections,
    signature: perches
      .map((perch) => `${perch.id}:${perch.branchId}@${perch.branchT.toFixed(6)}`)
      .join('|'),
  };
};

const getProceduralTreePerchSignature = (tree: TreeInstance) => tree.perches
  .map((perch) => `${perch.id}:${perch.branchId}@${perch.branchT.toFixed(6)}`)
  .join('|');

const validateTreeContract = (
  recipe: ProceduralTreeRecipe,
  skeleton: ProceduralTreeSkeleton,
  perches: readonly TreePerchPoint[],
  connections: readonly TreePerchConnection[],
  occluders: readonly THREE.Object3D[],
) => {
  if (perches.length !== recipe.perchGeneration.targetCount) {
    throw new Error(
      `Procedural tree ${recipe.id} generated ${perches.length} perches; expected ${recipe.perchGeneration.targetCount}`,
    );
  }
  const perchIds = new Set(perches.map((perch) => perch.id));
  if (perchIds.size !== perches.length) {
    throw new Error(`Procedural tree ${recipe.id} generated duplicate perch ids`);
  }
  recipe.perchGeneration.requiredAnchors.forEach((anchor) => {
    if (!perchIds.has(anchor.id)) {
      throw new Error(`Procedural tree ${recipe.id} is missing required perch ${anchor.id}`);
    }
  });

  const branchById = new Map(skeleton.branches.map((branch) => [branch.id, branch]));
  perches.forEach((perch) => {
    const branch = branchById.get(perch.branchId);
    if (!branch) {
      throw new Error(`Procedural perch ${perch.id} references unknown branch ${perch.branchId}`);
    }
    if (perch.branchT < 0 || perch.branchT > 1) {
      throw new Error(`Procedural perch ${perch.id} branchT must stay between 0 and 1`);
    }
    const branchSample = sampleBranch(branch, perch.branchT);
    const expectedPosition = branchSample.position.add(
      new THREE.Vector3(
        0,
        branchSample.radius + recipe.perchGeneration.surfaceOffset,
        0,
      ),
    );
    if (expectedPosition.distanceToSquared(perch.localPosition) > 1e-8) {
      throw new Error(`Procedural perch ${perch.id} is not bound to its declared branch path`);
    }
  });

  const outgoing = new Set<string>();
  const connectionIds = new Set<string>();
  connections.forEach((connection) => {
    if (!perchIds.has(connection.from) || !perchIds.has(connection.to)) {
      throw new Error(
        `Procedural tree connection ${connection.from} -> ${connection.to} references an unknown perch`,
      );
    }
    const id = `${connection.from}>${connection.to}`;
    if (connectionIds.has(id)) {
      throw new Error(`Procedural tree ${recipe.id} generated duplicate connection ${id}`);
    }
    connectionIds.add(id);
    outgoing.add(connection.from);
  });
  perches.forEach((perch) => {
    if (!outgoing.has(perch.id)) {
      throw new Error(`Procedural perch ${perch.id} has no outgoing connection`);
    }
  });
  if (occluders.length === 0) {
    throw new Error(`Procedural tree ${recipe.id} did not create gameplay occluders`);
  }
};

export const createProceduralCamphorTree = (
  recipe: ProceduralTreeRecipe = proceduralCamphorTreeRecipe,
) => {
  const model = createProceduralTreeBuilder({
    parameters: recipe.skeleton,
    foliage: recipe.foliage,
    mode: 'foliage',
    authoringAccessories: false,
    generationVersion: recipe.generationVersion,
    visibleFoliageRoles: recipe.visibleFoliageRoles,
    bounceEnabled: recipe.bounceEnabled,
    crownIntegrationEnabled: recipe.crownIntegrationEnabled,
  });
  const skeleton = model.getSkeleton();
  const perchLayout = createProceduralTreePerchLayout(skeleton, recipe);
  const perches = perchLayout.perches;
  const perchConnections = perchLayout.connections;
  const occluders: THREE.Object3D[] = [];
  model.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object.name === 'procedural-tree-r05-foliage-clusters') {
      object.userData.treeRole = 'foliage-occluder';
      occluders.push(object);
    } else if (object.userData.treeRole === 'branch-occluder') {
      occluders.push(object);
    }
  });
  validateTreeContract(recipe, skeleton, perches, perchConnections, occluders);

  const stats = model.getStats();
  const tree: TreeInstance = {
    recipeId: recipe.id,
    root: model.root,
    localHeight: skeleton.bounds.max.y,
    perches,
    perchConnections,
    occluders,
    resolveBranchFrame(branchId, branchT) {
      const branch = skeleton.branches.find((candidate) => candidate.id === branchId);
      if (!branch) throw new Error(`Tree ${recipe.id} references unknown branch ${branchId}`);
      if (!Number.isFinite(branchT) || branchT < 0 || branchT > 1) {
        throw new Error(`Tree ${recipe.id} branchT must stay between 0 and 1`);
      }
      const sample = sampleBranch(branch, branchT);
      const forward = sample.tangent.clone().setY(0);
      if (forward.lengthSq() < 0.0001) forward.copy(sample.position).setY(0);
      return { position: sample.position, forward: forward.normalize() };
    },
    getFoliageVersion: () => 'emitter',
    setFoliageVersion: () => undefined,
    updateFoliageLighting: model.updateLighting,
    stats: {
      branchSegments: stats.branchSegments,
      foliageClusters: stats.crownLobes,
      foliageLobes: stats.crownLobes,
      emitterCards: stats.totalFoliageCards,
      declaredPerches: recipe.perchGeneration.requiredAnchors.length,
      generatedPerches: perches.length - recipe.perchGeneration.requiredAnchors.length,
    },
  };
  assertTreeInstanceContract(tree);
  const perchSignature = getProceduralTreePerchSignature(tree);
  tree.root.userData.treeRecipeId = recipe.id;
  tree.root.userData.perchContract = {
    targetCount: recipe.perchGeneration.targetCount,
    requiredAnchors: recipe.perchGeneration.requiredAnchors.map((anchor) => anchor.id),
    signature: perchSignature,
  };
  return {
    tree,
    skeleton,
    recipe,
    perchSignature,
    updateLighting: model.updateLighting,
    updateWind: model.updateWind,
  };
};
