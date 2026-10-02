import * as THREE from 'three';
import { createReferenceCharacter, updateReferenceCharacterWalk } from './art/characters/birdwatcher';
import { applyBlackbirdPose, createBlackbird, sampleBlackbirdPose } from './art/birds/blackbird';
import { applyGrayMagpiePose, createGrayMagpie } from './art/birds/gray-magpie-model';
import { sampleGrayMagpiePose } from './art/birds/gray-magpie-behavior';
import type { BirdPerception } from './gameplay/birds/contracts';
import { calculateBirdPerception } from './gameplay/birds/perception';
import { createRuntimeBird, type RuntimeBird } from './gameplay/birds/bird-runtime';
import { createBirdCallAudio } from './gameplay/audio/bird-call-audio';
import { createEnvironmentAudio } from './gameplay/audio/environment-audio';
import {
  blackbirdPolicy,
  blackbirdPressureRules,
  type BlackbirdState,
} from './gameplay/birds/species/blackbird-policy';
import {
  grayMagpiePolicy,
  grayMagpiePressureRules,
  type GrayMagpieState,
} from './gameplay/birds/species/gray-magpie-policy';
import { createPlayerInputController } from './gameplay/player/player-input';
import { alertnessRules } from './gameplay/journal/journal-config';
import { createFieldJournal, entryForState, speciesName } from './gameplay/journal/field-journal';
import { checkShot, ratePhoto, shotProblemText, type ShotMetrics } from './gameplay/journal/photo-rating';
import { createCoach } from './ui/coach';
import { renderJournal, renderSummary } from './ui/journal-view';
import { createGameRendering } from './rendering/game-rendering';
import { createWetlandGameplayWorld } from './world/wetland-gameplay-world';
import './style.css';

document.body.classList.add('gameplay-mode');

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('Canvas not found');

const gameplayPixelRatio = () => Math.min(window.devicePixelRatio, 1);
const gameRendering = createGameRendering(canvas);
gameRendering.resize(window.innerWidth, window.innerHeight, gameplayPixelRatio());
const { scene, camera } = gameRendering;

const parkWorld = await createWetlandGameplayWorld({
  scene,
  renderer: gameRendering.renderer,
  lighting: gameRendering.lighting,
});
canvas.dataset.world = parkWorld.study.field.layoutMap.domainShape === 'ellipse'
  ? 'shared-expanded-wetland'
  : 'shared-park-third-wetland';
canvas.dataset.visualDomain = [
  parkWorld.study.field.layoutMap.domainShape,
  parkWorld.study.field.width,
  parkWorld.study.field.depth,
].join(',');
canvas.dataset.playableDomain = [
  parkWorld.playableDomain.shape,
  parkWorld.playableDomain.width,
  parkWorld.playableDomain.depth,
].join(',');
canvas.dataset.airWallProbe = [
  parkWorld.airWallProbe.visualRingRejected,
  parkWorld.airWallProbe.sweptMovementContained,
  parkWorld.airWallProbe.diagonalMovementContained,
].join(',');
// The old bird-only outline composer redraws the full scene. On the promoted
// wetland, direct rendering preserves the bird materials without duplicating
// the large grass and terrain passes.
gameRendering.setStylizedOutlineEnabled(false);
const { groundLeaves, habitatRegistry } = parkWorld;

const characterVisualScale = 1.35;
const blackbirdVisualScale = 0.61;
const grayMagpieVisualScale = 0.71;
const firstPersonEyeHeight = 2.45;
const character = createReferenceCharacter();
const characterSceneYaw = -0.52;
character.scale.setScalar(characterVisualScale);
character.position.copy(parkWorld.spawn);
character.rotation.y = characterSceneYaw;
scene.add(character);

const blackbirdCount = 10;
const wetlandGroundNodes = habitatRegistry.getProviderNodes('wetland-floor')
  .filter((node) => node.kind === 'ground');
if (wetlandGroundNodes.length < blackbirdCount) {
  throw new Error(`Wetland requires ${blackbirdCount} blackbird ground nodes`);
}
const blackbirdOccupancy = new Map<string, RuntimeBird>();
const occupiedByOtherBlackbirds = (sourceId: string) => {
  const occupiedNodeIds = new Set<string>();
  blackbirdOccupancy.forEach((runtime, otherSourceId) => {
    if (otherSourceId === sourceId) return;
    occupiedNodeIds.add(runtime.getHabitatNode().id);
    const targetNode = runtime.getTargetHabitatNode();
    if (targetNode) occupiedNodeIds.add(targetNode.id);
  });
  return [...occupiedNodeIds];
};
const blackbirdEntries = Array.from({ length: blackbirdCount }, (_, index) => {
  const sourceId = `blackbird-${(index + 1).toString().padStart(2, '0')}`;
  const root = createBlackbird('adult');
  root.name = sourceId;
  // Keep birds readable at wetland distances without making them oversized
  // photographic targets; behavior and recognition distances stay unchanged.
  root.scale.setScalar(blackbirdVisualScale + (index % 4) * 0.014);
  scene.add(root);
  gameRendering.registerStylizedBird(root);
  const parts = root.userData.parts as Parameters<typeof applyBlackbirdPose>[0];
  const initialNode = wetlandGroundNodes[Math.floor(index * wetlandGroundNodes.length / blackbirdCount)];
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
    excludeNodeIds: () => occupiedByOtherBlackbirds(sourceId),
    groundHeightAt: parkWorld.sampleHeight,
    applyPose: (state, cycle, time, delta) => {
      applyBlackbirdPose(parts, sampleBlackbirdPose(state, cycle, time), delta);
    },
  });
  blackbirdOccupancy.set(sourceId, runtime);
  return { sourceId, root, runtime, initialNodeId: initialNode.id };
});
const blackbirdRuntimes = blackbirdEntries.map(({ runtime }) => runtime);

