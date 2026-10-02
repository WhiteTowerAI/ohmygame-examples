import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { attachStylizedBirdDetailOutline } from '../rendering/stylized-bird-detail-outline';
import { createStylizedBirdMaterial as toon } from '../rendering/stylized-bird-material';

const addMesh = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position = new THREE.Vector3(),
  scale = new THREE.Vector3(1, 1, 1),
) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.scale.copy(scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const cylinderBetween = (
  parent: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  color: THREE.ColorRepresentation,
) => {
  const delta = end.clone().sub(start);
  const mesh = addMesh(parent, new THREE.CylinderGeometry(radius * 0.7, radius, delta.length(), 7), toon(color));
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
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

const smooth01 = (value: number) => {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
};

type BlackbirdVariant = 'adult' | 'juvenile';

export const createBlackbird = (variant: BlackbirdVariant) => {
  const juvenile = variant === 'juvenile';
  const group = new THREE.Group();
  const feathers = juvenile
    ? toon('#6b5346', { shadeColor: '#493b34' })
    : toon('#293431', { shadeColor: '#171f1e' });
  const wingFeathers = juvenile
    ? toon('#51443d', { shadeColor: '#372f2b' })
    : toon('#39423f', { shadeColor: '#252e2c' });
  wingFeathers.side = THREE.DoubleSide;
  const flightFeathers = juvenile
    ? toon('#443a35', { shadeColor: '#2e2825' })
    : toon('#2d3633', { shadeColor: '#1c2422' });
  const beakColor = juvenile
    ? toon('#75675a', { shadeColor: '#51483f' })
    : toon('#d99131', { shadeColor: '#a85e24' });
  const eyeRingColor = toon(juvenile ? '#8a7964' : '#e29a2a', { stylizedShading: false });
  const body = new THREE.Group();
  group.add(body);

  // Keep the breast full, but pull its upper front edge back so the head does not
  // merge into a column-thick neck in profile.
  // Re-emphasize the compact low-poly silhouette: a round toy-like torso and
  // a larger head read better at the game's naked-eye distance.
  const bodyCenter = juvenile ? new THREE.Vector3(0, 0.31, -0.025) : new THREE.Vector3(0, 0.30, -0.06);
  const bodyRadii = juvenile ? new THREE.Vector3(0.27, 0.27, 0.32) : new THREE.Vector3(0.255, 0.245, 0.36);
  const torso = addMesh(body, new THREE.SphereGeometry(1, 12, 8), feathers, bodyCenter, bodyRadii);
  attachStylizedBirdDetailOutline(torso, 0.0090);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, juvenile ? 0.49 : 0.475, juvenile ? 0.255 : 0.295);
  headGroup.userData.neutralPosition = headGroup.position.clone();
  body.add(headGroup);
  const headRadius = juvenile ? 0.195 : 0.19;
  const headScaleY = juvenile ? 1.07 : 1.03;
  const headScaleZ = juvenile ? 1.02 : 0.98;
  const head = addMesh(headGroup, new THREE.SphereGeometry(headRadius, 12, 8), feathers, new THREE.Vector3(0, 0, 0.01), new THREE.Vector3(1, headScaleY, headScaleZ));
  attachStylizedBirdDetailOutline(head, 0.0070);
  const beakUpper = addMesh(
    headGroup,
    new THREE.ConeGeometry(juvenile ? 0.043 : 0.052, juvenile ? 0.205 : 0.26, 5),
    beakColor,
    new THREE.Vector3(0, -0.006, juvenile ? 0.205 : 0.235),
    new THREE.Vector3(1, juvenile ? 0.78 : 0.86, 1),
  );
  beakUpper.rotation.x = Math.PI / 2;
  const beakLower = addMesh(
    headGroup,
    new THREE.ConeGeometry(juvenile ? 0.033 : 0.039, juvenile ? 0.185 : 0.235, 5),
    juvenile
      ? toon('#5f544b', { shadeColor: '#403a35' })
      : toon('#c97823', { shadeColor: '#8c431c' }),
    new THREE.Vector3(0, juvenile ? -0.027 : -0.031, juvenile ? 0.194 : 0.222),
    new THREE.Vector3(1, juvenile ? 0.70 : 0.78, 1),
  );
  beakLower.rotation.x = Math.PI / 2;
  attachStylizedBirdDetailOutline(beakUpper, 0.0028);
  attachStylizedBirdDetailOutline(beakLower, 0.0025);
  if (juvenile) {
    [-1, 1].forEach((side) => {
      const gape = addMesh(
        headGroup,
        new THREE.ConeGeometry(0.021, 0.085, 3),
        toon('#c9b78c'),
        new THREE.Vector3(side * 0.038, -0.017, 0.165),
        new THREE.Vector3(0.75, 0.72, 1),
      );
      gape.rotation.x = Math.PI / 2;
      gape.rotation.z = side * 0.12;
    });
    const tuftMaterial = toon('#594c42');
    [
      new THREE.Vector3(-0.052, 0.178, -0.025),
      new THREE.Vector3(0.010, 0.195, -0.045),
      new THREE.Vector3(0.058, 0.172, -0.010),
    ].forEach((position, index) => {
      const tuft = addMesh(
        headGroup,
        new THREE.TetrahedronGeometry(0.026, 0),
        tuftMaterial,
        position,
        new THREE.Vector3(0.75, 0.42, 0.75),
      );
      tuft.rotation.y = index * 0.8;
      tuft.rotation.z = (index - 1) * 0.18;
    });
  }
  [-1, 1].forEach((side) => {
    // Place the concentric layers on the ellipsoid surface, not on a fixed X plane.
    // This gives the eye the same curvature as the head and lets it sit slightly in.
    const eyeY = 0.045;
    const eyeZ = 0.10;
    const headRadii = new THREE.Vector3(headRadius, headRadius * headScaleY, headRadius * headScaleZ);
    const surfaceX = headRadii.x * Math.sqrt(Math.max(0, 1 - (eyeY * eyeY) / (headRadii.y * headRadii.y) - (eyeZ * eyeZ) / (headRadii.z * headRadii.z)));
    const normal = new THREE.Vector3(side * surfaceX / (headRadii.x * headRadii.x), eyeY / (headRadii.y * headRadii.y), eyeZ / (headRadii.z * headRadii.z)).normalize();
    const eyeCenter = new THREE.Vector3(side * (surfaceX - 0.002), eyeY, eyeZ);
    const orientEye = (object: THREE.Object3D, offset: number) => {
      object.position.copy(eyeCenter).addScaledVector(normal, offset);
      object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    };
    const eyeRing = addMesh(
      headGroup,
      new THREE.TorusGeometry(juvenile ? 0.024 : 0.027, juvenile ? 0.0025 : 0.004, 5, 12),
      eyeRingColor,
    );
    orientEye(eyeRing, 0.001);
    const pupil = addMesh(
      headGroup,
      new THREE.CircleGeometry(0.021, 10),
      toon('#080b0a', { stylizedShading: false }),
    );
    orientEye(pupil, 0.005);
    const highlight = addMesh(
      headGroup,
      new THREE.CircleGeometry(0.004, 6),
      toon('#f0eadb', { stylizedShading: false }),
    );
    orientEye(highlight, 0.009);
    highlight.position.addScaledVector(new THREE.Vector3(0, 0.007, 0.009).applyQuaternion(eyeRing.quaternion), 1);
  });

  if (juvenile) {
    const chestSpots: Array<[number, number, number]> = [
      [-0.105, 0.405, 0.014], [-0.045, 0.42, 0.012], [0.02, 0.415, 0.014], [0.09, 0.39, 0.013],
      [-0.13, 0.35, 0.016], [-0.065, 0.355, 0.012], [0.005, 0.36, 0.015], [0.075, 0.34, 0.012], [0.135, 0.32, 0.014],
      [-0.115, 0.285, 0.013], [-0.05, 0.29, 0.016], [0.02, 0.285, 0.012], [0.09, 0.27, 0.015],
      [-0.08, 0.225, 0.014], [-0.015, 0.215, 0.012], [0.055, 0.215, 0.015], [0.11, 0.205, 0.012],
    ];
    chestSpots.forEach(([x, y, radius], index) => {
      const nx = x / bodyRadii.x;
      const ny = (y - bodyCenter.y) / bodyRadii.y;
      const z = bodyCenter.z + bodyRadii.z * Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const normal = new THREE.Vector3(
        x / (bodyRadii.x * bodyRadii.x),
        (y - bodyCenter.y) / (bodyRadii.y * bodyRadii.y),
        (z - bodyCenter.z) / (bodyRadii.z * bodyRadii.z),
      ).normalize();
      const spot = addMesh(
        body,
        new THREE.CircleGeometry(radius, 3),
        toon(index % 4 === 0 ? '#c09a72' : index % 3 === 0 ? '#9b7459' : '#ad8463'),
      );
      spot.position.set(x, y, z).addScaledVector(normal, 0.003);
      spot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    });
    const sideSpots: Array<[number, number, number]> = [
      [0.385, 0.145, 0.021], [0.315, 0.085, 0.018], [0.245, 0.155, 0.017],
    ];
    [-1, 1].forEach((side) => {
      sideSpots.forEach(([y, z, radius], index) => {
        const ny = (y - bodyCenter.y) / bodyRadii.y;
        const nz = (z - bodyCenter.z) / bodyRadii.z;
        const x = side * bodyRadii.x * Math.sqrt(Math.max(0, 1 - ny * ny - nz * nz));
        const normal = new THREE.Vector3(
          x / (bodyRadii.x * bodyRadii.x),
          (y - bodyCenter.y) / (bodyRadii.y * bodyRadii.y),
          (z - bodyCenter.z) / (bodyRadii.z * bodyRadii.z),
        ).normalize();
        const spot = addMesh(body, new THREE.CircleGeometry(radius * 0.72, 3), toon(index % 2 ? '#a17c5f' : '#b08b68'));
        spot.position.set(x, y, z).addScaledVector(normal, 0.003);
        spot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      });
    });
  }

  const createFoldedWing = (side: number) => {
    const baseProfile: Array<[number, number]> = [
      [0.455, 0.13], [0.455, -0.04], [0.385, -0.25], [0.285, -0.36], [0.25, -0.29], [0.265, 0.10],
    ];
    const profile: Array<[number, number]> = juvenile
      ? baseProfile.map(([y, z]) => [y + 0.005, z * 0.84 + 0.015])
      : baseProfile;
    const point = ([y, z]: [number, number], outer: boolean) => new THREE.Vector3(
      side * (0.24 + z * 0.10 + (outer ? 0.026 : 0)),
      y,
      z,
    );
    const outer = profile.map((entry) => point(entry, true));
    const inner = profile.map((entry) => point(entry, false));
    const positions: number[] = [];
    const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      const second = side < 0 ? b : c;
      const third = side < 0 ? c : b;
      positions.push(a.x, a.y, a.z, second.x, second.y, second.z, third.x, third.y, third.z);
    };
    // Explicit convex caps avoid the small missing triangle produced by the
    // automatic extrude cap on this low-poly outline.
    for (let i = 1; i < profile.length - 1; i += 1) {
      triangle(outer[0], outer[i], outer[i + 1]);
      triangle(inner[0], inner[i + 1], inner[i]);
    }
    for (let i = 0; i < profile.length; i += 1) {
      const next = (i + 1) % profile.length;
      triangle(outer[i], inner[i], inner[next]);
      triangle(outer[i], inner[next], outer[next]);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const wing = addMesh(body, geometry, wingFeathers);
    wing.receiveShadow = false;
    return wing;
  };
  const foldedWingLeft = createFoldedWing(-1);
  const foldedWingRight = createFoldedWing(1);
  attachStylizedBirdDetailOutline(foldedWingLeft, 0.0035, { inflation: 'bounds' });
  attachStylizedBirdDetailOutline(foldedWingRight, 0.0035, { inflation: 'bounds' });

  const createFlightWing = (side: number) => {
    const wing = new THREE.Group();
    wing.position.set(side * 0.14, 0.40, 0.04);
    body.add(wing);
    const points = [
      new THREE.Vector3(0, 0.045, 0.13), new THREE.Vector3(0, -0.045, 0.13),
      new THREE.Vector3(side * 0.38, 0.04, 0.10), new THREE.Vector3(side * 0.38, -0.04, 0.10),
      new THREE.Vector3(side * 0.72, 0.025, -0.08), new THREE.Vector3(side * 0.72, -0.025, -0.08),
      new THREE.Vector3(side * 0.48, 0.035, -0.22), new THREE.Vector3(side * 0.48, -0.035, -0.22),
      new THREE.Vector3(0, 0.04, -0.15), new THREE.Vector3(0, -0.04, -0.15),
    ];
    addMesh(wing, new ConvexGeometry(points), flightFeathers);
    for (let i = 0; i < 4; i += 1) {
      const feather = addMesh(
        wing,
        new THREE.CapsuleGeometry(0.027, 0.23 - i * 0.018, 3, 5),
        wingFeathers,
        new THREE.Vector3(side * (0.54 + i * 0.045), -0.018, -0.10 - i * 0.038),
        new THREE.Vector3(1, 1, 0.68),
      );
      feather.rotation.z = side * Math.PI / 2;
      feather.rotation.y = side * (0.10 + i * 0.05);
      attachStylizedBirdDetailOutline(feather, 0.0018);
    }
    wing.visible = false;
    return wing;
  };
  const flightWingLeft = createFlightWing(-1);
  const flightWingRight = createFlightWing(1);

  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.295, -0.29);
  body.add(tailGroup);
  const tailPoints = [
    new THREE.Vector3(-0.12, 0.045, 0.02), new THREE.Vector3(0.12, 0.045, 0.02),
    new THREE.Vector3(-0.12, -0.045, 0.02), new THREE.Vector3(0.12, -0.045, 0.02),
    new THREE.Vector3(-0.07, 0.028, juvenile ? -0.34 : -0.53), new THREE.Vector3(0.07, 0.028, juvenile ? -0.34 : -0.53),
    new THREE.Vector3(-0.07, -0.045, juvenile ? -0.34 : -0.53), new THREE.Vector3(0.07, -0.045, juvenile ? -0.34 : -0.53),
  ];
  const tail = addMesh(tailGroup, new ConvexGeometry(tailPoints), flightFeathers);
  attachStylizedBirdDetailOutline(tail, 0.0045, { inflation: 'bounds' });

  const createLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.085, 0.17, 0.035);
    body.add(leg);
    const ankleY = juvenile ? -0.18 : -0.145;
    const toeY = juvenile ? -0.19 : -0.155;
    const ankle = new THREE.Vector3(0, ankleY, -0.025);
    cylinderBetween(leg, new THREE.Vector3(0, 0, 0), ankle, 0.013, '#786052');
    cylinderBetween(leg, ankle, new THREE.Vector3(0, toeY, 0.14), 0.0075, '#786052');
    cylinderBetween(leg, ankle, new THREE.Vector3(-0.052, toeY, 0.105), 0.007, '#786052');
    cylinderBetween(leg, ankle, new THREE.Vector3(0.052, toeY, 0.105), 0.007, '#786052');
    cylinderBetween(leg, ankle, new THREE.Vector3(0, toeY + 0.002, -0.09), 0.0065, '#786052');
    return leg;
  };
  const legLeft = createLeg(-1);
  const legRight = createLeg(1);
  attachGroupDetailOutlines(legLeft, 0.0020);
  attachGroupDetailOutlines(legRight, 0.0020);
  group.userData.parts = {
    body, headGroup, head, beakUpper, beakLower, foldedWingLeft, foldedWingRight,
    flightWingLeft, flightWingRight, tailGroup, legLeft, legRight,
  };
  group.userData.stylizedOutlineMode = 'parts';
  return group;
};


