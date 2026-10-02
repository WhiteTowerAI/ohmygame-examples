import * as THREE from 'three';
import { forestEdgePalette } from './forest-edge-palette';

export type StylizedBushVariant = 'rounded' | 'open';

type StylizedBushOptions = Readonly<{
  variant: StylizedBushVariant;
  seed: number;
  scale?: number;
}>;

type EnvelopeLobe = Readonly<{
  center: THREE.Vector3;
  radius: THREE.Vector3;
  weight: number;
}>;

const branchGeometry = new THREE.CylinderGeometry(0.55, 1, 1, 5, 1);
const branchMaterial = new THREE.MeshToonMaterial({
  color: forestEdgePalette.tree.bark[0],
});
const yAxis = new THREE.Vector3(0, 1, 0);
const zAxis = new THREE.Vector3(0, 0, 1);
const leafProfile = [
  [-0.50, 0.00, 0.00],
  [-0.22, 0.27, 0.00],
  [0.20, 0.29, 0.00],
  [0.50, 0.00, 0.00],
  [0.21, -0.28, 0.00],
  [-0.23, -0.25, 0.00],
  [0.00, 0.00, 0.055],
] as const;
const leafIndices = [
  6, 0, 1,
  6, 1, 2,
  6, 2, 3,
  6, 3, 4,
  6, 4, 5,
  6, 5, 0,
] as const;

const createStylizedLeafGeometry = () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(leafProfile.flat(), 3));
  geometry.setIndex([...leafIndices]);
  geometry.computeVertexNormals();
  return geometry;
};

