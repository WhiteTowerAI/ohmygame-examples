import type {
  BirdDecision,
  BirdDecisionContext,
  BirdPerception,
  BirdSpeciesPolicy,
  HabitatKind,
  HabitatLevel,
} from './contracts';

export type BirdAgentTransition<State extends string> = Readonly<{
  previousState: State;
  decision: BirdDecision<State>;
  startedAt: number;
  duration: number;
}>;

export type BirdAgentSnapshot<State extends string> = Readonly<{
  state: State;
  stateStartedAt: number;
  stateDuration: number;
  habitatKind: HabitatKind;
  habitatLevel: HabitatLevel;
  drives: Readonly<Record<string, number>>;
}>;

export type BirdAgentOptions<State extends string> = Readonly<{
  policy: BirdSpeciesPolicy<State>;
  initialState: State;
  initialHabitatKind: HabitatKind;
  initialHabitatLevel: HabitatLevel;
  initialDrives?: Readonly<Record<string, number>>;
  random: () => number;
  startedAt?: number;
  initialDuration?: number;
}>;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export class BirdAgent<State extends string> {
  readonly #policy: BirdSpeciesPolicy<State>;
  readonly #random: () => number;
  readonly #drives: Record<string, number>;
  #state: State;
  #stateStartedAt: number;
  #stateDuration: number;
  #habitatKind: HabitatKind;
  #habitatLevel: HabitatLevel;

  constructor(options: BirdAgentOptions<State>) {
    this.#policy = options.policy;
    this.#random = options.random;
    this.#state = options.initialState;
    this.#stateStartedAt = options.startedAt ?? 0;
    this.#stateDuration = options.initialDuration ?? this.#sampleDuration(options.initialState);
    this.#habitatKind = options.initialHabitatKind;
    this.#habitatLevel = options.initialHabitatLevel;
    this.#drives = { ...options.initialDrives };
  }

  get state() { return this.#state; }
  get stateStartedAt() { return this.#stateStartedAt; }
  get stateDuration() { return this.#stateDuration; }
  get habitatKind() { return this.#habitatKind; }
  get habitatLevel() { return this.#habitatLevel; }

  getProgress(now: number) {
    if (this.#stateDuration <= 0) return 1;
    return clamp01((now - this.#stateStartedAt) / this.#stateDuration);
  }

  getDrive(id: string) {
    return this.#drives[id] ?? 0;
  }

  setDrive(id: string, value: number) {
    this.#drives[id] = clamp01(value);
  }

  adjustDrive(id: string, delta: number) {
    this.setDrive(id, this.getDrive(id) + delta);
    return this.#drives[id];
  }

  setHabitat(kind: HabitatKind, level: HabitatLevel) {
    this.#habitatKind = kind;
    this.#habitatLevel = level;
  }

  update(now: number, perception: BirdPerception): BirdAgentTransition<State> | null {
    const interrupted = this.interrupt(now, perception);
    if (interrupted) return interrupted;
    return this.advanceIfDue(now, perception);
  }

  interrupt(now: number, perception: BirdPerception): BirdAgentTransition<State> | null {
    const interrupted = this.#policy.interrupt(this.#createContext(perception));
    return interrupted ? this.#enterDecision(interrupted, now) : null;
  }

  advanceIfDue(now: number, perception: BirdPerception): BirdAgentTransition<State> | null {
    if (now - this.#stateStartedAt < this.#stateDuration) return null;
    return this.#enterDecision(this.#policy.chooseNext(this.#createContext(perception)), now);
  }

  force(decision: BirdDecision<State>, now: number) {
    return this.#enterDecision(decision, now);
  }

  getSnapshot(): BirdAgentSnapshot<State> {
    return {
      state: this.#state,
      stateStartedAt: this.#stateStartedAt,
      stateDuration: this.#stateDuration,
      habitatKind: this.#habitatKind,
      habitatLevel: this.#habitatLevel,
      drives: { ...this.#drives },
    };
  }

  #createContext(perception: BirdPerception): BirdDecisionContext<State> {
    return {
      currentState: this.#state,
      habitatKind: this.#habitatKind,
      habitatLevel: this.#habitatLevel,
      perception,
      drives: this.#drives,
      random: this.#random,
    };
  }

  #enterDecision(decision: BirdDecision<State>, now: number): BirdAgentTransition<State> {
    const previousState = this.#state;
    this.#state = decision.state;
    this.#stateStartedAt = now;
    this.#stateDuration = this.#sampleDuration(decision.state);
    return {
      previousState,
      decision,
      startedAt: this.#stateStartedAt,
      duration: this.#stateDuration,
    };
  }

  #sampleDuration(state: State) {
    const [minimum, maximum] = this.#policy.stateDurationRanges[state];
    return minimum + (maximum - minimum) * this.#random();
  }
}
