import * as THREE from 'three';
import { BirdAgent, type BirdAgentSnapshot, type BirdAgentTransition } from './bird-agent';
import { BirdPresentationAdapter, type BirdMotionKind } from './bird-presentation';
import type {
  BirdPerception,
  BirdRelocationRequest,
  BirdSpeciesPolicy,
  HabitatNode,
  ObserverPressureRules,
} from './contracts';
import {
  HabitatRegistry,
  type HabitatCandidateScore,
  type RegisteredHabitatNode,
} from '../habitat/registry';

type BirdRuntimeSelectionSnapshot = Readonly<{
  nodeId: string;
  score: number;
  observerDistance: number;
  heightGain: number;
  visualTransmission: number;
  arrivalPressure: number;
  clearance: number;
  crossTree: boolean;
}>;

type BirdRuntimeStateEvent = Readonly<{
  sequence: number;
  previousState: string;
  state: string;
  startedAt: number;
  duration: number;
  currentNodeId: string;
  targetNodeId?: string;
  relocation?: BirdRelocationRequest;
  selection?: BirdRuntimeSelectionSnapshot;
}>;

export type BirdRuntimeSnapshot = Readonly<{
  speciesId: string;
  label: string;
  state: string;
  stateLabel: string;
  stateProgress: number;
  currentNodeId: string;
  targetNodeId?: string;
  lastSelection?: BirdRuntimeSelectionSnapshot;
  agent: BirdAgentSnapshot<string>;
  events: readonly BirdRuntimeStateEvent[];
}>;

export type RuntimeBird = Readonly<{
  speciesId: string;
  label: string;
  root: THREE.Group;
  pressureRules: ObserverPressureRules;
  getState: () => string;
  getStateLabel: () => string;
  getHabitatNode: () => HabitatNode;
  getTargetHabitatNode: () => HabitatNode | undefined;
  getLastSelection: () => HabitatCandidateScore | undefined;
  getProgress: (time: number) => number;
  getSnapshot: (time: number) => BirdRuntimeSnapshot;
  reset: (startedAt?: number, seed?: number) => void;
  setDrive: (id: string, value: number) => void;
  getDrive: (id: string) => number;
  setFacingYaw: (yaw: number) => void;
  update: (time: number, delta: number, perception: BirdPerception, observer: THREE.Vector3) => void;
}>;

type RuntimeBirdOptions<State extends string> = Readonly<{
  habitatRegistry: HabitatRegistry;
  speciesId: string;
  label: string;
  root: THREE.Group;
  policy: BirdSpeciesPolicy<State>;
  pressureRules: ObserverPressureRules;
  initialState: State;
  initialNodeId: string;
  initialDrives?: Readonly<Record<string, number>>;
  seed: number;
  motionByState: Partial<Readonly<Record<State, BirdMotionKind>>>;
  faceObserverStates: readonly State[];
  excludeNodeIds?: () => readonly string[];
  groundHeightAt?: (x: number, z: number) => number;
  applyPose: (
    state: State,
    cycle: number,
    time: number,
    delta: number,
    habitatLevel: HabitatNode['level'],
  ) => void;
}>;

const MAX_STATE_EVENTS = 96;

const habitatNodePosition = (node: HabitatNode, target = new THREE.Vector3()) => target.set(
  node.position.x,
  node.position.y,
  node.position.z,
);

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const selectionSnapshot = (
  selection: HabitatCandidateScore | undefined,
): BirdRuntimeSelectionSnapshot | undefined => selection && ({
  nodeId: selection.node.id,
  score: selection.score,
  observerDistance: selection.observerDistance,
  heightGain: selection.heightGain,
  visualTransmission: selection.visualTransmission,
  arrivalPressure: selection.arrivalPressure,
  clearance: selection.clearance,
  crossTree: selection.crossTree,
});