type BlackbirdPose = {
  bodyX: number; bodyY: number; bodyZ: number;
  headX: number; headY: number; headZ: number;
  tailX: number; tailY: number; tailZ: number;
  wingSpread: number; wingFlap: number;
  leftLegX: number; rightLegX: number; beakOpen: number;
};

type BlackbirdState =
  | 'idle'
  | 'listen'
  | 'forage'
  | 'peck'
  | 'hop'
  | 'alert'
  | 'takeoff'
  | 'flight'
  | 'land'
  | 'perch'
  | 'sing'
  | 'preen';
const createNeutralBlackbirdPose = (): BlackbirdPose => ({
  bodyX: 0, bodyY: 0, bodyZ: 0,
  headX: 0, headY: 0, headZ: 0,
  tailX: 0, tailY: 0, tailZ: 0,
  wingSpread: 0, wingFlap: 0,
  leftLegX: 0, rightLegX: 0, beakOpen: 0,
});
let renderedPose = createNeutralBlackbirdPose();

export const sampleBlackbirdPose = (state: BlackbirdState, cycle: number, time: number): BlackbirdPose => {
  const pose = createNeutralBlackbirdPose();
  const pulse = Math.sin(cycle * Math.PI * 2);
  const slowPulse = Math.sin(time * 1.35);
  if (state === 'idle') {
    pose.bodyX = Math.sin(time * 1.7) * 0.025;
    pose.headX = Math.sin(time * 1.8) * 0.06;
    pose.tailX = 0.035 + slowPulse * 0.065;
    pose.tailZ = Math.sin(time * 0.82) * 0.025;
  } else if (state === 'listen') {
    pose.headZ = Math.sin(cycle * Math.PI * 2) * 0.24;
    pose.headY = Math.sin(cycle * Math.PI * 2) * 0.12;
    pose.headX = -0.08 + Math.sin(cycle * Math.PI * 4) * 0.04;
    pose.tailX = 0.05 + pulse * 0.035;
    pose.tailZ = -pose.headZ * 0.32;
  } else if (state === 'forage') {
    const peck = Math.max(0, Math.sin(cycle * Math.PI * 4));
    pose.bodyX = 0.10 + peck * 0.18;
    pose.headX = 0.10 + peck * 0.72;
    pose.headY = -peck * 0.065;
    pose.headZ = Math.sin(cycle * Math.PI * 2) * 0.05;
    pose.tailX = 0.04 + peck * 0.18;
    pose.tailZ = Math.sin(cycle * Math.PI * 2) * 0.025;
    pose.leftLegX = Math.sin(cycle * Math.PI * 2) * 0.08;
    pose.rightLegX = -pose.leftLegX;
  } else if (state === 'peck') {
    const peck = Math.sin(Math.PI * cycle);
    pose.bodyX = 0.14 + peck * 0.12;
    pose.headX = 0.14 + peck * 0.82;
    pose.headY = -peck * 0.045;
    pose.tailX = 0.06 + peck * 0.18;
    pose.beakOpen = peck * 0.12;
  } else if (state === 'hop') {
    const hop = Math.sin(Math.PI * cycle);
    pose.bodyZ = -pulse * 0.08;
    pose.headX = -hop * 0.10;
    pose.tailX = 0.04 + hop * 0.16;
    pose.tailZ = -pulse * 0.06;
    pose.leftLegX = -hop * 0.28;
    pose.rightLegX = hop * 0.28;
  } else if (state === 'alert') {
    pose.bodyX = -0.20;
    pose.headX = -0.24;
    pose.headY = Math.sin(cycle * Math.PI * 3) * 0.11;
    pose.headZ = Math.sin(cycle * Math.PI * 2) * 0.08;
    pose.tailX = -0.08;
    pose.tailZ = -Math.sin(cycle * Math.PI * 2) * 0.055;
  } else if (state === 'takeoff') {
    const launch = smooth01(cycle);
    pose.bodyX = 0.18 - launch * 0.42;
    pose.headX = 0.08 - launch * 0.20;
    pose.tailX = 0.12 - launch * 0.26;
    pose.wingSpread = smooth01(cycle * 1.2);
    pose.wingFlap = Math.sin(cycle * Math.PI * 3) * 0.20;
    pose.leftLegX = -launch * 1.1;
    pose.rightLegX = -launch * 1.1;
  } else if (state === 'flight') {
    const flap = Math.sin(time * 12.5);
    pose.bodyX = -0.14;
    pose.headX = -0.03;
    pose.tailX = -0.14;
    pose.wingSpread = 1;
    pose.wingFlap = flap * 0.58;
    pose.leftLegX = 1.05;
    pose.rightLegX = 1.05;
  } else if (state === 'land') {
    const brake = smooth01(cycle);
    pose.bodyX = -0.16 + brake * 0.28;
    pose.headX = -0.04 + brake * 0.06;
    pose.tailX = -0.14 + brake * 0.20;
    pose.wingSpread = 1 - brake;
    pose.wingFlap = Math.sin(time * 10.5) * (0.42 * (1 - brake));
    pose.leftLegX = 1.05 - brake * 1.05;
    pose.rightLegX = 1.05 - brake * 1.05;
  } else if (state === 'perch') {
    pose.bodyX = Math.sin(time * 1.4) * 0.018;
    pose.headX = Math.sin(time * 1.7) * 0.05;
    pose.tailX = 0.04 + Math.sin(time * 1.1) * 0.05;
    pose.tailZ = Math.sin(time * 0.75) * 0.025;
  } else if (state === 'sing') {
    const note = Math.max(0, Math.sin(cycle * Math.PI * 4));
    pose.bodyX = -0.08 - note * 0.05;
    pose.headX = -0.15 + note * 0.08;
    pose.headY = Math.sin(cycle * Math.PI * 2) * 0.10;
    pose.tailX = 0.05 + note * 0.07;
    pose.beakOpen = note * 0.85;
  } else if (state === 'preen') {
    const side = Math.sin(cycle * Math.PI * 2);
    pose.bodyX = 0.05;
    pose.headX = 0.25;
    pose.headY = side * 0.35;
    pose.headZ = side * 0.10;
    pose.tailX = 0.06;
    pose.tailZ = -side * 0.08;
    pose.beakOpen = 0.08;
  }
  return pose;
};

