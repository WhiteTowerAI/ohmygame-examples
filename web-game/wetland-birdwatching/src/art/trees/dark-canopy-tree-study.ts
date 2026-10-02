import * as THREE from 'three';

export type DarkCanopyVec3Tuple = readonly [number, number, number];
export type DarkCanopyLobeVariant = 'broad' | 'swept' | 'fan' | 'crown';
type Vec3Tuple = DarkCanopyVec3Tuple;
type CanopyLobeVariant = DarkCanopyLobeVariant;

export type DarkCanopyBranchPathSpec = {
  id: string;
  points: readonly Vec3Tuple[];
  startRadius: number;
  endRadius: number;
  tone: number;
};
type BranchPathSpec = DarkCanopyBranchPathSpec;

export type DarkCanopyLobeSpec = {
  id: string;
  variant: CanopyLobeVariant;
  mount: Vec3Tuple;
  supportVisible?: boolean;
  position: Vec3Tuple;
  scale: Vec3Tuple;
  rotation: Vec3Tuple;
  tone: number;
};
type CanopyLobeSpec = DarkCanopyLobeSpec;

export type DarkCanopyTreeStudy = {
  root: THREE.Group;
  collisionProxy: THREE.Object3D;
  perches: readonly { id: string; position: THREE.Vector3; forward: THREE.Vector3 }[];
  stats: {
    branchMeshes: number;
    branchSegments: number;
    canopyLobes: number;
    instancedMeshes: number;
    uniqueGeometries: number;
    uniqueMaterials: number;
    approximateTriangles: number;
    maxBranchControlTurnDegrees: number;
  };
  setSilhouette: (enabled: boolean) => void;
};

const tupleToVector = ([x, y, z]: Vec3Tuple) => new THREE.Vector3(x, y, z);
export const darkCanopyDepthScale = 0.82;
const canopyDepthScale = darkCanopyDepthScale;
const tupleToSpatialPosition = ([x, y, z]: Vec3Tuple) => new THREE.Vector3(x, y, z * canopyDepthScale);

export const getDarkCanopyBranchCurvePoints = (spec: BranchPathSpec) => {
  const points = spec.points.map(tupleToSpatialPosition);
  if (points.length < 3 || spec.id.startsWith('foliage-support')) return points;
  const start = points[0];
  const end = points[points.length - 1];
  const straightening = spec.id === 'trunk' ? 0.16 : spec.id.startsWith('root-') ? 0.42 : 0.68;
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return point;
    const linearPoint = start.clone().lerp(end, index / (points.length - 1));
    return point.clone().lerp(linearPoint, straightening);
  });
};
const getBranchCurvePoints = getDarkCanopyBranchCurvePoints;