const grayMagpieRoot = createGrayMagpie();
grayMagpieRoot.scale.setScalar(grayMagpieVisualScale);
scene.add(grayMagpieRoot);
gameRendering.registerStylizedBird(grayMagpieRoot);
const grayMagpieRuntime = createRuntimeBird<GrayMagpieState>({
  habitatRegistry,
  speciesId: 'gray-magpie',
  label: speciesName('gray-magpie'),
  root: grayMagpieRoot,
  policy: grayMagpiePolicy,
  pressureRules: grayMagpiePressureRules,
  initialState: 'perch',
  initialNodeId: parkWorld.grayMagpieInitialNodeId,
  seed: 31871,
  motionByState: { patrol: 'ground-step', takeoff: 'takeoff', flight: 'flight', land: 'land' },
  faceObserverStates: ['inspect', 'alarm'],
  groundHeightAt: parkWorld.sampleHeight,
  applyPose: (state, cycle, time, delta, habitatLevel) => {
    const habitat = habitatLevel === 'ground' ? 'ground' : habitatLevel === 'low' ? 'low' : 'high';
    applyGrayMagpiePose(grayMagpieRoot, sampleGrayMagpiePose(state, cycle, time, habitat), delta);
  },
});

const birdRuntimes: readonly RuntimeBird[] = [...blackbirdRuntimes, grayMagpieRuntime];
let activeBird: RuntimeBird = blackbirdRuntimes[0];
let selectedSpeciesId = 'blackbird';
grayMagpieRoot.visible = false;
const birdCallAudio = createBirdCallAudio({
  camera,
  blackbirdRoots: blackbirdEntries.map(({ sourceId, root }) => ({ sourceId, root })),
});
const environmentAudio = createEnvironmentAudio();
const gameplayParams = new URLSearchParams(window.location.search);
const pressureScenario = gameplayParams.get('scenario') === 'pressure';
let observerPressure = 0.24;
let vigilance = 0.16;
let birdPerception: BirdPerception = {
  observerDistance: Number.POSITIVE_INFINITY,
  observerApproachSpeed: 0,
  observerFacingDot: 0,
  visualAwareness: 1,
  visualTransmission: 1,
  directAttention: false,
  observerPressure,
};
const journal = createFieldJournal();
const clock = new THREE.Clock();
const gameplayForward = new THREE.Vector3();
const gameplayRight = new THREE.Vector3();
const gameplayMove = new THREE.Vector3();
const gameplayDesiredVelocity = new THREE.Vector3();
const gameplayVelocity = new THREE.Vector3();
const gameplayPreviousPosition = new THREE.Vector3();
const gameplayBirdDirection = new THREE.Vector3();
const birdForward = new THREE.Vector3();
const birdToPlayer = new THREE.Vector3();
const projectedBirdCenter = new THREE.Vector3();
const gameplayLookTarget = new THREE.Vector3();
const gameplayLookDirection = new THREE.Vector3();
const gameplayCameraTarget = new THREE.Vector3();
const focusStops = [1.5, 2, 2.6, 3.3, 4.1, 5, 6, 7.2, 8.6, 10.2, 12, 14.2, 16.8, 20, 24, 28, 32, 38, 46, 56] as const;
let binocularRaised = false;
let binocularRaisedLastFrame = false;
type ViewMode = 'first-person' | 'third-person';
let viewMode: ViewMode = 'first-person';
let focusIndex = 10;
let focusDistance: number = focusStops[focusIndex];
let toastTimeout = 0;
let focusLimitTimeout = 0;
let journalOpen = false;
let smoothedCameraYaw = Math.PI;
let smoothedCameraPitch = -0.08;
const frameTimeSamples: number[] = [];
let lastFrameTelemetryAt = 0;

const selectActiveBlackbird = () => {
  let best = blackbirdRuntimes[0];
  let bestScore = Number.POSITIVE_INFINITY;
  blackbirdRuntimes.forEach((runtime) => {
    projectedBirdCenter.copy(runtime.root.position);
    projectedBirdCenter.y += 0.22;
    projectedBirdCenter.project(camera);
    const inView = projectedBirdCenter.z > -1 && projectedBirdCenter.z < 1;
    const screenDistance = Math.hypot(projectedBirdCenter.x, projectedBirdCenter.y);
    const worldDistance = camera.position.distanceTo(runtime.root.position);
    const score = (inView ? 0 : 8)
      + screenDistance * 3
      + Math.min(worldDistance / 80, 1.5)
      - (runtime === activeBird ? 0.45 : 0);
    if (score < bestScore) {
      best = runtime;
      bestScore = score;
    }
  });
  return best;
};

const perceptionForBird = (
  runtime: RuntimeBird,
  moving: boolean,
  directAttention: boolean,
  forcePressure: boolean,
) => {
  const birdRoot = runtime.root;
  const birdDistance = character.position.distanceTo(birdRoot.position);
  gameplayBirdDirection.copy(birdRoot.position).sub(character.position).setY(0);
  if (gameplayBirdDirection.lengthSq() > 0.0001) gameplayBirdDirection.normalize();
  const birdApproachSpeed = moving
    ? Math.max(0, gameplayVelocity.dot(gameplayBirdDirection))
    : 0;
  birdForward.set(Math.sin(birdRoot.rotation.y), 0, Math.cos(birdRoot.rotation.y));
  birdToPlayer.copy(character.position).sub(birdRoot.position).setY(0);
  if (birdToPlayer.lengthSq() > 0.0001) birdToPlayer.normalize();
  const visualTransmission = habitatRegistry.measureVisualTransmission(
    { x: character.position.x, y: character.position.y + 1.2, z: character.position.z },
    { x: birdRoot.position.x, y: birdRoot.position.y + 0.18, z: birdRoot.position.z },
  );
  const perception = calculateBirdPerception({
    observerDistance: forcePressure ? Math.min(birdDistance, 2.2) : birdDistance,
    observerApproachSpeed: forcePressure ? Math.max(birdApproachSpeed, 3) : birdApproachSpeed,
    observerFacingDot: birdForward.dot(birdToPlayer),
    visualTransmission,
    directAttention,
  }, runtime.pressureRules);
  return { perception, visualTransmission };
};

