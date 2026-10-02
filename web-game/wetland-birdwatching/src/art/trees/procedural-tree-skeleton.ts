import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export type ProceduralTreePreset = 'open' | 'dome' | 'edge' | 'willow';
export type ProceduralTreeGenerationVersion = 'legacy-v003' | 'species-v004' | 'willow-v001';

export type ProceduralTreeParameters = Readonly<{
  preset: ProceduralTreePreset;
  seed: number;
  height: number;
  trunkRadius: number;
  crownStart: number;
  crownWidth: number;
  crownDepth: number;
  primaryBranches: number;
  levels: 2 | 3;
  branchDensity: number;
  branchLengthScale: number;
  branchAngle: number;
  upward: number;
  droop: number;
  wander: number;
  asymmetry: number;
}>;

export type ProceduralBranchPath = Readonly<{
  id: string;
  parentId?: string;
  parentT: number;
  level: number;
  points: readonly THREE.Vector3[];
  radii: readonly number[];
}>;

export type ProceduralFoliageAnchor = Readonly<{
  id: string;
  branchId: string;
  branchT: number;
  level: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  outward: THREE.Vector3;
  radius: number;
  scale: number;
}>;

export type ProceduralCrownLobe = Readonly<{
  id: string;
  branchId: string;
  branchT: number;
  position: THREE.Vector3;
  radii: THREE.Vector3;
  outward: THREE.Vector3;
  attachmentPoints: readonly THREE.Vector3[];
  maxAttachmentDistance: number;
  cohesionShift: number;
}>;

export type ProceduralTreeSkeleton = Readonly<{
  parameters: ProceduralTreeParameters;
  branches: readonly ProceduralBranchPath[];
  foliageAnchors: readonly ProceduralFoliageAnchor[];
  crownLobes: readonly ProceduralCrownLobe[];
  bounds: THREE.Box3;
  stats: Readonly<{
    branches: number;
    branchSegments: number;
    foliageAnchors: number;
    crownLobes: number;
    maxTurnDegrees: number;
    maxAttachmentDistance: number;
    trunkHorizontalDeviation: number;
    skeletonSignature: string;
  }>;
}>;

export type ProceduralBranchGeometryColorOptions = Readonly<{
  baseColor: THREE.ColorRepresentation;
  foliageColor: THREE.ColorRepresentation;
  crownLobes: readonly ProceduralCrownLobe[];
  bounceStrength: number;
  maxBranchRadius: number;
  parentBranch?: ProceduralBranchPath;
  longitudinalSmoothing?: boolean;
}>;

const PRESETS: Readonly<Record<ProceduralTreePreset, ProceduralTreeParameters>> = {
  open: {
    preset: 'open', seed: 1507, height: 9.2, trunkRadius: 0.54,
    crownStart: 0.30, crownWidth: 1.08, crownDepth: 0.88,
    primaryBranches: 7, levels: 3, branchDensity: 2, branchLengthScale: 1, branchAngle: 56,
    upward: 0.46, droop: 0.34, wander: 0.13, asymmetry: 0.22,
  },
  dome: {
    preset: 'dome', seed: 2411, height: 10.2, trunkRadius: 0.62,
    crownStart: 0.31, crownWidth: 1.22, crownDepth: 1.10,
    primaryBranches: 9, levels: 3, branchDensity: 3, branchLengthScale: 1, branchAngle: 54,
    upward: 0.54, droop: 0.24, wander: 0.10, asymmetry: 0.14,
  },
  edge: {
    preset: 'edge', seed: 3917, height: 8.6, trunkRadius: 0.50,
    crownStart: 0.28, crownWidth: 1.16, crownDepth: 0.76,
    primaryBranches: 6, levels: 3, branchDensity: 2, branchLengthScale: 1, branchAngle: 58,
    upward: 0.50, droop: 0.31, wander: 0.16, asymmetry: 0.58,
  },
  willow: {
    preset: 'willow', seed: 8261, height: 10.8, trunkRadius: 0.58,
    crownStart: 0.27, crownWidth: 1.18, crownDepth: 0.92,
    primaryBranches: 6, levels: 3, branchDensity: 3, branchLengthScale: 1, branchAngle: 48,
    upward: 0.58, droop: 0.78, wander: 0.16, asymmetry: 0.38,
  },
};

export const getProceduralTreePreset = (preset: ProceduralTreePreset) => ({ ...PRESETS[preset] });