const createTaperedBranchGeometry = (spec: BranchPathSpec) => {
  const curve = new THREE.CatmullRomCurve3(getBranchCurvePoints(spec), false, 'centripetal');
  const tubularSegments = Math.max(6, (spec.points.length - 1) * 5);
  const radialSegments = 8;
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring <= tubularSegments; ring += 1) {
    const t = ring / tubularSegments;
    const center = curve.getPointAt(t);
    const radius = THREE.MathUtils.lerp(spec.startRadius, spec.endRadius, Math.pow(t, 0.78));
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
    const current = ring * radialSegments;
    const next = (ring + 1) * radialSegments;
    for (let side = 0; side < radialSegments; side += 1) {
      const nextSide = (side + 1) % radialSegments;
      indices.push(
        current + side, next + side, next + nextSide,
        current + side, next + nextSide, current + nextSide,
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

type UmbrellaProfile = {
  width: number;
  depth: number;
  dome: number;
  underside: number;
  seed: number;
  sweep: number;
  droop: number;
};

const umbrellaProfiles: Record<CanopyLobeVariant, UmbrellaProfile> = {
  broad: { width: 1.80, depth: 0.96, dome: 0.70, underside: 0.23, seed: 1.7, sweep: -0.06, droop: 0.25 },
  swept: { width: 1.65, depth: 0.82, dome: 0.64, underside: 0.22, seed: 3.2, sweep: 0.30, droop: 0.23 },
  fan: { width: 1.40, depth: 1.12, dome: 0.72, underside: 0.24, seed: 4.6, sweep: -0.20, droop: 0.22 },
  crown: { width: 1.18, depth: 0.94, dome: 0.82, underside: 0.25, seed: 6.1, sweep: 0.12, droop: 0.20 },
};

export const createDarkCanopyLobeGeometry = (variant: CanopyLobeVariant) => {
  const profile = umbrellaProfiles[variant];
  const segments = 14;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const topMiddle: number[] = [];
  const topEdge: number[] = [];
  const bottomEdge: number[] = [];
  const bottomMiddle: number[] = [];
  const bottomInner: number[] = [];

  const addVertex = (x: number, y: number, z: number, shade: number) => {
    positions.push(x, y, z);
    colors.push(shade, shade, shade);
    return positions.length / 3 - 1;
  };

  const topCenter = addVertex(profile.sweep * 0.25, profile.dome * 0.88, 0, 1.00);
  const bottomCenter = addVertex(profile.sweep * 0.10, profile.underside * 0.04, 0, 0.82);

  for (let index = 0; index < segments; index += 1) {
    const angle = index / segments * Math.PI * 2;
    const irregularity = 1
      + Math.sin(angle * 3 + profile.seed) * 0.16
      + Math.sin(angle * 5 - profile.seed * 0.6) * 0.08;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const middleRadius = 0.52;
    const distalWeight = Math.pow(Math.max(0, cos), 1.45);
    const proximalWeight = Math.pow(Math.max(0, -cos), 1.65);
    const endWeight = distalWeight + proximalWeight * 0.48;
    const macroLobe = Math.sin(angle * 3 + profile.seed * 0.83);
    const secondaryLobe = Math.sin(angle * 2 - profile.seed * 0.57);
    const fineLobe = Math.sin(angle * 5 + profile.seed * 1.31);
    const rimOffset = profile.droop * (macroLobe * 0.36 + secondaryLobe * 0.19 + fineLobe * 0.08);
    const edgeDrop = profile.droop * (0.24 + distalWeight * 0.52 + proximalWeight * 0.18);
    const sweepOffset = profile.sweep * (0.35 + cos * 0.18);
    const edgeX = cos * profile.width * irregularity + sweepOffset;
    const edgeZ = sin * profile.depth * (1 + Math.cos(angle * 2 + profile.seed) * 0.06);
    const middleX = cos * profile.width * middleRadius + sweepOffset * 0.55;
    const middleZ = sin * profile.depth * middleRadius;
    const edgeY = rimOffset - edgeDrop;
    const undersidePocket = 0.5 + Math.sin(angle * 3 - profile.seed * 0.72) * 0.5;
    const edgeThickness = profile.underside * (0.11 + undersidePocket * 0.12);
    topMiddle.push(addVertex(
      middleX,
      profile.dome * (0.68 + (1 - endWeight) * 0.08) + rimOffset * 0.24 - edgeDrop * 0.10,
      middleZ,
      0.94,
    ));
    topEdge.push(addVertex(edgeX, edgeY, edgeZ, 0.88));
    const bottomInset = 0.92 + Math.sin(angle * 3 - profile.seed) * 0.022;
    bottomEdge.push(addVertex(
      edgeX * bottomInset + profile.sweep * 0.02,
      edgeY - edgeThickness,
      edgeZ * bottomInset,
      0.80,
    ));
    bottomMiddle.push(addVertex(
      middleX,
      -profile.underside * (0.72 + undersidePocket * 0.18) + rimOffset * 0.34 - edgeDrop * 0.10,
      middleZ,
      0.80,
    ));
    bottomInner.push(addVertex(
      cos * profile.width * 0.22 + sweepOffset * 0.24,
      -profile.underside * (0.18 + undersidePocket * 0.16) + rimOffset * 0.12,
      sin * profile.depth * 0.22,
      0.82,
    ));
  }

  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    indices.push(
      topCenter, topMiddle[next], topMiddle[index],
      topMiddle[index], topMiddle[next], topEdge[next],
      topMiddle[index], topEdge[next], topEdge[index],
      bottomCenter, bottomInner[index], bottomInner[next],
      bottomInner[index], bottomMiddle[index], bottomMiddle[next],
      bottomInner[index], bottomMiddle[next], bottomInner[next],
      bottomMiddle[index], bottomEdge[index], bottomEdge[next],
      bottomMiddle[index], bottomEdge[next], bottomMiddle[next],
      topEdge[index], topEdge[next], bottomEdge[next],
      topEdge[index], bottomEdge[next], bottomEdge[index],
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
const createCanopyLobeGeometry = createDarkCanopyLobeGeometry;

export const darkCanopyBranchPaths: readonly BranchPathSpec[] = [
  { id: 'trunk', points: [[0, 0, 0], [0.05, 1.35, -0.03], [-0.10, 2.65, 0.06], [0.12, 3.85, -0.04], [-0.08, 5.10, 0.10], [0.10, 6.25, -0.06], [-0.04, 7.35, 0.04]], startRadius: 0.60, endRadius: 0.070, tone: 0 },
  { id: 'root-west', points: [[0, 0.22, 0], [-0.48, 0.08, 0.20], [-1.08, 0.01, 0.46]], startRadius: 0.23, endRadius: 0.035, tone: 1 },
  { id: 'root-east', points: [[0, 0.20, 0], [0.46, 0.07, -0.12], [1.02, 0.01, -0.40]], startRadius: 0.22, endRadius: 0.032, tone: 1 },
  { id: 'root-back', points: [[0, 0.18, 0], [-0.10, 0.06, -0.42], [-0.28, 0.01, -0.92]], startRadius: 0.18, endRadius: 0.030, tone: 2 },
  { id: 'low-west-front', points: [[-0.06, 2.45, 0.04], [-0.62, 3.12, 0.82], [-1.56, 3.66, 1.76], [-2.72, 4.28, 1.58]], startRadius: 0.29, endRadius: 0.040, tone: 0 },
  { id: 'low-east-front', points: [[0.03, 2.72, 0.05], [0.64, 3.32, 0.76], [1.64, 3.80, 1.66], [2.82, 4.50, 1.34]], startRadius: 0.28, endRadius: 0.040, tone: 0 },
  { id: 'low-west-back', points: [[-0.02, 2.95, -0.02], [-0.48, 3.52, -0.78], [-1.08, 3.92, -1.84], [-2.02, 4.42, -2.66]], startRadius: 0.24, endRadius: 0.036, tone: 1 },
  { id: 'low-east-back', points: [[0.06, 3.12, -0.02], [0.46, 3.62, -0.84], [1.02, 3.96, -1.94], [1.92, 4.36, -2.70]], startRadius: 0.23, endRadius: 0.034, tone: 1 },
  { id: 'mid-front', points: [[0.04, 3.55, 0.06], [-0.12, 4.16, 0.95], [-0.42, 4.70, 2.10], [-0.78, 5.36, 2.82]], startRadius: 0.22, endRadius: 0.032, tone: 1 },
  { id: 'mid-back', points: [[-0.02, 3.82, 0], [0.18, 4.40, -0.90], [0.30, 4.80, -2.10], [0.62, 5.58, -2.94]], startRadius: 0.20, endRadius: 0.030, tone: 1 },
  { id: 'mid-west', points: [[-0.02, 4.10, 0.02], [-0.76, 4.66, -0.05], [-1.92, 5.05, 0.22], [-3.30, 5.14, 0.32]], startRadius: 0.18, endRadius: 0.029, tone: 1 },
  { id: 'mid-east', points: [[0.04, 4.34, 0.02], [0.78, 4.82, 0.05], [1.90, 5.14, -0.22], [3.34, 5.48, -0.38]], startRadius: 0.17, endRadius: 0.028, tone: 1 },
  { id: 'upper-northwest', points: [[-0.02, 5.05, 0.06], [-0.62, 5.54, 0.42], [-1.62, 5.92, 0.82], [-2.82, 6.06, 1.18]], startRadius: 0.14, endRadius: 0.024, tone: 2 },
  { id: 'upper-southeast', points: [[0.04, 5.22, -0.02], [0.64, 5.68, -0.40], [1.66, 6.08, -0.78], [2.94, 6.40, -1.12]], startRadius: 0.13, endRadius: 0.023, tone: 2 },
  { id: 'crown-west', points: [[-0.02, 5.82, 0.03], [-0.40, 6.38, -0.24], [-0.95, 6.78, -0.56], [-1.56, 7.00, -0.88]], startRadius: 0.105, endRadius: 0.020, tone: 2 },
  { id: 'crown-east', points: [[0.02, 6.00, 0.00], [0.35, 6.52, 0.34], [0.85, 6.86, 0.62], [1.58, 7.32, 0.92]], startRadius: 0.100, endRadius: 0.020, tone: 2 },
];
const branchPaths = darkCanopyBranchPaths;

const maxBranchControlTurn = THREE.MathUtils.degToRad(55);
const branchControlTurns = branchPaths.flatMap((path) => path.points.slice(1, -1).map((point, index) => {
  const incoming = tupleToVector(point).sub(tupleToVector(path.points[index])).normalize();
  const outgoing = tupleToVector(path.points[index + 2]).sub(tupleToVector(point)).normalize();
  return { id: path.id, angle: incoming.angleTo(outgoing) };
}));
const excessiveBranchTurn = branchControlTurns.find(({ angle }) => angle > maxBranchControlTurn);
if (excessiveBranchTurn) {
  throw new Error(`Branch ${excessiveBranchTurn.id} turns ${THREE.MathUtils.radToDeg(excessiveBranchTurn.angle).toFixed(1)} degrees at one control point`);
}

export const darkCanopyLobes: readonly CanopyLobeSpec[] = [
  { id: 'low-west-front', variant: 'fan', mount: [-2.72, 4.28, 1.58], position: [-2.72, 4.38, 1.58], scale: [1.42, 1.10, 1.20], rotation: [0.08, 0.20, 0.07], tone: 3 },
  { id: 'low-east-front', variant: 'fan', mount: [2.82, 4.50, 1.34], position: [2.82, 4.60, 1.34], scale: [1.34, 1.08, 1.18], rotation: [-0.07, -0.22, -0.06], tone: 2 },
  { id: 'low-west-back', variant: 'fan', mount: [-2.02, 4.42, -2.66], position: [-2.02, 4.52, -2.66], scale: [1.08, 1.04, 1.04], rotation: [0.07, 0.72, 0.05], tone: 0 },
  { id: 'low-east-back', variant: 'broad', mount: [1.92, 4.36, -2.70], position: [1.92, 4.46, -2.70], scale: [1.06, 1.02, 1.02], rotation: [-0.08, -0.68, -0.05], tone: 1 },

  { id: 'mid-west', variant: 'broad', mount: [-3.30, 5.14, 0.32], position: [-3.30, 5.24, 0.32], scale: [1.28, 1.10, 1.06], rotation: [-0.08, -0.08, 0.08], tone: 2 },
  { id: 'mid-east', variant: 'broad', mount: [3.34, 5.48, -0.38], position: [3.34, 5.58, -0.38], scale: [1.20, 1.08, 1.06], rotation: [0.09, 0.12, -0.07], tone: 2 },
  { id: 'mid-front', variant: 'broad', mount: [-0.78, 5.36, 2.82], position: [-0.78, 5.46, 2.82], scale: [1.10, 1.08, 1.04], rotation: [0.09, -0.88, 0.05], tone: 3 },
  { id: 'mid-back', variant: 'fan', mount: [0.62, 5.58, -2.94], position: [0.62, 5.68, -2.94], scale: [1.10, 1.08, 1.04], rotation: [-0.09, 0.84, -0.05], tone: 0 },
  { id: 'mid-core', variant: 'broad', mount: [0.02, 4.72, -0.10], supportVisible: false, position: [-0.12, 5.76, -0.08], scale: [1.00, 1.04, 0.98], rotation: [0.06, 0.10, 0.04], tone: 1 },

  { id: 'upper-west', variant: 'broad', mount: [-2.82, 6.06, 1.18], position: [-2.82, 6.16, 1.18], scale: [1.24, 1.10, 1.06], rotation: [-0.09, 0.42, 0.08], tone: 3 },
  { id: 'upper-east', variant: 'broad', mount: [2.94, 6.40, -1.12], position: [2.94, 6.50, -1.12], scale: [1.16, 1.10, 1.06], rotation: [0.10, -0.54, -0.07], tone: 2 },
  { id: 'upper-front', variant: 'fan', mount: [-1.00, 6.02, 1.95], position: [-0.96, 6.42, 2.76], scale: [1.06, 1.06, 1.04], rotation: [-0.08, 0.64, 0.07], tone: 2 },
  { id: 'upper-back', variant: 'fan', mount: [1.00, 6.08, -1.90], position: [0.94, 6.70, -2.76], scale: [1.06, 1.06, 1.04], rotation: [0.09, -0.72, -0.07], tone: 0 },
  { id: 'upper-core', variant: 'broad', mount: [0.00, 5.56, 0.08], supportVisible: false, position: [0.14, 6.78, 0.08], scale: [1.10, 1.06, 1.00], rotation: [-0.06, -0.06, -0.04], tone: 1 },

  { id: 'crown-west', variant: 'crown', mount: [-1.56, 7.00, -0.88], position: [-1.56, 7.10, -0.88], scale: [1.18, 1.10, 1.06], rotation: [0.08, 0.20, -0.09], tone: 1 },
  { id: 'crown-east', variant: 'crown', mount: [1.58, 7.32, 0.92], position: [1.58, 7.42, 0.92], scale: [1.14, 1.10, 1.06], rotation: [-0.08, -0.24, 0.08], tone: 2 },
  { id: 'crown-top', variant: 'broad', mount: [0.00, 6.42, 0.00], supportVisible: false, position: [-0.08, 7.72, 0.00], scale: [1.02, 1.06, 1.00], rotation: [0.06, 0.04, 0.04], tone: 1 },
];
const canopyLobes = darkCanopyLobes;

const supportBranchPaths: readonly BranchPathSpec[] = canopyLobes
  .filter((lobe) => lobe.supportVisible === true)
  .map((lobe) => {
  const [mountX, mountY, mountZ] = lobe.mount;
  const [lobeX, lobeY, lobeZ] = lobe.position;
  const companion = lobe.id.endsWith('companion');
  return {
    id: `foliage-support-${lobe.id}`,
    points: [
      lobe.mount,
      [
        THREE.MathUtils.lerp(mountX, lobeX, 0.55),
        THREE.MathUtils.lerp(mountY, lobeY, 0.55) + (companion ? 0.035 : 0),
        THREE.MathUtils.lerp(mountZ, lobeZ, 0.55),
      ],
      lobe.position,
    ],
    startRadius: companion ? 0.038 : 0.045,
    endRadius: companion ? 0.011 : 0.014,
    tone: 2,
  };
  });

export const getDarkCanopyGrowthYaw = (lobe: CanopyLobeSpec) => {
  const [mountX, , mountZ] = lobe.mount;
  const [lobeX, , lobeZ] = lobe.position;
  let directionX = lobeX - mountX;
  let directionZ = (lobeZ - mountZ) * canopyDepthScale;
  if (Math.hypot(directionX, directionZ) < 0.16) {
    directionX = mountX;
    directionZ = mountZ * canopyDepthScale;
  }
  return Math.atan2(-directionZ, directionX) + lobe.rotation[1] * 0.18;
};
const getCanopyGrowthYaw = getDarkCanopyGrowthYaw;

export const createDarkCanopyTreeStudy = (): DarkCanopyTreeStudy => {
  const root = new THREE.Group();
  root.name = 'straightened-skeleton-canopy-study-v015';
  const barkMaterials = ['#493d38', '#5c4b42', '#705c4c'].map((color) =>
    new THREE.MeshToonMaterial({ color, emissive: color, emissiveIntensity: 0.10 }));
  const foliageMaterials = ['#2d4634', '#35523a', '#3d5b3f', '#456544'].map((color) =>
    new THREE.MeshToonMaterial({ color, vertexColors: true, emissive: color, emissiveIntensity: 0.13 }));
  const visualMaterials = new Map<THREE.Object3D, THREE.Material>();
  const silhouetteMaterial = new THREE.MeshBasicMaterial({ color: '#171a18' });
  let approximateTriangles = 0;
  const allBranchPaths = [...branchPaths, ...supportBranchPaths];

  allBranchPaths.forEach((spec) => {
    const geometry = createTaperedBranchGeometry(spec);
    const branch = new THREE.Mesh(geometry, barkMaterials[spec.tone % barkMaterials.length]);
    branch.name = spec.id;
    branch.castShadow = true;
    branch.receiveShadow = true;
    branch.userData.treeRole = 'branch-occluder';
    visualMaterials.set(branch, branch.material);
    root.add(branch);
    approximateTriangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  });

  const geometries = new Map<CanopyLobeVariant, THREE.BufferGeometry>();
  const transformGroups = new Map<string, THREE.Matrix4[]>();
  canopyLobes.forEach((lobe) => {
    const key = `${lobe.variant}:${lobe.tone % foliageMaterials.length}`;
    const transforms = transformGroups.get(key) ?? [];
    transformGroups.set(key, transforms);
    transforms.push(new THREE.Matrix4().compose(
      tupleToSpatialPosition(lobe.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(
        lobe.rotation[0] * 1.45,
        getCanopyGrowthYaw(lobe),
        lobe.rotation[2] * 1.35,
      )),
      tupleToVector(lobe.scale),
    ));
  });

  transformGroups.forEach((transforms, key) => {
    const [variant, toneName] = key.split(':') as [CanopyLobeVariant, string];
    const geometry = geometries.get(variant) ?? createCanopyLobeGeometry(variant);
    geometries.set(variant, geometry);
    const canopy = new THREE.InstancedMesh(
      geometry,
      foliageMaterials[Number(toneName)],
      transforms.length,
    );
    canopy.name = `canopy-${variant}-tone-${toneName}`;
    transforms.forEach((matrix, index) => canopy.setMatrixAt(index, matrix));
    canopy.instanceMatrix.needsUpdate = true;
    canopy.computeBoundingBox();
    canopy.computeBoundingSphere();
    canopy.castShadow = true;
    canopy.receiveShadow = false;
    canopy.userData.treeRole = 'foliage-occluder';
    visualMaterials.set(canopy, canopy.material as THREE.Material);
    root.add(canopy);
    const triangleCount = (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
    approximateTriangles += triangleCount * transforms.length;
  });

  const collisionProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.58, 4.8, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  collisionProxy.name = 'collision-proxy';
  collisionProxy.position.y = 2.4;
  collisionProxy.userData.treeRole = 'collision-proxy';
  root.add(collisionProxy);

  const perches = [
    { id: 'study-low-rest', position: new THREE.Vector3(-1.62, 3.67, 0.66 * canopyDepthScale), forward: new THREE.Vector3(-1, 0.06, 0.18).normalize() },
    { id: 'study-high-song', position: new THREE.Vector3(1.56, 5.10, -0.28 * canopyDepthScale), forward: new THREE.Vector3(1, 0.05, -0.22).normalize() },
  ];

  const setSilhouette = (enabled: boolean) => {
    visualMaterials.forEach((material, object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
        object.material = enabled ? silhouetteMaterial : material;
      }
    });
  };

  root.userData.studyId = 'straightened-skeleton-canopy-study-v015';
  root.userData.maxBranchControlTurnDegrees = THREE.MathUtils.radToDeg(maxBranchControlTurn);
  root.userData.actualMaxBranchControlTurnDegrees = THREE.MathUtils.radToDeg(
    Math.max(...branchControlTurns.map(({ angle }) => angle)),
  );
  root.userData.perches = perches;

  return {
    root,
    collisionProxy,
    perches,
    stats: {
      branchMeshes: allBranchPaths.length,
      branchSegments: allBranchPaths.reduce((total, path) => total + path.points.length - 1, 0),
      canopyLobes: canopyLobes.length,
      instancedMeshes: transformGroups.size,
      uniqueGeometries: allBranchPaths.length + geometries.size + 1,
      uniqueMaterials: barkMaterials.length + foliageMaterials.length + 1,
      approximateTriangles: Math.round(approximateTriangles),
      maxBranchControlTurnDegrees: Number(THREE.MathUtils.radToDeg(
        Math.max(...branchControlTurns.map(({ angle }) => angle)),
      ).toFixed(1)),
    },
    setSilhouette,
  };
};