export const applyBlackbirdPose = (parts: {
  body: THREE.Group;
  headGroup: THREE.Group;
  beakUpper: THREE.Mesh;
  beakLower: THREE.Mesh;
  foldedWingLeft: THREE.Mesh;
  foldedWingRight: THREE.Mesh;
  flightWingLeft: THREE.Group;
  flightWingRight: THREE.Group;
  tailGroup: THREE.Group;
  legLeft: THREE.Group;
  legRight: THREE.Group;
}, pose: BlackbirdPose, delta: number) => {
  const blend = 1 - Math.exp(-delta * 12);
  (Object.keys(renderedPose) as Array<keyof BlackbirdPose>).forEach((key) => {
    renderedPose[key] = THREE.MathUtils.lerp(renderedPose[key], pose[key], blend);
  });
  parts.body.rotation.set(renderedPose.bodyX, renderedPose.bodyY, renderedPose.bodyZ);
  parts.headGroup.rotation.set(renderedPose.headX, renderedPose.headY, renderedPose.headZ);
  parts.headGroup.position.copy(parts.headGroup.userData.neutralPosition as THREE.Vector3);
  parts.beakUpper.rotation.x = Math.PI / 2 - renderedPose.beakOpen * 0.06;
  parts.beakLower.rotation.x = Math.PI / 2 + renderedPose.beakOpen * 0.34;
  parts.tailGroup.rotation.set(renderedPose.tailX, renderedPose.tailY, renderedPose.tailZ);
  parts.legLeft.rotation.x = renderedPose.leftLegX;
  parts.legRight.rotation.x = renderedPose.rightLegX;
  parts.flightWingLeft.rotation.z = renderedPose.wingFlap;
  parts.flightWingRight.rotation.z = -renderedPose.wingFlap;
  parts.flightWingLeft.rotation.x = renderedPose.wingFlap * 0.18;
  parts.flightWingRight.rotation.x = renderedPose.wingFlap * 0.18;
  const spread = THREE.MathUtils.clamp(renderedPose.wingSpread, 0, 1);
  const foldedVisible = spread < 0.62;
  parts.foldedWingLeft.visible = foldedVisible;
  parts.foldedWingRight.visible = foldedVisible;
  parts.flightWingLeft.visible = spread > 0.04;
  parts.flightWingRight.visible = spread > 0.04;
  parts.flightWingLeft.scale.setScalar(0.16 + spread * 0.84);
  parts.flightWingRight.scale.setScalar(0.16 + spread * 0.84);
};