export const createRuntimeBird = <State extends string>(
  options: RuntimeBirdOptions<State>,
): RuntimeBird => {
  const { habitatRegistry } = options;
  let runtimeSeed = options.seed;
  let random = createSeededRandom(runtimeSeed);
  const initialNode = habitatRegistry.getNode(options.initialNodeId);
  if (!initialNode) throw new Error(`Missing initial habitat node: ${options.initialNodeId}`);

  let currentNode: RegisteredHabitatNode = initialNode;
  let pendingNode: RegisteredHabitatNode = currentNode;
  let landingApplied = true;
  let relocationSequence = 0;
  let eventSequence = 0;
  let lastSelection: HabitatCandidateScore | undefined;
  let activeRelocation: BirdRelocationRequest | undefined;
  let settleUntil = 0;
  let relocationRearmed = true;
  const recentNodeIds: string[] = [];
  const settledForward = new THREE.Vector3(0, 0, 1);
  const events: BirdRuntimeStateEvent[] = [];

  options.root.position.copy(habitatNodePosition(currentNode));
  const createPresentation = () => new BirdPresentationAdapter<State>({
    root: options.root,
    motionByState: options.motionByState,
    applyPose: options.applyPose,
  });
  let presentation = createPresentation();
  const createAgent = (startedAt: number) => new BirdAgent<State>({
      policy: options.policy,
      initialState: options.initialState,
      initialHabitatKind: currentNode.kind,
      initialHabitatLevel: currentNode.level,
      initialDrives: options.initialDrives,
      random,
      startedAt,
      initialDuration: 2.4,
    });
  let agent = createAgent(0);

  const setSettledForward = (node: HabitatNode, observer?: THREE.Vector3) => {
    if (activeRelocation?.avoidObserver && observer) {
      settledForward.copy(habitatNodePosition(node)).sub(observer).setY(0);
    } else if (node.forward) {
      settledForward.set(node.forward.x, 0, node.forward.z);
      if (random() < 0.5) settledForward.multiplyScalar(-1);
    } else {
      const angle = random() * Math.PI * 2;
      settledForward.set(Math.sin(angle), 0, Math.cos(angle));
    }
    if (settledForward.lengthSq() < 0.0001) settledForward.set(0, 0, 1);
    settledForward.normalize();
  };

  setSettledForward(initialNode);

  const chooseLandingNode = (
    request: BirdRelocationRequest | undefined,
    perception: BirdPerception,
    observer: THREE.Vector3,
  ) => {
    if (!request) return currentNode;
    const requestedKind = request.kind ?? currentNode.kind;
    if (requestedKind === 'ground' && !request.allowGroundReturn) return currentNode;
    const excludeNodeIds = [...new Set([
      ...recentNodeIds,
      ...(options.excludeNodeIds?.() ?? []),
    ])];
    const ranked = habitatRegistry.rankRelocation({
      kind: requestedKind,
      level: request?.level,
      capability: request?.capability,
      currentNodeId: currentNode.id,
      origin: currentNode.position,
      maxDistance: request?.maxDistance,
      avoidPosition: request?.avoidObserver ? observer : undefined,
      observerPosition: { x: observer.x, y: observer.y + 1.2, z: observer.z },
      preferHigher: request?.preferHigher,
      preferCover: request?.preferCover,
      preferDifferentTree: request?.preferDifferentTree,
      preferSameTree: request?.preferSameTree,
      minHeightGain: request?.minHeightGain,
      minClearance: request?.minClearance,
      minObserverDistance: request.minObserverDistance,
      minObserverDistanceGain: request.minObserverDistanceGain,
      maxArrivalPressure: request.maxArrivalPressure,
      minPressureReduction: request.minPressureReduction,
      currentObserverPressure: request.avoidObserver ? perception.observerPressure : undefined,
      observerPressureRadius: options.pressureRules.pressureRadius,
      excludeNodeIds,
      seed: runtimeSeed + relocationSequence * 101,
    });
    relocationSequence += 1;
    lastSelection = ranked[0];
    return ranked[0]?.node ?? currentNode;
  };

  const enterDecision = (
    state: State,
    relocation: BirdRelocationRequest | undefined,
    perception: BirdPerception,
    observer: THREE.Vector3,
  ) => {
    const motion = options.motionByState[state] ?? 'still';
    if (motion === 'ground-step') {
      const direction = new THREE.Vector3(Math.sin(options.root.rotation.y), 0, Math.cos(options.root.rotation.y));
      const target = options.root.position.clone().addScaledVector(direction, 0.28 + random() * 0.22);
      target.x += (random() - 0.5) * 0.34;
      if (agent.habitatKind === 'ground') {
        // Ground nodes already carry the authoritative terrain height. Keep
        // the hop target on that height instead of adding a persistent lift;
        // otherwise each completed ground step leaves the bird hovering.
        target.y = options.groundHeightAt?.(target.x, target.z) ?? 0;
      }
      presentation.beginState(state, target);
    } else if (motion === 'takeoff') {
      activeRelocation = relocation;
      pendingNode = chooseLandingNode(relocation, perception, observer);
      landingApplied = false;
      presentation.beginState(state, undefined, habitatNodePosition(pendingNode));
    } else if (motion === 'flight') {
      const target = habitatNodePosition(pendingNode).add(new THREE.Vector3(0, 0.28, 0));
      presentation.beginState(state, target);
    } else if (motion === 'land') {
      presentation.beginState(state, habitatNodePosition(pendingNode));
    } else {
      const shouldFaceObserver = options.faceObserverStates.includes(state);
      const forwardTarget = habitatNodePosition(currentNode).add(settledForward);
      presentation.beginState(state, undefined, shouldFaceObserver ? observer : forwardTarget);
    }
  };

  const recordTransition = (
    transition: BirdAgentTransition<State>,
    relocation: BirdRelocationRequest | undefined,
  ) => {
    events.push({
      sequence: eventSequence,
      previousState: transition.previousState,
      state: transition.decision.state,
      startedAt: transition.startedAt,
      duration: transition.duration,
      currentNodeId: currentNode.id,
      targetNodeId: landingApplied ? undefined : pendingNode.id,
      relocation,
      selection: selectionSnapshot(lastSelection),
    });
    eventSequence += 1;
    if (events.length > MAX_STATE_EVENTS) events.splice(0, events.length - MAX_STATE_EVENTS);
  };

  return {
    speciesId: options.speciesId,
    label: options.label,
    root: options.root,
    pressureRules: options.pressureRules,
    getState: () => agent.state,
    getStateLabel: () => options.policy.stateLabels[agent.state],
    getHabitatNode: () => currentNode,
    getTargetHabitatNode: () => landingApplied ? undefined : pendingNode,
    getLastSelection: () => lastSelection,
    getProgress: (time) => agent.getProgress(time),
    getSnapshot: (time) => ({
      speciesId: options.speciesId,
      label: options.label,
      state: agent.state,
      stateLabel: options.policy.stateLabels[agent.state],
      stateProgress: agent.getProgress(time),
      currentNodeId: currentNode.id,
      targetNodeId: landingApplied ? undefined : pendingNode.id,
      lastSelection: selectionSnapshot(lastSelection),
      agent: agent.getSnapshot() as BirdAgentSnapshot<string>,
      events: [...events],
    }),
    reset(startedAt = 0, seed = options.seed) {
      runtimeSeed = seed;
      random = createSeededRandom(runtimeSeed);
      currentNode = initialNode;
      pendingNode = initialNode;
      landingApplied = true;
      relocationSequence = 0;
      eventSequence = 0;
      lastSelection = undefined;
      activeRelocation = undefined;
      settleUntil = 0;
      relocationRearmed = true;
      recentNodeIds.length = 0;
      events.length = 0;
      options.root.position.copy(habitatNodePosition(initialNode));
      if (initialNode.forward) {
        options.root.rotation.y = Math.atan2(initialNode.forward.x, initialNode.forward.z);
      }
      setSettledForward(initialNode);
      presentation = createPresentation();
      agent = createAgent(startedAt);
      presentation.beginState(options.initialState);
    },
    setDrive: (id, value) => agent.setDrive(id, value),
    getDrive: (id) => agent.getDrive(id),
    setFacingYaw(yaw) {
      options.root.rotation.y = yaw;
      settledForward.set(Math.sin(yaw), 0, Math.cos(yaw));
      presentation.setFacing(options.root.position.clone().add(settledForward));
    },
    update(time, delta, perception, observer) {
      if (!relocationRearmed && perception.observerPressure <= 0.36) relocationRearmed = true;
      let landedThisFrame = false;
      if (agent.state === 'land' && agent.getProgress(time) >= 1 && !landingApplied) {
        const previousNodeId = currentNode.id;
        currentNode = pendingNode;
        agent.setHabitat(currentNode.kind, currentNode.level);
        landingApplied = true;
        if (previousNodeId !== currentNode.id) {
          recentNodeIds.unshift(previousNodeId);
          recentNodeIds.splice(3);
        }
        setSettledForward(currentNode, observer);
        landedThisFrame = true;
      }
      const settling = time < settleUntil;
      const emergencyDuringLock = options.root.position.distanceTo(observer) <= 1.4;
      const relocationLocked = !relocationRearmed && !emergencyDuringLock;
      const transition = (settling && perception.observerPressure < 0.92) || relocationLocked
        ? null
        : agent.update(time, perception);
      if (transition) {
        enterDecision(transition.decision.state, transition.decision.relocation, perception, observer);
        recordTransition(transition, transition.decision.relocation);
      }
      if (landedThisFrame) {
        settleUntil = time + (activeRelocation?.settleDuration ?? 0.8);
        if (activeRelocation?.avoidObserver) relocationRearmed = false;
      }
      presentation.update(agent.state, agent.getProgress(time), time, delta, agent.habitatLevel);
    },
  };
};