const clampParameters = (parameters: ProceduralTreeParameters): ProceduralTreeParameters => ({
  ...parameters,
  seed: Math.trunc(parameters.seed) || 0,
  height: THREE.MathUtils.clamp(parameters.height, 4, 16),
  trunkRadius: THREE.MathUtils.clamp(parameters.trunkRadius, 0.18, 1.2),
  crownStart: THREE.MathUtils.clamp(parameters.crownStart, 0.18, 0.68),
  crownWidth: THREE.MathUtils.clamp(parameters.crownWidth, 0.55, 1.55),
  crownDepth: THREE.MathUtils.clamp(parameters.crownDepth, 0.45, 1.45),
  primaryBranches: Math.round(THREE.MathUtils.clamp(parameters.primaryBranches, 3, 12)),
  levels: parameters.levels === 2 ? 2 : 3,
  branchDensity: Math.round(THREE.MathUtils.clamp(parameters.branchDensity, 1, 4)),
  branchLengthScale: THREE.MathUtils.clamp(parameters.branchLengthScale ?? 1, 0.6, 1.4),
  branchAngle: THREE.MathUtils.clamp(parameters.branchAngle, 28, 72),
  upward: THREE.MathUtils.clamp(parameters.upward, 0, 1),
  droop: THREE.MathUtils.clamp(parameters.droop, 0, 1),
  wander: THREE.MathUtils.clamp(parameters.wander, 0, 0.4),
  asymmetry: THREE.MathUtils.clamp(parameters.asymmetry, 0, 0.8),
});

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const randomStream = (seed: number, key: string) => {
  let state = (seed ^ hashString(key)) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const signed = (random: () => number) => random() * 2 - 1;

const samplePath = (branch: ProceduralBranchPath, t: number) => {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  const scaled = clamped * (branch.points.length - 1);
  const index = Math.min(branch.points.length - 2, Math.floor(scaled));
  const localT = scaled - index;
  const position = branch.points[index].clone().lerp(branch.points[index + 1], localT);
  const tangent = branch.points[index + 1].clone().sub(branch.points[index]).normalize();
  const radius = THREE.MathUtils.lerp(branch.radii[index], branch.radii[index + 1], localT);
  return { position, tangent, radius };
};

const perpendicularBasis = (direction: THREE.Vector3) => {
  const helper = Math.abs(direction.y) < 0.92
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const normal = new THREE.Vector3().crossVectors(direction, helper).normalize();
  const binormal = new THREE.Vector3().crossVectors(direction, normal).normalize();
  return { normal, binormal };
};

const rotateAround = (vector: THREE.Vector3, axis: THREE.Vector3, angle: number) => (
  vector.clone().applyAxisAngle(axis, angle).normalize()
);

const bendDirectionToward = (
  direction: THREE.Vector3,
  target: THREE.Vector3,
  angle: number,
) => {
  if (Math.abs(angle) < 0.00001) return direction;
  const projectedTarget = target.clone()
    .addScaledVector(direction, -target.dot(direction));
  if (projectedTarget.lengthSq() < 0.00001) return direction;
  projectedTarget.normalize();
  const axis = new THREE.Vector3().crossVectors(direction, projectedTarget).normalize();
  return direction.applyAxisAngle(axis, angle).normalize();
};

const createTrunk = (
  parameters: ProceduralTreeParameters,
  version: ProceduralTreeGenerationVersion,
): ProceduralBranchPath => {
  const random = randomStream(parameters.seed, 'trunk');
  const segmentCount = version === 'species-v004' ? 16 : 11;
  const trunkHeight = version === 'species-v004' && parameters.preset === 'dome'
    ? parameters.height * 0.76
    : parameters.height;
  const points: THREE.Vector3[] = [];
  const radii: number[] = [];
  const leanAngle = random() * Math.PI * 2;
  const leanDirection = new THREE.Vector3(Math.cos(leanAngle), 0, Math.sin(leanAngle));
  const sideDirection = new THREE.Vector3(-leanDirection.z, 0, leanDirection.x);
  const lean = leanDirection.clone().multiplyScalar(
    version === 'species-v004'
      ? trunkHeight * (0.030 + parameters.asymmetry * 0.028)
      : parameters.asymmetry * trunkHeight * 0.035,
  );
  const phaseA = random() * Math.PI * 2;
  const phaseB = random() * Math.PI * 2;

  for (let index = 0; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    let position: THREE.Vector3;
    if (version === 'species-v004') {
      const envelope = Math.sin(Math.PI * t);
      const primaryBend = trunkHeight * (0.018 + parameters.wander * 0.16)
        * envelope * (0.58 + t * 0.42);
      const sBend = trunkHeight * (0.007 + parameters.wander * 0.075)
        * Math.sin(Math.PI * t * 2) * envelope;
      const lowFrequencyGnarl = trunkHeight * parameters.wander * 0.018
        * Math.sin(phaseA + t * Math.PI * 1.35) * envelope;
      position = new THREE.Vector3(0, trunkHeight * t, 0)
        .addScaledVector(lean, Math.pow(t, 1.32))
        .addScaledVector(leanDirection, primaryBend + lowFrequencyGnarl)
        .addScaledVector(sideDirection, sBend);
    } else {
      const flex = parameters.height * parameters.wander * 0.025;
      position = new THREE.Vector3(
        Math.sin(t * Math.PI * 2.1 + phaseA) * flex * (0.25 + t * 0.75),
        trunkHeight * t,
        Math.sin(t * Math.PI * 1.65 + phaseB) * flex * (0.25 + t * 0.75),
      ).addScaledVector(lean, Math.pow(t, 1.45));
    }
    points.push(position);
    const baseFlare = version === 'species-v004'
      ? 1 + Math.max(0, 1 - t / 0.16) ** 2 * 0.24
      : 1;
    radii.push(parameters.trunkRadius
      * (0.10 + 0.90 * Math.pow(1 - t, 1.08))
      * baseFlare);
  }
  return { id: 'trunk', parentT: 0, level: 0, points, radii };
};

type GrowBranchOptions = Readonly<{
  id: string;
  parentId: string;
  parentT: number;
  level: number;
  origin: THREE.Vector3;
  initialDirection: THREE.Vector3;
  length: number;
  baseRadius: number;
  leader?: boolean;
}>;

const growBranch = (
  parameters: ProceduralTreeParameters,
  options: GrowBranchOptions,
  version: ProceduralTreeGenerationVersion,
): ProceduralBranchPath => {
  const random = randomStream(parameters.seed, options.id);
  const segmentCount = version === 'species-v004'
    ? options.level === 1 ? 11 : options.level === 2 ? 8 : 5
    : options.level === 1 ? 7 : options.level === 2 ? 5 : 3;
  const segmentLength = options.length / segmentCount;
  const points = [options.origin.clone()];
  const radii = [options.baseRadius];
  const direction = options.initialDirection.clone().normalize();
  const meanDirection = direction.clone();
  const { normal, binormal } = perpendicularBasis(direction);
  const bendPhase = random() * Math.PI * 2;
  const sideBias = signed(random);
  const gnarlPhase = random() * Math.PI * 2;
  const curveAxis = normal.clone().multiplyScalar(Math.cos(bendPhase))
    .addScaledVector(binormal, Math.sin(bendPhase))
    .normalize();

  for (let index = 1; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const previous = points[index - 1];
    if (version === 'species-v004') {
      const levelWeight = options.level === 1 ? 0.72 : options.level === 2 ? 1 : 1.26;
      const leaderWeight = options.leader ? 0.58 : 1;
      const macroCurve = parameters.wander * 0.28 * levelWeight * leaderWeight
        * Math.sin(Math.PI * t) * sideBias;
      const smoothGnarl = parameters.wander * 0.13 * levelWeight
        * Math.sin(gnarlPhase + t * Math.PI * 1.6) * Math.sin(Math.PI * t);
      const target = meanDirection.clone()
        .addScaledVector(curveAxis, macroCurve)
        .addScaledVector(binormal, smoothGnarl);
      target.y += parameters.upward
        * (options.leader ? 0.12 : options.level === 1 ? 0.12 : 0.16)
        * Math.sin(Math.PI * t);
      target.y -= parameters.droop
        * (options.leader ? 0.055 : options.level === 1 ? 0.10 : 0.16)
        * Math.pow(t, 1.85);
      target.normalize();
      direction.lerp(target, options.leader ? 0.26 : 0.32).normalize();
    } else {
      const noiseScale = parameters.wander * (0.10 + options.level * 0.045);
      direction.addScaledVector(normal, signed(random) * noiseScale);
      direction.addScaledVector(binormal, signed(random) * noiseScale);
      direction.addScaledVector(normal, Math.sin(bendPhase + t * Math.PI) * sideBias * noiseScale * 0.65);
      direction.y += parameters.upward * (options.level === 1 ? 0.045 : 0.065);
      direction.y -= parameters.droop * Math.pow(t, 1.7) * (options.level === 1 ? 0.070 : 0.095);
      direction.normalize();
    }
    points.push(previous.clone().addScaledVector(direction, segmentLength));
    const tipFloor = options.leader ? 0.18 : 0.10;
    radii.push(options.baseRadius * (tipFloor + (1 - tipFloor) * Math.pow(1 - t, 1.12)));
  }

  return {
    id: options.id,
    parentId: options.parentId,
    parentT: options.parentT,
    level: options.level,
    points,
    radii,
  };
};

const crownEnvelope = (normalizedHeight: number, preset: ProceduralTreePreset) => {
  const t = THREE.MathUtils.clamp(normalizedHeight, 0, 1);
  if (preset === 'dome') return 0.30 + Math.pow(Math.sin((0.08 + t * 0.84) * Math.PI), 0.72) * 0.78;
  if (preset === 'edge') return 0.30 + Math.pow(1 - t, 0.62) * 0.72;
  return 0.26 + Math.pow(1 - t, 0.54) * 0.82;
};

const createPrimaryBranches = (
  parameters: ProceduralTreeParameters,
  trunk: ProceduralBranchPath,
  version: ProceduralTreeGenerationVersion,
) => {
  const branches: ProceduralBranchPath[] = [];
  const random = randomStream(parameters.seed, 'primary-layout');
  const phase = random() * Math.PI * 2;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const biasAngle = random() * Math.PI * 2;
  const bias = new THREE.Vector3(Math.cos(biasAngle), 0, Math.sin(biasAngle));
  const angle = THREE.MathUtils.degToRad(parameters.branchAngle);
  const denseV004 = version === 'species-v004' && parameters.preset === 'dome';
  const leaderCount = version === 'species-v004' ? denseV004 ? 3 : 2 : 0;
  const denseLeaderParentOffsets = [0.17, 0.10, 0.04];
  const denseLeaderLengths = [0.52, 0.43, 0.37];
  const denseLeaderAngles = [10, 24, 40];

  for (let index = 0; index < parameters.primaryBranches; index += 1) {
    const isLeader = index < leaderCount;
    const isCentralLeader = denseV004 && index === 0;
    const layoutT = (index + 0.35 + random() * 0.32) / parameters.primaryBranches;
    const parentT = isLeader
      ? denseV004
        ? THREE.MathUtils.clamp(
          parameters.crownStart + denseLeaderParentOffsets[index] + signed(random) * 0.010,
          0.30,
          0.54,
        )
        : THREE.MathUtils.clamp(parameters.crownStart + 0.045 + index * 0.065 + signed(random) * 0.012, 0.28, 0.56)
      : THREE.MathUtils.lerp(
        Math.max(parameters.crownStart + 0.12, 0.42),
        0.91,
        (index - leaderCount + 0.35 + random() * 0.32)
          / Math.max(1, parameters.primaryBranches - leaderCount),
      );
    const parent = samplePath(trunk, parentT);
    const azimuth = phase + index * goldenAngle + signed(random) * 0.15;
    const radial = new THREE.Vector3(
      Math.cos(azimuth) * parameters.crownWidth,
      0,
      Math.sin(azimuth) * parameters.crownDepth,
    ).normalize();
    const directionalBias = 1 + parameters.asymmetry * radial.dot(bias) * 0.52;
    const normalizedCrownHeight = (parentT - parameters.crownStart) / (1 - parameters.crownStart);
    const baseLength = isLeader
      ? parameters.height
        * (denseV004 ? denseLeaderLengths[index] : 0.44 - index * 0.030)
        * (0.94 + random() * 0.10)
      : parameters.height * 0.39
        * crownEnvelope(normalizedCrownHeight, parameters.preset)
        * directionalBias
        * (0.90 + random() * 0.20);
    const length = baseLength * (version === 'species-v004' ? parameters.branchLengthScale : 1);
    const branchAngle = isLeader
      ? THREE.MathUtils.degToRad(
        (denseV004 ? denseLeaderAngles[index] : 34 + index * 6) + signed(random) * (isCentralLeader ? 2 : 3),
      )
      : angle;
    const direction = radial.multiplyScalar(Math.sin(branchAngle))
      .addScaledVector(parent.tangent, Math.cos(branchAngle))
      .addScaledVector(
        THREE.Object3D.DEFAULT_UP,
        parameters.upward * (isCentralLeader ? 0.42 : isLeader ? 0.30 : 0.16),
      )
      .normalize();
    branches.push(growBranch(parameters, {
      id: `b1-${String(index + 1).padStart(2, '0')}`,
      parentId: trunk.id,
      parentT,
      level: 1,
      origin: parent.position,
      initialDirection: direction,
      length,
      baseRadius: Math.max(
        parameters.trunkRadius * (isLeader ? 0.26 : 0.16),
        parent.radius * (
          isCentralLeader
            ? 0.76 + random() * 0.06
            : isLeader ? 0.68 + random() * 0.08 : 0.48 + random() * 0.12
        ),
      ),
      leader: isLeader,
    }, version));
  }
  return branches;
};

const createChildBranches = (
  parameters: ProceduralTreeParameters,
  parents: readonly ProceduralBranchPath[],
  level: number,
  version: ProceduralTreeGenerationVersion,
) => {
  const children: ProceduralBranchPath[] = [];
  parents.forEach((parent) => {
    const random = randomStream(parameters.seed, `${parent.id}:children`);
    const baseCount = Math.max(1, parameters.branchDensity - Math.max(0, level - 2));
    const count = Math.min(4, baseCount + (random() > 0.62 ? 1 : 0));
    for (let index = 0; index < count; index += 1) {
      const parentT = THREE.MathUtils.clamp(
        0.36 + (index + 0.45) / count * 0.50 + signed(random) * 0.045,
        0.32,
        0.91,
      );
      const source = samplePath(parent, parentT);
      const radial = source.position.clone().setY(0);
      const { normal } = perpendicularBasis(source.tangent);
      const baseSide = radial.lengthSq() > 0.001 ? radial.normalize() : normal;
      const around = (index / count) * Math.PI * 1.65
        + (level % 2 === 0 ? 0.45 : -0.35)
        + signed(random) * 0.32;
      const side = rotateAround(baseSide, source.tangent, around);
      const childAngle = THREE.MathUtils.degToRad(
        THREE.MathUtils.clamp(parameters.branchAngle * (level === 2 ? 0.86 : 0.72), 28, 62),
      );
      const direction = source.tangent.clone().multiplyScalar(Math.cos(childAngle))
        .addScaledVector(side, Math.sin(childAngle))
        .addScaledVector(THREE.Object3D.DEFAULT_UP, parameters.upward * 0.14)
        .normalize();
      const parentLength = parent.points.reduce((sum, point, pointIndex) => (
        pointIndex === 0 ? 0 : sum + point.distanceTo(parent.points[pointIndex - 1])
      ), 0);
      const lengthRatio = level === 2 ? 0.52 : 0.43;
      children.push(growBranch(parameters, {
        id: `${parent.id}-${String(index + 1).padStart(2, '0')}`,
        parentId: parent.id,
        parentT,
        level,
        origin: source.position,
        initialDirection: direction,
        length: parentLength * lengthRatio * (0.82 + random() * 0.30),
        baseRadius: Math.max(parameters.trunkRadius * 0.018, source.radius * (0.42 + random() * 0.10)),
      }, version));
    }
  });
  return children;
};

type WillowBranchKind = 'primary' | 'secondary' | 'drape';

const growWillowBranch = (
  parameters: ProceduralTreeParameters,
  options: GrowBranchOptions,
  kind: WillowBranchKind,
): ProceduralBranchPath => {
  const random = randomStream(parameters.seed, `willow:${options.id}`);
  const segmentCount = kind === 'primary' ? 12 : kind === 'secondary' ? 9 : 8;
  const segmentLength = options.length / segmentCount;
  const points = [options.origin.clone()];
  const radii = [options.baseRadius];
  const direction = options.initialDirection.clone().normalize();
  const meanDirection = direction.clone();
  const { normal, binormal } = perpendicularBasis(direction);
  const curveAxis = normal.clone().multiplyScalar(signed(random))
    .addScaledVector(binormal, signed(random) * 0.55)
    .normalize();
  const gnarlPhase = random() * Math.PI * 2;
  const radiusRatio = THREE.MathUtils.clamp(options.baseRadius / parameters.trunkRadius, 0, 1);
  const compliance = THREE.MathUtils.lerp(0.92, 0.55, radiusRatio);
  const forwardCurve = kind === 'primary'
    ? options.leader ? 18 : 28
    : kind === 'secondary' ? 24 : 10;
  const curveBack = kind === 'primary'
    ? options.leader ? -8 : -16
    : kind === 'secondary' ? -11 : 0;

  for (let index = 1; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const apexProgress = THREE.MathUtils.smoothstep(t, 0.16, 0.58);
    const target = meanDirection.clone();
    const macroCurve = t <= 0.52
      ? forwardCurve * THREE.MathUtils.smoothstep(t, 0, 0.52)
      : THREE.MathUtils.lerp(
        forwardCurve,
        forwardCurve + curveBack,
        THREE.MathUtils.smoothstep(t, 0.52, 1),
      );
    bendDirectionToward(
      target,
      curveAxis,
      THREE.MathUtils.degToRad(macroCurve) * compliance,
    );
    if (kind === 'drape') {
      target.y = 0;
      if (target.lengthSq() < 0.001) target.copy(curveAxis).setY(0);
      target.normalize();
    }
    const wander = (
      kind === 'primary'
        ? (options.leader ? 0.10 : 0.15) + parameters.wander * 0.22
        : kind === 'secondary'
          ? 0.12 + parameters.wander * 0.30
          : parameters.wander * 0.34
    ) * Math.sin(Math.PI * t);
    target.addScaledVector(
      binormal,
      wander * compliance * Math.sin(gnarlPhase + t * Math.PI * 2) * Math.sin(Math.PI * t),
    );
    if (kind === 'primary') {
      target.y += options.leader
        ? 0.36 * (1 - t) - 0.06 * t * t
        : 0.18 * (1 - t) - 0.16 * t * t;
    } else if (kind === 'secondary') {
      target.y += 0.12 * (1 - t) - 0.25 * t * t;
    } else {
      target.y = THREE.MathUtils.lerp(
        0.38,
        -(1.65 + parameters.droop * 0.55),
        apexProgress,
      );
    }
    target.normalize();
    direction.lerp(target, kind === 'drape' ? 0.50 : 0.28).normalize();
    points.push(points[index - 1].clone().addScaledVector(direction, segmentLength));
    const tipFloor = kind === 'primary' ? 0.14 : kind === 'secondary' ? 0.10 : 0.055;
    radii.push(options.baseRadius * (tipFloor + (1 - tipFloor) * Math.pow(1 - t, 1.18)));
  }

  return {
    id: options.id,
    parentId: options.parentId,
    parentT: options.parentT,
    level: options.level,
    points,
    radii,
  };
};

const createWillowTrunk = (parameters: ProceduralTreeParameters): ProceduralBranchPath => {
  const random = randomStream(parameters.seed, 'willow:trunk');
  const segmentCount = 16;
  const points: THREE.Vector3[] = [new THREE.Vector3()];
  const radii: number[] = [];
  const leanAngle = random() * Math.PI * 2;
  const leanDirection = new THREE.Vector3(Math.cos(leanAngle), 0, Math.sin(leanAngle));
  const sideDirection = new THREE.Vector3(-leanDirection.z, 0, leanDirection.x);
  const sidePhase = random() * Math.PI * 2;
  const trunkHeight = parameters.height * 0.68;
  const segmentLength = trunkHeight / segmentCount * 1.025;
  const forwardCurve = 26 + parameters.asymmetry * 8;
  const curveBack = -(14 + parameters.wander * 10);
  for (let index = 0; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const flare = 1 + Math.max(0, 1 - t / 0.18) ** 2 * 0.30;
    const postForkTaper = THREE.MathUtils.lerp(
      1,
      0.72,
      THREE.MathUtils.smoothstep(t, 0.30, 0.58),
    );
    const radius = parameters.trunkRadius * flare
      * (0.11 + 0.89 * Math.pow(1 - t, 1.06))
      * postForkTaper;
    radii.push(radius);
    if (index === 0) continue;

    const compliance = THREE.MathUtils.lerp(
      0.96,
      0.36,
      THREE.MathUtils.clamp(radius / parameters.trunkRadius, 0, 1),
    );
    const macroCurve = t <= 0.52
      ? forwardCurve * THREE.MathUtils.smoothstep(t, 0, 0.52)
      : THREE.MathUtils.lerp(
        forwardCurve,
        forwardCurve + curveBack,
        THREE.MathUtils.smoothstep(t, 0.52, 1),
      );
    const direction = new THREE.Vector3(0, 1, 0);
    bendDirectionToward(
      direction,
      leanDirection,
      THREE.MathUtils.degToRad(macroCurve) * compliance,
    );
    const sideCurve = (7 + parameters.wander * 12)
      * Math.sin(sidePhase + t * Math.PI * 2)
      * Math.sin(Math.PI * t);
    bendDirectionToward(
      direction,
      sideDirection,
      THREE.MathUtils.degToRad(sideCurve) * compliance,
    );
    direction.lerp(THREE.Object3D.DEFAULT_UP, 0.015 + t * 0.025).normalize();
    points.push(points[index - 1].clone().addScaledVector(direction, segmentLength));
  }
  return { id: 'trunk', parentT: 0, level: 0, points, radii };
};

const createWillowBranches = (
  parameters: ProceduralTreeParameters,
  trunk: ProceduralBranchPath,
) => {
  const primary: ProceduralBranchPath[] = [];
  const secondary: ProceduralBranchPath[] = [];
  const drapes: ProceduralBranchPath[] = [];
  const layoutRandom = randomStream(parameters.seed, 'willow:primary-layout');
  const phase = layoutRandom() * Math.PI * 2;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < parameters.primaryBranches; index += 1) {
    const random = randomStream(parameters.seed, `willow:primary:${index}`);
    const isCoLeader = index < 2;
    const parentT = THREE.MathUtils.clamp(
      isCoLeader
        ? 0.28 + index * 0.075 + signed(random) * 0.012
        : 0.43 + (index - 2) / Math.max(1, parameters.primaryBranches - 3) * 0.38
          + signed(random) * 0.022,
      0.26,
      0.84,
    );
    const source = samplePath(trunk, parentT);
    const azimuth = isCoLeader
      ? phase + index * Math.PI + signed(random) * 0.08
      : phase + 0.82 + (index - 2) * goldenAngle + signed(random) * 0.16;
    const radial = new THREE.Vector3(
      Math.cos(azimuth) * parameters.crownWidth,
      0,
      Math.sin(azimuth) * parameters.crownDepth,
    ).normalize();
    const direction = radial.multiplyScalar(isCoLeader ? 0.52 : 0.68 + random() * 0.08)
      .addScaledVector(source.tangent, isCoLeader ? 0.55 : 0.34)
      .addScaledVector(
        THREE.Object3D.DEFAULT_UP,
        isCoLeader ? 0.34 + parameters.upward * 0.18 : 0.22 + parameters.upward * 0.16,
      )
      .normalize();
    primary.push(growWillowBranch(parameters, {
      id: `b1-${String(index + 1).padStart(2, '0')}`,
      parentId: trunk.id,
      parentT,
      level: 1,
      origin: source.position,
      initialDirection: direction,
      length: parameters.height * (isCoLeader ? 0.53 + random() * 0.06 : 0.35 + random() * 0.09),
      baseRadius: Math.max(
        parameters.trunkRadius * (isCoLeader ? 0.36 : 0.20),
        source.radius * (isCoLeader ? 0.82 + random() * 0.06 : 0.54 + random() * 0.08),
      ),
      leader: isCoLeader,
    }, 'primary'));
  }

  primary.forEach((parent) => {
    const random = randomStream(parameters.seed, `willow:${parent.id}:secondary-layout`);
    const count = Math.min(4, Math.max(2, parameters.branchDensity));
    for (let index = 0; index < count; index += 1) {
      const parentT = THREE.MathUtils.clamp(
        0.34 + (index + 0.45) / count * 0.52 + signed(random) * 0.035,
        0.34,
        0.91,
      );
      const source = samplePath(parent, parentT);
      const radial = source.position.clone().setY(0).normalize();
      const { normal } = perpendicularBasis(source.tangent);
      const baseSide = radial.lengthSq() > 0.001 ? radial : normal;
      const side = rotateAround(
        baseSide,
        source.tangent,
        index / count * Math.PI * 1.55 + signed(random) * 0.28,
      );
      const direction = source.tangent.clone().multiplyScalar(0.58)
        .addScaledVector(side, 0.64)
        .addScaledVector(THREE.Object3D.DEFAULT_UP, 0.22 + parameters.upward * 0.12)
        .normalize();
      const branch = growWillowBranch(parameters, {
        id: `${parent.id}-${String(index + 1).padStart(2, '0')}`,
        parentId: parent.id,
        parentT,
        level: 2,
        origin: source.position,
        initialDirection: direction,
        length: parameters.height * (0.24 + random() * 0.075),
        baseRadius: Math.max(parameters.trunkRadius * 0.035, source.radius * (0.43 + random() * 0.08)),
      }, 'secondary');
      secondary.push(branch);
    }
  });

  secondary.forEach((parent) => {
    const random = randomStream(parameters.seed, `willow:${parent.id}:drape-layout`);
    const count = 2 + (random() > 0.42 ? 1 : 0);
    for (let index = 0; index < count; index += 1) {
      const parentT = THREE.MathUtils.clamp(
        0.42 + (index + 0.35) / count * 0.50 + signed(random) * 0.035,
        0.40,
        0.93,
      );
      const source = samplePath(parent, parentT);
      const { normal, binormal } = perpendicularBasis(source.tangent);
      const sideAngle = index / count * Math.PI * 1.65 + signed(random) * 0.45;
      const side = normal.multiplyScalar(Math.cos(sideAngle))
        .addScaledVector(binormal, Math.sin(sideAngle));
      const direction = source.tangent.clone().multiplyScalar(0.50)
        .addScaledVector(side, 0.28)
        .addScaledVector(THREE.Object3D.DEFAULT_UP, 0.42)
        .normalize();
      drapes.push(growWillowBranch(parameters, {
        id: `${parent.id}-d${String(index + 1).padStart(2, '0')}`,
        parentId: parent.id,
        parentT,
        level: 3,
        origin: source.position,
        initialDirection: direction,
        length: parameters.height * (0.30 + random() * 0.14),
        baseRadius: Math.max(parameters.trunkRadius * 0.012, source.radius * (0.27 + random() * 0.07)),
      }, 'drape'));
    }
  });

  return { primary, secondary, drapes };
};