const createFoliageClusterGeometry = () => {
  const placements = [
    [-0.29, 0.18, -0.01, 0.34, -0.28, 0.18, -0.24, 0.90],
    [0.00, 0.22, 0.05, 0.36, 0.12, -0.12, 0.16, 1.00],
    [0.30, 0.17, -0.02, 0.33, 0.32, 0.16, 0.28, 0.84],
    [-0.39, 0.00, 0.03, 0.35, 0.16, -0.20, -0.30, 0.82],
    [-0.13, 0.02, 0.09, 0.38, -0.10, 0.22, -0.18, 0.96],
    [0.16, 0.02, 0.08, 0.39, 0.20, -0.18, 0.20, 0.88],
    [0.40, -0.02, 0.01, 0.34, -0.18, 0.20, 0.34, 0.94],
    [-0.28, -0.18, -0.01, 0.32, 0.30, 0.16, -0.24, 0.86],
    [0.01, -0.20, 0.06, 0.36, -0.14, -0.22, 0.12, 0.98],
    [0.29, -0.16, -0.02, 0.32, 0.24, 0.18, 0.26, 0.80],
  ] as const;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const point = new THREE.Vector3();
  const rotation = new THREE.Quaternion();

  placements.forEach(([x, y, z, size, roll, pitch, yaw, shade], leafIndex) => {
    rotation.setFromEuler(new THREE.Euler(pitch, yaw, roll, 'XYZ'));
    leafProfile.forEach(([px, py, pz]) => {
      point.set(px, py, pz).multiplyScalar(size).applyQuaternion(rotation);
      positions.push(point.x + x, point.y + y, point.z + z);
      colors.push(shade, shade, shade);
    });
    const vertexOffset = leafIndex * leafProfile.length;
    leafIndices.forEach((index) => indices.push(vertexOffset + index));
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

const stylizedLeafGeometry = createStylizedLeafGeometry();
const foliageClusterGeometry = createFoliageClusterGeometry();
const foliageMaterial = new THREE.MeshToonMaterial({
  color: '#ffffff',
  side: THREE.DoubleSide,
});
const foliageClusterMaterial = new THREE.MeshToonMaterial({
  color: '#ffffff',
  side: THREE.DoubleSide,
  vertexColors: true,
});

const mulberry32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const getEnvelopeLobes = (variant: StylizedBushVariant): readonly EnvelopeLobe[] => (
  variant === 'open'
    ? [
      {
        center: new THREE.Vector3(-0.34, 0.36, 0.02),
        radius: new THREE.Vector3(0.53, 0.28, 0.43),
        weight: 1,
      },
      {
        center: new THREE.Vector3(0.35, 0.34, 0.00),
        radius: new THREE.Vector3(0.51, 0.27, 0.42),
        weight: 0.95,
      },
      {
        center: new THREE.Vector3(0.03, 0.54, -0.13),
        radius: new THREE.Vector3(0.41, 0.24, 0.37),
        weight: 0.62,
      },
    ]
    : [
      {
        center: new THREE.Vector3(-0.29, 0.35, 0.04),
        radius: new THREE.Vector3(0.58, 0.29, 0.48),
        weight: 1,
      },
      {
        center: new THREE.Vector3(0.29, 0.36, -0.01),
        radius: new THREE.Vector3(0.56, 0.30, 0.47),
        weight: 1,
      },
      {
        center: new THREE.Vector3(0.02, 0.53, -0.10),
        radius: new THREE.Vector3(0.46, 0.25, 0.40),
        weight: 0.82,
      },
    ]
);

const chooseLobe = (lobes: readonly EnvelopeLobe[], random: () => number) => {
  const totalWeight = lobes.reduce((sum, lobe) => sum + lobe.weight, 0);
  let pick = random() * totalWeight;
  for (const lobe of lobes) {
    pick -= lobe.weight;
    if (pick <= 0) return lobe;
  }
  return lobes[lobes.length - 1];
};

const addBranch = (
  root: THREE.Group,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  name: string,
) => {
  const direction = end.clone().sub(start);
  const branch = new THREE.Mesh(branchGeometry, branchMaterial);
  branch.name = name;
  branch.position.copy(start).addScaledVector(direction, 0.5);
  branch.quaternion.setFromUnitVectors(yAxis, direction.clone().normalize());
  branch.scale.set(radius, direction.length(), radius);
  branch.castShadow = true;
  branch.receiveShadow = true;
  branch.userData.environmentRole = 'bush-stem';
  root.add(branch);
};

const addBranchStructure = (
  root: THREE.Group,
  lobes: readonly EnvelopeLobe[],
  random: () => number,
  open: boolean,
) => {
  lobes.forEach((lobe, index) => {
    const base = new THREE.Vector3((random() - 0.5) * 0.11, 0.015, (random() - 0.5) * 0.09);
    const shoulder = lobe.center.clone().multiplyScalar(0.56);
    shoulder.y = 0.21 + random() * 0.07;
    const tip = lobe.center.clone().add(new THREE.Vector3(
      (random() - 0.5) * 0.22,
      0.07 + random() * 0.07,
      (random() - 0.5) * 0.18,
    ));
    addBranch(root, base, shoulder, open ? 0.019 : 0.022, `bush-stem-${index}-lower`);
    addBranch(root, shoulder, tip, open ? 0.012 : 0.014, `bush-stem-${index}-upper`);
  });
};

const clusterAnchors = {
  rounded: [
    [-0.52, 0.34, 0.02], [-0.34, 0.50, -0.14], [-0.30, 0.31, 0.29],
    [-0.08, 0.50, 0.16], [0.07, 0.56, -0.12], [0.28, 0.49, 0.13],
    [0.52, 0.34, 0.02], [0.35, 0.29, -0.29], [0.03, 0.29, -0.38],
    [-0.36, 0.30, -0.27], [0.04, 0.31, 0.34], [0.00, 0.44, -0.04],
  ],
  open: [
    [-0.58, 0.32, 0.03], [-0.38, 0.48, -0.12], [-0.31, 0.29, 0.27],
    [-0.10, 0.46, 0.12], [0.14, 0.50, -0.11], [0.36, 0.44, 0.11],
    [0.58, 0.31, 0.00], [0.37, 0.27, -0.27], [-0.38, 0.27, -0.25],
    [0.08, 0.28, 0.30],
  ],
} as const;

const createFoliageClusters = (
  variant: StylizedBushVariant,
  random: () => number,
) => {
  const anchors = clusterAnchors[variant];
  const foliage = new THREE.InstancedMesh(
    foliageClusterGeometry,
    foliageClusterMaterial,
    anchors.length,
  );
  foliage.name = 'bush-foliage-midscale-clusters';
  foliage.castShadow = true;
  foliage.receiveShadow = true;
  foliage.userData.environmentRole = 'bush-foliage';
  foliage.userData.preserveStylizedMaterial = true;

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const localRoll = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  anchors.forEach(([x, y, z], index) => {
    position.set(
      x + (random() - 0.5) * 0.055,
      y + (random() - 0.5) * 0.035,
      z + (random() - 0.5) * 0.055,
    );
    normal.set(x * 1.1, (y - 0.34) * 1.8, z * 1.15);
    if (normal.lengthSq() < 0.02) normal.set(0, 0.45, 1);
    normal.normalize();
    quaternion.setFromUnitVectors(zAxis, normal);
    localRoll.setFromAxisAngle(zAxis, (random() - 0.5) * 0.62);
    quaternion.multiply(localRoll);
    const clusterScale = (variant === 'open' ? 0.60 : 0.64) * (0.90 + random() * 0.16);
    scale.set(clusterScale, clusterScale * (0.90 + random() * 0.14), clusterScale);
    matrix.compose(position, quaternion, scale);
    foliage.setMatrixAt(index, matrix);
    color.set(forestEdgePalette.bush[index % 4 === 0 ? 2 : index % 3 === 0 ? 0 : 1]);
    color.offsetHSL((random() - 0.5) * 0.015, 0, (random() - 0.5) * 0.04);
    foliage.setColorAt(index, color);
  });

  foliage.instanceMatrix.needsUpdate = true;
  if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
  foliage.computeBoundingBox();
  foliage.computeBoundingSphere();
  foliage.userData.foliageClusterCount = anchors.length;
  foliage.userData.leavesPerCluster = 10;
  return foliage;
};

const createEdgeLeaves = (
  lobes: readonly EnvelopeLobe[],
  random: () => number,
  open: boolean,
) => {
  const leafCount = open ? 12 : 16;
  const foliage = new THREE.InstancedMesh(
    stylizedLeafGeometry,
    foliageMaterial,
    leafCount,
  );
  foliage.name = 'bush-foliage-edge-leaves';
  foliage.castShadow = true;
  foliage.receiveShadow = true;
  foliage.userData.environmentRole = 'bush-foliage';
  foliage.userData.preserveStylizedMaterial = true;

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const localRoll = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalJitter = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  for (let index = 0; index < leafCount; index += 1) {
    const lobe = chooseLobe(lobes, random);
    const azimuth = random() * Math.PI * 2;
    const vertical = -0.48 + random() * 1.43;
    const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
    const direction = new THREE.Vector3(
      Math.cos(azimuth) * horizontal,
      vertical,
      Math.sin(azimuth) * horizontal,
    );
    const shell = 0.54 + random() * 0.18;
    position.set(
      lobe.center.x + direction.x * lobe.radius.x * shell,
      lobe.center.y + direction.y * lobe.radius.y * shell,
      lobe.center.z + direction.z * lobe.radius.z * shell,
    );
    position.y = Math.max(position.y, 0.13 + random() * 0.05);
    normal.set(
      direction.x / lobe.radius.x,
      direction.y / lobe.radius.y,
      direction.z / lobe.radius.z,
    ).normalize();
    normalJitter.set(
      random() - 0.5,
      random() - 0.44,
      random() - 0.5,
    ).normalize();
    normal.lerp(normalJitter, open ? 0.30 : 0.24).normalize();
    quaternion.setFromUnitVectors(zAxis, normal);
    localRoll.setFromAxisAngle(zAxis, random() * Math.PI * 2);
    quaternion.multiply(localRoll);
    const leafScale = (open ? 0.078 : 0.082) * (0.84 + random() * 0.24);
    scale.set(leafScale, leafScale * (0.88 + random() * 0.18), leafScale);
    matrix.compose(position, quaternion, scale);
    foliage.setMatrixAt(index, matrix);
    const paletteIndex = random() < 0.22 ? 2 : random() < 0.58 ? 1 : 0;
    color.set(forestEdgePalette.bush[paletteIndex]);
    color.offsetHSL((random() - 0.5) * 0.018, (random() - 0.5) * 0.035, (random() - 0.5) * 0.055);
    foliage.setColorAt(index, color);
  }

  foliage.instanceMatrix.needsUpdate = true;
  if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
  foliage.computeBoundingBox();
  foliage.computeBoundingSphere();
  foliage.userData.edgeLeafCount = leafCount;
  return foliage;
};

export const createStylizedBush = (options: StylizedBushOptions) => {
  const random = mulberry32(options.seed);
  const root = new THREE.Group();
  root.name = `stylized-bush-${options.variant}`;
  root.userData.bushVariant = options.variant;
  root.userData.seed = options.seed;
  root.userData.modelingApproach = 'midscale-leaf-clusters-with-edge-leaves';

  const open = options.variant === 'open';
  const lobes = getEnvelopeLobes(options.variant);
  addBranchStructure(root, lobes, random, open);
  root.add(createFoliageClusters(options.variant, random));
  root.add(createEdgeLeaves(lobes, random, open));

  root.scale.setScalar(options.scale ?? 1);
  return root;
};
