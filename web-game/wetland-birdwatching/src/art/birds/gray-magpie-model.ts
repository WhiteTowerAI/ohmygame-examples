import * as THREE from 'three';
import { attachStylizedBirdDetailOutline } from '../rendering/stylized-bird-detail-outline';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { createStylizedBirdMaterial as toon } from '../rendering/stylized-bird-material';

export type GrayMagpiePose = {
  bodyX: number;
  bodyY: number;
  bodyZ: number;
  headX: number;
  headY: number;
  headZ: number;
  tailX: number;
  tailY: number;
  tailZ: number;
  tailFan: number;
  wingSpread: number;
  wingFlap: number;
  leftLegX: number;
  rightLegX: number;
  beakOpen: number;
};

export type GrayMagpieParts = {
  body: THREE.Group;
  headGroup: THREE.Group;
  beakUpper: THREE.Mesh;
  beakLower: THREE.Mesh;
  foldedWingLeft: THREE.Mesh;
  foldedWingRight: THREE.Mesh;
  flightWingLeft: THREE.Group;
  flightWingRight: THREE.Group;
  tailGroup: THREE.Group;
  tailFeatherLeft: THREE.Mesh;
  tailFeatherRight: THREE.Mesh;
  legLeft: THREE.Group;
  legRight: THREE.Group;
};

