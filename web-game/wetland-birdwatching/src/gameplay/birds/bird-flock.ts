import type * as THREE from 'three';
import { applyBlackbirdPose, createBlackbird, sampleBlackbirdPose } from '../../art/birds/blackbird';
import { applyGrayMagpiePose, createGrayMagpie } from '../../art/birds/gray-magpie-model';
import { sampleGrayMagpiePose } from '../../art/birds/gray-magpie-behavior';
import { speciesName } from '../journal/field-journal';
import type { HabitatRegistry } from '../habitat/registry';
import { createRuntimeBird, type RuntimeBird } from './bird-runtime';
import { blackbirdPolicy, blackbirdPressureRules, type BlackbirdState } from './species/blackbird-policy';
import { grayMagpiePolicy, grayMagpiePressureRules, type GrayMagpieState } from './species/gray-magpie-policy';

const blackbirdCount = 10;
const blackbirdVisualScale = 0.61;
const grayMagpieVisualScale = 0.71;

export type BlackbirdEntry = Readonly<{
  sourceId: string;
  root: THREE.Group;
  runtime: RuntimeBird;
  initialNodeId: string;
}>;

export type BirdFlockOptions = Readonly<{
  scene: THREE.Scene;
  habitatRegistry: HabitatRegistry;
  grayMagpieInitialNodeId: string;
  sampleHeight: (x: number, z: number) => number;
  registerStylizedBird: (root: THREE.Object3D) => void;
}>;

// Spawns every bird in the park: a flock of blackbirds spread over the ground
// habitat nodes, and one gray magpie in the canopy (hidden until selected).
export const createBirdFlock = (options: BirdFlockOptions) => {
  const { scene, habitatRegistry } = options;
  const groundNodes = habitatRegistry.getProviderNodes('wetland-floor')
    .filter((node) => node.kind === 'ground');
  if (groundNodes.length < blackbirdCount) {
    throw new Error(`Wetland requires ${blackbirdCount} blackbird ground nodes`);
  }

  // Blackbirds avoid landing on a node another blackbird holds or is flying to.
  const occupancy = new Map<string, RuntimeBird>();
  const occupiedByOthers = (sourceId: string) => {
    const occupiedNodeIds = new Set<string>();
    occupancy.forEach((runtime, otherSourceId) => {
      if (otherSourceId === sourceId) return;
      occupiedNodeIds.add(runtime.getHabitatNode().id);
      const targetNode = runtime.getTargetHabitatNode();
      if (targetNode) occupiedNodeIds.add(targetNode.id);
    });
    return [...occupiedNodeIds];
  };

  const blackbirds: BlackbirdEntry[] = Array.from({ length: blackbirdCount }, (_, index) => {
    const sourceId = `blackbird-${(index + 1).toString().padStart(2, '0')}`;
    const root = createBlackbird('adult');
    root.name = sourceId;
    // Keep birds readable at wetland distances without making them oversized
    // photographic targets; behavior and recognition distances stay unchanged.
    root.scale.setScalar(blackbirdVisualScale + (index % 4) * 0.014);
    scene.add(root);
    options.registerStylizedBird(root);
    const parts = root.userData.parts as Parameters<typeof applyBlackbirdPose>[0];
    const initialNode = groundNodes[Math.floor(index * groundNodes.length / blackbirdCount)];
    const runtime = createRuntimeBird<BlackbirdState>({
      habitatRegistry,
      speciesId: 'blackbird',
      label: speciesName('blackbird'),
      root,
      policy: blackbirdPolicy,
      pressureRules: blackbirdPressureRules,
      initialState: index % 3 === 0 ? 'listen' : 'idle',
      initialNodeId: initialNode.id,
      initialDrives: { forage: 0.58 + (index % 5) * 0.07 },
      seed: 91427 + index * 7919,
      motionByState: { hop: 'ground-step', takeoff: 'takeoff', flight: 'flight', land: 'land' },
      faceObserverStates: ['alert'],
      excludeNodeIds: () => occupiedByOthers(sourceId),
      groundHeightAt: options.sampleHeight,
      applyPose: (state, cycle, time, delta) => {
        applyBlackbirdPose(parts, sampleBlackbirdPose(state, cycle, time), delta);
      },
    });
    occupancy.set(sourceId, runtime);
    return { sourceId, root, runtime, initialNodeId: initialNode.id };
  });

  const grayMagpieRoot = createGrayMagpie();
  grayMagpieRoot.scale.setScalar(grayMagpieVisualScale);
  grayMagpieRoot.visible = false;
  scene.add(grayMagpieRoot);
  options.registerStylizedBird(grayMagpieRoot);
  const grayMagpie = createRuntimeBird<GrayMagpieState>({
    habitatRegistry,
    speciesId: 'gray-magpie',
    label: speciesName('gray-magpie'),
    root: grayMagpieRoot,
    policy: grayMagpiePolicy,
    pressureRules: grayMagpiePressureRules,
    initialState: 'perch',
    initialNodeId: options.grayMagpieInitialNodeId,
    seed: 31871,
    motionByState: { patrol: 'ground-step', takeoff: 'takeoff', flight: 'flight', land: 'land' },
    faceObserverStates: ['inspect', 'alarm'],
    groundHeightAt: options.sampleHeight,
    applyPose: (state, cycle, time, delta, habitatLevel) => {
      const habitat = habitatLevel === 'ground' ? 'ground' : habitatLevel === 'low' ? 'low' : 'high';
      applyGrayMagpiePose(grayMagpieRoot, sampleGrayMagpiePose(state, cycle, time, habitat), delta);
    },
  });

  const blackbirdRuntimes = blackbirds.map(({ runtime }) => runtime);
  return {
    blackbirds,
    blackbirdRuntimes,
    grayMagpie,
    all: [...blackbirdRuntimes, grayMagpie] as readonly RuntimeBird[],
  };
};
