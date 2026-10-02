import * as THREE from 'three';
import type { WetlandRegionField } from './wetland-region-fields';
import type { WetlandWindFrame } from './wetland-weather';

type WetlandFlowerField = Readonly<{
  root: THREE.Group;
  count: number;
  update: (elapsed: number, wind: WetlandWindFrame) => void;
  dispose: () => void;
}>;

const mulberry32 = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const createPetalGeometry = () => {
  const positions: number[] = [];
  const indices: number[] = [];
  const x = 0;
  const y = 0.025;
  const z = 0;
  const radius = 0.1;
  for (let petal = 0; petal < 5; petal += 1) {
      const angle = petal * Math.PI * 0.4;
      const directionX = Math.cos(angle);
      const directionZ = Math.sin(angle);
      const sideX = -directionZ;
      const sideZ = directionX;
      const base = positions.length / 3;
      positions.push(
        x, y, z,
        x + directionX * radius * 1.35 + sideX * radius * 0.38, y + radius * 0.05, z + directionZ * radius * 1.35 + sideZ * radius * 0.38,
        x + directionX * radius * 1.7, y + radius * 0.08, z + directionZ * radius * 1.7,
        x + directionX * radius * 1.35 - sideX * radius * 0.38, y + radius * 0.05, z + directionZ * radius * 1.35 - sideZ * radius * 0.38,
      );
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

export const createWetlandFlowerField = (
  field: WetlandRegionField,
  spacing = 0.5,
): WetlandFlowerField => {
  const random = mulberry32(field.params.vegetationSeed ^ 0xf10a3);
  const placements: Array<{
    x: number;
    z: number;
    y: number;
    yaw: number;
    scale: number;
    normal: THREE.Vector3;
    color: THREE.ColorRepresentation;
  }> = [];
  const halfWidth = field.width * 0.5;
  const halfDepth = field.depth * 0.5;
  const palette: readonly THREE.ColorRepresentation[] = [
    '#fff5db', '#fff5db', '#fff5db', '#f6dc69', '#f6dc69', '#f4a7bd', '#c7a6e8',
  ];

  for (let x = -halfWidth + spacing * 0.5; x < halfWidth; x += spacing) {
    for (let z = -halfDepth + spacing * 0.5; z < halfDepth; z += spacing) {
      const px = x + (random() - 0.5) * spacing * 0.9;
      const pz = z + (random() - 0.5) * spacing * 0.9;
      if (!field.layoutMap.containsWorldPoint(px, pz, spacing * 0.5)
        || !field.layoutMap.containsDetailPoint(px, pz, spacing * 0.5)) continue;
      const sample = field.sample(px, pz);
      if (sample.pathSurface > 0.03) continue;
      if (random() > sample.flower) continue;
      const normalStep = 0.14;
      const normal = new THREE.Vector3(
        field.heightAt(px - normalStep, pz) - field.heightAt(px + normalStep, pz),
        normalStep * 2,
        field.heightAt(px, pz - normalStep) - field.heightAt(px, pz + normalStep),
      ).normalize();
      placements.push({
        x: px,
        z: pz,
        y: sample.height + 0.018,
        yaw: random() * Math.PI * 2,
        scale: THREE.MathUtils.lerp(0.68, 1.32, random()),
        normal,
        color: palette[Math.floor(random() * palette.length)],
      });
    }
  }

  const petalGeometry = createPetalGeometry();
  const petalMaterial = new THREE.MeshToonMaterial({ color: '#ffffff', side: THREE.DoubleSide });
  const petals = new THREE.InstancedMesh(petalGeometry, petalMaterial, placements.length);
  petals.name = 'wetland-ground-flower-petals';
  petals.castShadow = false;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const windTilt = new THREE.Quaternion();
  const windAxis = new THREE.Vector3();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  placements.forEach((placement, index) => {
    position.set(placement.x, placement.y, placement.z);
    quaternion.setFromUnitVectors(up, placement.normal);
    spin.setFromAxisAngle(up, placement.yaw);
    quaternion.multiply(spin);
    scale.setScalar(placement.scale);
    matrix.compose(position, quaternion, scale);
    petals.setMatrixAt(index, matrix);
    color.set(placement.color);
    petals.setColorAt(index, color);
  });
  petals.instanceMatrix.needsUpdate = true;
  if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
  petals.computeBoundingSphere();

  const root = new THREE.Group();
  root.name = 'wetland-field-driven-flower-clusters';
  root.add(petals);
  return {
    root,
    count: placements.length,
    update(elapsed, wind) {
      windAxis.set(wind.direction.y, 0, -wind.direction.x).normalize();
      placements.forEach((placement, index) => {
        position.set(placement.x, placement.y, placement.z);
        quaternion.setFromUnitVectors(up, placement.normal);
        spin.setFromAxisAngle(up, placement.yaw);
        quaternion.multiply(spin);
        const localWave = Math.sin(elapsed * wind.speed * 1.45 + placement.x * 0.47 + placement.z * 0.31);
        const bend = (wind.sway * 0.026 + localWave * wind.strength * 0.018) * placement.scale;
        windTilt.setFromAxisAngle(windAxis, bend);
        quaternion.premultiply(windTilt);
        scale.setScalar(placement.scale);
        matrix.compose(position, quaternion, scale);
        petals.setMatrixAt(index, matrix);
      });
      petals.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      petalGeometry.dispose();
      petalMaterial.dispose();
    },
  };
};