const addMesh = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  position = new THREE.Vector3(),
  scale = new THREE.Vector3(1, 1, 1),
  name = '',
) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.scale.copy(scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const createPartitionedSphereGeometry = (
  widthSegments: number,
  patchSegments: number,
  boundaryYAtAzimuth: (azimuth: number) => number,
) => {
  const positions: number[] = [];
  const indices: number[] = [];
  const geometry = new THREE.BufferGeometry();

  const addPatch = (upper: boolean, materialIndex: number) => {
    const vertexStart = positions.length / 3;
    const indexStart = indices.length;
    for (let row = 0; row <= patchSegments; row += 1) {
      const v = row / patchSegments;
      for (let column = 0; column <= widthSegments; column += 1) {
        const azimuth = column / widthSegments * Math.PI * 2;
        const boundaryPhi = Math.acos(THREE.MathUtils.clamp(boundaryYAtAzimuth(azimuth), -0.92, 0.92));
        const phi = upper
          ? boundaryPhi * v
          : boundaryPhi + (Math.PI - boundaryPhi) * v;
        const sinPhi = Math.sin(phi);
        positions.push(
          sinPhi * Math.sin(azimuth),
          Math.cos(phi),
          sinPhi * Math.cos(azimuth),
        );
      }
    }
    for (let row = 0; row < patchSegments; row += 1) {
      for (let column = 0; column < widthSegments; column += 1) {
        const a = vertexStart + row * (widthSegments + 1) + column;
        const b = a + widthSegments + 1;
        const c = b + 1;
        const d = a + 1;
        if (!(upper && row === 0)) indices.push(a, b, d);
        if (!(!upper && row === patchSegments - 1)) indices.push(b, c, d);
      }
    }
    geometry.addGroup(indexStart, indices.length - indexStart, materialIndex);
  };

  addPatch(true, 0);
  addPatch(false, 1);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const createBlendedSphereGeometry = (
  widthSegments: number,
  patchSegments: number,
  boundaryYAtAzimuth: (azimuth: number) => number,
  transitionWidth: number,
  upperColor: THREE.ColorRepresentation,
  lowerColor: THREE.ColorRepresentation,
) => {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const upper = new THREE.Color(upperColor);
  const lower = new THREE.Color(lowerColor);
  const color = new THREE.Color();
  const bandSegments = 2;
  const rows = [
    ...Array.from({ length: patchSegments + 1 }, (_, step) => ({ region: 'upper', t: step / patchSegments } as const)),
    ...Array.from({ length: bandSegments }, (_, index) => ({ region: 'band', t: (index + 1) / bandSegments } as const)),
    ...Array.from({ length: patchSegments }, (_, index) => ({ region: 'lower', t: (index + 1) / patchSegments } as const)),
  ];
  const halfTransition = transitionWidth * 0.5;

  rows.forEach(({ region, t }) => {
    for (let column = 0; column <= widthSegments; column += 1) {
      const azimuth = column / widthSegments * Math.PI * 2;
      const boundaryY = THREE.MathUtils.clamp(boundaryYAtAzimuth(azimuth), -0.82, 0.82);
      const upperPhi = Math.acos(THREE.MathUtils.clamp(boundaryY + halfTransition, -0.92, 0.92));
      const lowerPhi = Math.acos(THREE.MathUtils.clamp(boundaryY - halfTransition, -0.92, 0.92));
      const phi = region === 'upper'
        ? upperPhi * t
        : region === 'band'
          ? THREE.MathUtils.lerp(upperPhi, lowerPhi, t)
          : THREE.MathUtils.lerp(lowerPhi, Math.PI, t);
      const sinPhi = Math.sin(phi);
      const x = sinPhi * Math.sin(azimuth);
      const y = Math.cos(phi);
      const z = sinPhi * Math.cos(azimuth);
      positions.push(x, y, z);
      normals.push(x, y, z);

      const upperWeight = THREE.MathUtils.smoothstep(
        y,
        boundaryY - halfTransition,
        boundaryY + halfTransition,
      );
      color.copy(lower).lerp(upper, upperWeight);
      colors.push(color.r, color.g, color.b);
    }
  });

  const rowStride = widthSegments + 1;
  for (let row = 0; row < rows.length - 1; row += 1) {
    for (let column = 0; column < widthSegments; column += 1) {
      const a = row * rowStride + column;
      const b = a + rowStride;
      const c = b + 1;
      const d = a + 1;
      if (row > 0) indices.push(a, b, d);
      if (row < rows.length - 2) indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
};

const cylinderBetween = (
  parent: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  name = '',
) => {
  const delta = end.clone().sub(start);
  const mesh = addMesh(
    parent,
    new THREE.CylinderGeometry(radius, radius * 0.86, delta.length(), 6),
    material,
    start.clone().add(end).multiplyScalar(0.5),
    new THREE.Vector3(1, 1, 1),
    name,
  );
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
};

const createPartitionedTailGeometry = (
  length: number,
  halfWidth: number,
  halfThickness: number,
  tipWidthRatio = 0.58,
) => {
  const tipWidth = halfWidth * tipWidthRatio;
  const tipThickness = halfThickness * 0.62;
  const tipBandLength = Math.min(0.065, length * 0.10);
  const seamT = (length - tipBandLength) / length;
  const sections = [
    { z: 0, width: halfWidth, thickness: halfThickness },
    {
      z: -(length - tipBandLength),
      width: THREE.MathUtils.lerp(halfWidth, tipWidth, seamT),
      thickness: THREE.MathUtils.lerp(halfThickness, tipThickness, seamT),
    },
    { z: -length, width: tipWidth, thickness: tipThickness },
  ];
  const positions: number[] = [];
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const corners = (section: typeof sections[number]) => ({
    topLeft: new THREE.Vector3(-section.width, section.thickness, section.z),
    topRight: new THREE.Vector3(section.width, section.thickness, section.z),
    bottomLeft: new THREE.Vector3(-section.width, -section.thickness, section.z),
    bottomRight: new THREE.Vector3(section.width, -section.thickness, section.z),
  });
  const geometry = new THREE.BufferGeometry();
  for (let index = 0; index < sections.length - 1; index += 1) {
    const start = positions.length / 3;
    const a = corners(sections[index]);
    const b = corners(sections[index + 1]);
    triangle(a.topLeft, a.topRight, b.topRight);
    triangle(a.topLeft, b.topRight, b.topLeft);
    triangle(a.bottomLeft, b.bottomRight, a.bottomRight);
    triangle(a.bottomLeft, b.bottomLeft, b.bottomRight);
    triangle(a.topLeft, b.topLeft, b.bottomLeft);
    triangle(a.topLeft, b.bottomLeft, a.bottomLeft);
    triangle(a.topRight, a.bottomRight, b.bottomRight);
    triangle(a.topRight, b.bottomRight, b.topRight);
    geometry.addGroup(start, positions.length / 3 - start, index);
  }
  const root = corners(sections[0]);
  let start = positions.length / 3;
  triangle(root.topLeft, root.bottomRight, root.topRight);
  triangle(root.topLeft, root.bottomLeft, root.bottomRight);
  geometry.addGroup(start, positions.length / 3 - start, 0);
  const tip = corners(sections[2]);
  start = positions.length / 3;
  triangle(tip.topLeft, tip.topRight, tip.bottomRight);
  triangle(tip.topLeft, tip.bottomRight, tip.bottomLeft);
  geometry.addGroup(start, positions.length / 3 - start, 1);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
};

type FoldedWingSection = { z: number; centerY: number; halfHeight: number };

const createFoldedWingGeometry = (side: number) => {
  const sections: FoldedWingSection[] = [
    { z: 0.11, centerY: 0.455, halfHeight: 0.035 },
    { z: 0.01, centerY: 0.445, halfHeight: 0.082 },
    { z: -0.10, centerY: 0.420, halfHeight: 0.103 },
    { z: -0.25, centerY: 0.365, halfHeight: 0.094 },
    { z: -0.39, centerY: 0.305, halfHeight: 0.056 },
    { z: -0.47, centerY: 0.275, halfHeight: 0.012 },
  ];
  const materialIndices = [0, 1, 1, 1, 1];
  const innerX = side * 0.208;
  const outerX = side * 0.245;
  const positions: number[] = [];
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const ordered = side > 0 ? [a, b, c] : [a, c, b];
    ordered.forEach((point) => positions.push(point.x, point.y, point.z));
  };
  const points = (section: FoldedWingSection) => ({
    outerTop: new THREE.Vector3(outerX, section.centerY + section.halfHeight, section.z),
    outerBottom: new THREE.Vector3(outerX, section.centerY - section.halfHeight, section.z),
    innerTop: new THREE.Vector3(innerX, section.centerY + section.halfHeight, section.z),
    innerBottom: new THREE.Vector3(innerX, section.centerY - section.halfHeight, section.z),
  });
  const geometry = new THREE.BufferGeometry();
  for (let index = 0; index < sections.length - 1; index += 1) {
    const start = positions.length / 3;
    const a = points(sections[index]);
    const b = points(sections[index + 1]);
    triangle(a.outerTop, a.outerBottom, b.outerBottom);
    triangle(a.outerTop, b.outerBottom, b.outerTop);
    triangle(a.innerTop, b.innerBottom, a.innerBottom);
    triangle(a.innerTop, b.innerTop, b.innerBottom);
    triangle(a.outerTop, b.outerTop, b.innerTop);
    triangle(a.outerTop, b.innerTop, a.innerTop);
    triangle(a.outerBottom, a.innerBottom, b.innerBottom);
    triangle(a.outerBottom, b.innerBottom, b.outerBottom);
    geometry.addGroup(start, positions.length / 3 - start, materialIndices[index]);
  }
  let start = positions.length / 3;
  const root = points(sections[0]);
  triangle(root.outerTop, root.innerTop, root.innerBottom);
  triangle(root.outerTop, root.innerBottom, root.outerBottom);
  geometry.addGroup(start, positions.length / 3 - start, 0);
  start = positions.length / 3;
  const tip = points(sections[sections.length - 1]);
  triangle(tip.outerTop, tip.innerBottom, tip.innerTop);
  triangle(tip.outerTop, tip.outerBottom, tip.innerBottom);
  geometry.addGroup(start, positions.length / 3 - start, 1);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
};

type FlightWingSection = { x: number; leadingZ: number; trailingZ: number };

const createSectionedFlightWingGeometry = (side: number) => {
  const sections: FlightWingSection[] = [
    { x: 0, leadingZ: 0.13, trailingZ: -0.22 },
    { x: 0.18, leadingZ: 0.14, trailingZ: -0.26 },
    { x: 0.34, leadingZ: 0.11, trailingZ: -0.30 },
    { x: 0.46, leadingZ: 0.06, trailingZ: -0.25 },
    { x: 0.58, leadingZ: 0.09, trailingZ: -0.02 },
  ];
  const materialIndices = [0, 1, 1, 1];
  const halfThickness = 0.018;
  const positions: number[] = [];
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const ordered = side > 0 ? [a, b, c] : [a, c, b];
    ordered.forEach((point) => positions.push(point.x, point.y, point.z));
  };
  const points = (section: FlightWingSection) => ({
    topLeading: new THREE.Vector3(side * section.x, halfThickness, section.leadingZ),
    topTrailing: new THREE.Vector3(side * section.x, halfThickness, section.trailingZ),
    bottomLeading: new THREE.Vector3(side * section.x, -halfThickness, section.leadingZ),
    bottomTrailing: new THREE.Vector3(side * section.x, -halfThickness, section.trailingZ),
  });
  const geometry = new THREE.BufferGeometry();
  for (let index = 0; index < sections.length - 1; index += 1) {
    const start = positions.length / 3;
    const a = points(sections[index]);
    const b = points(sections[index + 1]);
    triangle(a.topLeading, a.topTrailing, b.topTrailing);
    triangle(a.topLeading, b.topTrailing, b.topLeading);
    triangle(a.bottomLeading, b.bottomTrailing, a.bottomTrailing);
    triangle(a.bottomLeading, b.bottomLeading, b.bottomTrailing);
    triangle(a.topLeading, b.topLeading, b.bottomLeading);
    triangle(a.topLeading, b.bottomLeading, a.bottomLeading);
    triangle(a.topTrailing, a.bottomTrailing, b.bottomTrailing);
    triangle(a.topTrailing, b.bottomTrailing, b.topTrailing);
    geometry.addGroup(start, positions.length / 3 - start, materialIndices[index]);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
};

const createBeakWedgeGeometry = (upper: boolean) => {
  const halfWidth = upper ? 0.040 : 0.033;
  const baseTop = upper ? 0.018 : 0.003;
  const baseBottom = upper ? -0.006 : -0.018;
  const tipY = upper ? -0.003 : -0.008;
  return new ConvexGeometry([
    new THREE.Vector3(-halfWidth, baseTop, 0),
    new THREE.Vector3(halfWidth, baseTop, 0),
    new THREE.Vector3(-halfWidth, baseBottom, 0),
    new THREE.Vector3(halfWidth, baseBottom, 0),
    new THREE.Vector3(-0.004, tipY + 0.003, upper ? 0.205 : 0.185),
    new THREE.Vector3(0.004, tipY + 0.003, upper ? 0.205 : 0.185),
    new THREE.Vector3(0, tipY - 0.003, upper ? 0.205 : 0.185),
  ]);
};

const createFlightPrimaryGeometry = (
  side: number,
  rootX: number,
  rootZ: number,
  tipX: number,
  tipZ: number,
  halfWidth: number,
) => {
  const root = new THREE.Vector2(side * rootX, rootZ);
  const tip = new THREE.Vector2(side * tipX, tipZ);
  const direction = tip.clone().sub(root).normalize();
  const perpendicular = new THREE.Vector2(-direction.y, direction.x);
  const rootPerpendicular = perpendicular.clone().multiplyScalar(halfWidth * 0.36);
  const midPerpendicular = perpendicular.clone().multiplyScalar(halfWidth);
  const tipPerpendicular = perpendicular.clone().multiplyScalar(halfWidth * 0.94);
  const mid = root.clone().lerp(tip, 0.68);
  const tipShoulder = tip.clone().addScaledVector(direction, -0.010);
  const roundedTip = tip.clone().addScaledVector(direction, 0.006);
  const halfThickness = 0.018;
  const points: THREE.Vector3[] = [];
  [-halfThickness, halfThickness].forEach((y) => {
    points.push(
      new THREE.Vector3(root.x + rootPerpendicular.x, y, root.y + rootPerpendicular.y),
      new THREE.Vector3(root.x - rootPerpendicular.x, y, root.y - rootPerpendicular.y),
      new THREE.Vector3(mid.x + midPerpendicular.x, y, mid.y + midPerpendicular.y),
      new THREE.Vector3(mid.x - midPerpendicular.x, y, mid.y - midPerpendicular.y),
      new THREE.Vector3(
        tipShoulder.x + tipPerpendicular.x,
        y * 0.55,
        tipShoulder.y + tipPerpendicular.y,
      ),
      new THREE.Vector3(
        tipShoulder.x - tipPerpendicular.x,
        y * 0.55,
        tipShoulder.y - tipPerpendicular.y,
      ),
      new THREE.Vector3(roundedTip.x, y * 0.45, roundedTip.y),
    );
  });
  return new ConvexGeometry(points);
};

const createLeg = (side: number, legMaterial: THREE.Material) => {
  const leg = new THREE.Group();
  leg.name = side < 0 ? 'gray-magpie-leg-left' : 'gray-magpie-leg-right';
  leg.position.set(side * 0.095, 0.20, 0.015);
  const ankle = new THREE.Vector3(0, -0.155, -0.012);
  const toeY = -0.172;
  cylinderBetween(leg, new THREE.Vector3(0, 0, 0), ankle, 0.013, legMaterial, 'tarsus');
  cylinderBetween(leg, ankle, new THREE.Vector3(0, toeY, 0.14), 0.0065, legMaterial, 'toe-forward');
  cylinderBetween(leg, ankle, new THREE.Vector3(side * -0.050, toeY, 0.085), 0.006, legMaterial, 'toe-inner');
  cylinderBetween(leg, ankle, new THREE.Vector3(side * 0.050, toeY, 0.085), 0.006, legMaterial, 'toe-outer');
  cylinderBetween(leg, ankle, new THREE.Vector3(0, toeY + 0.008, -0.075), 0.0055, legMaterial, 'toe-back');
  return leg;
};

const attachGroupDetailOutlines = (
  root: THREE.Object3D,
  thickness: number,
) => {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  meshes.forEach((mesh) => attachStylizedBirdDetailOutline(mesh, thickness));
};

export const grayMagpieNeutralPose = (): GrayMagpiePose => ({
  bodyX: 0,
  bodyY: 0,
  bodyZ: 0,
  headX: 0,
  headY: 0,
  headZ: 0,
  tailX: -0.18,
  tailY: 0,
  tailZ: 0,
  tailFan: 0,
  wingSpread: 0,
  wingFlap: 0,
  leftLegX: 0,
  rightLegX: 0,
  beakOpen: 0,
});

export const createGrayMagpie = () => {
  const group = new THREE.Group();
  group.name = 'BIO_GrayMagpie_v003';

  const materials = {
    body: toon('#ffffff', { vertexColors: true, shadeColor: '#747f84', shadeStrength: 0.60 }),
    back: toon('#8f9694', { shadeColor: '#6f7978' }),
    light: toon('#d6d7cf', { shadeColor: '#a8b2b3' }),
    dark: toon('#293235', { shadeColor: '#182125' }),
    blue: toon('#7b9fb5', { shadeColor: '#536f81' }),
    white: toon('#f2f3ef', { shadeColor: '#b9c5c7' }),
    eye: toon('#090d0e', { stylizedShading: false }),
  };

  const body = new THREE.Group();
  body.name = 'gray-magpie-body';
  group.add(body);
  const bodyGeometry = createBlendedSphereGeometry(
    16,
    5,
    (azimuth) => 0.15 + Math.cos(azimuth) * 0.35,
    0.12,
    '#8f9694',
    '#d6d7cf',
  );
  const torso = addMesh(
    body,
    bodyGeometry,
    materials.body,
    new THREE.Vector3(0, 0.37, -0.065),
    new THREE.Vector3(0.230, 0.247, 0.46),
    'gray-magpie-torso',
  );
  attachStylizedBirdDetailOutline(torso, 0.0100);

  const headGroup = new THREE.Group();
  headGroup.name = 'gray-magpie-head-pivot';
  headGroup.position.set(0, 0.560, 0.290);
  headGroup.userData.neutralPosition = headGroup.position.clone();
  body.add(headGroup);
  const headGeometry = createPartitionedSphereGeometry(
    16,
    5,
    (azimuth) => -0.05 - (1 - Math.cos(azimuth)) * 0.09,
  );
  const headRadii = new THREE.Vector3(0.150, 0.150, 0.180);
  const headCenter = new THREE.Vector3(0, -0.005, 0.015);
  const head = addMesh(
    headGroup,
    headGeometry,
    [materials.dark, materials.light],
    headCenter,
    headRadii,
    'gray-magpie-head',
  );
  attachStylizedBirdDetailOutline(head, 0.0080);

  const beakUpper = addMesh(
    headGroup,
    createBeakWedgeGeometry(true),
    materials.dark,
    new THREE.Vector3(0, -0.005, 0.13),
    new THREE.Vector3(1, 1, 1),
    'gray-magpie-beak-upper',
  );
  const beakLower = addMesh(
    headGroup,
    createBeakWedgeGeometry(false),
    materials.dark,
    new THREE.Vector3(0, -0.005, 0.13),
    new THREE.Vector3(1, 1, 1),
    'gray-magpie-beak-lower',
  );
  attachStylizedBirdDetailOutline(beakUpper, 0.0035);
  attachStylizedBirdDetailOutline(beakLower, 0.0030);

  [-1, 1].forEach((side) => {
    const eyeY = 0.042;
    const eyeZ = 0.108;
    const surfaceX = headRadii.x * Math.sqrt(
      Math.max(0, 1 - (eyeY * eyeY) / (headRadii.y * headRadii.y) - (eyeZ * eyeZ) / (headRadii.z * headRadii.z)),
    );
    const normal = new THREE.Vector3(
      side * surfaceX / (headRadii.x * headRadii.x),
      eyeY / (headRadii.y * headRadii.y),
      eyeZ / (headRadii.z * headRadii.z),
    ).normalize();
    const eyePosition = new THREE.Vector3(
      side * surfaceX,
      eyeY + headCenter.y,
      eyeZ + headCenter.z,
    );
    const eye = addMesh(
      headGroup,
      new THREE.CircleGeometry(0.015, 8),
      materials.eye,
      eyePosition.clone().addScaledVector(normal, 0.002),
      new THREE.Vector3(1, 1, 1),
      side < 0 ? 'gray-magpie-eye-left' : 'gray-magpie-eye-right',
    );
    eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const eyeRing = addMesh(
      headGroup,
      new THREE.TorusGeometry(0.0155, 0.0015, 5, 10),
      materials.light,
      eyePosition.clone().addScaledVector(normal, 0.0035),
      new THREE.Vector3(1, 1, 1),
      side < 0 ? 'gray-magpie-eye-ring-left' : 'gray-magpie-eye-ring-right',
    );
    eyeRing.quaternion.copy(eye.quaternion);
    const highlight = addMesh(
      headGroup,
      new THREE.CircleGeometry(0.0035, 6),
      materials.light,
      eyePosition.clone().addScaledVector(normal, 0.006).add(new THREE.Vector3(0, 0.005, 0)),
      new THREE.Vector3(1, 1, 1),
      side < 0 ? 'gray-magpie-eye-highlight-left' : 'gray-magpie-eye-highlight-right',
    );
    highlight.quaternion.copy(eye.quaternion);
  });

  const createFoldedWing = (side: number) => {
    const wing = addMesh(
      body,
      createFoldedWingGeometry(side),
      [materials.back, materials.blue],
      new THREE.Vector3(),
      new THREE.Vector3(1, 1, 1),
      side < 0 ? 'gray-magpie-folded-wing-left' : 'gray-magpie-folded-wing-right',
    );
    wing.receiveShadow = false;
    return wing;
  };

  const foldedWingLeft = createFoldedWing(-1);
  const foldedWingRight = createFoldedWing(1);
  attachStylizedBirdDetailOutline(foldedWingLeft, 0.0040, { inflation: 'bounds' });
  attachStylizedBirdDetailOutline(foldedWingRight, 0.0040, { inflation: 'bounds' });

  const flightPrimaryLayout = [
    { rootX: 0.55, rootZ: 0.070, tipX: 1.02, tipZ: 0.14, halfWidth: 0.050 },
    { rootX: 0.515, rootZ: 0.045, tipX: 1.07, tipZ: 0.09, halfWidth: 0.052 },
    { rootX: 0.47, rootZ: 0.018, tipX: 1.10, tipZ: 0.02, halfWidth: 0.055 },
    { rootX: 0.42, rootZ: -0.012, tipX: 1.08, tipZ: -0.08, halfWidth: 0.058 },
    { rootX: 0.37, rootZ: -0.047, tipX: 1.02, tipZ: -0.20, halfWidth: 0.061 },
    { rootX: 0.32, rootZ: -0.082, tipX: 0.89, tipZ: -0.327, halfWidth: 0.064 },
    { rootX: 0.27, rootZ: -0.120, tipX: 0.75, tipZ: -0.446, halfWidth: 0.067 },
    { rootX: 0.22, rootZ: -0.158, tipX: 0.561, tipZ: -0.524, halfWidth: 0.070 },
    { rootX: 0.16, rootZ: -0.190, tipX: 0.36, tipZ: -0.536, halfWidth: 0.071 },
    { rootX: 0.10, rootZ: -0.215, tipX: 0.196, tipZ: -0.510, halfWidth: 0.070 },
  ];

  const createFlightWing = (side: number) => {
    const flightWing = new THREE.Group();
    flightWing.name = side < 0 ? 'gray-magpie-flight-wing-left' : 'gray-magpie-flight-wing-right';
    flightWing.position.set(side * 0.17, 0.47, 0.015);
    body.add(flightWing);
    // The broad wing surface can expose either face to the camera, so it cannot
    // use an inverted hull. Thin primary hulls provide the crisp outer fan edge.
    addMesh(
      flightWing,
      createSectionedFlightWingGeometry(side),
      [materials.back, materials.blue],
      new THREE.Vector3(),
      new THREE.Vector3(1, 1, 1),
      'flight-wing-surface',
    );
    flightPrimaryLayout.forEach((primary, index) => {
      const primaryMesh = addMesh(
        flightWing,
        createFlightPrimaryGeometry(
          side,
          primary.rootX,
          primary.rootZ,
          primary.tipX,
          primary.tipZ,
          primary.halfWidth,
        ),
        materials.blue,
        new THREE.Vector3(0, -0.004 - index * 0.0015, 0),
        new THREE.Vector3(1, 1, 1),
        `flight-primary-${index}`,
      );
      attachStylizedBirdDetailOutline(primaryMesh, 0.0020, { inflation: 'bounds' });
    });
    flightWing.visible = false;
    return flightWing;
  };

  const flightWingLeft = createFlightWing(-1);
  const flightWingRight = createFlightWing(1);

  const tailGroup = new THREE.Group();
  tailGroup.name = 'gray-magpie-tail-pivot';
  tailGroup.position.set(0, 0.34, -0.39);
  body.add(tailGroup);
  const tailFeathers: THREE.Mesh[] = [];
  [-1, 1].forEach((side) => {
    const feather = addMesh(
      tailGroup,
      createPartitionedTailGeometry(1.02, 0.070, 0.042, 0.58),
      [materials.blue, materials.white],
      new THREE.Vector3(side * 0.040, 0, 0),
      new THREE.Vector3(1, 1, 1),
      side < 0 ? 'gray-magpie-tail-left' : 'gray-magpie-tail-right',
    );
    feather.rotation.y = side * 0.016;
    feather.userData.neutralX = side * 0.040;
    feather.userData.neutralYaw = side * 0.016;
    attachStylizedBirdDetailOutline(feather, 0.0060, { inflation: 'bounds' });
    tailFeathers.push(feather);
  });
  const tailCenter = addMesh(
    tailGroup,
    createPartitionedTailGeometry(1.08, 0.045, 0.045, 0.55),
    [materials.blue, materials.white],
    new THREE.Vector3(0, 0.008, 0.005),
    new THREE.Vector3(1, 1, 1),
    'gray-magpie-tail-center',
  );
  attachStylizedBirdDetailOutline(tailCenter, 0.0055, { inflation: 'bounds' });

  const legLeft = createLeg(-1, materials.dark);
  const legRight = createLeg(1, materials.dark);
  attachGroupDetailOutlines(legLeft, 0.0025);
  attachGroupDetailOutlines(legRight, 0.0025);
  body.add(legLeft, legRight);

  const parts: GrayMagpieParts = {
    body,
    headGroup,
    beakUpper,
    beakLower,
    foldedWingLeft,
    foldedWingRight,
    flightWingLeft,
    flightWingRight,
    tailGroup,
    tailFeatherLeft: tailFeathers[0],
    tailFeatherRight: tailFeathers[1],
    legLeft,
    legRight,
  };
  group.userData.parts = parts;
  group.userData.species = 'gray-magpie';
  group.userData.stylizedOutlineMode = 'parts';
  group.userData.renderedPose = grayMagpieNeutralPose();
  return group;
};

export const applyGrayMagpiePose = (
  group: THREE.Group,
  target: GrayMagpiePose,
  delta: number,
) => {
  const parts = group.userData.parts as GrayMagpieParts | undefined;
  if (!parts) return;
  const rendered = (group.userData.renderedPose ?? grayMagpieNeutralPose()) as GrayMagpiePose;
  const blend = 1 - Math.exp(-delta * 12);
  (Object.keys(rendered) as Array<keyof GrayMagpiePose>).forEach((key) => {
    rendered[key] = THREE.MathUtils.lerp(rendered[key], target[key], blend);
  });
  parts.body.rotation.set(rendered.bodyX, rendered.bodyY, rendered.bodyZ);
  parts.headGroup.rotation.set(rendered.headX, rendered.headY, rendered.headZ);
  parts.headGroup.position.copy(parts.headGroup.userData.neutralPosition as THREE.Vector3);
  parts.tailGroup.rotation.set(rendered.tailX, rendered.tailY, rendered.tailZ);
  [parts.tailFeatherLeft, parts.tailFeatherRight].forEach((feather, index) => {
    const side = index === 0 ? -1 : 1;
    feather.position.x = (feather.userData.neutralX as number) + side * rendered.tailFan * 0.090;
    feather.rotation.y = (feather.userData.neutralYaw as number) + side * rendered.tailFan * 0.42;
  });
  parts.legLeft.rotation.x = rendered.leftLegX;
  parts.legRight.rotation.x = rendered.rightLegX;
  parts.beakUpper.rotation.x = -rendered.beakOpen * 0.08;
  parts.beakLower.rotation.x = rendered.beakOpen * 0.26;
  parts.flightWingLeft.rotation.z = rendered.wingFlap;
  parts.flightWingRight.rotation.z = -rendered.wingFlap;
  parts.flightWingLeft.rotation.x = rendered.wingFlap * 0.12;
  parts.flightWingRight.rotation.x = rendered.wingFlap * 0.12;
  const spread = THREE.MathUtils.clamp(rendered.wingSpread, 0, 1);
  parts.foldedWingLeft.visible = spread < 0.62;
  parts.foldedWingRight.visible = spread < 0.62;
  parts.flightWingLeft.visible = spread > 0.04;
  parts.flightWingRight.visible = spread > 0.04;
  parts.flightWingLeft.scale.setScalar(0.18 + spread * 0.82);
  parts.flightWingRight.scale.setScalar(0.18 + spread * 0.82);
};
