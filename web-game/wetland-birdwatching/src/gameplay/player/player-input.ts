type PlayerControlFrame = Readonly<{
  pointerActive: boolean;
  moveForward: number;
  moveRight: number;
  running: boolean;
  binocularRaised: boolean;
  cameraYaw: number;
  cameraPitch: number;
  cameraDistance: number;
  touchMode: boolean;
}>;

type PlayerInputElements = Readonly<{
  focusRange: HTMLInputElement;
  touchRoot: HTMLElement;
  movePad: HTMLElement;
  moveKnob: HTMLElement;
  binocularButton: HTMLButtonElement;
  captureButton: HTMLButtonElement;
}>;

type PlayerInputOptions = Readonly<{
  canvas: HTMLCanvasElement;
  elements: PlayerInputElements;
  isBlocked: () => boolean;
  onJournalToggle: () => void;
  onCapture: () => void;
  onFocusStep: (direction: number) => void;
  onFocusSet: (index: number) => void;
  onBinocularChange: (raised: boolean) => void;
  onControlStateChange: (active: boolean, gameStarted: boolean) => void;
}>;

interface PlayerInputController {
  getFrame(): PlayerControlFrame;
  start(): void;
  setBinocularRaised(raised: boolean): void;
  setLook(yaw: number, pitch: number): void;
  isMouseLookActive(): boolean;
  dispose(): void;
}

const mouseSensitivityX = 0.00225;
const mouseSensitivityY = 0.0018;
const binocularMouseSensitivityScale = 0.38;
// Pixels a press may travel and still count as a click rather than a drag.
const clickMoveTolerance = 5;
const touchSensitivityX = 0.0042;
const touchSensitivityY = 0.0036;
const minimumPitch = -0.58;
const maximumPitch = 0.74;
const minimumCameraDistance = 2.8;
const maximumCameraDistance = 8.5;
const cameraZoomStep = 0.45;
const maximumUnlockedMouseDelta = 48;

const clamp = (value: number, minimum: number, maximum: number) => Math.max(
  minimum,
  Math.min(maximum, value),
);

