/**
 * Drawing other players between the updates a room sends. Positions arrive a few times a
 * second (once a tick, or once a tick for an owner room's player states); drawing each one
 * as it arrives makes others jump. A Smoother keeps the recent updates of each thing, keyed
 * by any string such as a playerId, and gives the value to draw at the current time.
 *
 * - "interpolate" (the default) draws `delayMs` in the past, between the two updates around
 *   that time, so motion follows exactly the path the updates describe. It runs dry when an
 *   update is late, and then carries on along the last movement for at most `maxExtrapolateMs`.
 * - "extrapolate" draws ahead of the newest update along its movement, at most
 *   `maxExtrapolateMs`, easing toward that point. Shows others sooner, but overshoots a
 *   player who stops or turns, and eases back.
 * - "damped" eases toward the newest update. Never overshoots; trails moving things by
 *   about `smoothMs`.
 *
 * Only numeric fields are smoothed; give the fields to smooth in each update, such as
 * { x, y }. Smoothing runs on the page only and costs the service nothing.
 */
export type SmoothingMode = "interpolate" | "extrapolate" | "damped";
export interface SmoothingOptions {
    /** How to draw between updates. Default "interpolate". */
    mode?: SmoothingMode;
    /**
     * The time between updates in milliseconds, such as the room's tick: client.tickMs.
     * The defaults below derive from it. Default 50.
     */
    intervalMs?: number;
    /** "interpolate": how far in the past to draw. Default intervalMs: one update behind. */
    delayMs?: number;
    /** "extrapolate" and "damped": the easing time constant in milliseconds. Default 50. */
    smoothMs?: number;
    /** The furthest to carry movement past the newest update. Default intervalMs. */
    maxExtrapolateMs?: number;
    /**
     * A jump larger than this, in the fields' own units, is a teleport, such as a respawn: it
     * is drawn at once instead of glided across. Default Infinity (never).
     */
    snapDistance?: number;
    /** Fields that are angles in radians, eased the short way round. */
    angles?: readonly string[];
}
type Values = Record<string, number>;
export declare class Smoother {
    private readonly tracks;
    private readonly mode;
    private readonly delayMs;
    private readonly smoothMs;
    private readonly maxExtrapolateMs;
    private readonly snapDistance;
    private readonly angles;
    constructor(options?: SmoothingOptions);
    /**
     * Records an update for `key`, such as { x, y } from a snapshot, received at `at`
     * (performance.now() by default). An update equal to the last one is still recorded, so a
     * player who stopped is drawn stopped.
     */
    push(key: string, values: Readonly<Values>, at?: number): void;
    /** The values to draw for `key` at `time` (performance.now() by default), or undefined before its first update. */
    get(key: string, time?: number): Values | undefined;
    /** Forgets `key`, such as a player who left. */
    delete(key: string): void;
    /** Forgets every key not in `keys`, such as the players no longer in the snapshot. */
    retain(keys: Iterable<string>): void;
    private interpolate;
    /** The newest update moved along its last movement to `time`, at most maxExtrapolateMs past it. */
    private ahead;
    private ease;
}
export {};
