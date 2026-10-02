const command = {
  move: (x, y) => ['M', x, y],
  line: (x, y) => ['L', x, y],
  curve: (cx, cy, x, y) => ['Q', cx, cy, x, y],
};

function createPartedPreset(partX) {
  return {
    napeDrop: 0.34,
    front: [
      command.move(-0.61, -0.36),
      command.curve(-0.84, -0.27, -0.86, -0.06),
      command.line(-0.86, 0.54),
      command.curve(-0.84, 0.8, -0.58, 0.91),
      command.curve(0, 1.0, 0.58, 0.91),
      command.curve(0.84, 0.8, 0.86, 0.54),
      command.line(0.86, -0.06),
      command.curve(0.84, -0.27, 0.61, -0.36),
      command.line(0.56, -0.15),
      command.line(0.56, 0.17),
      command.curve(0.53, 0.26, 0.43, 0.3),
      command.curve(partX + 0.22, 0.44, partX, 0.56),
      command.curve(partX - 0.2, 0.43, -0.43, 0.29),
      command.curve(-0.54, 0.24, -0.56, 0.15),
      command.line(-0.56, -0.15),
      command.line(-0.61, -0.36),
    ],
    back: [
      command.move(-0.63, -0.7),
      command.curve(-0.84, -0.6, -0.86, -0.34),
      command.line(-0.86, 0.54),
      command.curve(-0.84, 0.8, -0.58, 0.91),
      command.curve(0, 1.0, 0.58, 0.91),
      command.curve(0.84, 0.8, 0.86, 0.54),
      command.line(0.86, -0.34),
      command.curve(0.84, -0.6, 0.63, -0.7),
      command.curve(0, -0.78, -0.63, -0.7),
    ],
  };
}

function createDefaultUPreset() {
  const preset = createPartedPreset(0);
  preset.front = [
    command.move(-0.61, -0.36),
    command.curve(-0.84, -0.27, -0.86, -0.06),
    command.line(-0.86, 0.54),
    command.curve(-0.84, 0.8, -0.58, 0.91),
    command.curve(0, 1.0, 0.58, 0.91),
    command.curve(0.84, 0.8, 0.86, 0.54),
    command.line(0.86, -0.06),
    command.curve(0.84, -0.27, 0.61, -0.36),
    command.line(0.56, -0.15),
    command.line(0.56, 0.3),
    command.line(-0.56, 0.3),
    command.line(-0.56, -0.15),
    command.line(-0.61, -0.36),
  ];
  return preset;
}

export const CHARACTER_HAIR_PRESETS = Object.freeze({
  'default-u': createDefaultUPreset(),
  'middle-part': createPartedPreset(0),
  'side-part': createPartedPreset(-0.2),
});

function shapeFromCommands(THREE, commands) {
  const shape = new THREE.Shape();
  for (const [operation, ...values] of commands) {
    if (operation === 'M') shape.moveTo(...values);
    if (operation === 'L') shape.lineTo(...values);
    if (operation === 'Q') shape.quadraticCurveTo(...values);
  }
  shape.closePath();
  return shape;
}

export function curveHairTowardNape(THREE, geometry, drop) {
  geometry.computeBoundingBox();
  const frontZ = geometry.boundingBox.max.z;
  const backZ = geometry.boundingBox.min.z;
  const positions = geometry.attributes.position;

  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const depthT = THREE.MathUtils.clamp((frontZ - z) / (frontZ - backZ), 0, 1);
    const lowerHairWeight = 1 - THREE.MathUtils.smoothstep(y, -0.15, 0.45);
    positions.setY(index, y - drop * depthT * depthT * lowerHairWeight);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function buildCharacterHair(THREE, { material, style }) {
  const preset = CHARACTER_HAIR_PRESETS[style];
  if (!preset) throw new Error(`Unknown character hair preset: ${style}`);
  if (!material) throw new Error('buildCharacterHair requires a Three.js material');

  const group = new THREE.Group();
  group.name = `CharacterHair_${style}`;
  group.userData.hairPreset = style;

  const depth = 1.24;
  const shellGeometry = new THREE.ExtrudeGeometry(shapeFromCommands(THREE, preset.front), {
    depth,
    steps: 8,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.055,
    bevelThickness: 0.055,
    curveSegments: 8,
  });
  shellGeometry.translate(0, 0, -depth / 2);
  curveHairTowardNape(THREE, shellGeometry, preset.napeDrop);

  const shell = new THREE.Mesh(shellGeometry, material);
  shell.name = 'ContinuousHairShell';
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const backGeometry = new THREE.ExtrudeGeometry(shapeFromCommands(THREE, preset.back), {
    depth: 0.08,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.035,
    bevelThickness: 0.035,
  });
  backGeometry.translate(0, 0, -depth / 2 - 0.1);
  backGeometry.computeVertexNormals();

  const back = new THREE.Mesh(backGeometry, material);
  back.name = 'ClosedRearHair';
  back.castShadow = true;
  back.receiveShadow = true;
  group.add(back);

  return group;
}
