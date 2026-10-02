import * as THREE from 'three';

export type EnvironmentAudioLocation = 'wetland-path' | 'wetland-shore' | 'wetland-meadow';
type FootstepSurface = 'path' | 'grass';

export type EnvironmentAudioUpdate = Readonly<{
  time: number;
  delta: number;
  movementSpeed: number;
  moving: boolean;
  location: EnvironmentAudioLocation;
}>;

export type EnvironmentAudioSnapshot = Readonly<{
  contextState: AudioContextState;
  loaded: boolean;
  unlocked: boolean;
  footstepCount: number;
  lastFootstepSurface?: FootstepSurface;
  waterEventCount: number;
  lastWaterClip?: number;
  location: EnvironmentAudioLocation;
  error?: string;
}>;

const pathFootstepUrls = [
  new URL('../../assets/audio/environment/footstep-stone-01.mp3', import.meta.url).href,
  new URL('../../assets/audio/environment/footstep-stone-02.mp3', import.meta.url).href,
  new URL('../../assets/audio/environment/footstep-stone-03.mp3', import.meta.url).href,
] as const;

const grassFootstepUrls = [
  new URL('../../assets/audio/environment/footstep-grass-01.mp3', import.meta.url).href,
  new URL('../../assets/audio/environment/footstep-grass-02.mp3', import.meta.url).href,
  new URL('../../assets/audio/environment/footstep-grass-03.mp3', import.meta.url).href,
] as const;

const shoreWaveUrls = [
  new URL('../../assets/audio/environment/wave-01.mp3', import.meta.url).href,
  new URL('../../assets/audio/environment/wave-02.mp3', import.meta.url).href,
  new URL('../../assets/audio/environment/wave-03.mp3', import.meta.url).href,
  new URL('../../assets/audio/environment/wave-04.mp3', import.meta.url).href,
] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const createEnvironmentAudio = () => {
  const context = THREE.AudioContext.getContext();
  const master = context.createGain();
  master.gain.value = 0.95;
  master.connect(context.destination);

  let randomState = 0x7a31c9e5;
  let pathBuffers: AudioBuffer[] = [];
  let grassBuffers: AudioBuffer[] = [];
  let waveBuffers: AudioBuffer[] = [];
  let loaded = false;
  let unlocked = context.state === 'running';
  let loadError: string | undefined;
  let nextStepAt = 0;
  let nextWaterAt = Number.POSITIVE_INFINITY;
  let footstepCount = 0;
  let waterEventCount = 0;
  let currentLocation: EnvironmentAudioLocation = 'wetland-meadow';
  let lastFootstepSurface: FootstepSurface | undefined;
  let lastPathClip: number | undefined;
  let lastGrassClip: number | undefined;
  let lastWaterClip: number | undefined;

  const random = () => {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return (randomState >>> 0) / 4294967296;
  };
  const pickClip = (length: number, previous: number | undefined) => {
    if (length <= 1) return 0;
    let index = Math.floor(random() * length);
    if (index === previous) index = (index + 1 + Math.floor(random() * (length - 1))) % length;
    return index;
  };

  const loader = new THREE.AudioLoader();
  const loadPromise = Promise.all([
    Promise.all(pathFootstepUrls.map((url) => loader.loadAsync(url))),
    Promise.all(grassFootstepUrls.map((url) => loader.loadAsync(url))),
    Promise.all(shoreWaveUrls.map((url) => loader.loadAsync(url))),
  ]).then(([loadedPath, loadedGrass, loadedWaves]) => {
    pathBuffers = loadedPath;
    grassBuffers = loadedGrass;
    waveBuffers = loadedWaves;
    loaded = true;
  }).catch((error: unknown) => {
    loadError = error instanceof Error ? error.message : String(error);
    console.error('Failed to load environment audio', error);
  });

  const playFootstep = (time: number, speed: number, surface: FootstepSurface) => {
    if (!loaded || !unlocked || context.state !== 'running') return;
    const buffers = surface === 'path' ? pathBuffers : grassBuffers;
    const previous = surface === 'path' ? lastPathClip : lastGrassClip;
    const clipIndex = pickClip(buffers.length, previous);
    const buffer = buffers[clipIndex];
    if (!buffer) return;
    if (surface === 'path') lastPathClip = clipIndex;
    else lastGrassClip = clipIndex;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const intensity = clamp((speed - 0.2) / 3.15, 0.26, 1);
    source.buffer = buffer;
    source.playbackRate.value = 0.96 + random() * 0.08;
    gain.gain.value = (surface === 'path' ? 0.36 : 0.46) + intensity * 0.12;
    source.connect(gain);
    gain.connect(master);
    source.start();
    footstepCount += 1;
    lastFootstepSurface = surface;
    nextStepAt = time + clamp(0.58 - speed * 0.10, 0.26, 0.55);
  };

  const playShoreWave = (time: number) => {
    if (!loaded || !unlocked || context.state !== 'running') return;
    const clipIndex = pickClip(waveBuffers.length, lastWaterClip);
    const buffer = waveBuffers[clipIndex];
    if (!buffer) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    const fade = Math.min(0.28, buffer.duration * 0.18);
    source.buffer = buffer;
    source.playbackRate.value = 0.96 + random() * 0.07;
    panner.pan.value = (random() - 0.5) * 0.6;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.24, context.currentTime + fade);
    gain.gain.setValueAtTime(0.24, Math.max(context.currentTime + fade, context.currentTime + buffer.duration - fade));
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + buffer.duration);
    source.connect(panner);
    panner.connect(gain);
    gain.connect(master);
    source.start();
    lastWaterClip = clipIndex;
    waterEventCount += 1;
    nextWaterAt = time + 2.7 + random() * 2.8;
  };

  return {
    async unlock() {
      await loadPromise;
      if (context.state !== 'running') await context.resume();
      unlocked = context.state === 'running';
    },
    update({ time, movementSpeed, moving, location }: EnvironmentAudioUpdate) {
      const enteredShore = currentLocation !== 'wetland-shore' && location === 'wetland-shore';
      currentLocation = location;
      if (enteredShore) nextWaterAt = Math.min(nextWaterAt, time + 0.45);
      if (location !== 'wetland-shore') nextWaterAt = Number.POSITIVE_INFINITY;
      else if (time >= nextWaterAt) playShoreWave(time);
      if (!moving || movementSpeed < 0.25) {
        nextStepAt = Math.max(nextStepAt, time + 0.08);
        return;
      }
      if (time >= nextStepAt) playFootstep(time, movementSpeed, location === 'wetland-path' ? 'path' : 'grass');
    },
    getSnapshot(): EnvironmentAudioSnapshot {
      return {
        contextState: context.state,
        loaded,
        unlocked,
        footstepCount,
        lastFootstepSurface,
        waterEventCount,
        lastWaterClip,
        location: currentLocation,
        error: loadError,
      };
    },
  };
};
