import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
// Shared game-art asset is intentionally kept as its original ESM module.
// @ts-expect-error The sibling declaration is used by editors; tsc does not resolve .mjs declarations in bundler mode.
import { buildCharacterHair } from './ThreeJSCharacterHairBuilder.mjs';

const toon = (color: THREE.ColorRepresentation) => new THREE.MeshToonMaterial({ color });

const addMesh = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
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

const roundedBox = (width: number, height: number, depth: number, radius: number) =>
  new RoundedBoxGeometry(width, height, depth, 5, radius);

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
    new THREE.CylinderGeometry(radius, radius, delta.length(), 8),
    material,
    start.clone().add(end).multiplyScalar(0.5),
    new THREE.Vector3(1, 1, 1),
    name,
  );
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
};

const addStrap = (
  parent: THREE.Object3D,
  points: THREE.Vector3[],
  radius: number,
  material: THREE.Material,
  name: string,
) => addMesh(
  parent,
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, radius, 6, false),
  material,
  new THREE.Vector3(),
  new THREE.Vector3(1, 1, 1),
  name,
);

const createBackpack = (materials: {
  pack: THREE.Material;
  packDark: THREE.Material;
  strap: THREE.Material;
  brass: THREE.Material;
  bottle: THREE.Material;
  bottleCap: THREE.Material;
}) => {
  const backpack = new THREE.Group();
  backpack.name = 'BirdwatchingBackpack';

  addMesh(
    backpack,
    roundedBox(0.62, 0.68, 0.28, 0.1),
    materials.pack,
    new THREE.Vector3(0, 0.76, -0.31),
    new THREE.Vector3(1, 1, 1),
    'BackpackBody',
  );
  addMesh(
    backpack,
    roundedBox(0.51, 0.18, 0.3, 0.07),
    materials.packDark,
    new THREE.Vector3(0, 1.05, -0.31),
    new THREE.Vector3(1, 1, 1),
    'BackpackFlap',
  );
  addMesh(
    backpack,
    roundedBox(0.44, 0.23, 0.08, 0.04),
    materials.packDark,
    new THREE.Vector3(0, 0.57, -0.49),
    new THREE.Vector3(1, 1, 1),
    'BackpackFrontPocket',
  );
  addMesh(
    backpack,
    roundedBox(0.12, 0.1, 0.05, 0.018),
    materials.brass,
    new THREE.Vector3(0, 0.72, -0.5),
    new THREE.Vector3(1, 1, 1),
    'BackpackBuckle',
  );

  [-1, 1].forEach((side) => {
    addStrap(
      backpack,
      [
        new THREE.Vector3(side * 0.23, 1.04, -0.08),
        new THREE.Vector3(side * 0.31, 0.84, 0.23),
        new THREE.Vector3(side * 0.3, 0.58, 0.24),
      ],
      0.025,
      materials.strap,
      side < 0 ? 'BackpackStrapLeft' : 'BackpackStrapRight',
    );
  });
  cylinderBetween(
    backpack,
    new THREE.Vector3(-0.29, 0.72, 0.25),
    new THREE.Vector3(0.29, 0.72, 0.25),
    0.018,
    materials.strap,
    'SternumStrap',
  );

  const bottle = new THREE.Group();
  bottle.name = 'WaterBottle';
  bottle.position.set(0.4, 0.65, -0.28);
  addMesh(
    bottle,
    new THREE.CylinderGeometry(0.095, 0.105, 0.34, 10),
    materials.bottle,
    new THREE.Vector3(),
    new THREE.Vector3(1, 1, 1),
    'BottleBody',
  );
  addMesh(
    bottle,
    new THREE.CylinderGeometry(0.075, 0.075, 0.07, 10),
    materials.bottleCap,
    new THREE.Vector3(0, 0.2, 0),
    new THREE.Vector3(1, 1, 1),
    'BottleCap',
  );
  backpack.add(bottle);

  return backpack;
};

