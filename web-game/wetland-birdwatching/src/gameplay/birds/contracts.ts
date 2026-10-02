export type HabitatKind = 'ground' | 'perch' | 'water';
export type HabitatLevel = 'ground' | 'low' | 'high' | 'water-edge' | 'open-water';
export type HabitatCapability =
  | 'rest'
  | 'sing'
  | 'transfer'
  | 'small-bird-rest'
  | 'canopy-perch'
  | 'forage'
  | 'swim'
  | 'dive';

export type SpatialPoint = Readonly<{ x: number; y: number; z: number }>;

export type HabitatNode = Readonly<{
  id: string;
  providerId: string;
  kind: HabitatKind;
  level: HabitatLevel;
  capabilities: readonly HabitatCapability[];
  position: SpatialPoint;
  forward?: SpatialPoint;
  clearance: number;
}>;

export type BirdPerception = Readonly<{
  observerDistance: number;
  observerApproachSpeed: number;
  observerFacingDot: number;
  visualAwareness: number;
  visualTransmission: number;
  directAttention: boolean;
  observerPressure: number;
}>;

export type ObserverPressureRules = Readonly<{
  pressureRadius: number;
  pressureFalloff: number;
  rearVisualFloor: number;
  distancePressureBase: number;
  distancePressureVisualWeight: number;
  approachSpeedReference: number;
  approachPressureWeight: number;
  raisedAttentionPressure: number;
  ambientAttentionPressure: number;
}>;

export type BirdDecisionContext<State extends string> = Readonly<{
  currentState: State;
  habitatKind: HabitatKind;
  habitatLevel: HabitatLevel;
  perception: BirdPerception;
  drives: Readonly<Record<string, number>>;
  random: () => number;
}>; 

export type BirdRelocationRequest = Readonly<{
  kind?: HabitatKind;
  level?: HabitatLevel;
  capability?: HabitatCapability;
  avoidObserver?: boolean;
  preferHigher?: boolean;
  preferCover?: boolean;
  preferDifferentTree?: boolean;
  preferSameTree?: boolean;
  minHeightGain?: number;
  minClearance?: number;
  maxDistance?: number;
  minObserverDistance?: number;
  minObserverDistanceGain?: number;
  maxArrivalPressure?: number;
  minPressureReduction?: number;
  settleDuration?: number;
  allowGroundReturn?: boolean;
}>;

export type BirdDecision<State extends string> = Readonly<{
  state: State;
  relocation?: BirdRelocationRequest;
}>;

export interface BirdSpeciesPolicy<State extends string> {
  readonly speciesId: string;
  readonly stateDurationRanges: Readonly<Record<State, readonly [number, number]>>;
  readonly stateLabels: Readonly<Record<State, string>>;
  chooseNext(context: BirdDecisionContext<State>): BirdDecision<State>;
  interrupt(context: BirdDecisionContext<State>): BirdDecision<State> | null;
}
