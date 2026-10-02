import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentLook } from '../environment/environment-look';
import { forestEdgePalette } from '../environment/forest-edge-palette';
import {
  createLeafClusterSdfTexture,
  getCamphorAlphaFoliageState,
  type AlphaLeafPreset,
} from '../environment/alpha-foliage-authoring-lab';
import {
  createFoliageCardRenderer,
  type FoliageInstance,
  type FoliageGrowthMode,
} from '../rendering/foliage-card-renderer';
import {
  createProceduralBranchGeometry,
  generateProceduralTreeSkeleton,
  getProceduralTreePreset,
  refineProceduralCrownLobes,
  type ProceduralTreeGenerationVersion,
  type ProceduralTreeParameters,
  type ProceduralTreePreset,
  type ProceduralTreeSkeleton,
} from './procedural-tree-skeleton';

export type ProceduralTreeFoliageRole = 'spur' | 'inner' | 'mid' | 'outer';

export type ProceduralTreeSkeletonLabMode = 'baseline' | 'foliage';

type GeneratedFoliageRole = ProceduralTreeFoliageRole | 'baseline';
const foliageRoles: readonly ProceduralTreeFoliageRole[] = ['spur', 'inner', 'mid', 'outer'];

export type ProceduralTreeFoliageParameters = Readonly<{
  density: number;
  cardsPerAnchor: number;
  scale: number;
  hollow: number;
  leafPreset: AlphaLeafPreset;
  leafSize: number;
  leafWidth: number;
  leafTip: number;
  serration: number;
  cardLeafCount: number;
  leafVariation: number;
  leafOverlap: number;
  leafSpread: number;
  sdfThickness: number;
  growthMode: FoliageGrowthMode;
  outwardStrength: number;
  directionJitter: number;
  bounceStrength: number;
  branchRadiusLimit: number;
  branchWrapLength: number;
}>;

export type ProceduralTreeBuildOptions = Readonly<{
  parameters?: ProceduralTreeParameters;
  foliage?: ProceduralTreeFoliageParameters;
  mode?: ProceduralTreeSkeletonLabMode;
  authoringAccessories?: boolean;
  generationVersion?: ProceduralTreeGenerationVersion;
  visibleFoliageRoles?: readonly ProceduralTreeFoliageRole[];
  bounceEnabled?: boolean;
  crownIntegrationEnabled?: boolean;
}>;

export type ProceduralTreeAuthoringState = Readonly<{
  generationVersion: ProceduralTreeGenerationVersion;
  parameters: ProceduralTreeParameters;
  foliage: ProceduralTreeFoliageParameters;
  visibleFoliageRoles: readonly ProceduralTreeFoliageRole[];
  bounceEnabled: boolean;
  crownIntegrationEnabled: boolean;
}>;

export const getDefaultProceduralTreeFoliageParameters = (): ProceduralTreeFoliageParameters => ({
  density: 1.45,
  cardsPerAnchor: 2,
  scale: 1.12,
  hollow: 0.03,
  leafPreset: 'camphor',
  leafSize: 1.87,
  leafWidth: 0.94,
  leafTip: 0.52,
  serration: 0.02,
  cardLeafCount: 17,
  leafVariation: 0.38,
  leafOverlap: 0.70,
  leafSpread: 0.58,
  sdfThickness: 0,
  growthMode: 'outward',
  outwardStrength: 0.62,
  directionJitter: 0.22,
  bounceStrength: 0.28,
  branchRadiusLimit: 0.22,
  branchWrapLength: 0.32,
});

export const getDefaultWillowFoliageParameters = (): ProceduralTreeFoliageParameters => ({
  density: 1.45,
  cardsPerAnchor: 2,
  scale: 1.00,
  hollow: 0.22,
  leafPreset: 'lance',
  leafSize: 3.30,
  leafWidth: 0.31,
  leafTip: 0.96,
  serration: 0.02,
  cardLeafCount: 8,
  leafVariation: 0.58,
  leafOverlap: 0.28,
  leafSpread: 0.92,
  sdfThickness: 0,
  growthMode: 'upright',
  outwardStrength: 0.18,
  directionJitter: 0.06,
  bounceStrength: 0.20,
  branchRadiusLimit: 0.16,
  branchWrapLength: 0.28,
});

const createTreeLeafMask = (
  foliage: ProceduralTreeFoliageParameters,
) => createLeafClusterSdfTexture({
  ...getCamphorAlphaFoliageState(),
  leafPreset: foliage.leafPreset,
  leafScale: foliage.leafSize,
  leafWidth: foliage.leafWidth,
  leafTip: foliage.leafTip,
  serration: foliage.serration,
  cardLeafCount: foliage.cardLeafCount,
  leafVariation: foliage.leafVariation,
  leafOverlap: foliage.leafOverlap,
  leafSpread: foliage.leafSpread,
  sdfThickness: foliage.sdfThickness,
});

const hash01 = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
};