const createFoliageAnchors = (
  branches: readonly ProceduralBranchPath[],
  version: ProceduralTreeGenerationVersion,
) => {
  const anchors: ProceduralFoliageAnchor[] = [];
  branches.filter((branch) => branch.level > 0).forEach((branch) => {
    const samples = version === 'willow-v001'
      ? branch.level === 2
        ? [0.78, 0.96]
        : branch.level === 3
          ? [0.18, 0.34, 0.50, 0.66, 0.82, 0.98]
          : []
      : branch.level === 1
        ? [0.86]
        : branch.level === 2
          ? [0.54, 0.78, 0.98]
          : [0.58, 0.82, 0.98];
    samples.forEach((branchT, index) => {
      const sample = samplePath(branch, branchT);
      let outward = sample.position.clone().setY(0);
      if (outward.lengthSq() < 0.001) outward = perpendicularBasis(sample.tangent).normal;
      outward.normalize();
      anchors.push({
        id: `foliage-${branch.id}-${index + 1}`,
        branchId: branch.id,
        branchT,
        level: branch.level,
        position: sample.position,
        tangent: sample.tangent,
        outward,
        radius: sample.radius,
        scale: THREE.MathUtils.clamp(0.48 + branchT * 0.34 + branch.level * 0.08, 0.55, 1.08),
      });
    });
  });
  return anchors;
};

