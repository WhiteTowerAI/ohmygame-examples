import {
  grayMagpieStateDurationRanges,
  grayMagpieStateLabels,
  type GrayMagpieState,
} from '../../../art/birds/gray-magpie-behavior';
import type { BirdDecision, BirdSpeciesPolicy, ObserverPressureRules } from '../contracts';

export { type GrayMagpieState } from '../../../art/birds/gray-magpie-behavior';

export const grayMagpiePressureRules: ObserverPressureRules = {
  pressureRadius: 13.5,
  pressureFalloff: 11,
  rearVisualFloor: 0.58,
  distancePressureBase: 0.22,
  distancePressureVisualWeight: 0.32,
  approachSpeedReference: 3.35,
  approachPressureWeight: 0.22,
  raisedAttentionPressure: 0.13,
  ambientAttentionPressure: 0.025,
};

const decision = (state: GrayMagpieState): BirdDecision<GrayMagpieState> => ({ state });

export const grayMagpiePolicy: BirdSpeciesPolicy<GrayMagpieState> = {
  speciesId: 'gray-magpie',
  stateDurationRanges: grayMagpieStateDurationRanges,
  stateLabels: grayMagpieStateLabels,

  chooseNext(context) {
    const { currentState, habitatKind, habitatLevel, perception } = context;
    if (currentState === 'takeoff') return decision('flight');
    if (currentState === 'flight') return decision('land');
    if (currentState === 'land') return decision('perch');
    if (currentState === 'alarm') {
      if (perception.observerPressure > 0.62) {
        return {
          state: 'takeoff',
          relocation: {
            kind: 'perch',
            capability: 'transfer',
            avoidObserver: true,
            preferCover: true,
            preferHigher: true,
            preferDifferentTree: perception.observerPressure > 0.78,
            minClearance: 0.38,
            minObserverDistance: 4.5,
            minObserverDistanceGain: 0.8,
            maxArrivalPressure: 0.52,
            minPressureReduction: 0.12,
            settleDuration: 1.05,
            maxDistance: 16,
          },
        };
      }
      return decision('inspect');
    }
    if (perception.observerPressure > 0.48) return decision('alarm');
    const random = context.random();
    if (habitatLevel === 'high') {
      if (random < 0.30) return decision('contact');
      if (random < 0.56) return decision('inspect');
      if (random < 0.72) return decision('preen');
      if (random < 0.80) return decision('perch');
      return {
        state: 'takeoff',
        relocation: {
          kind: 'perch', capability: 'transfer', preferCover: true, minClearance: 0.38,
          preferSameTree: true, minObserverDistance: 3.4, maxArrivalPressure: 0.62,
          settleDuration: 0.72, maxDistance: 8,
        },
      };
    }
    if (random < 0.38) return decision('inspect');
    if (random < 0.68) {
      if (habitatKind === 'ground') return decision('patrol');
      return {
        state: 'takeoff',
        relocation: {
          kind: 'perch', capability: 'transfer', preferHigher: true,
          preferCover: true, preferSameTree: true, minClearance: 0.38,
          minObserverDistance: 3.4, maxArrivalPressure: 0.62, settleDuration: 0.72, maxDistance: 8,
        },
      };
    }
    if (random < 0.84) return decision('preen');
    return decision('contact');
  },

  interrupt(context) {
    const { currentState, perception } = context;
    if (currentState === 'takeoff' || currentState === 'flight' || currentState === 'land') return null;
    const hardFlush = perception.observerDistance <= 2.8;
    const rushed = perception.observerDistance <= 5.4 && perception.observerApproachSpeed >= 2.6;
    if (hardFlush || rushed || perception.observerPressure >= 0.90) {
      return {
        state: 'takeoff',
        relocation: {
          kind: 'perch',
          capability: 'transfer',
          avoidObserver: true,
          preferHigher: true,
          preferCover: true,
          preferDifferentTree: true,
          minClearance: 0.4,
          minObserverDistance: 5.0,
          minObserverDistanceGain: 1.0,
          maxArrivalPressure: 0.46,
          minPressureReduction: 0.16,
          settleDuration: 1.2,
          maxDistance: 18,
        },
      };
    }
    if (perception.observerPressure >= 0.52 && currentState !== 'alarm') return decision('alarm');
    return null;
  },
};