export const createPlayerInputController = (
  options: PlayerInputOptions,
): PlayerInputController => {
  const movementKeys = new Set<string>();
  const movementKeyTapUntil = new Map<string, number>();
  const lookPointers = new Map<number, { x: number; y: number }>();
  const touchMode = window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(max-width: 760px)').matches
    || window.matchMedia('(max-width: 900px) and (max-height: 520px)').matches;
  let gameStarted = false;
  let binocularRaised = false;
  let desktopLookHeld = false;
  let desktopLookEnabled = false;
  let desktopLookPointer: { x: number; y: number } | undefined;
  // Through the binoculars a left press either drags to aim or, if released
  // without moving, takes a photo.
  let pendingCapture: { x: number; y: number } | undefined;
  // Set once the browser grants Pointer Lock. Until then (or where it is
  // refused, e.g. a sandboxed iframe) holding the left button drags to look.
  let pointerLockGranted = false;
  let cameraYaw = Math.PI;
  let cameraPitch = -0.08;
  let cameraDistance = touchMode ? 6.1 : 4.9;
  let touchMoveForward = 0;
  let touchMoveRight = 0;
  let joystickPointerId: number | undefined;
  let focusPointerId: number | undefined;
  let pinchDistance: number | undefined;

  options.elements.touchRoot.classList.toggle('touch-mode', touchMode);
  options.elements.touchRoot.setAttribute('aria-hidden', 'true');

  const setBinocularRaised = (raised: boolean) => {
    if (binocularRaised === raised) return;
    binocularRaised = raised;
    options.elements.binocularButton.classList.toggle('active', raised);
    options.elements.binocularButton.setAttribute('aria-pressed', String(raised));
    options.elements.captureButton.disabled = !raised;
    options.onBinocularChange(raised);
  };

  const setCameraDistance = (distance: number) => {
    cameraDistance = clamp(distance, minimumCameraDistance, maximumCameraDistance);
  };

  const isPointerLocked = () => document.pointerLockElement === options.canvas;

  // Free mouse-look: the cursor is captured and every mouse move turns the
  // view. Esc releases it; the next click on the scene captures it again.
  const requestMouseLook = () => {
    if (touchMode || isPointerLocked()) return;
    try {
      void Promise.resolve(options.canvas.requestPointerLock()).catch(() => undefined);
    } catch {
      // Pointer Lock unavailable: drag-to-look still works.
    }
  };

  const handlePointerLockChange = () => {
    if (touchMode) return;
    const active = isPointerLocked();
    if (active) pointerLockGranted = true;
    desktopLookEnabled = active || desktopLookHeld;
    options.canvas.dataset.mouseLook = String(desktopLookEnabled);
    options.onControlStateChange(desktopLookEnabled, gameStarted);
  };

  const handleDesktopPointerMove = (event: PointerEvent) => {
    if (touchMode || !gameStarted || options.isBlocked()) return;
    const pointerLocked = document.pointerLockElement === options.canvas;
    if (!pointerLocked && !desktopLookEnabled) return;
    if (pendingCapture && Math.hypot(event.clientX - pendingCapture.x, event.clientY - pendingCapture.y) > clickMoveTolerance) {
      pendingCapture = undefined;
    }
    const sensitivityScale = binocularRaised ? binocularMouseSensitivityScale : 1;
    const unlockedDeltaX = desktopLookPointer
      ? event.clientX - desktopLookPointer.x
      : 0;
    const unlockedDeltaY = desktopLookPointer
      ? event.clientY - desktopLookPointer.y
      : 0;
    if (!pointerLocked) desktopLookPointer = { x: event.clientX, y: event.clientY };
    const movementX = pointerLocked
      ? event.movementX
      : clamp(unlockedDeltaX, -maximumUnlockedMouseDelta, maximumUnlockedMouseDelta);
    const movementY = pointerLocked
      ? event.movementY
      : clamp(unlockedDeltaY, -maximumUnlockedMouseDelta, maximumUnlockedMouseDelta);
    cameraYaw -= movementX * mouseSensitivityX * sensitivityScale;
    cameraPitch = clamp(
      cameraPitch - movementY * mouseSensitivityY * sensitivityScale,
      minimumPitch,
      maximumPitch,
    );
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if ((event.code === 'KeyJ' || event.code === 'KeyP') && !event.repeat) {
      options.onJournalToggle();
      return;
    }
    if (event.code === 'KeyB' && !event.repeat && gameStarted && !options.isBlocked()) {
      setBinocularRaised(!binocularRaised);
      return;
    }
    movementKeys.add(event.code);
    if (event.code === 'KeyW' || event.code === 'KeyA'
      || event.code === 'KeyS' || event.code === 'KeyD') {
      movementKeyTapUntil.set(event.code, performance.now() + 160);
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    movementKeys.delete(event.code);
  };

  const resetJoystick = () => {
    joystickPointerId = undefined;
    touchMoveForward = 0;
    touchMoveRight = 0;
    options.elements.moveKnob.style.transform = 'translate(-50%, -50%)';
    options.elements.movePad.classList.remove('active');
  };

  const handleBlur = () => {
    movementKeys.clear();
    movementKeyTapUntil.clear();
    resetJoystick();
    lookPointers.clear();
    pinchDistance = undefined;
    desktopLookHeld = false;
    desktopLookPointer = undefined;
    desktopLookEnabled = false;
    options.canvas.dataset.mouseLook = 'false';
  };

  const handleContextMenu = (event: MouseEvent) => event.preventDefault();

  const setDesktopLookHeld = (held: boolean) => {
    if (touchMode || desktopLookHeld === held) return;
    desktopLookHeld = held;
    const enabled = held || isPointerLocked();
    desktopLookEnabled = enabled;
    options.canvas.dataset.mouseLook = String(enabled);
    options.onControlStateChange(enabled, gameStarted);
  };

  const handleDesktopPointerDown = (event: PointerEvent) => {
    // Binoculars and capture are gameplay actions, so they must remain
    // available when the browser refuses Pointer Lock. Pointer Lock only
    // gates relative mouse-look, not the right-click interaction itself.
    if (touchMode || !gameStarted || options.isBlocked()) return;
    if (isPointerLocked()) {
      if (event.button === 2) setBinocularRaised(!binocularRaised);
      if (event.button === 0 && binocularRaised) options.onCapture();
      return;
    }
    if (event.button === 2) setBinocularRaised(!binocularRaised);
    if (event.button !== 0) return;
    // Once Pointer Lock has worked, a click on the free cursor only recaptures
    // the mouse, so it never fires the shutter by accident.
    pendingCapture = binocularRaised && !pointerLockGranted ? { x: event.clientX, y: event.clientY } : undefined;
    desktopLookPointer = { x: event.clientX, y: event.clientY };
    setDesktopLookHeld(true);
    requestMouseLook();
  };

  const handleDesktopPointerUp = (event: PointerEvent) => {
    if (event.button === 0) {
      const capture = pendingCapture !== undefined && binocularRaised && !options.isBlocked();
      pendingCapture = undefined;
      desktopLookPointer = undefined;
      setDesktopLookHeld(false);
      if (capture) options.onCapture();
    }
  };

  const handleWheel = (event: WheelEvent) => {
    if (!gameStarted || options.isBlocked()) return;
    event.preventDefault();
    const direction = Math.sign(event.deltaY);
    if (binocularRaised) {
      options.onFocusStep(direction < 0 ? 1 : -1);
      return;
    }
    setCameraDistance(cameraDistance + direction * cameraZoomStep);
  };

  const updateJoystick = (event: PointerEvent) => {
    const rect = options.elements.movePad.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.34);
    let x = event.clientX - (rect.left + rect.width * 0.5);
    let y = event.clientY - (rect.top + rect.height * 0.5);
    const length = Math.hypot(x, y);
    if (length > radius) {
      x *= radius / length;
      y *= radius / length;
    }
    touchMoveRight = x / radius;
    touchMoveForward = -y / radius;
    options.elements.moveKnob.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  };

  const handleJoystickDown = (event: PointerEvent) => {
    if (!touchMode || !gameStarted || options.isBlocked()) return;
    event.preventDefault();
    joystickPointerId = event.pointerId;
    options.elements.movePad.setPointerCapture(event.pointerId);
    options.elements.movePad.classList.add('active');
    updateJoystick(event);
  };

  const handleJoystickMove = (event: PointerEvent) => {
    if (event.pointerId !== joystickPointerId) return;
    event.preventDefault();
    updateJoystick(event);
  };

  const handleJoystickEnd = (event: PointerEvent) => {
    if (event.pointerId === joystickPointerId) resetJoystick();
  };

  const distanceBetweenLookPointers = () => {
    const points = [...lookPointers.values()];
    if (points.length < 2) return undefined;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const handleLookDown = (event: PointerEvent) => {
    if (!touchMode || !gameStarted || options.isBlocked() || event.button !== 0) return;
    event.preventDefault();
    options.canvas.setPointerCapture(event.pointerId);
    lookPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinchDistance = distanceBetweenLookPointers();
  };

  const handleLookMove = (event: PointerEvent) => {
    const previous = lookPointers.get(event.pointerId);
    if (!previous || options.isBlocked()) return;
    event.preventDefault();
    const deltaX = event.clientX - previous.x;
    const deltaY = event.clientY - previous.y;
    lookPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (lookPointers.size >= 2 && !binocularRaised) {
      const nextPinchDistance = distanceBetweenLookPointers();
      if (nextPinchDistance !== undefined && pinchDistance !== undefined) {
        setCameraDistance(cameraDistance - (nextPinchDistance - pinchDistance) * 0.018);
      }
      pinchDistance = nextPinchDistance;
      return;
    }
    if (lookPointers.size === 1) {
      cameraYaw -= deltaX * touchSensitivityX;
      cameraPitch = clamp(cameraPitch - deltaY * touchSensitivityY, minimumPitch, maximumPitch);
    }
  };

  const handleLookEnd = (event: PointerEvent) => {
    lookPointers.delete(event.pointerId);
    pinchDistance = distanceBetweenLookPointers();
  };

  const handleBinocularButton = () => {
    if (!gameStarted || options.isBlocked()) return;
    setBinocularRaised(!binocularRaised);
  };

  const handleCaptureButton = () => {
    if (!gameStarted || options.isBlocked() || !binocularRaised) return;
    options.onCapture();
  };

  const handleFocusInput = () => {
    options.onFocusSet(Number(options.elements.focusRange.value));
  };

  const updateFocusFromPointer = (event: PointerEvent) => {
    const rect = options.elements.focusRange.getBoundingClientRect();
    const ratio = clamp((rect.bottom - event.clientY) / Math.max(1, rect.height), 0, 1);
    const index = Math.round(ratio * Number(options.elements.focusRange.max));
    options.elements.focusRange.value = String(index);
    options.onFocusSet(index);
  };

  const handleFocusPointerDown = (event: PointerEvent) => {
    if (!touchMode || !gameStarted || options.isBlocked() || !binocularRaised) return;
    event.preventDefault();
    focusPointerId = event.pointerId;
    options.elements.focusRange.setPointerCapture(event.pointerId);
    updateFocusFromPointer(event);
  };

  const handleFocusPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== focusPointerId) return;
    event.preventDefault();
    updateFocusFromPointer(event);
  };

  const handleFocusPointerEnd = (event: PointerEvent) => {
    if (event.pointerId === focusPointerId) focusPointerId = undefined;
  };

  document.addEventListener('pointerlockchange', handlePointerLockChange);
  document.addEventListener('pointermove', handleDesktopPointerMove);
  document.addEventListener('pointerup', handleDesktopPointerUp);
  document.addEventListener('pointercancel', handleDesktopPointerUp);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleBlur);
  options.canvas.addEventListener('contextmenu', handleContextMenu);
  options.canvas.addEventListener('pointerdown', handleDesktopPointerDown);
  options.canvas.addEventListener('wheel', handleWheel, { passive: false });
  options.canvas.addEventListener('pointerdown', handleLookDown);
  options.canvas.addEventListener('pointermove', handleLookMove);
  options.canvas.addEventListener('pointerup', handleLookEnd);
  options.canvas.addEventListener('pointercancel', handleLookEnd);
  options.elements.movePad.addEventListener('pointerdown', handleJoystickDown);
  options.elements.movePad.addEventListener('pointermove', handleJoystickMove);
  options.elements.movePad.addEventListener('pointerup', handleJoystickEnd);
  options.elements.movePad.addEventListener('pointercancel', handleJoystickEnd);
  options.elements.binocularButton.addEventListener('click', handleBinocularButton);
  options.elements.captureButton.addEventListener('click', handleCaptureButton);
  options.elements.focusRange.addEventListener('input', handleFocusInput);
  options.elements.focusRange.addEventListener('pointerdown', handleFocusPointerDown);
  options.elements.focusRange.addEventListener('pointermove', handleFocusPointerMove);
  options.elements.focusRange.addEventListener('pointerup', handleFocusPointerEnd);
  options.elements.focusRange.addEventListener('pointercancel', handleFocusPointerEnd);

  return {
    getFrame() {
      const controlsActive = !options.isBlocked() && (touchMode
        ? gameStarted
        : gameStarted);
      const pointerActive = !options.isBlocked() && (touchMode
        ? gameStarted
        : desktopLookEnabled);
      const keyActive = (code: string) => movementKeys.has(code)
        || (movementKeyTapUntil.get(code) ?? 0) > performance.now();
      const keyboardForward = Number(keyActive('KeyW')) - Number(keyActive('KeyS'));
      const keyboardRight = Number(keyActive('KeyD')) - Number(keyActive('KeyA'));
      const touchMagnitude = Math.hypot(touchMoveForward, touchMoveRight);
      return {
        pointerActive,
        moveForward: controlsActive ? clamp(keyboardForward + touchMoveForward, -1, 1) : 0,
        moveRight: controlsActive ? clamp(keyboardRight + touchMoveRight, -1, 1) : 0,
        running: movementKeys.has('ShiftLeft') || movementKeys.has('ShiftRight') || touchMagnitude > 0.88,
        binocularRaised,
        cameraYaw,
        cameraPitch,
        cameraDistance,
        touchMode,
      };
    },
    setLook(yaw: number, pitch: number) {
      cameraYaw = yaw;
      cameraPitch = Math.min(maximumPitch, Math.max(minimumPitch, pitch));
    },
    start() {
      gameStarted = true;
      options.elements.touchRoot.classList.toggle('active', touchMode);
      options.elements.touchRoot.setAttribute('aria-hidden', String(!touchMode));
      options.onControlStateChange(touchMode, true);
      options.canvas.dataset.mouseLook = String(touchMode);
      requestMouseLook();
    },
    isMouseLookActive: isPointerLocked,
    setBinocularRaised,
    dispose() {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('pointermove', handleDesktopPointerMove);
      document.removeEventListener('pointerup', handleDesktopPointerUp);
      document.removeEventListener('pointercancel', handleDesktopPointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      options.canvas.removeEventListener('contextmenu', handleContextMenu);
      options.canvas.removeEventListener('pointerdown', handleDesktopPointerDown);
      options.canvas.removeEventListener('wheel', handleWheel);
      options.canvas.removeEventListener('pointerdown', handleLookDown);
      options.canvas.removeEventListener('pointermove', handleLookMove);
      options.canvas.removeEventListener('pointerup', handleLookEnd);
      options.canvas.removeEventListener('pointercancel', handleLookEnd);
      options.elements.movePad.removeEventListener('pointerdown', handleJoystickDown);
      options.elements.movePad.removeEventListener('pointermove', handleJoystickMove);
      options.elements.movePad.removeEventListener('pointerup', handleJoystickEnd);
      options.elements.movePad.removeEventListener('pointercancel', handleJoystickEnd);
      options.elements.binocularButton.removeEventListener('click', handleBinocularButton);
      options.elements.captureButton.removeEventListener('click', handleCaptureButton);
      options.elements.focusRange.removeEventListener('input', handleFocusInput);
      options.elements.focusRange.removeEventListener('pointerdown', handleFocusPointerDown);
      options.elements.focusRange.removeEventListener('pointermove', handleFocusPointerMove);
      options.elements.focusRange.removeEventListener('pointerup', handleFocusPointerEnd);
      options.elements.focusRange.removeEventListener('pointercancel', handleFocusPointerEnd);
      movementKeys.clear();
      movementKeyTapUntil.clear();
      lookPointers.clear();
      desktopLookPointer = undefined;
      resetJoystick();
    },
  };
};