const createWillowCrownLobes = (
  parameters: ProceduralTreeParameters,
  branches: readonly ProceduralBranchPath[],
) => branches.filter((branch) => branch.level === 2).map((branch) => {
  const drapes = branches.filter((candidate) => candidate.parentId === branch.id && candidate.level === 3);
  const curtainPoints = drapes.flatMap((drape) => drape.points.slice(1));
  const fallback = samplePath(branch, 0.82).position;
  const bounds = new THREE.Box3();
  (curtainPoints.length > 0 ? curtainPoints : [fallback]).forEach((point) => bounds.expandByPoint(point));
  const position = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  let outward = position.clone().setY(0);
  if (outward.lengthSq() < 0.001) outward = perpendicularBasis(samplePath(branch, 0.82).tangent).normal;
  outward.normalize();
  return {
    id: `willow-curtain-${branch.id}`,
    branchId: branch.id,
    branchT: 0.82,
    position,
    radii: new THREE.Vector3(
      Math.max(0.42, size.x * 0.5 + parameters.height * 0.025),
      Math.max(0.82, size.y * 0.5 + parameters.height * 0.035),
      Math.max(0.42, size.z * 0.5 + parameters.height * 0.025),
    ),
    outward,
    attachmentPoints: drapes.flatMap((drape) => [drape.points[1], drape.points.at(-1)!]),
    maxAttachmentDistance: 0,
    cohesionShift: 0,
  };
});

