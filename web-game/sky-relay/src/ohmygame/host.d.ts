/**
 * Rules a player's browser runs for the room: the game's own rules from defineGame or
 * defineRealtimeGame, which the game service never runs. The service keeps the room —
 * seats, phase, sequence, reconnection and the saved state — and asks the hosting player
 * to apply the rules; it accepts only the game's part of the answer. docs/multiplayer.md
 * describes the exchange.
 */
import { type MultiplayerGameState, type RealtimeAction, type RealtimeInput, type TurnCommand } from "./multiplayer-protocol.js";
import { type GameAdapter } from "./rules.js";
/** The adapterId of deployments whose rules run on a player's browser. */
export declare const HOST_ADAPTER_ID = "host";
/** The largest message a hosting player may send, in bytes of its JSON. */
export declare const HOST_MESSAGE_MAX_BYTES: number;
/** How long the service waits for the hosting player before another player hosts. */
export declare const HOST_REPLY_MS = 5000;
/** What the service asks the hosting player to apply to state. */
export type HostRequest = {
    requestId: string;
    /** The room's state, unfiltered. */
    state: MultiplayerGameState;
    now: number;
} & ({
    kind: "command";
    playerId: string;
    command: TurnCommand;
} | {
    kind: "join" | "leave";
    playerId: string;
}
/** A round starts; finished is the round before, when there is one. */
 | {
    kind: "round";
    finished?: MultiplayerGameState;
} | {
    kind: "timeout";
});
/** Views per seat for rules with playerView, keyed by player ID; "" is a spectator's. */
export type HostViews = Record<string, Record<string, unknown>>;
export interface HostReply {
    requestId: string;
    state?: MultiplayerGameState;
    views?: HostViews;
    /** Why the rules refused a command. */
    error?: string;
}
/** Whether rules from defineGame or defineRealtimeGame show players different things. */
export declare function hasPlayerView(rules: unknown): boolean;
/** What each seat, and a spectator, may see of state. */
export declare function hostViews(adapter: GameAdapter, state: MultiplayerGameState): HostViews;
/** Applies one request with the rules, as the service would if it ran them. */
export declare function runHostRequest(adapter: GameAdapter, request: HostRequest, playerView: boolean): HostReply;
/**
 * The room state after a hosting player's answer. The service keeps what it owns: seats and
 * their connections, the owner, and any phase it set itself while the player worked, such as
 * closing the room. From the player it takes the game, positions, whose turn it is, the
 * deadline and winners among the seats. base is the state the request carried; a realtime
 * tick has none, and changes the phase only while a round is playing.
 */
export declare function mergeHostState(host: MultiplayerGameState, room: MultiplayerGameState, base?: MultiplayerGameState): MultiplayerGameState;
/**
 * Calls tick every ms. In a browser the timer runs in a worker: browsers slow a hidden
 * page's own timers to about once a second, which would slow the whole room while the
 * hosting player looks at another tab or window. Falls back to the page's timer.
 */
export declare function startTicker(ms: number, tick: () => void): () => void;
/**
 * The realtime loop a hosting player's browser runs: every tick it steps the rules with the
 * players' latest inputs and the actions since the last tick, and sends the new state. The
 * hosting player's own input goes straight to the loop, and show lets their game draw each
 * tick at once instead of after a trip through the service.
 */
export declare class HostLoop {
    private readonly adapter;
    private readonly tickMs;
    private readonly playerView;
    private readonly send;
    private readonly show?;
    private state?;
    private readonly inputs;
    private actions;
    private stopTicker?;
    /** When the next tick is due. */
    private due;
    constructor(adapter: GameAdapter, tickMs: number, playerView: boolean, send: (state: MultiplayerGameState, views?: HostViews) => void, show?: (state: MultiplayerGameState) => void);
    /** The phase of the loop's state, which runs ahead of the service's while a round plays. */
    get phase(): MultiplayerGameState["phase"] | undefined;
    start(state: MultiplayerGameState): void;
    /** The room changed without this player's rules, for example a seat was taken. */
    sync(state: MultiplayerGameState): void;
    input(playerId: string, input: RealtimeInput): void;
    action(playerId: string, action: RealtimeAction): void;
    stop(): void;
    private tick;
}