const foliageLayoutSignature = (instances: readonly FoliageInstance[]) => {
  let hash = 2166136261;
  const write = (value: number) => {
    const quantized = Math.round(value * 10000);
    hash ^= quantized;
    hash = Math.imul(hash, 16777619);
  };
  instances.forEach((instance) => {
    write(instance.position.x);
    write(instance.position.y);
    write(instance.position.z);
    write(instance.surfaceNormal.x);
    write(instance.surfaceNormal.y);
    write(instance.surfaceNormal.z);
    write(instance.scale);
    write(instance.roll);
    write(instance.tone ?? -1);
  });
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const distanceToBranchSurface = (
  point: THREE.Vector3,
  branch: ProceduralTreeSkeleton['branches'][number],
) => {
  let minimum = Number.POSITIVE_INFINITY;
  const closest = new THREE.Vector3();
  const segment = new THREE.Vector3();
  const fromStart = new THREE.Vector3();
  for (let index = 0; index < branch.points.length - 1; index += 1) {
    const start = branch.points[index];
    const end = branch.points[index + 1];
    segment.subVectors(end, start);
    const lengthSquared = segment.lengthSq();
    const segmentT = lengthSquared > 0
      ? THREE.MathUtils.clamp(fromStart.subVectors(point, start).dot(segment) / lengthSquared, 0, 1)
      : 0;
    closest.copy(start).addScaledVector(segment, segmentT);
    const radius = THREE.MathUtils.lerp(
      branch.radii[index] ?? 0,
      branch.radii[index + 1] ?? branch.radii[index] ?? 0,
      segmentT,
    );
    minimum = Math.min(minimum, point.distanceTo(closest) - radius);
  }
  return minimum;
};

const disposeChildren = (group: THREE.Group) => {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
    }
  });
  group.clear();
};

