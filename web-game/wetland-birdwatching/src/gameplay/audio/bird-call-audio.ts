import * as THREE from 'three';
import type { HabitatKind } from '../birds/contracts';

type BirdCallKind = 'contact' | 'song' | 'alarm';

type BirdCallSourceUpdate = Readonly<{
  sourceId: string;
  state: string;
  habitatKind: HabitatKind;
}>;

type BirdCallAudioUpdate = Readonly<{
  time: number;
  sources: readonly BirdCallSourceUpdate[];
}>;

type BirdCallAudioSnapshot = Readonly<{
  contextState: AudioContextState;
  loaded: boolean;
  playing: boolean;
  callCount: number;
  lastCallKind?: BirdCallKind;
  nextCallAt?: number;
  activeSpeciesId?: string;
  activeSourceId?: string;
  lastSourceId?: string;
  lastCallDistance?: number;
  activeHabitatKind?: HabitatKind;
  eligibleSourceCount: number;
  eligible: boolean;
  error?: string;
}>;

type BirdCallAudioOptions = Readonly<{
  camera: THREE.Camera;
  blackbirdRoots: readonly Readonly<{ sourceId: string; root: THREE.Object3D }>[];
  seed?: number;
}>;

// Recordings and licenses: src/assets/CREDITS.md
const blackbirdClipUrls = [
  new URL('../../assets/audio/birds/blackbird-song-01.mp3', import.meta.url).href,
  new URL('../../assets/audio/birds/blackbird-song-02.mp3', import.meta.url).href,
  new URL('../../assets/audio/birds/blackbird-song-03.mp3', import.meta.url).href,
  new URL('../../assets/audio/birds/blackbird-song-04.mp3', import.meta.url).href,
  new URL('../../assets/audio/birds/blackbird-song-05.mp3', import.meta.url).href,
  new URL('../../assets/audio/birds/blackbird-song-06.mp3', import.meta.url).href,
  new URL('../../assets/audio/birds/blackbird-contact-01.mp3', import.meta.url).href,
  new URL('../../assets/audio/birds/blackbird-contact-02.mp3', import.meta.url).href,
  new URL('../../assets/audio/birds/blackbird-contact-03.mp3', import.meta.url).href,
  new URL('../../assets/audio/birds/blackbird-contact-04.mp3', import.meta.url).href,
  new URL('../../assets/audio/birds/blackbird-contact-05.mp3', import.meta.url).href,
  new URL('../../assets/audio/birds/blackbird-alarm-01.mp3', import.meta.url).href,
  new URL('../../assets/audio/birds/blackbird-alarm-02.mp3', import.meta.url).href,
  new URL('../../assets/audio/birds/blackbird-alarm-03.mp3', import.meta.url).href,
] as const;

const clipPools: Readonly<Record<BirdCallKind, readonly number[]>> = {
  song: [0, 1, 2, 3, 4, 5],
  contact: [6, 7, 8, 9, 10],
  alarm: [11, 12, 13],
};

const silentStates = new Set(['takeoff', 'flight', 'land']);

const callKindForState = (state: string, habitatKind: HabitatKind): BirdCallKind | undefined => {
  if (habitatKind !== 'perch') return undefined;
  if (silentStates.has(state)) return undefined;
  if (state === 'sing') return 'song';
  if (state === 'alert') return 'alarm';
  if (state === 'perch') return 'contact';
  return undefined;
};

