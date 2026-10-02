import type {
  BirdDecision,
  BirdDecisionContext,
  BirdSpeciesPolicy,
  ObserverPressureRules,
} from '../contracts';

export type BlackbirdState =
  | 'idle'
  | 'listen'
  | 'forage'
  | 'peck'
  | 'hop'
  | 'alert'
  | 'takeoff'
  | 'flight'
  | 'land'
  | 'perch'
  | 'sing'
  | 'preen';

export const blackbirdPressureRules: ObserverPressureRules = {
  pressureRadius: 11.5,
  pressureFalloff: 9.5,
  rearVisualFloor: 0.42,
  distancePressureBase: 0.26,
  distancePressureVisualWeight: 0.36,
  approachSpeedReference: 3.35,
  approachPressureWeight: 0.28,
  raisedAttentionPressure: 0.16,
  ambientAttentionPressure: 0.02,
};

export const blackbirdEncounterRules = {
  alertPressure: 0.50,
  flushPressure: 0.82,
  hardFlushDistance: 2.4,
  rushFlushDistance: 4.8,
  rushApproachSpeed: 2.4,
} as const;

export const blackbirdStateLabels: Record<BlackbirdState, string> = {
  idle: 'Resting on the ground', listen: 'Listening', forage: 'Foraging', peck: 'Pecking', hop: 'Hopping',
  alert: 'Alert', takeoff: 'Taking off', flight: 'In flight', land: 'Landing',
  perch: 'Perched', sing: 'Singing', preen: 'Preening',
};

export const blackbirdStateDurationRanges: Record<BlackbirdState, readonly [number, number]> = {
  idle: [1.0, 2.1], listen: [0.45, 0.8], forage: [1.2, 2.2], peck: [0.32, 0.55],
  hop: [0.28, 0.42], alert: [0.38, 0.62], takeoff: [0.28, 0.42], flight: [1.05, 1.45],
  land: [0.3, 0.48], perch: [1.2, 2.5], sing: [1.8, 3.0], preen: [1.0, 1.8],
};

const decision = (state: BlackbirdState): BirdDecision<BlackbirdState> => ({ state });

const escapeToCover = (preferDifferentTree: boolean): BirdDecision<BlackbirdState> => ({
  state: 'takeoff',
  relocation: {
    kind: 'perch',
    level: 'high',
    capability: 'transfer',
    avoidObserver: true,
    preferHigher: true,
    preferCover: true,
    preferDifferentTree,
    minClearance: 0.34,
    minObserverDistance: 4.6,
    minObserverDistanceGain: 1.1,
    maxArrivalPressure: 0.48,
    minPressureReduction: 0.14,
    settleDuration: 1.35,
    maxDistance: 18,
  },
});

const moveToSongPost = (): BirdDecision<BlackbirdState> => ({
  state: 'takeoff',
  relocation: {
    kind: 'perch',
    level: 'high',
    capability: 'sing',
    preferHigher: true,
    minClearance: 0.34,
    minObserverDistance: 5.5,
    maxArrivalPressure: 0.34,
    settleDuration: 1.0,
    maxDistance: 14,
  },
});

export const blackbirdPolicy: BirdSpeciesPolicy<BlackbirdState> = {
  speciesId: 'blackbird',
  stateDurationRanges: blackbirdStateDurationRanges,
  stateLabels: blackbirdStateLabels,

  chooseNext(context) {
    const { currentState, habitatKind, habitatLevel, perception } = context;
    const forageDrive = context.drives.forage ?? 0;
    if (currentState === 'takeoff') return decision('flight');
    if (currentState === 'flight') return decision('land');
    if (currentState === 'land') return decision(habitatKind === 'perch' ? 'perch' : 'listen');
    if (currentState === 'alert') {
      return perception.observerPressure >= 0.48
        ? escapeToCover(perception.observerPressure >= 0.68)
        : decision('listen');
    }
    if (perception.observerPressure >= 0.66) return decision('alert');
    if (habitatKind === 'perch') {
      const random = context.random();
      const songChance = currentState === 'sing' ? 0 : habitatLevel === 'high' ? 0.28 : 0.08;
      if (random < songChance) return decision('sing');
      if (random < songChance + 0.18) return decision('preen');
      if (random < songChance + 0.38) return decision('perch');
      if (forageDrive > 0.56 && perception.observerPressure < 0.22) {
        return {
          state: 'takeoff',
          relocation: {
            kind: 'ground',
            capability: 'forage',
            avoidObserver: true,
            allowGroundReturn: true,
            minObserverDistance: 5.2,
            maxArrivalPressure: 0.34,
            minClearance: 0.34,
            settleDuration: 0.9,
            maxDistance: 13,
          },
        };
      }
      return decision('perch');
    }
    if (perception.observerPressure >= blackbirdEncounterRules.alertPressure) return decision('alert');
    if (perception.observerPressure > 0.38
      && context.random() < perception.observerPressure * 0.34) return decision('alert');
    const random = context.random();
    if (perception.observerPressure < 0.20 && forageDrive <= 0.70 && random < 0.08) {
      return moveToSongPost();
    }
    if (forageDrive > 0.62 && random < 0.42) return decision('forage');
    if (currentState === 'forage' && random < 0.58) return decision('peck');
    if (random < 0.34) return decision('listen');
    if (random < 0.60) return decision('hop');
    if (random < 0.72) return decision('preen');
    if (random < 0.90) return decision('forage');
    return decision('idle');
  },

  interrupt(context) {
    const { currentState, perception } = context;
    if (currentState === 'takeoff' || currentState === 'flight' || currentState === 'land') return null;
    const hardFlush = perception.observerDistance <= blackbirdEncounterRules.hardFlushDistance;
    const rushed = perception.observerDistance <= blackbirdEncounterRules.rushFlushDistance
      && perception.observerApproachSpeed >= blackbirdEncounterRules.rushApproachSpeed;
    if (hardFlush || rushed || perception.observerPressure >= blackbirdEncounterRules.flushPressure) {
      return escapeToCover(hardFlush || rushed);
    }
    if (perception.observerPressure >= blackbirdEncounterRules.alertPressure && currentState !== 'alert') {
      return decision('alert');
    }
    return null;
  },
};