export const createProceduralTreeSkeletonLab = (
  options: ProceduralTreeBuildOptions = {},
) => {
  const root = new THREE.Group();
  root.name = 'procedural-tree-skeleton-authoring-lab-v001';

  const meshStage = new THREE.Group();
  meshStage.name = 'tree-branch-mesh-stage';
  const anchorStage = new THREE.Group();
  anchorStage.name = 'tree-foliage-anchor-stage';

  const initialGenerationVersion = options.generationVersion ?? 'legacy-v003';
  let foliageState = options.foliage
    ? { ...options.foliage }
    : initialGenerationVersion === 'willow-v001'
      ? getDefaultWillowFoliageParameters()
      : getDefaultProceduralTreeFoliageParameters();
  let leafMask = createTreeLeafMask(foliageState);
  const foliageRenderer = createFoliageCardRenderer(leafMask, 1400, {
    shape: {
      shadow: '#2d5737',
      mid: '#4f7f46',
      highlight: '#85a958',
    },
    elemental: {
      shadow: '#2d5737',
      mid: '#4f7f46',
      highlight: '#85a958',
    },
    shared: {
      shadow: '#2d5737',
      mid: '#4f7f46',
      highlight: '#85a958',
    },
  });
  foliageRenderer.setMask(leafMask, 'sdf');
  foliageRenderer.setVisualMode('shared');
  foliageRenderer.setGrowthOrientation('outward', 0.58, 0.3);
  foliageRenderer.mesh.name = 'procedural-tree-r05-foliage-clusters';

  const barkColors = forestEdgePalette.tree.bark;
  const barkMaterials = [0, 1, 2, 3].map((index) => new THREE.MeshToonMaterial({
    color: barkColors[index % barkColors.length],
  }));
  const anchorMaterial = new THREE.MeshBasicMaterial({
    color: '#36d7d0',
    depthTest: false,
    depthWrite: false,
  });
  const anchorDirectionMaterial = new THREE.LineBasicMaterial({
    color: '#9cece6',
    depthTest: false,
    depthWrite: false,
  });
  const crownLobeMaterial = new THREE.MeshBasicMaterial({
    color: '#f0b34c',
    wireframe: true,
    transparent: true,
    opacity: 0.34,
    depthTest: false,
    depthWrite: false,
  });
  const attachmentMaterial = new THREE.MeshBasicMaterial({
    color: '#f07b9a',
    depthTest: false,
    depthWrite: false,
  });
  const refinedBarkMaterials = [0, 1, 2, 3].map(() => new THREE.MeshToonMaterial({
    color: '#ffffff',
    vertexColors: true,
  }));
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    new THREE.MeshToonMaterial({ color: forestEdgePalette.surface.grass }),
  );
  ground.name = 'procedural-tree-lab-ground';
  ground.rotation.x = -Math.PI * 0.5;
  ground.position.y = -0.025;
  ground.receiveShadow = true;
  root.add(ground, meshStage, foliageRenderer.mesh, anchorStage);

  let state = options.parameters
    ? { ...options.parameters }
    : getProceduralTreePreset(initialGenerationVersion === 'willow-v001' ? 'willow' : 'dome');
  let foliageCardCount = 0;
  let totalFoliageCardCount = 0;
  let trunkCollarRejectedCards = 0;
  let layoutSignature = '';
  let mode: ProceduralTreeSkeletonLabMode = options.mode ?? 'foliage';
  let generationVersion: ProceduralTreeGenerationVersion = initialGenerationVersion;
  let bounceEnabled = options.bounceEnabled ?? true;
  let crownIntegrationEnabled = options.crownIntegrationEnabled ?? true;
  let attachmentDiagnosticsVisible = false;
  const visibleFoliageRoles = new Set<ProceduralTreeFoliageRole>(
    options.visibleFoliageRoles ?? foliageRoles,
  );
  let skeleton: ProceduralTreeSkeleton = generateProceduralTreeSkeleton(state, generationVersion);
  let baselineCrownLobes = skeleton.crownLobes;

  const getDisplayedCrownLobes = () => (
    mode === 'baseline' ? baselineCrownLobes : skeleton.crownLobes
  );

  const setMode = (nextMode: ProceduralTreeSkeletonLabMode) => {
    const layoutChanged = (mode === 'baseline') !== (nextMode === 'baseline');
    mode = nextMode;
    meshStage.visible = true;
    meshStage.children.forEach((child) => {
      const level = Number.parseInt(child.name.replace('procedural-tree-level-', ''), 10);
      const refined = mode !== 'baseline';
      if (child instanceof THREE.Mesh && Number.isFinite(level)) {
        child.material = refined
          ? refinedBarkMaterials[Math.min(level, refinedBarkMaterials.length - 1)]
          : barkMaterials[Math.min(level, barkMaterials.length - 1)];
      }
      child.visible = !Number.isFinite(level)
        || level <= (generationVersion === 'willow-v001' ? 3 : 2);
    });
    foliageRenderer.mesh.visible = true;
    anchorStage.visible = mode === 'foliage'
      && crownIntegrationEnabled
      && attachmentDiagnosticsVisible;
    root.userData.studyMode = mode;
    root.userData.foliageLayout = generationVersion === 'willow-v001'
      ? 'willow-branch-drape'
      : mode === 'baseline' ? 'baseline-ellipsoid' : 'semantic-cohesive';
    if (layoutChanged) rebuildFoliage();
  };

  const rebuildFoliage = () => {
    foliageRenderer.setSdfThickness(foliageState.sdfThickness);
    foliageRenderer.setGrowthOrientation(
      foliageState.growthMode,
      foliageState.outwardStrength,
      foliageState.directionJitter,
    );
    const instances: FoliageInstance[] = [];
    const roleCounts: Record<GeneratedFoliageRole, number> = {
      baseline: 0,
      spur: 0,
      inner: 0,
      mid: 0,
      outer: 0,
    };
    const toneLightDirection = new THREE.Vector3(-0.42, 0.76, 0.49).normalize();
    if (generationVersion === 'willow-v001') {
      const willowInstances: Array<FoliageInstance & {
        lightScore: number;
        role: ProceduralTreeFoliageRole;
      }> = [];
      const cardsPerAnchor = foliageState.cardsPerAnchor;
      skeleton.foliageAnchors.forEach((anchor) => {
        const tangent = anchor.tangent.clone().normalize();
        const helper = Math.abs(tangent.y) < 0.92
          ? THREE.Object3D.DEFAULT_UP
          : new THREE.Vector3(1, 0, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, helper).normalize();
        const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
        const role: ProceduralTreeFoliageRole = anchor.level === 2 ? 'mid' : 'outer';
        for (let cardIndex = 0; cardIndex < cardsPerAnchor; cardIndex += 1) {
          const key = `${state.seed}:${anchor.id}:${cardIndex}`;
          const azimuth = hash01(`${key}:azimuth`) * Math.PI * 2;
          const radial = normal.clone().multiplyScalar(Math.cos(azimuth))
            .addScaledVector(binormal, Math.sin(azimuth))
            .normalize();
          const lateralOffset = THREE.MathUtils.lerp(0.05, 0.16, hash01(`${key}:offset`));
          const position = anchor.position.clone()
            .addScaledVector(radial, lateralOffset)
            .addScaledVector(tangent, (hash01(`${key}:along`) - 0.5) * 0.16);
          const surfaceNormal = anchor.outward.clone().multiplyScalar(0.72)
            .addScaledVector(radial, 0.42)
            .addScaledVector(tangent, -0.10)
            .normalize();
          const scale = (anchor.level === 2 ? 3.09 : 2.70)
            * foliageState.scale
            * THREE.MathUtils.lerp(0.84, 1.18, hash01(`${key}:scale`));
          willowInstances.push({
            position,
            surfaceNormal,
            scale,
            roll: (hash01(`${key}:roll`) * 2 - 1) * 0.72,
            role,
            lightScore: surfaceNormal.dot(toneLightDirection)
              + (hash01(`${key}:tone`) - 0.5) * 0.18,
          });
          roleCounts[role] += 1;
        }
      });
      willowInstances.sort((a, b) => a.lightScore - b.lightScore);
      willowInstances.forEach(({ lightScore: _lightScore, role, ...instance }, index) => {
        if (!visibleFoliageRoles.has(role)) return;
        const rank = (index + 0.5) / Math.max(1, willowInstances.length);
        const tone = rank < 0.30
          ? THREE.MathUtils.lerp(0.16, 0.31, rank / 0.30)
          : rank < 0.76
            ? THREE.MathUtils.lerp(0.42, 0.62, (rank - 0.30) / 0.46)
            : THREE.MathUtils.lerp(0.72, 0.90, (rank - 0.76) / 0.24);
        instances.push({ ...instance, tone });
      });
      totalFoliageCardCount = Object.values(roleCounts).reduce((total, count) => total + count, 0);
      foliageRenderer.setInstances(instances);
      foliageCardCount = instances.length;
      layoutSignature = foliageLayoutSignature(instances);
      trunkCollarRejectedCards = 0;
      root.userData.foliageCardCount = foliageCardCount;
      root.userData.foliageParameters = { ...foliageState };
      root.userData.foliageLayoutSignature = layoutSignature;
      root.userData.foliageLayout = 'willow-branch-drape';
      root.userData.visibleFoliageRoles = [...visibleFoliageRoles];
      root.userData.foliageRoleCounts = roleCounts;
      root.userData.trunkCollarRejectedCards = 0;
      return;
    }
    const branchById = new Map(skeleton.branches.map((branch) => [branch.id, branch]));
    const primaryOwnerOf = (branchId: string) => {
      let branch = branchById.get(branchId);
      while (branch && branch.level > 1 && branch.parentId) branch = branchById.get(branch.parentId);
      return branch?.level === 1 ? branch.id : undefined;
    };
    type TreeFoliageAnchor = (typeof skeleton.foliageAnchors)[number];
    type AnchoredRole = 'spur' | 'mid' | 'outer';
    type RoleAnchorSet = Record<AnchoredRole, TreeFoliageAnchor[]>;
    const createRoleAnchorSet = (): RoleAnchorSet => ({ spur: [], mid: [], outer: [] });
    const anchorsByPrimary = new Map<string, RoleAnchorSet>();
    const globalRoleAnchors = createRoleAnchorSet();
    skeleton.foliageAnchors.forEach((anchor) => {
      const primaryId = primaryOwnerOf(anchor.branchId);
      if (!primaryId) return;
      const roleAnchors = anchorsByPrimary.get(primaryId) ?? createRoleAnchorSet();
      if (anchor.level <= 2) {
        roleAnchors.spur.push(anchor);
        globalRoleAnchors.spur.push(anchor);
      }
      if (anchor.level === 2) {
        roleAnchors.mid.push(anchor);
        globalRoleAnchors.mid.push(anchor);
      }
      if (anchor.level >= 3) {
        roleAnchors.outer.push(anchor);
        globalRoleAnchors.outer.push(anchor);
      }
      anchorsByPrimary.set(primaryId, roleAnchors);
    });
    const semanticLayout = mode !== 'baseline';
    const trunk = branchById.get('trunk');
    const collarEndT = THREE.MathUtils.clamp(state.crownStart + 0.24, 0.46, 0.62);
    const collarEndIndex = trunk
      ? Math.round((trunk.points.length - 1) * collarEndT)
      : 0;
    const collarTopY = trunk?.points[collarEndIndex]?.y ?? Number.NEGATIVE_INFINITY;
    trunkCollarRejectedCards = 0;
    const clearsTrunkCollar = (position: THREE.Vector3, scale: number) => {
      if (
        generationVersion !== 'species-v004'
        || !semanticLayout
        || !trunk
        || position.y > collarTopY
      ) return true;
      const requiredClearance = Math.max(state.trunkRadius * 0.16, scale * 0.26);
      const clears = distanceToBranchSurface(position, trunk) >= requiredClearance;
      if (!clears) trunkCollarRejectedCards += 1;
      return clears;
    };
    const displayedLobes = getDisplayedCrownLobes();
    const anchorPoolsByLobe = new Map<string, RoleAnchorSet>();
    displayedLobes.forEach((lobe) => {
      const primaryId = primaryOwnerOf(lobe.branchId);
      if (primaryId) {
        anchorPoolsByLobe.set(lobe.id, anchorsByPrimary.get(primaryId) ?? createRoleAnchorSet());
        return;
      }
      const nearby = createRoleAnchorSet();
      (['mid', 'outer'] as const).forEach((role) => {
        nearby[role] = [...globalRoleAnchors[role]]
          .sort((a, b) => a.position.distanceToSquared(lobe.position)
            - b.position.distanceToSquared(lobe.position))
          .slice(0, role === 'mid' ? 18 : 24);
      });
      anchorPoolsByLobe.set(lobe.id, nearby);
    });
    displayedLobes.forEach((lobe) => {
      const cardCountBase = generationVersion === 'species-v004' ? 38 : 28;
      const cardCount = Math.max(8, Math.round(cardCountBase * foliageState.density));
      const lobeInstances: Array<FoliageInstance & {
        lightScore: number;
        role: GeneratedFoliageRole;
      }> = [];
      const lobeScale = Math.min(lobe.radii.x, lobe.radii.y, lobe.radii.z) * 0.78;
      const roleAnchorPools = anchorPoolsByLobe.get(lobe.id) ?? createRoleAnchorSet();
      const roleAnchorUseCount: Record<AnchoredRole, number> = { spur: 0, mid: 0, outer: 0 };
      const innerSourceAnchors = [...roleAnchorPools.mid, ...roleAnchorPools.outer];
      const pickRoleAnchor = (role: AnchoredRole, key: string) => {
        const pool = roleAnchorPools[role];
        if (pool.length === 0) return undefined;
        const useIndex = roleAnchorUseCount[role];
        roleAnchorUseCount[role] += 1;
        const offset = hash01(`${state.seed}:${lobe.id}:${role}:anchor-offset`);
        const index = Math.floor(((offset + useIndex * 0.61803398875) % 1) * pool.length);
        return pool[Math.min(pool.length - 1, index)] ?? pool[Math.floor(hash01(key) * pool.length)];
      };
      const findNearestAnchor = (pool: readonly TreeFoliageAnchor[], target: THREE.Vector3) => {
        let nearest: TreeFoliageAnchor | undefined;
        let nearestDistanceSq = Number.POSITIVE_INFINITY;
        pool.forEach((anchor) => {
          const distanceSq = anchor.position.distanceToSquared(target);
          if (distanceSq >= nearestDistanceSq) return;
          nearest = anchor;
          nearestDistanceSq = distanceSq;
        });
        return nearest;
      };
      for (let cardIndex = 0; cardIndex < cardCount; cardIndex += 1) {
        const key = `${state.seed}:${lobe.id}:${cardIndex}`;
        const scaleVariation = THREE.MathUtils.lerp(0.82, 1.18, hash01(`${key}:scale`));
        const roleRank = (cardIndex + 0.5) / cardCount;
        const useSpur = semanticLayout && roleRank < 0.17 && roleAnchorPools.spur.length > 0;
        if (useSpur) {
          const anchor = pickRoleAnchor('spur', `${key}:spur-anchor`)!;
          const tangent = anchor.tangent.clone().normalize();
          const helper = Math.abs(tangent.y) < 0.92
            ? THREE.Object3D.DEFAULT_UP
            : new THREE.Vector3(1, 0, 0);
          const normal = new THREE.Vector3().crossVectors(tangent, helper).normalize();
          const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
          const azimuth = hash01(`${key}:spur-azimuth`) * Math.PI * 2;
          const direction = normal.multiplyScalar(Math.cos(azimuth))
            .addScaledVector(binormal, Math.sin(azimuth))
            .normalize();
          const barkClearance = anchor.radius + lobeScale
            * THREE.MathUtils.lerp(0.04, 0.14, hash01(`${key}:spur-clearance`));
          const position = anchor.position.clone()
            .addScaledVector(direction, barkClearance)
            .addScaledVector(tangent, (hash01(`${key}:spur-along`) - 0.5) * lobeScale * 0.14);
          const scale = lobeScale * foliageState.scale * scaleVariation * 0.72;
          if (!clearsTrunkCollar(position, scale)) continue;
          const surfaceNormal = direction.clone()
            .addScaledVector(anchor.outward, 0.18)
            .addScaledVector(THREE.Object3D.DEFAULT_UP, 0.08)
            .normalize();
          lobeInstances.push({
            position,
            surfaceNormal,
            scale,
            roll: hash01(`${key}:roll`) * 2 - 1,
            role: 'spur',
            lightScore: surfaceNormal.dot(toneLightDirection)
              + (hash01(`${key}:tone`) - 0.5) * 0.16,
          });
          continue;
        }

        const vertical = hash01(`${key}:vertical`) * 2 - 1;
        const azimuth = hash01(`${key}:azimuth`) * Math.PI * 2;
        const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
        const direction = new THREE.Vector3(
          Math.cos(azimuth) * horizontal,
          vertical,
          Math.sin(azimuth) * horizontal,
        );
        const randomRadius = Math.pow(hash01(`${key}:radial`), semanticLayout ? 0.62 : 0.38);
        const trunkFill = generationVersion === 'species-v004' && lobe.branchId === 'trunk';
        const role = !semanticLayout
          ? 'baseline'
          : trunkFill
            ? roleRank < 0.58 ? 'inner' : 'mid'
            : roleRank < 0.41 ? 'inner' : roleRank < 0.71 ? 'mid' : 'outer';
        const hollowPush = foliageState.hollow * 0.34;
        const radial = role === 'inner'
          ? THREE.MathUtils.lerp(0.12 + hollowPush, 0.56, randomRadius)
          : role === 'mid'
            ? THREE.MathUtils.lerp(0.34 + hollowPush * 0.5, 0.76, randomRadius)
            : role === 'outer'
              ? THREE.MathUtils.lerp(0.58, 0.92, randomRadius)
              : THREE.MathUtils.lerp(0.18 + hollowPush, 0.82, randomRadius);
        const roleScale = role === 'inner' ? 1.10 : role === 'mid' ? 0.94 : 1;
        const scale = lobeScale * foliageState.scale * scaleVariation * roleScale;
        const canopyShoulder = generationVersion === 'species-v004'
          ? 1 + direction.y * 0.16
          : 1;
        const envelopePosition = lobe.position.clone().add(new THREE.Vector3(
          direction.x * lobe.radii.x * radial * canopyShoulder,
          direction.y * lobe.radii.y * radial,
          direction.z * lobe.radii.z * radial * canopyShoulder,
        ));
        let position: THREE.Vector3;
        let surfaceNormal: THREE.Vector3;
        const supportPool = role === 'inner'
          ? innerSourceAnchors
          : role === 'mid' || role === 'outer'
            ? roleAnchorPools[role]
            : [];
        const supportAnchor = semanticLayout
          ? findNearestAnchor(supportPool, envelopePosition)
          : undefined;
        if (semanticLayout && supportAnchor) {
          const supportDirection = envelopePosition.clone().sub(supportAnchor.position);
          if (supportDirection.lengthSq() < 0.0001) supportDirection.copy(supportAnchor.outward);
          const targetDistance = supportDirection.length();
          supportDirection.normalize();
          const supportLimit = scale * (
            role === 'outer' ? 0.74 : role === 'mid' ? 0.68 : 0.62
          );
          const supportDistance = THREE.MathUtils.clamp(
            targetDistance,
            supportAnchor.radius + scale * 0.04,
            supportLimit,
          );
          position = supportAnchor.position.clone().addScaledVector(supportDirection, supportDistance);
          surfaceNormal = position.clone().sub(lobe.position);
          if (surfaceNormal.lengthSq() < 0.0001) surfaceNormal.copy(supportDirection);
          surfaceNormal.normalize()
            .addScaledVector(supportAnchor.outward, 0.18)
            .addScaledVector(THREE.Object3D.DEFAULT_UP, 0.08)
            .normalize();
        } else {
          position = envelopePosition;
          surfaceNormal = direction.clone()
            .addScaledVector(lobe.outward, role === 'inner' ? 0.12 : 0.24)
            .addScaledVector(THREE.Object3D.DEFAULT_UP, 0.08)
            .normalize();
        }
        if (!clearsTrunkCollar(position, scale)) continue;
        lobeInstances.push({
          position,
          surfaceNormal,
          scale,
          roll: hash01(`${key}:roll`) * 2 - 1,
          role,
          lightScore: surfaceNormal.dot(toneLightDirection)
            + direction.y * 0.18
            + (hash01(`${key}:tone`) - 0.5) * 0.16,
        });
      }
      lobeInstances.sort((a, b) => a.lightScore - b.lightScore);
      lobeInstances.forEach(({ lightScore: _lightScore, role, ...instance }, index) => {
        roleCounts[role] += 1;
        const rank = (index + 0.5) / lobeInstances.length;
        const tone = rank < 0.30
          ? THREE.MathUtils.lerp(0.12, 0.28, rank / 0.30)
          : rank < 0.72
            ? THREE.MathUtils.lerp(0.40, 0.58, (rank - 0.30) / 0.42)
            : THREE.MathUtils.lerp(0.72, 0.90, (rank - 0.72) / 0.28);
        if (!semanticLayout || (role !== 'baseline' && visibleFoliageRoles.has(role))) {
          instances.push({ ...instance, tone });
        }
      });
    });
    totalFoliageCardCount = Object.values(roleCounts).reduce((total, count) => total + count, 0);
    foliageRenderer.setInstances(instances);
    foliageCardCount = instances.length;
    layoutSignature = foliageLayoutSignature(instances);
    root.userData.foliageCardCount = foliageCardCount;
    root.userData.foliageParameters = { ...foliageState };
    root.userData.foliageLayoutSignature = layoutSignature;
    root.userData.foliageLayout = semanticLayout ? 'semantic-cohesive' : 'baseline-ellipsoid';
    root.userData.visibleFoliageRoles = [...visibleFoliageRoles];
    root.userData.foliageRoleCounts = roleCounts;
    root.userData.trunkCollarRejectedCards = trunkCollarRejectedCards;
  };

  const setFoliageRoleVisible = (role: ProceduralTreeFoliageRole, visible: boolean) => {
    if (visible) visibleFoliageRoles.add(role);
    else visibleFoliageRoles.delete(role);
    rebuildFoliage();
  };

  const setBounceEnabled = (enabled: boolean) => {
    if (bounceEnabled === enabled) return;
    bounceEnabled = enabled;
    rebuild();
  };

  const setCrownIntegrationEnabled = (enabled: boolean) => {
    if (crownIntegrationEnabled === enabled) return;
    crownIntegrationEnabled = enabled;
    rebuild();
  };

  const setAttachmentDiagnosticsVisible = (visible: boolean) => {
    attachmentDiagnosticsVisible = visible;
    anchorStage.visible = mode === 'foliage'
      && crownIntegrationEnabled
      && attachmentDiagnosticsVisible;
    root.userData.attachmentDiagnosticsVisible = attachmentDiagnosticsVisible;
  };

  const applyAuthoringState = (nextState: ProceduralTreeAuthoringState) => {
    generationVersion = nextState.generationVersion;
    state = { ...nextState.parameters };
    foliageState = { ...nextState.foliage };
    visibleFoliageRoles.clear();
    nextState.visibleFoliageRoles.forEach((role) => visibleFoliageRoles.add(role));
    bounceEnabled = nextState.bounceEnabled;
    crownIntegrationEnabled = nextState.crownIntegrationEnabled;
    attachmentDiagnosticsVisible = false;
    rebuildLeafMask();
    rebuild();
  };

  const rebuildLeafMask = () => {
    const nextMask = createTreeLeafMask(foliageState);
    foliageRenderer.setMask(nextMask, 'sdf');
    leafMask.dispose();
    leafMask = nextMask;
  };

  const rebuild = () => {
    disposeChildren(meshStage);
    disposeChildren(anchorStage);
    const generatedSkeleton = generateProceduralTreeSkeleton(state, generationVersion);
    baselineCrownLobes = generatedSkeleton.crownLobes;
    const displayedCrownLobes = crownIntegrationEnabled && generationVersion !== 'willow-v001'
      ? refineProceduralCrownLobes(
        generatedSkeleton,
        foliageState.branchWrapLength,
        generationVersion === 'species-v004',
      )
      : generatedSkeleton.crownLobes;
    const maxAttachmentDistance = displayedCrownLobes.reduce(
      (maximum, lobe) => Math.max(maximum, lobe.maxAttachmentDistance),
      0,
    );
    skeleton = {
      ...generatedSkeleton,
      crownLobes: displayedCrownLobes,
      stats: {
        ...generatedSkeleton.stats,
        maxAttachmentDistance,
      },
    };
    state = skeleton.parameters;
    const branchById = new Map(skeleton.branches.map((branch) => [branch.id, branch]));

    for (let level = 0; level <= state.levels; level += 1) {
      const geometries = skeleton.branches
        .filter((branch) => branch.level === level)
        .map((branch) => createProceduralBranchGeometry(branch, {
          baseColor: barkColors[level % barkColors.length],
          foliageColor: generationVersion === 'willow-v001' ? '#6f9f4a' : '#3f8f42',
          crownLobes: skeleton.crownLobes,
          bounceStrength: bounceEnabled ? foliageState.bounceStrength : 0,
          maxBranchRadius: foliageState.branchRadiusLimit,
          parentBranch: branch.parentId ? branchById.get(branch.parentId) : undefined,
          longitudinalSmoothing: generationVersion !== 'legacy-v003',
        }));
      if (geometries.length === 0) continue;
      const merged = mergeGeometries(geometries, false);
      geometries.forEach((geometry) => geometry.dispose());
      if (!merged) continue;
      const refined = mode !== 'baseline';
      const mesh = new THREE.Mesh(
        merged,
        refined
          ? refinedBarkMaterials[Math.min(level, refinedBarkMaterials.length - 1)]
          : barkMaterials[Math.min(level, barkMaterials.length - 1)],
      );
      mesh.name = `procedural-tree-level-${level}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.treeRole = 'branch-occluder';
      meshStage.add(mesh);
    }

    const markerGeometry = new THREE.IcosahedronGeometry(0.09, 1);
    const markers = new THREE.InstancedMesh(
      markerGeometry,
      anchorMaterial,
      skeleton.crownLobes.length,
    );
    markers.name = 'procedural-tree-crown-lobe-centers';
    const markerMatrix = new THREE.Matrix4();
    skeleton.crownLobes.forEach((lobe, index) => {
      markerMatrix.makeTranslation(lobe.position.x, lobe.position.y, lobe.position.z);
      markers.setMatrixAt(index, markerMatrix);
      const lobeMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), crownLobeMaterial);
      lobeMesh.name = `procedural-tree-${lobe.id}`;
      lobeMesh.position.copy(lobe.position);
      lobeMesh.scale.copy(lobe.radii);
      lobeMesh.renderOrder = 5;
      anchorStage.add(lobeMesh);
    });
    markers.instanceMatrix.needsUpdate = true;
    anchorStage.add(markers);

    const attachmentPoints = skeleton.crownLobes.flatMap((lobe) => (
      lobe.attachmentPoints.map((point) => ({ lobe, point }))
    ));
    if (attachmentPoints.length > 0) {
      const attachmentGeometry = new THREE.IcosahedronGeometry(0.065, 1);
      const attachmentMarkers = new THREE.InstancedMesh(
        attachmentGeometry,
        attachmentMaterial,
        attachmentPoints.length,
      );
      attachmentMarkers.name = 'procedural-tree-attachment-samples';
      attachmentMarkers.renderOrder = 6;
      const attachmentLines: number[] = [];
      attachmentPoints.forEach(({ lobe, point }, index) => {
        markerMatrix.makeTranslation(point.x, point.y, point.z);
        attachmentMarkers.setMatrixAt(index, markerMatrix);
        attachmentLines.push(...lobe.position.toArray(), ...point.toArray());
      });
      attachmentMarkers.instanceMatrix.needsUpdate = true;
      anchorStage.add(attachmentMarkers);
      const attachmentLineGeometry = new THREE.BufferGeometry();
      attachmentLineGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(attachmentLines, 3),
      );
      const attachmentLinesMesh = new THREE.LineSegments(
        attachmentLineGeometry,
        anchorDirectionMaterial,
      );
      attachmentLinesMesh.name = 'procedural-tree-attachment-lines';
      attachmentLinesMesh.renderOrder = 5;
      anchorStage.add(attachmentLinesMesh);
    }

    const directionPositions: number[] = [];
    skeleton.crownLobes.forEach((lobe) => {
      const end = lobe.position.clone().addScaledVector(lobe.outward, 0.48);
      directionPositions.push(...lobe.position.toArray(), ...end.toArray());
    });
    const directionGeometry = new THREE.BufferGeometry();
    directionGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(directionPositions, 3),
    );
    const directions = new THREE.LineSegments(directionGeometry, anchorDirectionMaterial);
    directions.name = 'procedural-tree-foliage-anchor-directions';
    directions.renderOrder = 5;
    anchorStage.add(directions);

    const size = skeleton.bounds.getSize(new THREE.Vector3());
    ground.scale.setScalar(Math.max(3.4, Math.max(size.x, size.z) * 0.72));
    root.userData.parameters = { ...state };
    root.userData.generationVersion = generationVersion;
    root.userData.stats = { ...skeleton.stats };
    root.userData.foliageAnchors = skeleton.foliageAnchors;
    root.userData.crownLobes = skeleton.crownLobes;
    root.userData.baselineCrownLobes = baselineCrownLobes;
    root.userData.bounceEnabled = bounceEnabled;
    root.userData.crownIntegrationEnabled = crownIntegrationEnabled;
    root.userData.attachmentDiagnosticsVisible = attachmentDiagnosticsVisible;
    rebuildFoliage();
    setMode(mode);
  };

  const update = (partial: Partial<ProceduralTreeParameters>) => {
    state = { ...state, ...partial };
    rebuild();
  };

  const applyPreset = (preset: ProceduralTreePreset) => {
    const nextVersion = preset === 'willow'
      ? 'willow-v001'
      : generationVersion === 'willow-v001' ? 'species-v004' : generationVersion;
    const versionChanged = nextVersion !== generationVersion;
    generationVersion = nextVersion;
    state = getProceduralTreePreset(preset);
    if (versionChanged) {
      foliageState = generationVersion === 'willow-v001'
        ? getDefaultWillowFoliageParameters()
        : getDefaultProceduralTreeFoliageParameters();
      rebuildLeafMask();
    }
    rebuild();
  };

  const setGenerationVersion = (version: ProceduralTreeGenerationVersion) => {
    if (generationVersion === version) return;
    generationVersion = version;
    state = getProceduralTreePreset(version === 'willow-v001' ? 'willow' : 'dome');
    foliageState = version === 'willow-v001'
      ? getDefaultWillowFoliageParameters()
      : getDefaultProceduralTreeFoliageParameters();
    rebuildLeafMask();
    rebuild();
  };

  const updateFoliage = (partial: Partial<ProceduralTreeFoliageParameters>) => {
    const nextState: ProceduralTreeFoliageParameters = {
      density: THREE.MathUtils.clamp(partial.density ?? foliageState.density, 0.25, 3),
      cardsPerAnchor: Math.round(THREE.MathUtils.clamp(
        partial.cardsPerAnchor ?? foliageState.cardsPerAnchor,
        1,
        6,
      )),
      scale: THREE.MathUtils.clamp(partial.scale ?? foliageState.scale, 0.4, 1.8),
      hollow: THREE.MathUtils.clamp(partial.hollow ?? foliageState.hollow, 0, 0.9),
      leafPreset: partial.leafPreset ?? foliageState.leafPreset,
      leafSize: THREE.MathUtils.clamp(
        partial.leafSize ?? foliageState.leafSize,
        0.7,
        generationVersion === 'willow-v001' ? 5.9 : 3.4,
      ),
      leafWidth: THREE.MathUtils.clamp(partial.leafWidth ?? foliageState.leafWidth, 0.25, 1.1),
      leafTip: THREE.MathUtils.clamp(partial.leafTip ?? foliageState.leafTip, 0, 1),
      serration: THREE.MathUtils.clamp(partial.serration ?? foliageState.serration, 0, 1),
      cardLeafCount: Math.round(THREE.MathUtils.clamp(
        partial.cardLeafCount ?? foliageState.cardLeafCount,
        8,
        48,
      )),
      leafVariation: THREE.MathUtils.clamp(
        partial.leafVariation ?? foliageState.leafVariation,
        0,
        1,
      ),
      leafOverlap: THREE.MathUtils.clamp(partial.leafOverlap ?? foliageState.leafOverlap, 0, 1),
      leafSpread: THREE.MathUtils.clamp(partial.leafSpread ?? foliageState.leafSpread, 0.55, 1.25),
      sdfThickness: THREE.MathUtils.clamp(
        partial.sdfThickness ?? foliageState.sdfThickness,
        -1,
        1,
      ),
      growthMode: partial.growthMode ?? foliageState.growthMode,
      outwardStrength: THREE.MathUtils.clamp(
        partial.outwardStrength ?? foliageState.outwardStrength,
        0,
        1,
      ),
      directionJitter: THREE.MathUtils.clamp(
        partial.directionJitter ?? foliageState.directionJitter,
        0,
        1,
      ),
      bounceStrength: THREE.MathUtils.clamp(
        partial.bounceStrength ?? foliageState.bounceStrength,
        0,
        0.8,
      ),
      branchRadiusLimit: THREE.MathUtils.clamp(
        partial.branchRadiusLimit ?? foliageState.branchRadiusLimit,
        0.04,
        0.5,
      ),
      branchWrapLength: THREE.MathUtils.clamp(
        partial.branchWrapLength ?? foliageState.branchWrapLength,
        0.08,
        0.58,
      ),
    };
    const leafMaskChanged = nextState.leafPreset !== foliageState.leafPreset
      || nextState.leafSize !== foliageState.leafSize
      || nextState.leafWidth !== foliageState.leafWidth
      || nextState.leafTip !== foliageState.leafTip
      || nextState.serration !== foliageState.serration
      || nextState.cardLeafCount !== foliageState.cardLeafCount
      || nextState.leafVariation !== foliageState.leafVariation
      || nextState.leafOverlap !== foliageState.leafOverlap
      || nextState.leafSpread !== foliageState.leafSpread;
    const branchIntegrationChanged = nextState.bounceStrength !== foliageState.bounceStrength
      || nextState.branchRadiusLimit !== foliageState.branchRadiusLimit
      || nextState.branchWrapLength !== foliageState.branchWrapLength;
    foliageState = nextState;
    if (leafMaskChanged) rebuildLeafMask();
    if (branchIntegrationChanged) rebuild();
    else {
      rebuildFoliage();
      setMode(mode);
    }
  };

  const removeAuthoringAccessories = () => {
    disposeChildren(anchorStage);
    ground.removeFromParent();
    ground.geometry.dispose();
    if (ground.material instanceof THREE.Material) ground.material.dispose();
  };

  rebuild();
  if (options.authoringAccessories === false) removeAuthoringAccessories();
  return {
    root,
    update,
    applyPreset,
    setGenerationVersion,
    applyAuthoringState,
    updateFoliage,
    setFoliageRoleVisible,
    setBounceEnabled,
    setCrownIntegrationEnabled,
    setAttachmentDiagnosticsVisible,
    setMode,
    getMode: () => mode,
    getGenerationVersion: () => generationVersion,
    getState: () => ({ ...state }),
    getFoliageState: () => ({ ...foliageState }),
    getBounceEnabled: () => bounceEnabled,
    getCrownIntegrationEnabled: () => crownIntegrationEnabled,
    getAttachmentDiagnosticsVisible: () => attachmentDiagnosticsVisible,
    getVisibleFoliageRoles: () => [...visibleFoliageRoles],
    getSkeleton: () => skeleton,
    getStats: () => ({
      ...skeleton.stats,
      foliageCards: foliageCardCount,
      totalFoliageCards: totalFoliageCardCount,
      bounceEnabled,
      crownIntegrationEnabled,
      attachmentDiagnosticsVisible,
      foliageLayoutSignature: layoutSignature,
      trunkCollarRejectedCards,
      generationVersion,
    }),
    removeAuthoringAccessories,
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
    updateWind: foliageRenderer.updateWind,
  };
};