const createBinoculars = (materials: {
  body: THREE.Material;
  dark: THREE.Material;
  lens: THREE.Material;
}) => {
  const binoculars = new THREE.Group();
  binoculars.name = 'Binoculars_8x42';
  binoculars.position.set(0, 0.64, 0.3);
  binoculars.rotation.x = -0.08;

  [-0.085, 0.085].forEach((x, index) => {
    addMesh(
      binoculars,
      new THREE.CylinderGeometry(0.07, 0.085, 0.25, 10),
      materials.body,
      new THREE.Vector3(x, 0, 0),
      new THREE.Vector3(1, 1, 0.9),
      index === 0 ? 'BinocularBarrelLeft' : 'BinocularBarrelRight',
    );
    addMesh(
      binoculars,
      new THREE.CylinderGeometry(0.087, 0.087, 0.035, 10),
      materials.dark,
      new THREE.Vector3(x, -0.13, 0),
      new THREE.Vector3(1, 1, 0.9),
      index === 0 ? 'BinocularEyecupLeft' : 'BinocularEyecupRight',
    );
    addMesh(
      binoculars,
      new THREE.CylinderGeometry(0.074, 0.074, 0.018, 10),
      materials.lens,
      new THREE.Vector3(x, 0.134, 0),
      new THREE.Vector3(1, 1, 0.9),
      index === 0 ? 'BinocularLensLeft' : 'BinocularLensRight',
    );
  });
  addMesh(
    binoculars,
    roundedBox(0.12, 0.1, 0.08, 0.025),
    materials.body,
    new THREE.Vector3(0, 0.025, 0),
    new THREE.Vector3(1, 1, 1),
    'BinocularBridge',
  );
  return binoculars;
};

