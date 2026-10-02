import * as THREE from 'three';
import { alertnessRules } from '../gameplay/journal/journal-config';
import { shotProblemText, type ShotCheck, type ShotMetrics } from '../gameplay/journal/photo-rating';

const walkingHints = '<kbd>WASD</kbd> Walk · <kbd>Shift</kbd> Run · <kbd>B</kbd> Binoculars · <kbd>J</kbd> Journal · <kbd>V</kbd> View';
const binocularHints = '<kbd>Mouse</kbd> Aim · <kbd>Wheel</kbd> Focus · <kbd>Click</kbd> Photo · <kbd>B</kbd> Lower binoculars';
const lockedHint = ' · <kbd>Esc</kbd> Free cursor';
const unlockedHint = '<kbd>Click</kbd> the scene to look with the mouse · ';
const callCueSeconds = 2.6;

const requireElement = <T extends HTMLElement>(selector: string) => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing HUD element: ${selector}`);
  return element;
};

// The in-play HUD that explains the hidden systems: the viewfinder ring, the
// watched bird's alertness, a marker toward the latest birdsong, and the
// desktop control hints.
export const createPlayHud = () => {
  const shotRing = requireElement('#shot-ring');
  const shotHint = requireElement('#shot-hint');
  const alertness = requireElement('#alertness');
  const alertnessLabel = requireElement('#alertness-label');
  const alertnessFill = requireElement('#alertness-fill');
  const callCue = requireElement('#call-cue');
  const controlHints = requireElement('#control-hints');
  const projected = new THREE.Vector3();
  let lastCallCount = 0;
  let callSourceId: string | undefined;
  let callUntil = 0;
  let renderedHints = '';

  return {
    // The ring and hint use the same check that judges the photo.
    renderViewfinder: (shot: ShotMetrics, check: ShotCheck, touchMode: boolean) => {
      shotRing.dataset.state = check.identified ? 'ready' : check.centered ? 'partial' : 'idle';
      const text = check.identified
        ? `${Math.round(shot.distance)} m · Ready, ${touchMode ? 'tap Photo' : 'click to take a photo'}`
        : check.problem === 'not-in-frame'
          ? shotProblemText['not-in-frame']
          : `${Math.round(shot.distance)} m · ${shotProblemText[check.problem ?? 'out-of-focus']}`
            + (check.problem === 'out-of-focus' ? (touchMode ? ', drag the slider' : ', scroll to focus') : '');
      if (shotHint.textContent !== text) shotHint.textContent = text;
    },

    // `vigilance` is the smoothed observer pressure the bird AI reacts to.
    renderAlertness: (visible: boolean, birdLabel: string, vigilance: number) => {
      alertness.classList.toggle('visible', visible);
      if (!visible) return;
      const level = vigilance >= alertnessRules.fleeing ? 'fleeing' : vigilance >= alertnessRules.wary ? 'wary' : 'calm';
      alertness.dataset.level = level;
      const text = `${birdLabel}: ${level === 'fleeing' ? 'About to flee' : level === 'wary' ? 'Wary' : 'Calm'}`;
      if (alertnessLabel.textContent !== text) alertnessLabel.textContent = text;
      alertnessFill.style.transform = `scaleX(${Math.max(0.04, Math.min(1, vigilance)).toFixed(3)})`;
    },

    // Remembers which bird sang last so the marker can point at it for a moment.
    noteBirdCalls: (callCount: number, sourceId: string | undefined, time: number) => {
      if (callCount <= lastCallCount) return;
      lastCallCount = callCount;
      callSourceId = sourceId;
      callUntil = time + callCueSeconds;
    },

    // Shows the ♪ marker over the calling bird, clamped to the screen edge
    // when it is off-screen. Returns whether the marker is visible.
    renderCallCue: (
      allowed: boolean,
      findRoot: (sourceId: string) => THREE.Object3D | undefined,
      camera: THREE.Camera,
      time: number,
    ) => {
      const root = callSourceId ? findRoot(callSourceId) : undefined;
      const visible = allowed && root !== undefined && time < callUntil;
      callCue.classList.toggle('visible', visible);
      if (!visible || !root) return false;
      projected.copy(root.position).add(new THREE.Vector3(0, 0.4, 0)).project(camera);
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
      callCue.style.opacity = Math.min(1, (callUntil - time) / 0.6).toFixed(2);
      return true;
    },

    renderControlHints: (visible: boolean, mouseLook: boolean, binocularRaised: boolean) => {
      const hints = visible
        ? (mouseLook ? '' : unlockedHint) + (binocularRaised ? binocularHints : walkingHints) + (mouseLook ? lockedHint : '')
        : '';
      if (hints === renderedHints) return;
      renderedHints = hints;
      controlHints.innerHTML = hints;
    },
  };
};