export const createBirdCallAudio = (options: BirdCallAudioOptions) => {
  if (options.blackbirdRoots.length === 0) {
    throw new Error('Bird call audio requires at least one blackbird source');
  }
  const listener = new THREE.AudioListener();
  options.camera.add(listener);

  const emitter = new THREE.PositionalAudio(listener);
  emitter.name = 'blackbird-call-emitter';
  emitter.position.set(0, 0.28, 0);
  emitter.setDistanceModel('inverse');
  emitter.setRefDistance(2.8);
  emitter.setMaxDistance(34);
  emitter.setRolloffFactor(0.78);
  emitter.setVolume(1);
  options.blackbirdRoots[0].root.add(emitter);
  const rootsById = new Map(options.blackbirdRoots.map(({ sourceId, root }) => [sourceId, root]));

  let randomState = (options.seed ?? 73129) >>> 0;
  let buffers: AudioBuffer[] = [];
  let loaded = false;
  let unlocked = false;
  let loadError: string | undefined;
  let activeSpeciesId: string | undefined;
  let activeSourceId: string | undefined;
  let lastSourceId: string | undefined;
  let lastCallDistance: number | undefined;
  let lastClipIndex: number | undefined;
  let activeHabitatKind: HabitatKind | undefined;
  let eligibleSourceCount = 0;
  let globalCooldownUntil = 0;
  let callCount = 0;
  let lastCallKind: BirdCallKind | undefined;
  const schedules = new Map<string, {
    state: string;
    habitatKind: HabitatKind;
    previousEligibilityKey: string;
    nextCallAt?: number;
    cooldownUntil: number;
  }>();

  const random = () => {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return (randomState >>> 0) / 4294967296;
  };

  const loadPromise = Promise.all(blackbirdClipUrls.map((url) => new THREE.AudioLoader().loadAsync(url)))
    .then((loadedBuffers) => {
      buffers = loadedBuffers;
      loaded = true;
    })
    .catch((error: unknown) => {
      loadError = error instanceof Error ? error.message : String(error);
      console.error('Failed to load blackbird calls', error);
    });

  const cooldownFor = (kind: BirdCallKind) => {
    if (kind === 'alarm') return 2.0 + random() * 1.2;
    if (kind === 'song') return 14 + random() * 10;
    return 22 + random() * 18;
  };

  const scheduleInitialCall = (time: number, kind: BirdCallKind) => {
    if (kind === 'alarm') return time + 0.05;
    if (kind === 'song') return time + 0.28;
    return time + 0.8 + random() * 0.8;
  };

  const play = (sourceId: string, kind: BirdCallKind) => {
    const root = rootsById.get(sourceId);
    if (!root) return;
    const pool = clipPools[kind];
    const availableClips = pool.filter((index) => index !== lastClipIndex);
    const choices = availableClips.length > 0 ? availableClips : pool;
    const clipIndex = choices[Math.floor(random() * choices.length)] ?? choices[0];
    const buffer = buffers[clipIndex];
    if (!buffer) return;
    root.add(emitter);
    emitter.position.set(0, 0.28, 0);
    emitter.setBuffer(buffer);
    emitter.setPlaybackRate(kind === 'alarm' ? 1.08 : 0.97 + random() * 0.07);
    emitter.play();
    callCount += 1;
    lastCallKind = kind;
    lastSourceId = sourceId;
    lastClipIndex = clipIndex;
    lastCallDistance = root.getWorldPosition(new THREE.Vector3())
      .distanceTo(options.camera.getWorldPosition(new THREE.Vector3()));
  };

  return {
    async unlock() {
      await loadPromise;
      if (listener.context.state !== 'running') await listener.context.resume();
      unlocked = listener.context.state === 'running';
    },
    update({ time, sources }: BirdCallAudioUpdate) {
      activeSpeciesId = sources.length > 0 ? 'blackbird' : undefined;
      eligibleSourceCount = 0;
      const sourceIds = new Set(sources.map(({ sourceId }) => sourceId));
      schedules.forEach((_schedule, sourceId) => {
        if (!sourceIds.has(sourceId)) schedules.delete(sourceId);
      });
      for (const source of sources) {
        const schedule = schedules.get(source.sourceId) ?? {
          state: source.state,
          habitatKind: source.habitatKind,
          previousEligibilityKey: '',
          cooldownUntil: 0,
        };
        schedules.set(source.sourceId, schedule);
        schedule.state = source.state;
        schedule.habitatKind = source.habitatKind;
        const kind = callKindForState(source.state, source.habitatKind);
        if (kind) eligibleSourceCount += 1;
        const eligibilityKey = `${source.habitatKind}:${source.state}`;
        if (eligibilityKey !== schedule.previousEligibilityKey) {
          schedule.previousEligibilityKey = eligibilityKey;
          const shouldSchedule = kind !== undefined && (kind !== 'contact' || random() < 0.18);
          schedule.nextCallAt = shouldSchedule
            ? Math.max(scheduleInitialCall(time, kind), schedule.cooldownUntil)
            : undefined;
        }
      }
      if (sources.length === 0) {
        if (emitter.isPlaying) emitter.stop();
        activeSourceId = undefined;
        activeHabitatKind = undefined;
        return;
      }
      const due = sources
        .map((source) => {
          const schedule = schedules.get(source.sourceId);
          return { source, schedule, kind: callKindForState(source.state, source.habitatKind) };
        })
        .filter((candidate) => (
          candidate.kind
          && candidate.schedule?.nextCallAt !== undefined
          && candidate.schedule.nextCallAt <= time
        ))
        .sort((left, right) => (
          (left.schedule?.nextCallAt ?? Infinity) - (right.schedule?.nextCallAt ?? Infinity)
          || left.source.sourceId.localeCompare(right.source.sourceId)
        ))[0];
      if (!due || !due.kind || !due.schedule || !loaded || !unlocked
        || emitter.isPlaying || time < globalCooldownUntil) return;
      play(due.source.sourceId, due.kind);
      activeSourceId = due.source.sourceId;
      activeHabitatKind = due.source.habitatKind;
      due.schedule.cooldownUntil = time + cooldownFor(due.kind);
      due.schedule.nextCallAt = undefined;
      globalCooldownUntil = time + (due.kind === 'alarm' ? 1.4 : 6 + random() * 4);
    },
    getSnapshot(): BirdCallAudioSnapshot {
      const nextCallAt = [...schedules.values()].reduce<number | undefined>(
        (earliest, schedule) => schedule.nextCallAt === undefined
          ? earliest
          : Math.min(earliest ?? schedule.nextCallAt, schedule.nextCallAt),
        undefined,
      );
      return {
        contextState: listener.context.state,
        loaded,
        playing: emitter.isPlaying,
        callCount,
        lastCallKind,
        nextCallAt,
        activeSpeciesId,
        activeSourceId,
        lastSourceId,
        lastCallDistance,
        activeHabitatKind,
        eligibleSourceCount,
        eligible: eligibleSourceCount > 0,
        error: loadError,
      };
    },
  };
};