export const createReferenceCharacter = () => {
  const character = new THREE.Group();
  character.name = 'CHR_Birdwatcher_LinKui_v020';
  const arms: THREE.Group[] = [];
  const legs: THREE.Group[] = [];

  const mat = {
    hair: toon('#713044'),
    skin: toon('#d9a680'),
    feature: toon('#352d2b'),
    jacket: toon('#8fa390'),
    jacketDark: toon('#647b6b'),
    shirt: toon('#e9ddc6'),
    pants: toon('#3f5149'),
    boot: toon('#60473b'),
    bootSole: toon('#332c29'),
    pack: toon('#b87943'),
    packDark: toon('#7d4e31'),
    strap: toon('#4b4038'),
    brass: toon('#d2a558'),
    binocular: toon('#17625d'),
    binocularDark: toon('#123a3a'),
    lens: toon('#7eb7ad'),
    book: toon('#d9c978'),
    bookEdge: toon('#efe8cd'),
    bottle: toon('#c8794b'),
    bottleCap: toon('#4f6658'),
  };

  character.add(createBackpack({
    pack: mat.pack,
    packDark: mat.packDark,
    strap: mat.strap,
    brass: mat.brass,
    bottle: mat.bottle,
    bottleCap: mat.bottleCap,
  }));

  [-1, 1].forEach((side) => {
    const leg = new THREE.Group();
    leg.name = side < 0 ? 'character-leg-left' : 'character-leg-right';
    leg.position.set(side * 0.155, 0.52, 0.02);
    character.add(leg);
    legs.push(leg);

    addMesh(
      leg,
      roundedBox(0.28, 0.39, 0.31, 0.065),
      mat.pants,
      new THREE.Vector3(0, -0.17, 0),
      new THREE.Vector3(1, 1, 1),
      side < 0 ? 'TrouserLeft' : 'TrouserRight',
    );
    addMesh(
      leg,
      roundedBox(0.29, 0.16, 0.36, 0.055),
      mat.boot,
      new THREE.Vector3(0, -0.4, 0.025),
      new THREE.Vector3(1, 1, 1),
      side < 0 ? 'HikingBootLeft' : 'HikingBootRight',
    );
    addMesh(
      leg,
      roundedBox(0.31, 0.065, 0.4, 0.025),
      mat.bootSole,
      new THREE.Vector3(0, -0.49, 0.04),
      new THREE.Vector3(1, 1, 1),
      side < 0 ? 'BootSoleLeft' : 'BootSoleRight',
    );
  });

  addMesh(
    character,
    roundedBox(0.68, 0.63, 0.43, 0.1),
    mat.jacket,
    new THREE.Vector3(0, 0.78, 0),
    new THREE.Vector3(1, 1, 1),
    'FieldJacket',
  );
  addMesh(
    character,
    roundedBox(0.22, 0.24, 0.035, 0.025),
    mat.jacketDark,
    new THREE.Vector3(-0.19, 0.72, 0.23),
    new THREE.Vector3(1, 1, 1),
    'JacketPocketLeft',
  );
  addMesh(
    character,
    roundedBox(0.22, 0.24, 0.035, 0.025),
    mat.jacketDark,
    new THREE.Vector3(0.19, 0.72, 0.23),
    new THREE.Vector3(1, 1, 1),
    'JacketPocketRight',
  );
  addMesh(
    character,
    roundedBox(0.42, 0.13, 0.05, 0.04),
    mat.shirt,
    new THREE.Vector3(0, 1.03, 0.22),
    new THREE.Vector3(1, 1, 1),
    'HighCollar',
  );

  [-1, 1].forEach((side) => {
    const arm = new THREE.Group();
    arm.name = side < 0 ? 'character-arm-left' : 'character-arm-right';
    arm.position.set(side * 0.35, 1.03, 0);
    arm.rotation.z = side * 0.28;
    character.add(arm);
    arms.push(arm);

    addMesh(
      arm,
      roundedBox(0.25, 0.39, 0.27, 0.06),
      mat.jacket,
      new THREE.Vector3(0, -0.18, 0),
      new THREE.Vector3(1, 1, 1),
      side < 0 ? 'SleeveLeft' : 'SleeveRight',
    );
    addMesh(
      arm,
      roundedBox(0.255, 0.09, 0.275, 0.025),
      mat.jacketDark,
      new THREE.Vector3(0, -0.39, 0),
      new THREE.Vector3(1, 1, 1),
      side < 0 ? 'CuffLeft' : 'CuffRight',
    );
    addMesh(
      arm,
      roundedBox(0.22, 0.15, 0.24, 0.055),
      mat.skin,
      new THREE.Vector3(0, -0.49, 0.008),
      new THREE.Vector3(1, 1, 1),
      side < 0 ? 'HandLeft' : 'HandRight',
    );
  });

  addMesh(
    character,
    new THREE.CylinderGeometry(0.14, 0.15, 0.2, 12),
    mat.skin,
    new THREE.Vector3(0, 1.1, -0.01),
    new THREE.Vector3(1, 1, 1),
    'Neck',
  );

  const hair = buildCharacterHair(THREE, { material: mat.hair, style: 'side-part' });
  hair.name = 'HairAssembly_side-part';
  hair.position.set(0, 1.36, -0.04);
  hair.scale.setScalar(0.62);
  character.add(hair);

  const face = addMesh(
    character,
    roundedBox(0.64, 0.56, 0.54, 0.07),
    mat.skin,
    new THREE.Vector3(0, 1.41, 0.05),
    new THREE.Vector3(1, 1, 1),
    'Face',
  );
  const featureZ = 0.05 + 0.54 * 0.5 + 0.012;
  [-1, 1].forEach((side) => {
    addMesh(
      character,
      roundedBox(0.18, 0.055, 0.026, 0.009),
      mat.feature,
      new THREE.Vector3(side * 0.17, 1.54, featureZ),
      new THREE.Vector3(1, 1, 1),
      side < 0 ? 'BrowLeft' : 'BrowRight',
    );
    addMesh(
      character,
      roundedBox(0.06, 0.19, 0.026, 0.012),
      mat.feature,
      new THREE.Vector3(side * 0.17, 1.39, featureZ),
      new THREE.Vector3(1, 1, 1),
      side < 0 ? 'EyeLeft' : 'EyeRight',
    );
  });

  const binoculars = createBinoculars({ body: mat.binocular, dark: mat.binocularDark, lens: mat.lens });
  character.add(binoculars);
  [-1, 1].forEach((side) => {
    addStrap(
      character,
      [
        new THREE.Vector3(side * 0.22, 1.13, 0.2),
        new THREE.Vector3(side * 0.2, 0.94, 0.27),
        new THREE.Vector3(side * 0.075, 0.78, 0.3),
      ],
      0.014,
      mat.binocularDark,
      side < 0 ? 'BinocularNeckStrapLeft' : 'BinocularNeckStrapRight',
    );
  });

  const fieldGuide = new THREE.Group();
  fieldGuide.name = 'FieldGuide';
  fieldGuide.position.set(-0.43, 0.67, 0.08);
  fieldGuide.rotation.z = -0.12;
  addMesh(
    fieldGuide,
    roundedBox(0.22, 0.31, 0.065, 0.025),
    mat.book,
    new THREE.Vector3(),
    new THREE.Vector3(1, 1, 1),
    'FieldGuideCover',
  );
  addMesh(
    fieldGuide,
    roundedBox(0.18, 0.27, 0.012, 0.01),
    mat.bookEdge,
    new THREE.Vector3(0.016, 0, 0.038),
    new THREE.Vector3(1, 1, 1),
    'FieldGuidePages',
  );
  character.add(fieldGuide);
  addStrap(
    character,
    [
      new THREE.Vector3(-0.33, 0.93, 0.13),
      new THREE.Vector3(-0.43, 0.83, 0.13),
      new THREE.Vector3(-0.43, 0.79, 0.12),
    ],
    0.014,
    mat.strap,
    'FieldGuideLanyard',
  );

  addMesh(
    character,
    roundedBox(0.24, 0.2, 0.12, 0.045),
    mat.packDark,
    new THREE.Vector3(0.42, 0.65, 0.08),
    new THREE.Vector3(1, 1, 1),
    'UtilityPouch',
  );
  addMesh(
    character,
    roundedBox(0.1, 0.07, 0.03, 0.012),
    mat.brass,
    new THREE.Vector3(0.42, 0.69, 0.15),
    new THREE.Vector3(1, 1, 1),
    'UtilityPouchBuckle',
  );

  character.userData.walkParts = { arms, legs };
  character.userData.characterArt = {
    resourceId: character.name,
    hairPreset: 'side-part',
    equipment: ['8x42 binoculars', 'field backpack', 'field guide', 'water bottle', 'utility pouch'],
    reviewParts: { face, hair, binoculars },
  };
  return character;
};