const createCrownLobes = (
  parameters: ProceduralTreeParameters,
  branches: readonly ProceduralBranchPath[],
  version: ProceduralTreeGenerationVersion,
) => {
  if (version === 'willow-v001') return createWillowCrownLobes(parameters, branches);
  const primaryBranches = branches.filter((branch) => branch.level === 1);
  const lobes: ProceduralCrownLobe[] = primaryBranches.map((branch, index) => {
    const random = randomStream(parameters.seed, `${branch.id}:crown-lobe`);
    const branchT = 0.68 + random() * 0.16;
    const sample = samplePath(branch, branchT);
    const outward = sample.position.clone().setY(0);
    if (outward.lengthSq() < 0.001) outward.copy(perpendicularBasis(sample.tangent).normal);
    outward.normalize();
    const baseRadius = parameters.height * (parameters.preset === 'dome' ? 0.175 : 0.145);
    const variation = 0.88 + random() * 0.20;
    return {
      id: `crown-${branch.id}`,
      branchId: branch.id,
      branchT,
      position: sample.position.clone().addScaledVector(THREE.Object3D.DEFAULT_UP, baseRadius * 0.10),
      radii: new THREE.Vector3(
        baseRadius * parameters.crownWidth * variation,
        baseRadius * THREE.MathUtils.lerp(0.68, 0.82, random()),
        baseRadius * parameters.crownDepth * THREE.MathUtils.lerp(0.90, 1.08, random()),
      ),
      outward,
      attachmentPoints: [],
      maxAttachmentDistance: 0,
      cohesionShift: 0,
    };
  });

  const trunk = branches[0];
  const fillLevels = parameters.preset === 'dome' ? [0.28, 0.53, 0.75] : [0.36, 0.68];
  const activeFillLevels = version === 'species-v004' ? fillLevels.slice(1) : fillLevels;
  activeFillLevels.forEach((crownT) => {
    const fillIndex = fillLevels.indexOf(crownT);
    const parentT = THREE.MathUtils.lerp(parameters.crownStart, 0.94, crownT);
    const sample = samplePath(trunk, parentT);
    const crownProgress = (parentT - parameters.crownStart) / (1 - parameters.crownStart);
    const envelope = crownEnvelope(crownProgress, parameters.preset);
    const baseRadius = parameters.height * (parameters.preset === 'dome' ? 0.19 : 0.15) * envelope;
    lobes.push({
      id: `crown-trunk-${fillIndex + 1}`,
      branchId: trunk.id,
      branchT: parentT,
      position: sample.position.clone().addScaledVector(THREE.Object3D.DEFAULT_UP, baseRadius * 0.08),
      radii: new THREE.Vector3(
        baseRadius * parameters.crownWidth,
        baseRadius * (fillIndex === fillLevels.length - 1 ? 0.72 : 0.82),
        baseRadius * parameters.crownDepth,
      ),
      outward: new THREE.Vector3(0, 1, 0),
      attachmentPoints: [],
      maxAttachmentDistance: 0,
      cohesionShift: 0,
    });
  });
  return lobes;
};

