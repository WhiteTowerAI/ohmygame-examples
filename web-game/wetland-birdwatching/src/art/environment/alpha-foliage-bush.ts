import * as THREE from 'three';
import type { EnvironmentLook } from './environment-look';
import { forestEdgePalette } from './forest-edge-palette';
import {
  createBushEmitterInstances,
  createLeafClusterSdfTexture,
  getDefaultAlphaFoliageLabState,
} from './alpha-foliage-authoring-lab';
import { createStylizedBush, type StylizedBushVariant } from './stylized-bush';
import { createFoliageCardRenderer, type FoliagePalette } from '../rendering/foliage-card-renderer';

export type AlphaFoliageBushOptions = Readonly<{
  variant: StylizedBushVariant;
  seed: number;
  palette?: FoliagePalette;
  stemColor?: THREE.ColorRepresentation;
}>;

let sharedBushSdfTexture: THREE.Texture | undefined;

export const createAlphaFoliageBush = (options: AlphaFoliageBushOptions) => {
  const state = getDefaultAlphaFoliageLabState();
  state.seed = options.seed;
  if (options.variant === 'open') {
    state.clusterWidth = 1.95;
    state.clusterHeight = 1.42;
    state.clusterDepth = 1.42;
    state.density = 40;
    state.hollow = 0.58;
  }

  const root = createStylizedBush({ ...options, scale: 1 });
  if (options.stemColor !== undefined) {
    const stemColor = options.stemColor;
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object.userData.environmentRole !== 'bush-stem') return;
      const material = (object.material as THREE.MeshToonMaterial).clone();
      material.color.set(stemColor);
      object.material = material;
    });
  }
  [...root.children].forEach((child) => {
    if (child.userData.environmentRole === 'bush-foliage') root.remove(child);
  });

  sharedBushSdfTexture ??= createLeafClusterSdfTexture(getDefaultAlphaFoliageLabState());
  const bushPalette = options.palette ?? {
    shadow: forestEdgePalette.bush[0],
    mid: forestEdgePalette.bush[1],
    highlight: forestEdgePalette.bush[2],
  };
  const renderer = createFoliageCardRenderer(sharedBushSdfTexture, 160, {
    shape: {
      ...bushPalette,
    },
    elemental: {
      ...bushPalette,
    },
    shared: {
      ...bushPalette,
    },
  });
  const instances = createBushEmitterInstances(state);
  renderer.setMask(sharedBushSdfTexture, 'sdf');
  renderer.setInstances(instances);
  renderer.setSdfThickness(state.sdfThickness);
  renderer.setGrowthOrientation(
    state.growthMode,
    state.outwardStrength,
    state.directionJitter,
  );
  renderer.setVisualMode('shared');
  renderer.mesh.name = 'alpha-foliage-bush-cards-v001';
  renderer.mesh.userData.environmentRole = 'bush-foliage';
  renderer.mesh.userData.foliageVersion = 'r05-sdf-billboard-v001';
  root.add(renderer.mesh);

  root.name = `alpha-foliage-bush-${options.variant}`;
  root.userData.modelingApproach = 'r05-sdf-billboard-foliage-with-supporting-stems';
  root.userData.foliageVersion = 'r05-sdf-billboard-v001';
  root.userData.cardCount = instances.length;
  return {
    root,
    recipeId: `alpha-foliage-bush-${options.variant}-v001`,
    cardCount: instances.length,
    applyLook: (look: EnvironmentLook) => renderer.applyLook(look),
    updateLighting: renderer.updateLighting,
    updateWind: renderer.updateWind,
  };
};