export const updateReferenceCharacterWalk = (
  character: THREE.Group,
  moving: boolean,
  speed: number,
  delta: number,
  _time: number,
) => {
  const parts = character.userData.walkParts as { arms: THREE.Group[]; legs: THREE.Group[] } | undefined;
  if (!parts || parts.arms.length !== 2 || parts.legs.length !== 2) return;

  const motion = (character.userData.walkMotion ??= {
    phase: 0,
    strideAmplitude: 0,
  }) as { phase: number; strideAmplitude: number };
  motion.phase = (motion.phase + delta * speed * 3.2) % (Math.PI * 2);

  const walkAmount = THREE.MathUtils.clamp(speed / 1.75, 0, 1);
  const runAmount = THREE.MathUtils.clamp((speed - 1.75) / (3.35 - 1.75), 0, 1);
  const targetAmplitude = moving ? walkAmount * 0.38 + runAmount * 0.14 : 0;
  const amplitudeBlend = 1 - Math.exp(-delta * (moving ? 9 : 11));
  motion.strideAmplitude = THREE.MathUtils.lerp(
    motion.strideAmplitude,
    targetAmplitude,
    amplitudeBlend,
  );

  const stride = Math.sin(motion.phase) * motion.strideAmplitude;
  const blend = 1 - Math.exp(-delta * 15);
  const targets = {
    leftLeg: stride,
    rightLeg: -stride,
    leftArm: -stride * 0.72,
    rightArm: stride * 0.72,
  };

  parts.legs[0].rotation.x = THREE.MathUtils.lerp(parts.legs[0].rotation.x, targets.leftLeg, blend);
  parts.legs[1].rotation.x = THREE.MathUtils.lerp(parts.legs[1].rotation.x, targets.rightLeg, blend);
  parts.arms[0].rotation.x = THREE.MathUtils.lerp(parts.arms[0].rotation.x, targets.leftArm, blend);
  parts.arms[1].rotation.x = THREE.MathUtils.lerp(parts.arms[1].rotation.x, targets.rightArm, blend);
};