const gameElement = <T extends HTMLElement>(selector: string) => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing gameplay element: ${selector}`);
  return element;
};

const focusRange = gameElement<HTMLInputElement>('#focus-distance');
const locationLabel = gameElement<HTMLElement>('#location-name');
const focusControl = gameElement<HTMLElement>('#focus-control');
const viewToggle = gameElement<HTMLButtonElement>('#view-toggle');
focusRange.max = String(focusStops.length - 1);

const setViewMode = (mode: ViewMode) => {
  viewMode = mode;
  const thirdPerson = mode === 'third-person';
  viewToggle.textContent = thirdPerson ? 'Third person' : 'First person';
  viewToggle.setAttribute('aria-pressed', String(thirdPerson));
  document.body.classList.toggle('first-person-view', !thirdPerson);
  canvas.dataset.viewMode = mode;
};

viewToggle.addEventListener('click', () => {
  setViewMode(viewMode === 'first-person' ? 'third-person' : 'first-person');
});
window.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyV' || event.repeat || journalOpen || summaryOpen) return;
  setViewMode(viewMode === 'first-person' ? 'third-person' : 'first-person');
});
setViewMode(viewMode);

const closestFocusIndex = (distance: number) => focusStops.reduce(
  (closest, stop, index) => Math.abs(stop - distance) < Math.abs(focusStops[closest] - distance)
    ? index
    : closest,
  0,
);
const focusQualityAtDistance = (targetDistance: number) => {
  // Each stop owns a clear band half as deep as its focal distance. The soft
  // shoulder keeps wheel/slider changes gradual without making mid and far
  // targets share one effectively infinite depth of field.
  const clearHalfWidth = Math.max(0.55, focusDistance * 0.25);
  const featherWidth = Math.max(0.45, focusDistance * 0.14);
  const outsideClearBand = Math.max(0, Math.abs(targetDistance - focusDistance) - clearHalfWidth);
  return 1 - THREE.MathUtils.smoothstep(outsideClearBand, 0, featherWidth);
};

const focusDepthRange = () => ({
  clearHalfWidth: Math.max(0.55, focusDistance * 0.25),
  featherWidth: Math.max(0.45, focusDistance * 0.14),
});

const setFocusIndex = (requestedIndex: number, pulseLimit = false) => {
  const nextIndex = THREE.MathUtils.clamp(Math.round(requestedIndex), 0, focusStops.length - 1);
  const unchanged = nextIndex === focusIndex;
  focusIndex = nextIndex;
  focusDistance = focusStops[focusIndex];
  focusRange.value = String(focusIndex);
  focusControl.classList.toggle('at-near', focusIndex === 0);
  focusControl.classList.toggle('at-far', focusIndex === focusStops.length - 1);
  if (!pulseLimit || !unchanged) return;
  const limitClass = focusIndex === 0 ? 'limit-near' : 'limit-far';
  focusControl.classList.remove('limit-near', 'limit-far');
  void focusControl.offsetWidth;
  focusControl.classList.add(limitClass);
  window.clearTimeout(focusLimitTimeout);
  focusLimitTimeout = window.setTimeout(() => focusControl.classList.remove(limitClass), 260);
};

setFocusIndex(focusIndex);

const setGameplayStatus = (message: string) => {
    const status = gameElement<HTMLElement>('#game-status');
  if (status.textContent !== message) status.textContent = message;
};

const showGameToast = (message: string) => {
  const toast = gameElement<HTMLElement>('#game-toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove('visible'), 2200);
};

const journalViewElements = {
  progressTitle: gameElement<HTMLElement>('#journal-progress'),
  stats: gameElement<HTMLElement>('#journal-stats'),
  checklist: gameElement<HTMLElement>('#journal-checklist'),
  photoGrid: gameElement<HTMLElement>('#album-grid'),
  photoEmpty: gameElement<HTMLElement>('#album-empty'),
  toggleCount: gameElement<HTMLOutputElement>('#journal-count'),
};
const summaryElements = {
  root: gameElement<HTMLElement>('#session-summary'),
  kicker: gameElement<HTMLElement>('#summary-kicker'),
  title: gameElement<HTMLElement>('#summary-title'),
  stats: gameElement<HTMLElement>('#summary-stats'),
  photos: gameElement<HTMLElement>('#summary-photos'),
};
const coach = createCoach(gameElement<HTMLElement>('#coach'));
const shotRing = gameElement<HTMLElement>('#shot-ring');
const shotHint = gameElement<HTMLElement>('#shot-hint');
const alertness = gameElement<HTMLElement>('#alertness');
const alertnessLabel = gameElement<HTMLElement>('#alertness-label');
const alertnessFill = gameElement<HTMLElement>('#alertness-fill');
const callCue = gameElement<HTMLElement>('#call-cue');
const controlHints = gameElement<HTMLElement>('#control-hints');
let summaryOpen = false;
let journalEverOpened = false;
let summaryShownForCompletion = false;
let sessionStartedAt: number | undefined;
let secondsMoved = 0;
let lastCallCount = 0;
let callCueSourceId: string | undefined;
let callCueUntil = 0;
let renderedControlHints = '';
const previousBirdStates = new Map<RuntimeBird, string>();

const stars = (count: number) => '★'.repeat(count) + '☆'.repeat(3 - count);

const measureShot = (): ShotMetrics => {
  const birdCenter = activeBird.root.position.clone().add(new THREE.Vector3(0, 0.22, 0)).project(camera);
  const distance = camera.position.distanceTo(activeBird.root.position);
  return {
    inFrame: activeBird.root.visible && birdCenter.z > -1 && birdCenter.z < 1
      && Math.abs(birdCenter.x) <= 1 && Math.abs(birdCenter.y) <= 1,
    offCenter: Math.hypot(birdCenter.x, birdCenter.y),
    distance,
    focusQuality: focusQualityAtDistance(distance),
  };
};

const renderJournalView = () => renderJournal(journalViewElements, journal);

const setJournalOpen = (open: boolean) => {
  journalOpen = open;
  if (open) journalEverOpened = true;
  document.body.classList.toggle('journal-open', open);
  if (open) playerInput.setBinocularRaised(false);
  if (open && document.pointerLockElement) document.exitPointerLock();
  const drawer = gameElement<HTMLElement>('#journal-drawer');
  drawer.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', String(!open));
};

const setSummaryOpen = (open: boolean) => {
  summaryOpen = open;
  if (open) {
    setJournalOpen(false);
    playerInput.setBinocularRaised(false);
    if (document.pointerLockElement) document.exitPointerLock();
    const elapsed = sessionStartedAt === undefined ? 0 : clock.elapsedTime - sessionStartedAt;
    renderSummary(summaryElements, journal, elapsed);
  }
  summaryElements.root.hidden = !open;
  document.body.classList.toggle('summary-open', open);
};

const startNewSession = () => {
  journal.reset();
  summaryShownForCompletion = false;
  sessionStartedAt = clock.elapsedTime;
  renderJournalView();
  setSummaryOpen(false);
  showGameToast('New session: your field journal is empty again');
};

const setBinocularRaised = (raised: boolean) => {
  if (binocularRaised === raised) return;
  binocularRaised = raised;
  document.body.classList.toggle('binocular-raised', raised);
};

const captureGameplayPhoto = () => {
  if (!binocularRaised) return;
  const state = activeBird.getState();
  const entry = entryForState(activeBird.speciesId, state);
  const rating = ratePhoto(measureShot(), entry?.rare ?? false);

  const photoCanvas = document.createElement('canvas');
  const scale = Math.min(1, 960 / canvas.width);
  photoCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  photoCanvas.height = Math.max(1, Math.round(canvas.height * scale));
  const context = photoCanvas.getContext('2d');
  if (!context) return;
  context.drawImage(canvas, 0, 0, photoCanvas.width, photoCanvas.height);
  const result = journal.addPhoto({
    src: photoCanvas.toDataURL('image/jpeg', 0.82),
    speciesId: activeBird.speciesId,
    state,
    stateLabel: activeBird.getStateLabel(),
    rating,
  });
  renderJournalView();

  const flash = gameElement<HTMLElement>('.capture-flash');
  flash.classList.add('active');
  window.setTimeout(() => flash.classList.remove('active'), 90);
  const { photo } = result;
  if (rating.stars === 0) {
    showGameToast(`Photo saved · species unclear (${shotProblemText[rating.check.problem ?? 'out-of-focus'].toLowerCase()})`);
  } else if (result.newEntry && result.entry) {
    showGameToast(`New journal entry! ${photo.speciesName}: ${result.entry.title} ${stars(rating.stars)}`);
  } else if (result.improvedEntry && result.entry) {
    showGameToast(`Better shot! ${photo.speciesName}: ${result.entry.title} ${stars(rating.stars)}`);
  } else if (result.entry) {
    showGameToast(`${photo.speciesName}: ${result.entry.title} ${stars(rating.stars)} · already in your journal`);
  } else {
    showGameToast(`${photo.speciesName} · ${photo.stateLabel} ${stars(rating.stars)} · not a journal behaviour`);
  }
  if (journal.getProgress().complete && !summaryShownForCompletion) {
    summaryShownForCompletion = true;
    window.setTimeout(() => setSummaryOpen(true), 1600);
  }
};

const playerInput = createPlayerInputController({
  canvas,
  elements: {
    focusRange,
    touchRoot: gameElement<HTMLElement>('#touch-controls'),
    movePad: gameElement<HTMLElement>('#touch-move-pad'),
    moveKnob: gameElement<HTMLElement>('#touch-move-knob'),
    binocularButton: gameElement<HTMLButtonElement>('#touch-binocular'),
    captureButton: gameElement<HTMLButtonElement>('#touch-capture'),
  },
  isBlocked: () => journalOpen || summaryOpen,
  onJournalToggle: () => {
    if (!summaryOpen) setJournalOpen(!journalOpen);
  },
  onCapture: captureGameplayPhoto,
  onFocusStep: (direction) => {
    setFocusIndex(focusIndex + direction, true);
  },
  onFocusSet: (index) => setFocusIndex(index),
  onBinocularChange: setBinocularRaised,
  onControlStateChange: (active, gameStarted) => {
    const entryScreen = gameElement<HTMLElement>('#entry-screen');
    document.body.classList.toggle('game-started', gameStarted);
    entryScreen.classList.toggle('hidden', gameStarted || active || journalOpen);
  },
});

const isGameStarted = () => document.body.classList.contains('game-started');

const detectStartle = (runtime: RuntimeBird, pressure: number) => {
  const previous = previousBirdStates.get(runtime);
  const state = runtime.getState();
  previousBirdStates.set(runtime, state);
  if (previous === undefined || previous === state || state !== 'takeoff') return;
  if (pressure < alertnessRules.startledPressure || !isGameStarted()) return;
  journal.recordStartled();
  renderJournalView();
  showGameToast(`You startled a ${runtime.label.toLowerCase()}!`);
  coach.showTip(
    'startled',
    'Birds flee when you rush at them. Approach slowly and stop when the alertness bar turns orange.',
    7,
  );
};

const walkingHints = '<kbd>WASD</kbd> Walk · <kbd>Shift</kbd> Run · <kbd>B</kbd> Binoculars · <kbd>J</kbd> Journal · <kbd>V</kbd> View';
const binocularHints = '<kbd>Mouse</kbd> Aim · <kbd>Wheel</kbd> Focus · <kbd>Click</kbd> Photo · <kbd>B</kbd> Lower binoculars';
const lockedHint = ' · <kbd>Esc</kbd> Free cursor';
const unlockedHint = '<kbd>Click</kbd> the scene to look with the mouse · ';

const updateGuidance = (
  time: number,
  birdDistance: number,
  audioSnapshot: ReturnType<typeof birdCallAudio.getSnapshot>,
  touchMode: boolean,
) => {
  const started = isGameStarted();
  const overlayOpen = journalOpen || summaryOpen;
  const shot = measureShot();
  const check = checkShot(shot);

  // Viewfinder: the ring and hint use the same rule that judges the photo.
  shotRing.dataset.state = check.identified ? 'ready' : check.centered ? 'partial' : 'idle';
  const shotText = check.identified
    ? `${Math.round(shot.distance)} m · Ready, ${touchMode ? 'tap Photo' : 'click to take a photo'}`
    : check.problem === 'not-in-frame'
      ? shotProblemText['not-in-frame']
      : `${Math.round(shot.distance)} m · ${shotProblemText[check.problem ?? 'out-of-focus']}`
        + (check.problem === 'out-of-focus' ? (touchMode ? ', drag the slider' : ', scroll to focus') : '');
  if (shotHint.textContent !== shotText) shotHint.textContent = shotText;

  // Alertness of the watched bird, from the same pressure the bird AI uses.
  const showAlertness = started && !overlayOpen && activeBird.root.visible
    && birdDistance < alertnessRules.visibleWithin;
  alertness.classList.toggle('visible', showAlertness);
  if (showAlertness) {
    const level = vigilance >= alertnessRules.fleeing ? 'fleeing' : vigilance >= alertnessRules.wary ? 'wary' : 'calm';
    alertness.dataset.level = level;
    const labelText = `${activeBird.label}: ${level === 'fleeing' ? 'About to flee' : level === 'wary' ? 'Wary' : 'Calm'}`;
    if (alertnessLabel.textContent !== labelText) alertnessLabel.textContent = labelText;
    alertnessFill.style.transform = `scaleX(${Math.max(0.04, Math.min(1, vigilance)).toFixed(3)})`;
  }

  // A short marker toward the bird that just called, clamped to the screen edge.
  if (audioSnapshot.callCount > lastCallCount) {
    lastCallCount = audioSnapshot.callCount;
    callCueSourceId = audioSnapshot.lastSourceId;
    callCueUntil = time + 2.6;
  }
  const cueRoot = callCueSourceId
    ? blackbirdEntries.find(({ sourceId }) => sourceId === callCueSourceId)?.root
    : undefined;
  const showCue = started && !overlayOpen && !binocularRaised && cueRoot !== undefined
    && selectedSpeciesId === 'blackbird' && time < callCueUntil;
  callCue.classList.toggle('visible', showCue);
  if (showCue) coach.showTip('call', 'Hear that? The ♪ marker shows where the song came from.', 5);
  if (showCue && cueRoot) {
    const projected = cueRoot.position.clone().add(new THREE.Vector3(0, 0.4, 0)).project(camera);
    let x = projected.x;
    let y = projected.y;
    if (projected.z > 1) {
      x = -x;
      y = -y;
    }
    const overshoot = Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.8, projected.z > 1 ? 1 : 0);
    if (overshoot >= 1) {
      x /= overshoot;
      y /= overshoot;
    }
    callCue.style.left = `${((x + 1) / 2) * window.innerWidth}px`;
    callCue.style.top = `${((1 - y) / 2) * window.innerHeight}px`;
    callCue.style.opacity = Math.min(1, (callCueUntil - time) / 0.6).toFixed(2);
  }

  const mouseLook = playerInput.isMouseLookActive();
  const hints = started && !touchMode
    ? (mouseLook ? '' : unlockedHint) + (binocularRaised ? binocularHints : walkingHints) + (mouseLook ? lockedHint : '')
    : '';
  if (hints !== renderedControlHints) {
    renderedControlHints = hints;
    controlHints.innerHTML = hints;
  }

  if (!started) return;
  const progress = journal.getProgress();
  coach.update({
    touchMode,
    secondsMoved,
    birdNearby: activeBird.root.visible && birdDistance < 22 && shot.inFrame,
    binocularRaised,
    inFocus: check.inFocus,
    shotReady: check.identified,
    photosTaken: progress.photos,
    identifiedPhotos: progress.identifiedPhotos,
    journalOpened: journalEverOpened,
  }, time);
  if (selectedSpeciesId === 'blackbird' && journal.countFound('blackbird') >= 2) {
    coach.showTip('magpie', 'Tip: switch "Watching" to Gray magpie to look for a second species.', 8);
  }
};

const updateGameplay = (delta: number, time: number) => {
  const controls = playerInput.getFrame();
  const yawDifference = Math.atan2(
    Math.sin(controls.cameraYaw - smoothedCameraYaw),
    Math.cos(controls.cameraYaw - smoothedCameraYaw),
  );
  const lookResponse = controls.touchMode ? 24 : binocularRaised ? 11 : 18;
  const lookBlend = 1 - Math.exp(-delta * lookResponse);
  smoothedCameraYaw += yawDifference * lookBlend;
  smoothedCameraPitch = THREE.MathUtils.lerp(smoothedCameraPitch, controls.cameraPitch, lookBlend);
  gameplayForward.set(Math.sin(smoothedCameraYaw), 0, Math.cos(smoothedCameraYaw));
  gameplayRight.set(-gameplayForward.z, 0, gameplayForward.x);
  gameplayMove.set(0, 0, 0);
  gameplayMove.addScaledVector(gameplayForward, controls.moveForward);
  gameplayMove.addScaledVector(gameplayRight, controls.moveRight);

  const inputMagnitude = Math.min(1, gameplayMove.length());
  const inputActive = inputMagnitude > 0.01;
  const targetSpeed = (controls.running ? 3.35 : 1.75) * inputMagnitude;
  if (inputActive) gameplayMove.normalize();
  gameplayDesiredVelocity.copy(gameplayMove).multiplyScalar(targetSpeed);
  const movementBlend = 1 - Math.exp(-delta * (inputActive ? 10 : 15));
  gameplayVelocity.lerp(gameplayDesiredVelocity, movementBlend);
  if (!inputActive && gameplayVelocity.lengthSq() < 0.0004) gameplayVelocity.set(0, 0, 0);
  const actualSpeed = gameplayVelocity.length();
  const moving = actualSpeed > 0.025;
  if (moving) {
    gameplayPreviousPosition.copy(character.position);
    character.position.addScaledVector(gameplayVelocity, delta);
    character.rotation.y = THREE.MathUtils.lerp(
      character.rotation.y,
      Math.atan2(gameplayVelocity.x, gameplayVelocity.z),
      1 - Math.exp(-delta * 13),
    );
    parkWorld.resolvePlayerMovement(gameplayPreviousPosition, character.position);
  }
  // Keep the legacy entry point available for non-moving/spawn corrections;
  // moving frames use the swept resolver above so shore and obstacle contact
  // slides instead of teleporting toward a fixed radial sample.
  if (!moving) parkWorld.constrainPlayerPosition(character.position);
  character.position.y = parkWorld.sampleHeight(character.position.x, character.position.z);
  const location = parkWorld.locationAt(character.position);
  const locationName = location === 'wetland-shore'
    ? 'Lakeshore'
    : location === 'wetland-path' ? 'Wetland path' : 'Meadow';
  if (locationLabel.textContent !== locationName) locationLabel.textContent = locationName;
  canvas.dataset.location = location;
  updateReferenceCharacterWalk(character, moving, actualSpeed, delta, time);
  if (moving) secondsMoved += delta;

  if (selectedSpeciesId === 'blackbird') activeBird = selectActiveBlackbird();
  else activeBird = grayMagpieRuntime;
  let visualTransmission = 1;
  if (selectedSpeciesId === 'blackbird') {
    blackbirdRuntimes.forEach((runtime) => {
      const isActive = runtime === activeBird;
      const result = perceptionForBird(
        runtime,
        moving,
        binocularRaised && isActive,
        pressureScenario && isActive,
      );
      runtime.update(time, delta, result.perception, character.position);
      detectStartle(runtime, result.perception.observerPressure);
      const state = runtime.getState();
      runtime.setDrive('forage', Math.max(
        0.20,
        runtime.getDrive('forage') + delta * (state === 'forage' || state === 'peck' ? -0.10 : 0.018),
      ));
      if (!isActive) return;
      birdPerception = result.perception;
      visualTransmission = result.visualTransmission;
    });
  } else {
    const result = perceptionForBird(
      grayMagpieRuntime,
      moving,
      binocularRaised,
      pressureScenario,
    );
    grayMagpieRuntime.update(time, delta, result.perception, character.position);
    detectStartle(grayMagpieRuntime, result.perception.observerPressure);
    birdPerception = result.perception;
    visualTransmission = result.visualTransmission;
  }
  observerPressure = birdPerception.observerPressure;
  const birdRoot = activeBird.root;
  const birdDistance = character.position.distanceTo(birdRoot.position);
  const runtimeSelection = activeBird.getLastSelection();
  canvas.dataset.species = activeBird.speciesId;
  canvas.dataset.state = activeBird.getState();
  canvas.dataset.habitatNode = activeBird.getHabitatNode().id;
  canvas.dataset.visualTransmission = visualTransmission.toFixed(3);
  canvas.dataset.targetNode = runtimeSelection?.node.id ?? '';
  canvas.dataset.crossTree = String(runtimeSelection?.crossTree ?? false);
  canvas.dataset.targetScore = runtimeSelection?.score.toFixed(3) ?? '';
  canvas.dataset.birdPosition = [activeBird.root.position.x, activeBird.root.position.y, activeBird.root.position.z]
    .map((value) => value.toFixed(3))
    .join(',');
  canvas.dataset.playerPosition = [character.position.x, character.position.y, character.position.z]
    .map((value) => value.toFixed(3))
    .join(',');
  canvas.dataset.playerWalkable = String(parkWorld.isWalkable(
    character.position.x,
    character.position.z,
  ));
  canvas.dataset.cameraYaw = smoothedCameraYaw.toFixed(3);
  canvas.dataset.cameraPitch = controls.cameraPitch.toFixed(3);
  canvas.dataset.cameraDistance = controls.cameraDistance.toFixed(2);
  canvas.dataset.moveInput = `${controls.moveRight.toFixed(2)},${controls.moveForward.toFixed(2)}`;
  canvas.dataset.viewMode = viewMode;
  canvas.dataset.inputMode = controls.touchMode ? 'touch' : 'desktop';
  canvas.dataset.blackbirdCount = String(blackbirdRuntimes.length);
  canvas.dataset.visibleBlackbirdCount = String(
    blackbirdRuntimes.filter((runtime) => runtime.root.visible).length,
  );
  canvas.dataset.blackbirdStates = blackbirdEntries
    .map(({ sourceId, runtime }) => `${sourceId}:${runtime.getState()}@${runtime.getHabitatNode().id}`)
    .join('|');
  canvas.dataset.blackbirdTargets = blackbirdEntries
    .map(({ sourceId, runtime }) => `${sourceId}@${runtime.getTargetHabitatNode()?.id ?? ''}`)
    .join('|');

  const leavingBinocular = binocularRaisedLastFrame && !binocularRaised;
  const targetFov = binocularRaised ? 8 : 48;
  camera.fov = leavingBinocular
    ? targetFov
    : THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-delta * 12));
  camera.updateProjectionMatrix();
  canvas.dataset.cameraFov = camera.fov.toFixed(2);
  gameplayLookDirection.set(
    Math.sin(smoothedCameraYaw) * Math.cos(smoothedCameraPitch),
    Math.sin(smoothedCameraPitch),
    Math.cos(smoothedCameraYaw) * Math.cos(smoothedCameraPitch),
  );
  if (binocularRaised || viewMode === 'first-person') {
    character.visible = false;
    camera.position.copy(character.position).add(new THREE.Vector3(0, firstPersonEyeHeight, 0));
    gameplayLookTarget
      .copy(camera.position)
      .addScaledVector(gameplayLookDirection, 10);
    camera.lookAt(gameplayLookTarget);
  } else {
    character.visible = true;
    const cameraHeight = 1.48 + controls.cameraDistance * 0.22;
    const shoulderOffset = controls.touchMode ? 0.78 : 0.72;
    gameplayCameraTarget.set(character.position.x, character.position.y, character.position.z)
      .addScaledVector(gameplayForward, -controls.cameraDistance)
      .addScaledVector(gameplayRight, shoulderOffset)
      .add(new THREE.Vector3(0, cameraHeight, 0));
    if (leavingBinocular) camera.position.copy(gameplayCameraTarget);
    else camera.position.lerp(gameplayCameraTarget, 1 - Math.exp(-delta * 10));
    gameplayLookTarget.copy(camera.position).addScaledVector(gameplayLookDirection, 10);
    camera.lookAt(gameplayLookTarget);
  }
  binocularRaisedLastFrame = binocularRaised;

  const opticalDistance = camera.position.distanceTo(birdRoot.position);
  const focusQuality = focusQualityAtDistance(opticalDistance);
  const focusRangeState = focusDepthRange();
  gameRendering.setBinocularDepthOfField({
    enabled: binocularRaised,
    focusDistance,
    clearHalfWidth: focusRangeState.clearHalfWidth,
    featherWidth: focusRangeState.featherWidth,
    maxBlurPixels: 5.2,
  });
  const depthOfFieldSnapshot = gameRendering.getBinocularDepthOfFieldSnapshot();
  focusControl.style.setProperty('--focus-quality', Math.max(0.08, focusQuality).toFixed(3));
  canvas.dataset.focusIndex = String(focusIndex);
  canvas.dataset.focusDistance = focusDistance.toFixed(1);
  canvas.dataset.focusQuality = focusQuality.toFixed(3);
  canvas.dataset.focusLimit = focusIndex === 0 ? 'near' : focusIndex === focusStops.length - 1 ? 'far' : '';
  canvas.dataset.focusDofEnabled = String(depthOfFieldSnapshot.enabled);
  canvas.dataset.focusDofClearHalfWidth = depthOfFieldSnapshot.clearHalfWidth.toFixed(2);
  canvas.dataset.focusDofFeatherWidth = depthOfFieldSnapshot.featherWidth.toFixed(2);
  canvas.dataset.focusDofDepthSize = `${depthOfFieldSnapshot.depthWidth}x${depthOfFieldSnapshot.depthHeight}`;

  const activeState = activeBird.getState();
  birdCallAudio.update({
    time,
    sources: selectedSpeciesId === 'blackbird'
      ? blackbirdEntries.map(({ sourceId, runtime }) => ({
          sourceId,
          state: runtime.getState(),
          habitatKind: runtime.getHabitatNode().kind,
        }))
      : [],
  });
  const audioSnapshot = birdCallAudio.getSnapshot();
  canvas.dataset.birdAudioState = audioSnapshot.contextState;
  canvas.dataset.birdCallCount = String(audioSnapshot.callCount);
  canvas.dataset.birdCallKind = audioSnapshot.lastCallKind ?? '';
  canvas.dataset.birdCallSource = audioSnapshot.lastSourceId ?? '';
  canvas.dataset.birdCallEligibleCount = String(audioSnapshot.eligibleSourceCount);
  canvas.dataset.birdCallHabitat = audioSnapshot.activeHabitatKind ?? '';
  canvas.dataset.birdCallEligible = String(audioSnapshot.eligible);
  canvas.dataset.birdCallDistance = audioSnapshot.lastCallDistance?.toFixed(2) ?? '';
  environmentAudio.update({
    time,
    delta,
    movementSpeed: actualSpeed,
    moving,
    location,
  });
  const environmentSnapshot = environmentAudio.getSnapshot();
  canvas.dataset.environmentAudioState = environmentSnapshot.contextState;
  canvas.dataset.environmentAudioLoaded = String(environmentSnapshot.loaded);
  canvas.dataset.footstepCount = String(environmentSnapshot.footstepCount);
  canvas.dataset.footstepSurface = environmentSnapshot.lastFootstepSurface ?? '';
  canvas.dataset.shoreWaterCount = String(environmentSnapshot.waterEventCount);
  canvas.dataset.shoreWaterClip = environmentSnapshot.lastWaterClip?.toString() ?? '';
  if (location === 'wetland-shore' && birdDistance > 18) {
    setGameplayStatus('The water is calm. Keep watching along the shore');
  } else if (activeState === 'alert' || activeState === 'alarm') {
    setGameplayStatus(activeState === 'alarm'
      ? `The ${activeBird.label.toLowerCase()} calls an alarm and eyes an escape route`
      : `The ${activeBird.label.toLowerCase()} freezes and stares at you`);
  } else if (activeState === 'flight' || activeState === 'takeoff') {
    const selection = activeBird.getLastSelection();
    setGameplayStatus(selection?.crossTree
      ? `The ${activeBird.label.toLowerCase()} is flying to a safer tree`
      : `The ${activeBird.label.toLowerCase()} is moving to a new spot`);
  } else if (binocularRaised) {
    setGameplayStatus(focusQuality > 0.78 ? 'The view is sharpening' : 'Not in focus yet');
  } else if (activeState === 'sing' || activeState === 'contact') {
    setGameplayStatus(`A ${activeBird.label.toLowerCase()} is calling from the trees`);
  } else if (birdDistance < 13 && (activeState === 'forage' || activeState === 'peck')) {
    setGameplayStatus('Something is rustling in the leaves');
  } else {
    setGameplayStatus(`${activeBird.label} · ${activeBird.getStateLabel()}`);
  }
  updateGuidance(time, birdDistance, audioSnapshot, controls.touchMode);
};

character.position.copy(parkWorld.spawn);
character.position.y = parkWorld.sampleHeight(character.position.x, character.position.z);
  character.rotation.y = Math.PI;
  camera.position.set(
    character.position.x,
    character.position.y + firstPersonEyeHeight,
    character.position.z,
  );
  setFocusIndex(closestFocusIndex(12));

  const enterButton = gameElement<HTMLButtonElement>('#enter-park');
  enterButton.addEventListener('click', () => {
    void birdCallAudio.unlock();
    void environmentAudio.unlock();
    sessionStartedAt ??= clock.elapsedTime;
    gameElement<HTMLElement>('#entry-screen').classList.add('hidden');
    playerInput.start();
  });
  const speciesSelect = gameElement<HTMLSelectElement>('#bird-species-select');
  speciesSelect.addEventListener('change', () => {
    selectedSpeciesId = speciesSelect.value;
    if (selectedSpeciesId === 'blackbird') {
      blackbirdRuntimes.forEach((runtime) => { runtime.root.visible = true; });
      grayMagpieRoot.visible = false;
      activeBird = selectActiveBlackbird();
    } else {
      blackbirdRuntimes.forEach((runtime) => { runtime.root.visible = false; });
      grayMagpieRoot.visible = true;
      activeBird = grayMagpieRuntime;
    }
    setFocusIndex(closestFocusIndex(camera.position.distanceTo(activeBird.root.position)));
    setGameplayStatus(selectedSpeciesId === 'blackbird'
      ? 'Several blackbirds are active in the wetland'
      : 'Look for the gray magpie high in the canopy');
  });
  const requestedSpecies = gameplayParams.get('species');
  if (requestedSpecies && birdRuntimes.some((candidate) => candidate.speciesId === requestedSpecies)) {
    speciesSelect.value = requestedSpecies;
    speciesSelect.dispatchEvent(new Event('change'));
  }
  Object.assign(window, {
    __BIRD_GAME__: {
      getSnapshot: () => {
        const selection = activeBird.getLastSelection();
        return {
          speciesId: activeBird.speciesId,
          speciesLabel: activeBird.label,
          state: activeBird.getState(),
          stateLabel: activeBird.getStateLabel(),
          habitatNodeId: activeBird.getHabitatNode().id,
          position: activeBird.root.position.toArray(),
          perception: birdPerception,
          audio: birdCallAudio.getSnapshot(),
          selection: selection ? {
            nodeId: selection.node.id,
            score: selection.score,
            observerDistance: selection.observerDistance,
            heightGain: selection.heightGain,
            visualTransmission: selection.visualTransmission,
            crossTree: selection.crossTree,
          } : null,
          viewMode,
          world: parkWorld.study.field.layoutMap.domainShape === 'ellipse'
            ? 'shared-expanded-wetland'
            : 'shared-park-third-wetland',
          visualDomain: {
            shape: parkWorld.study.field.layoutMap.domainShape,
            width: parkWorld.study.field.width,
            depth: parkWorld.study.field.depth,
          },
          playableDomain: parkWorld.playableDomain,
          playerWalkable: parkWorld.isWalkable(character.position.x, character.position.z),
          blackbirds: blackbirdEntries.map(({ sourceId, runtime, initialNodeId }) => ({
            sourceId,
            initialNodeId,
            state: runtime.getState(),
            habitatNodeId: runtime.getHabitatNode().id,
            targetHabitatNodeId: runtime.getTargetHabitatNode()?.id,
            position: runtime.root.position.toArray(),
            visible: runtime.root.visible,
          })),
          trees: parkWorld.habitatProviderIds.filter((providerId) => providerId !== 'wetland-floor').map((providerId) => ({
            providerId,
            nodes: habitatRegistry.getProviderNodes(providerId).map((node) => ({
              id: node.id,
              level: node.level,
              position: [node.position.x, node.position.y, node.position.z],
              exposure: 'structuralExposure' in node ? node.structuralExposure : null,
              treeHeight: 'treeHeight' in node ? node.treeHeight : null,
            })),
          })),
        };
      },
      setSpecies: (speciesId: string) => {
        speciesSelect.value = speciesId;
        speciesSelect.dispatchEvent(new Event('change'));
      },
      setObserverPosition: (x: number, z: number) => {
        character.position.x = x;
        character.position.z = z;
        parkWorld.constrainPlayerPosition(character.position);
      },
      setFocusIndex: (index: number) => setFocusIndex(index),
      // Points the view at the watched bird and focuses on it (for playtests).
      aimAtActiveBird: () => {
        const eye = character.position.clone().add(new THREE.Vector3(0, firstPersonEyeHeight, 0));
        const toBird = activeBird.root.position.clone().add(new THREE.Vector3(0, 0.22, 0)).sub(eye);
        playerInput.setLook(
          Math.atan2(toBird.x, toBird.z),
          Math.atan2(toBird.y, Math.hypot(toBird.x, toBird.z)),
        );
        setFocusIndex(closestFocusIndex(toBird.length()));
      },
      getJournal: () => ({ progress: journal.getProgress(), coach: gameElement<HTMLElement>('#coach').textContent }),
    },
  });
  gameElement<HTMLButtonElement>('#journal-toggle').addEventListener('click', () => setJournalOpen(true));
  gameElement<HTMLButtonElement>('#journal-close').addEventListener('click', () => setJournalOpen(false));
  gameElement<HTMLButtonElement>('#finish-session').addEventListener('click', () => setSummaryOpen(true));
  gameElement<HTMLButtonElement>('#journal-finish').addEventListener('click', () => setSummaryOpen(true));
  gameElement<HTMLButtonElement>('#summary-continue').addEventListener('click', () => setSummaryOpen(false));
  gameElement<HTMLButtonElement>('#summary-restart').addEventListener('click', startNewSession);
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Escape') return;
    if (summaryOpen) setSummaryOpen(false);
    else if (journalOpen) setJournalOpen(false);
  });
  renderJournalView();

const animate = () => {
  const rawDelta = clock.getDelta();
  const delta = Math.min(rawDelta, 0.05);
  const time = clock.elapsedTime;
  frameTimeSamples.push(rawDelta * 1000);
  if (frameTimeSamples.length > 180) frameTimeSamples.shift();
  if (time - lastFrameTelemetryAt >= 1 && frameTimeSamples.length >= 30) {
    const sortedFrameTimes = [...frameTimeSamples].sort((a, b) => a - b);
    const meanFrameTime = frameTimeSamples.reduce((sum, value) => sum + value, 0) / frameTimeSamples.length;
    canvas.dataset.frameMsMean = meanFrameTime.toFixed(1);
    canvas.dataset.frameMsP95 = (sortedFrameTimes[Math.floor(sortedFrameTimes.length * 0.95)] ?? 0).toFixed(1);
    canvas.dataset.longFrameRatio = (
      frameTimeSamples.filter((value) => value > 25).length / frameTimeSamples.length
    ).toFixed(3);
    lastFrameTelemetryAt = time;
  }
  updateGameplay(delta, time);
  const wetlandWind = parkWorld.update(time, camera);
  canvas.dataset.windStrength = wetlandWind.strength.toFixed(3);
  canvas.dataset.windSpeed = wetlandWind.speed.toFixed(3);
  canvas.dataset.windDirection = wetlandWind.direction.toArray().map((value) => value.toFixed(3)).join(',');
  const vigilanceResponse = observerPressure > vigilance ? 4.5 : 1.25;
  vigilance = THREE.MathUtils.lerp(vigilance, observerPressure, 1 - Math.exp(-delta * vigilanceResponse));
  const activeState = activeBird.getState();
  const leafActivity = activeBird.speciesId === 'blackbird'
    && (activeState === 'forage' || activeState === 'peck') ? 1 : 0;
  groundLeaves.forEach((leaf, index) => {
    const base = leaf.userData.basePosition as THREE.Vector3;
    const distance = Math.hypot(base.x - activeBird.root.position.x, base.z - activeBird.root.position.z);
    const influence = leafActivity * THREE.MathUtils.clamp(1 - distance / 0.62, 0, 1);
    const flutter = Math.sin(time * 8 + index * 1.7);
    leaf.position.set(base.x + influence * flutter * 0.025, base.y + influence * Math.max(0, flutter) * 0.055, base.z + influence * Math.cos(time * 7 + index) * 0.025);
    leaf.rotation.set(-Math.PI / 2 + influence * flutter * 0.16, influence * Math.cos(time * 6 + index) * 0.12, leaf.userData.baseRotation + influence * flutter * 0.16);
  });
  parkWorld.updateFinalGroundColor(gameRendering.renderer, scene);
  gameRendering.render(() => parkWorld.render(camera));
  requestAnimationFrame(animate);
};
animate();

window.addEventListener('resize', () => {
  gameRendering.resize(window.innerWidth, window.innerHeight, gameplayPixelRatio());
});

declare global {
  interface Window {
    __BIRD_GAME__?: {
      getSnapshot: () => unknown;
      setSpecies: (speciesId: string) => void;
      setObserverPosition: (x: number, z: number) => void;
      setFocusIndex: (index: number) => void;
      aimAtActiveBird: () => void;
      getJournal: () => unknown;
    };
  }
}
