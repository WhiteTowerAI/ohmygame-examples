import * as THREE from 'three';
import {
  createLeafClusterSdfTexture,
  getCamphorAlphaFoliageState,
} from '../environment/alpha-foliage';
import {
  createFoliageCardRenderer,
  type FoliageInstance,
} from '../rendering/foliage-card-renderer';
import type { FoliageClusterSpec, FoliageVariant } from './modular-tree';

type EmitterProfile = Readonly<{
  radii: readonly [number, number, number];
  cardCount: number;
  cardScale: number;
  sweep: number;
}>;

const profiles: Record<string, EmitterProfile> = {
  broad: { radii: [1.62, 0.68, 0.92], cardCount: 32, cardScale: 0.96, sweep: 0.04 },
  swept: { radii: [1.52, 0.64, 0.82], cardCount: 30, cardScale: 0.94, sweep: 0.28 },
  fan: { radii: [1.30, 0.68, 1.04], cardCount: 30, cardScale: 0.95, sweep: -0.12 },
  crown: { radii: [1.08, 0.78, 0.90], cardCount: 28, cardScale: 0.94, sweep: 0.08 },
  wide: { radii: [1.16, 0.66, 0.76], cardCount: 28, cardScale: 0.94, sweep: 0.03 },
  upright: { radii: [0.78, 1.04, 0.72], cardCount: 28, cardScale: 0.90, sweep: 0.02 },
  connector: { radii: [0.84, 0.66, 0.70], cardCount: 24, cardScale: 0.90, sweep: 0.02 },
};

const hash01 = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
};

const tupleToVector = ([x, y, z]: readonly [number, number, number]) => (
  new THREE.Vector3(x, y, z)
);

const getProfile = (variant: FoliageVariant) => {
  const key = variant.startsWith('dark-') ? variant.slice(5) : variant;
  return profiles[key] ?? profiles.crown;
};

const createClusterInstances = (cluster: FoliageClusterSpec): FoliageInstance[] => {
  const profile = getProfile(cluster.variant);
  const center = tupleToVector(cluster.position);
  const clusterScale = tupleToVector(cluster.scale);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...cluster.rotation));
  const radii = new THREE.Vector3(
    clusterScale.x * profile.radii[0],
    clusterScale.y * profile.radii[1],
    clusterScale.z * profile.radii[2],
  );
  const outward = new THREE.Vector3(1, 0.08, 0).applyQuaternion(quaternion).normalize();
  const toneLightDirection = new THREE.Vector3(-0.42, 0.76, 0.49).normalize();
  const candidates: Array<FoliageInstance & { lightScore: number }> = [];

  for (let cardIndex = 0; cardIndex < profile.cardCount; cardIndex += 1) {
    const key = `${cluster.seed}:${cluster.id}:${cardIndex}`;
    const vertical = hash01(`${key}:vertical`) * 2 - 1;
    const azimuth = hash01(`${key}:azimuth`) * Math.PI * 2;
    const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
    const direction = new THREE.Vector3(
      Math.cos(azimuth) * horizontal,
      vertical,
      Math.sin(azimuth) * horizontal,
    );
    const radial = THREE.MathUtils.lerp(0.18, 0.88, Math.pow(hash01(`${key}:radial`), 0.42));
    const localPosition = direction.clone().multiply(radii).multiplyScalar(radial);
    localPosition.x += profile.sweep * radii.x * (0.28 + radial * 0.38);
    const position = localPosition.applyQuaternion(quaternion).add(center);
    const surfaceNormal = new THREE.Vector3(
      direction.x / Math.max(radii.x, 0.001),
      direction.y / Math.max(radii.y, 0.001),
      direction.z / Math.max(radii.z, 0.001),
    )
      .normalize()
      .applyQuaternion(quaternion)
      .addScaledVector(outward, 0.18)
      .addScaledVector(THREE.Object3D.DEFAULT_UP, 0.06)
      .normalize();
    const baseScale = Math.min(radii.y * 1.12, radii.z, radii.x * 0.62) * profile.cardScale;
    candidates.push({
      position,
      surfaceNormal,
      scale: baseScale * THREE.MathUtils.lerp(0.84, 1.18, hash01(`${key}:scale`)),
      roll: hash01(`${key}:roll`) * 2 - 1,
      lightScore: surfaceNormal.dot(toneLightDirection)
        + direction.y * 0.16
        + (hash01(`${key}:tone`) - 0.5) * 0.14,
    });
  }

  candidates.sort((a, b) => a.lightScore - b.lightScore);
  const clusterToneOffset = ((cluster.tone % 4) - 1.5) * 0.025;
  return candidates.map(({ lightScore: _lightScore, ...instance }, index) => {
    const rank = (index + 0.5) / candidates.length;
    const tone = rank < 0.30
      ? THREE.MathUtils.lerp(0.12, 0.28, rank / 0.30)
      : rank < 0.72
        ? THREE.MathUtils.lerp(0.40, 0.58, (rank - 0.30) / 0.42)
        : THREE.MathUtils.lerp(0.72, 0.90, (rank - 0.72) / 0.28);
    return { ...instance, tone: THREE.MathUtils.clamp(tone + clusterToneOffset, 0, 1) };
  });
};

export const createFormalTreeFoliageEmitter = (
  clusters: readonly FoliageClusterSpec[],
) => {
  const instances = clusters.flatMap(createClusterInstances);
  const mask = createLeafClusterSdfTexture(getCamphorAlphaFoliageState());
  const renderer = createFoliageCardRenderer(mask, Math.max(1, instances.length), {
    shape: { shadow: '#2d5737', mid: '#4f7f46', highlight: '#85a958' },
    elemental: { shadow: '#2d5737', mid: '#4f7f46', highlight: '#85a958' },
    shared: { shadow: '#2d5737', mid: '#4f7f46', highlight: '#85a958' },
  });
  renderer.setMask(mask, 'sdf');
  renderer.setVisualMode('shared');
  renderer.setGrowthOrientation('outward', 0.58, 0.30);
  renderer.setInstances(instances);
  renderer.mesh.name = 'formal-tree-r05-foliage-emitter';
  renderer.mesh.visible = false;
  renderer.mesh.userData.foliageCardCount = instances.length;

  return {
    mesh: renderer.mesh,
    cardCount: instances.length,
    updateLighting(
      keyLight: THREE.DirectionalLight,
      fillLight: THREE.DirectionalLight,
      rimLight: THREE.DirectionalLight,
    ) {
      renderer.updateLighting(keyLight, fillLight, rimLight);
    },
    dispose() {
      renderer.dispose();
      mask.dispose();
    },
  };
};