const normalizedEllipsoidDistance = (
  point: THREE.Vector3,
  center: THREE.Vector3,
  radii: THREE.Vector3,
) => Math.hypot(
  (point.x - center.x) / Math.max(0.001, radii.x),
  (point.y - center.y) / Math.max(0.001, radii.y),
  (point.z - center.z) / Math.max(0.001, radii.z),
);

const resolvePrimaryBranchId = (
  branch: ProceduralBranchPath,
  branchById: ReadonlyMap<string, ProceduralBranchPath>,
) => {
  let current = branch;
  while (current.level > 1 && current.parentId) {
    const parent = branchById.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current.level === 1 ? current.id : undefined;
};

const sampleBranchTail = (branch: ProceduralBranchPath, wrapLength: number) => {
  const start = THREE.MathUtils.clamp(1 - wrapLength, 0.36, 0.92);
  return [start, THREE.MathUtils.lerp(start, 1, 0.52), 1]
    .map((branchT) => samplePath(branch, branchT).position);
};

export const refineProceduralCrownLobes = (
  skeleton: ProceduralTreeSkeleton,
  wrapLength: number,
  matureBroadleafCohesion = false,
) => {
  if (skeleton.crownLobes.length === 0) return [];
  const branchById = new Map(skeleton.branches.map((branch) => [branch.id, branch]));
  const centroid = skeleton.crownLobes.reduce(
    (sum, lobe) => sum.add(lobe.position),
    new THREE.Vector3(),
  ).multiplyScalar(1 / skeleton.crownLobes.length);
  const terminalByPrimary = new Map<string, ProceduralBranchPath[]>();
  skeleton.branches
    .filter((branch) => branch.level === 2)
    .forEach((branch) => {
      const primaryId = resolvePrimaryBranchId(branch, branchById);
      if (!primaryId) return;
      const entries = terminalByPrimary.get(primaryId) ?? [];
      entries.push(branch);
      terminalByPrimary.set(primaryId, entries);
    });

  const highestTrunkLobe = skeleton.crownLobes
    .filter((lobe) => lobe.branchId === 'trunk')
    .reduce<ProceduralCrownLobe | undefined>((highest, lobe) => (
      !highest || lobe.branchT > highest.branchT ? lobe : highest
    ), undefined);

  const upperPrimaryLobes = skeleton.crownLobes.filter((lobe) => (
    lobe.branchId !== 'trunk' && lobe.position.y >= centroid.y
  ));
  const upperCrownCenter = upperPrimaryLobes.length > 0
    ? upperPrimaryLobes.reduce(
      (sum, lobe) => sum.add(lobe.position),
      new THREE.Vector3(),
    ).multiplyScalar(1 / upperPrimaryLobes.length)
    : centroid.clone();
  const upperCrownRange = Math.max(
    skeleton.parameters.height * 0.18,
    ...skeleton.crownLobes.map((lobe) => Math.abs(lobe.position.y - centroid.y)),
  );

  return skeleton.crownLobes.map((lobe) => {
    const upperWeight = matureBroadleafCohesion
      ? THREE.MathUtils.smoothstep(
        (lobe.position.y - centroid.y) / upperCrownRange,
        -0.08,
        0.78,
      )
      : 0;
    const horizontalSpread = matureBroadleafCohesion
      ? THREE.MathUtils.lerp(0.84, 0.78, upperWeight)
      : 0.86;
    const verticalSpread = matureBroadleafCohesion ? 0.78 : 0.92;
    const center = new THREE.Vector3(
      centroid.x + (lobe.position.x - centroid.x) * horizontalSpread,
      centroid.y + (lobe.position.y - centroid.y) * verticalSpread,
      centroid.z + (lobe.position.z - centroid.z) * horizontalSpread,
    );
    if (matureBroadleafCohesion && highestTrunkLobe?.id === lobe.id) {
      center.x = THREE.MathUtils.lerp(center.x, upperCrownCenter.x, 0.52);
      center.y = THREE.MathUtils.lerp(center.y, upperCrownCenter.y, 0.62);
      center.z = THREE.MathUtils.lerp(center.z, upperCrownCenter.z, 0.52);
    }
    const cohesionShift = center.distanceTo(lobe.position);
    const attachmentPoints: THREE.Vector3[] = [];
    const host = branchById.get(lobe.branchId);
    if (host && host.level === 1) {
      attachmentPoints.push(...sampleBranchTail(host, wrapLength));
      const representativeChildren = [...(terminalByPrimary.get(host.id) ?? [])]
        .sort((a, b) => (
          b.points.at(-1)!.distanceToSquared(lobe.position)
          - a.points.at(-1)!.distanceToSquared(lobe.position)
        ))
        .slice(0, 2);
      representativeChildren.forEach((branch) => {
        const tail = sampleBranchTail(branch, wrapLength);
        attachmentPoints.push(tail[0], tail[2]);
      });
    } else if (highestTrunkLobe?.id === lobe.id && host) {
      attachmentPoints.push(...sampleBranchTail(host, wrapLength));
    }

    const radii = lobe.radii.clone();
    if (matureBroadleafCohesion) {
      const shoulderScale = 1 + upperWeight * 0.14;
      radii.x *= shoulderScale;
      radii.z *= shoulderScale;
      if (highestTrunkLobe?.id === lobe.id) {
        radii.x *= 1.12;
        radii.y *= 1.06;
        radii.z *= 1.12;
      }
    }
    for (let pass = 0; pass < 4; pass += 1) {
      attachmentPoints.forEach((point) => {
        const distance = normalizedEllipsoidDistance(point, center, radii);
        if (distance <= 0.72) return;
        const correction = 1 - 0.72 / distance;
        center.add(point.clone().sub(center).multiplyScalar(correction * 0.58));
      });
    }
    const maxBeforeScale = attachmentPoints.reduce(
      (maximum, point) => Math.max(maximum, normalizedEllipsoidDistance(point, center, radii)),
      0,
    );
    if (maxBeforeScale > 0.72) radii.multiplyScalar(maxBeforeScale / 0.72);
    const maxAttachmentDistance = attachmentPoints.reduce(
      (maximum, point) => Math.max(maximum, normalizedEllipsoidDistance(point, center, radii)),
      0,
    );

    return {
      ...lobe,
      position: center,
      radii,
      attachmentPoints,
      maxAttachmentDistance,
      cohesionShift,
    };
  });
};

const calculateMaxTurn = (branches: readonly ProceduralBranchPath[]) => branches.reduce((maximum, branch) => {
  for (let index = 1; index < branch.points.length - 1; index += 1) {
    const incoming = branch.points[index].clone().sub(branch.points[index - 1]).normalize();
    const outgoing = branch.points[index + 1].clone().sub(branch.points[index]).normalize();
    maximum = Math.max(maximum, THREE.MathUtils.radToDeg(incoming.angleTo(outgoing)));
  }
  return maximum;
}, 0);

const calculateSkeletonSignature = (branches: readonly ProceduralBranchPath[]) => {
  let hash = 2166136261;
  const write = (value: number) => {
    hash ^= Math.round(value * 10000);
    hash = Math.imul(hash, 16777619);
  };
  branches.forEach((branch) => {
    branch.points.forEach((point, index) => {
      write(point.x);
      write(point.y);
      write(point.z);
      write(branch.radii[index] ?? 0);
    });
  });
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const generateProceduralTreeSkeleton = (
  input: ProceduralTreeParameters,
  version: ProceduralTreeGenerationVersion = 'legacy-v003',
): ProceduralTreeSkeleton => {
  const parameters = clampParameters(input);
  const trunk = version === 'willow-v001'
    ? createWillowTrunk(parameters)
    : createTrunk(parameters, version);
  const willowBranches = version === 'willow-v001'
    ? createWillowBranches(parameters, trunk)
    : undefined;
  const primary = willowBranches?.primary ?? createPrimaryBranches(parameters, trunk, version);
  const secondary = willowBranches?.secondary ?? createChildBranches(parameters, primary, 2, version);
  const tertiary = willowBranches?.drapes ?? (parameters.levels === 3
    ? createChildBranches(parameters, secondary, 3, version)
    : []);
  const branches = [trunk, ...primary, ...secondary, ...tertiary];
  const foliageAnchors = createFoliageAnchors(branches, version);
  const crownLobes = createCrownLobes(parameters, branches, version);
  const bounds = new THREE.Box3();
  branches.forEach((branch) => branch.points.forEach((point) => bounds.expandByPoint(point)));
  const maxTurnDegrees = calculateMaxTurn(branches);
  const trunkHorizontalDeviation = trunk.points.reduce(
    (maximum, point) => Math.max(maximum, Math.hypot(point.x, point.z)),
    0,
  );

  return {
    parameters,
    branches,
    foliageAnchors,
    crownLobes,
    bounds,
    stats: {
      branches: branches.length,
      branchSegments: branches.reduce((total, branch) => total + branch.points.length - 1, 0),
      foliageAnchors: foliageAnchors.length,
      crownLobes: crownLobes.length,
      maxTurnDegrees: Number(maxTurnDegrees.toFixed(1)),
      maxAttachmentDistance: 0,
      trunkHorizontalDeviation: Number(trunkHorizontalDeviation.toFixed(3)),
      skeletonSignature: calculateSkeletonSignature(branches),
    },
  };
};

export const createProceduralBranchGeometry = (
  branch: ProceduralBranchPath,
  colorOptions?: ProceduralBranchGeometryColorOptions,
) => {
  let curvePoints = branch.points.map((point) => point.clone());
  const parentBranch = colorOptions?.parentBranch;
  if (branch.level > 0 && parentBranch && curvePoints.length > 1) {
    const parent = samplePath(parentBranch, branch.parentT);
    const childTangent = curvePoints[1].clone().sub(curvePoints[0]).normalize();
    const axialAlignment = Math.abs(childTangent.dot(parent.tangent));
    const perpendicularRate = Math.sqrt(Math.max(
      0.02,
      1 - axialAlignment ** 2,
    ));
    const childRadialReach = branch.radii[0] * axialAlignment;
    const shallowOverlap = Math.min(parent.radius * 0.08, branch.radii[0] * 0.22);
    let remainingTrim = Math.max(
      0,
      (parent.radius - childRadialReach) / perpendicularRate - shallowOverlap,
    );
    for (let index = 1; index < curvePoints.length; index += 1) {
      const previous = curvePoints[index - 1];
      const next = curvePoints[index];
      const segmentLength = previous.distanceTo(next);
      if (remainingTrim >= segmentLength && index < curvePoints.length - 1) {
        remainingTrim -= segmentLength;
        continue;
      }
      const trimmedStart = previous.clone().lerp(
        next,
        THREE.MathUtils.clamp(remainingTrim / Math.max(segmentLength, 0.0001), 0, 0.96),
      );
      curvePoints = [trimmedStart, ...curvePoints.slice(index)];
      break;
    }
  }
  const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'centripetal');
  const tubularSegments = Math.max(5, (branch.points.length - 1) * (branch.level === 0 ? 4 : 3));
  const radialSegments = branch.level === 0 ? 9 : branch.level === 1 ? 7 : 6;
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const baseColor = colorOptions ? new THREE.Color(colorOptions.baseColor) : undefined;
  const foliageColor = colorOptions ? new THREE.Color(colorOptions.foliageColor) : undefined;
  const maxBranchRadius = colorOptions
    ? Math.max(0.001, colorOptions.maxBranchRadius)
    : 1;
  const bounceStrength = THREE.MathUtils.clamp(colorOptions?.bounceStrength ?? 0, 0, 1);
  const readableBounceStrength = 1 - (1 - bounceStrength) ** 4;

  const smoothstep = (edge0: number, edge1: number, value: number) => {
    const t = THREE.MathUtils.clamp((value - edge0) / Math.max(0.001, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const crownWeightAt = (position: THREE.Vector3) => colorOptions?.crownLobes.reduce(
    (maximum, lobe) => Math.max(
      maximum,
      1 - smoothstep(0.38, 1.04, normalizedEllipsoidDistance(position, lobe.position, lobe.radii)),
    ),
    0,
  ) ?? 0;

  for (let ring = 0; ring <= tubularSegments; ring += 1) {
    const t = ring / tubularSegments;
    const center = curve.getPointAt(t);
    const scaled = t * (branch.radii.length - 1);
    const radiusIndex = Math.min(branch.radii.length - 2, Math.floor(scaled));
    const radius = THREE.MathUtils.lerp(
      branch.radii[radiusIndex],
      branch.radii[radiusIndex + 1],
      scaled - radiusIndex,
    );
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = side / radialSegments * Math.PI * 2;
      const offset = frames.normals[ring].clone().multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(frames.binormals[ring], Math.sin(angle) * radius);
      positions.push(center.x + offset.x, center.y + offset.y, center.z + offset.z);
      if (baseColor && foliageColor) {
        const crownWeight = crownWeightAt(center);
        const radiusMask = 1 - smoothstep(
          maxBranchRadius * 0.46,
          maxBranchRadius,
          radius,
        );
        const levelWeight = branch.level === 1 ? 0.16 : branch.level === 2 ? 0.82 : branch.level >= 3 ? 1 : 0;
        const bounce = crownWeight * radiusMask * levelWeight
          * readableBounceStrength;
        const vertexColor = baseColor.clone().lerp(foliageColor, bounce);
        colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
      }
    }
  }

  for (let ring = 0; ring < tubularSegments; ring += 1) {
    const current = ring * radialSegments;
    const next = (ring + 1) * radialSegments;
    for (let side = 0; side < radialSegments; side += 1) {
      const nextSide = (side + 1) % radialSegments;
      indices.push(
        current + side, next + nextSide, next + side,
        current + side, current + nextSide, next + nextSide,
      );
    }
  }

  const startCenterIndex = positions.length / 3;
  const endCenterIndex = startCenterIndex + 1;
  positions.push(...curve.getPointAt(0).toArray());
  positions.push(...curve.getPointAt(1).toArray());
  if (colors.length > 0) {
    const endRingColorOffset = tubularSegments * radialSegments * 3;
    colors.push(colors[0], colors[1], colors[2]);
    colors.push(
      colors[endRingColorOffset],
      colors[endRingColorOffset + 1],
      colors[endRingColorOffset + 2],
    );
  }
  const endRingStart = tubularSegments * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const nextSide = (side + 1) % radialSegments;
    indices.push(startCenterIndex, nextSide, side);
    indices.push(
      endCenterIndex, endRingStart + side, endRingStart + nextSide,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colors.length > 0) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  const faceted = geometry.toNonIndexed();
  geometry.dispose();
  if (colorOptions?.longitudinalSmoothing) {
    return toCreasedNormals(faceted, THREE.MathUtils.degToRad(28));
  }
  faceted.computeVertexNormals();
  return faceted;
};
