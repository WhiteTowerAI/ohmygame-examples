export type MultiplayerMode = "turn-based" | "realtime";
export type MultiplayerAuthPolicy = "anonymous" | "guest-or-account" | "account-required";
/**
 * invite-or-public: an owner creates the room; it is listed while waiting, and anyone
 * with its ID or invite code joins until the match starts. invite-only: never listed,
 * and joining takes the invite code. drop-in is realtime only: players join a room with
 * a free seat, or a new one, without creating or starting it, and can join a round in
 * progress. It has no room owner. "public" is an older name for invite-or-public, still
 * read in saved deployments; registering it makes an invite-or-public deployment.
 */
export type MultiplayerRoomPolicy = "invite-or-public" | "public" | "invite-only" | "drop-in";
export interface MultiplayerManifestConfig {
    enabled: true;
    mode: MultiplayerMode;
    gameId: string;
    deploymentId: string;
    /**
     * The version of this deployment format. Rooms negotiate their protocol separately,
     * from MULTIPLAYER_PROTOCOL_VERSION.
     */
    protocolVersion: 1;
    serverUrl: string;
    authPolicy: MultiplayerAuthPolicy;
    roomPolicy: MultiplayerRoomPolicy;
    maxClients: number;
    reconnectSeconds: number;
    /** The rules the service registered for this deployment, by name. */
    adapterId: string;
    /**
     * Lockstep and owner deployments only: the tick in milliseconds at which the service
     * sends frames, since it never loads the game's rules.
     */
    tickMs?: number;
}
/** Explicit reference runtime; authored Web Games render their own adapter. */
export interface PublishedMultiplayerManifest {
    version: 1;
    runtime: "multiplayer-example";
    multiplayer: MultiplayerManifestConfig;
}
export declare function isPublishedMultiplayerManifest(value: unknown): value is PublishedMultiplayerManifest;
/** The tick of realtime rules that choose none. The service reports each room's own tick when a player joins. */
export declare const DEFAULT_TICK_MS = 50;
/** The fastest and slowest tick realtime rules may choose, in milliseconds. */
export declare const TICK_MS_RANGE: {
    readonly min: 20;
    readonly max: 1000;
};
/** The largest realtime input, in characters of its JSON. */
export declare const REALTIME_INPUT_MAX_LENGTH = 512;
/**
 * Sent with a matchmaking error when the service cannot open another room; quick play
 * retries it. Colyseus uses the code as the HTTP status, so it stays in that range.
 */
export declare const MULTIPLAYER_ROOM_LIMIT_CODE = 503;
/**
 * The newest room protocol this SDK speaks, sent as protocolVersion when it joins. Games
 * keep the client.js they were built with, so the service must keep speaking every
 * version a published game may send.
 */
export declare const MULTIPLAYER_PROTOCOL_VERSION = 1;
/**
 * The room protocols this service speaks. A new version raises max and keeps min, so
 * games built with an older SDK keep connecting; min rises only once no published game
 * still sends it.
 */
export declare const MULTIPLAYER_PROTOCOL_VERSIONS: {
    readonly min: 1;
    readonly max: 1;
};
/**
 * Sent with a matchmaking error when the service speaks none of the client's versions.
 * Colyseus uses the code as the HTTP status: 426 Upgrade Required.
 */
export declare const MULTIPLAYER_PROTOCOL_UNSUPPORTED_CODE = 426;
/**
 * The version a room speaks to a client: the newest both sides speak. The client sends
 * its newest as protocolVersion and, when it can still speak older ones, its oldest as
 * minProtocolVersion; clients before negotiation send only protocolVersion. Undefined
 * when they share none. The service reports the result as protocolVersion in "ready";
 * a service before negotiation sends none, and speaks version 1.
 */
export declare function negotiateProtocolVersion(options: {
    protocolVersion?: unknown;
    minProtocolVersion?: unknown;
}, supported?: {
    min: number;
    max: number;
}): number | undefined;
/** Why a client and service share no protocol version, for the error both show. */
export declare function describeProtocolMismatch(options: {
    protocolVersion?: unknown;
}, supported?: {
    min: number;
    max: number;
}): string;
export declare const MULTIPLAYER_MIN_CLIENTS = 2;
export declare const MULTIPLAYER_MAX_CLIENTS = 32;
/**
 * The adapterId of realtime deployments whose rules every player's browser runs alike
 * (lockstep): the service numbers frames of everyone's input and passes them on, and each
 * page steps the same rules with the same random numbers. docs/multiplayer.md describes it.
 */
export declare const LOCKSTEP_ADAPTER_ID = "lockstep";
/**
 * The adapterId of realtime deployments in which each player's page runs their own part
 * of the game and the service passes it on (owner): every player's state, shared data the
 * service changes one request at a time, and messages. docs/multiplayer.md describes it.
 */
export declare const OWNER_ADAPTER_ID = "owner";
/** The longest a player's state may be in an owner room, as JSON. */
export declare const OWNER_STATE_MAX_LENGTH = 4096;
/** The longest one shared value in an owner room, or one message in any room, may be as JSON. */
export declare const OWNER_VALUE_MAX_LENGTH = 1024;
/**
 * The most messages (emit) one player may send each second; the service drops the rest.
 * It stays well below the 10 messages a second after which a turn-based room closes a
 * connection, leaving room for commands.
 */
export declare const ROOM_MESSAGES_PER_SECOND = 5;
/** The most shared values an owner room keeps. */
export declare const OWNER_SHARED_MAX_KEYS = 256;
/** The most changes one shared request may make. */
export declare const OWNER_SHARED_MAX_CHANGES = 8;
export declare const MULTIPLAYER_MANIFEST_SCHEMA: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly required: readonly ["enabled", "mode", "gameId", "deploymentId", "protocolVersion", "serverUrl", "authPolicy", "roomPolicy", "maxClients", "reconnectSeconds", "adapterId"];
    readonly properties: {
        readonly enabled: {
            readonly const: true;
        };
        readonly mode: {
            readonly enum: readonly ["turn-based", "realtime"];
        };
        readonly gameId: {
            readonly type: "string";
            readonly pattern: "^[A-Za-z0-9_-]{1,100}$";
        };
        readonly deploymentId: {
            readonly type: "string";
            readonly pattern: "^[A-Za-z0-9_-]{1,100}$";
        };
        readonly protocolVersion: {
            readonly const: 1;
        };
        readonly serverUrl: {
            readonly type: "string";
            readonly pattern: "^https://[^/?#@\\s]+/?$";
        };
        readonly authPolicy: {
            readonly enum: readonly ["anonymous", "guest-or-account", "account-required"];
        };
        readonly roomPolicy: {
            readonly enum: readonly ["invite-or-public", "public", "invite-only", "drop-in"];
        };
        readonly maxClients: {
            readonly type: "integer";
            readonly minimum: 2;
            readonly maximum: 32;
        };
        readonly reconnectSeconds: {
            readonly type: "integer";
            readonly minimum: 0;
            readonly maximum: 3600;
        };
        readonly adapterId: {
            readonly type: "string";
            readonly pattern: "^[A-Za-z0-9_-]{1,100}$";
        };
        readonly tickMs: {
            readonly type: "integer";
            readonly minimum: 20;
            readonly maximum: 1000;
        };
    };
};
export declare function isMultiplayerManifestConfig(value: unknown, options?: {
    allowLocalhost?: boolean;
}): value is MultiplayerManifestConfig;
export declare function multiplayerRoomType(config: Pick<MultiplayerManifestConfig, "gameId" | "deploymentId">): string;
export declare function sameMultiplayerConfig(left: MultiplayerManifestConfig, right: MultiplayerManifestConfig): boolean;
export interface JoinRoomOptions {
    gameId: string;
    deploymentId: string;
    /** The newest room protocol the client speaks. See negotiateProtocolVersion. */
    protocolVersion: number;
    /** The oldest room protocol the client still speaks; protocolVersion when absent. */
    minProtocolVersion?: number;
    displayName?: string;
    roomCode?: string;
    creationKey?: string;
}
export type CreateRoomOptions = JoinRoomOptions;
export interface TurnCommand {
    commandId: string;
    expectedSequence: number;
    /**
     * start, restart, close and kick manage the room; action carries a move of the game's
     * rules. restart is the owner starting another match once one has finished.
     */
    type: "start" | "restart" | "close" | "kick" | "action";
    payload?: {
        playerId?: string;
        [key: string]: unknown;
    };
}
/**
 * What a player sends each tick in a realtime game, such as { x, y } for a direction or
 * { x, y, jump: true }. The rules decide its shape: plain JSON, at most
 * REALTIME_INPUT_MAX_LENGTH characters, without the key inputId, which the SDK adds.
 */
export type RealtimeInput = Record<string, unknown>;
/**
 * Something a player does once in a realtime game, such as { fire: true }: the rules read
 * each action in exactly one tick. Plain JSON of at most REALTIME_INPUT_MAX_LENGTH characters.
 */
export type RealtimeAction = Record<string, unknown>;
/** The most actions one player may have waiting for the next tick; more are refused. */
export declare const REALTIME_ACTIONS_PER_TICK = 8;
export interface MultiplayerPlayer {
    playerId: string;
    displayName: string;
    connected: boolean;
    x: number;
    y: number;
}
export interface MultiplayerGameState {
    phase: "lobby" | "playing" | "finished" | "closed";
    ownerId: string;
    currentPlayerId: string;
    winnerPlayerId: string;
    /** Every winner, when a team or several players win together; empty for a draw. */
    winnerPlayerIds?: string[];
    turnDeadline: number;
    players: MultiplayerPlayer[];
    /** The player whose browser runs the rules, in a deployment whose rules run there (adapterId "host"). */
    hostPlayerId?: string;
    /** Serializable data owned and validated by the deployment's rules adapter. */
    game?: Record<string, unknown>;
    /**
     * Lockstep rounds: where the rules' random numbers are, so every page draws the same
     * ones. Each draw moves it on.
     */
    seed?: number;
}
/**
 * Adapters run only on the service; clients submit intent, never final state.
 *
 * @experimental The low-level form of server rules, for the operator's own service. Turn-based
 * rules should use defineGame; this interface may change before realtime rules have one.
 */
export interface MultiplayerGameAdapter<State, Command> {
    /** The game mode these rules play; a deployment must declare the same mode. */
    mode: MultiplayerMode;
    /** Seats the rules support. A deployment's maxClients must fit, and a match starts with at least min connected players. */
    players: {
        min: number;
        max: number;
    };
    initialState(): State;
    validateCommand(state: State, playerId: string, command: Command): void;
    applyCommand(state: State, playerId: string, command: Command): State;
    onDisconnect?(state: State, playerId: string): void;
    onTurnTimeout?(state: State, now: number): State;
    /**
     * Realtime only: advances the world by one tick of dt seconds. inputs holds each seat's
     * latest input that is still fresh; a player who stops sending drops out of it.
     */
    step?(state: State, inputs: ReadonlyMap<string, {
        input: RealtimeInput;
        at: number;
    }>, now: number, dt: number, actions: readonly {
        playerId: string;
        action: RealtimeAction;
    }[]): State;
    /** Realtime only: the tick in milliseconds, 20 to 1000. Defaults to 50. */
    tickMs?: number;
    /**
     * A leaderboard, named with MATCH_BOARD_PREFIX, on which a service that keeps game data
     * records every finished match: each winner's count goes up by one. Only rules the
     * service runs itself may set it, since their results cannot be forged.
     */
    matchBoard?: string;
    /**
     * The room asks a player's browser to run the rules, as for adapterId "host": the
     * adapter keeps only the room's own commands. Set by the service, not by rules.
     */
    hosted?: boolean;
    /**
     * The room numbers frames of input for the players' browsers, which all run the rules
     * (adapterId "lockstep"): the adapter keeps only the room's own commands. Set by the
     * service, not by rules.
     */
    lockstep?: boolean;
    /**
     * Each player's page runs their own part of the game and the room passes it on
     * (adapterId "owner"): the adapter keeps only the room's own commands. Set by the service.
     */
    owner?: boolean;
    /** The rules show each player only part of the state, through playerView. */
    playerView?: boolean;
    /** Realtime only: throws when an input does not have the shape the rules read. Without it any input passes. */
    validateInput?(input: RealtimeInput, playerId: string): void;
    /**
     * Realtime only: throws when an action does not have the shape the rules read. Without
     * it the rules take no actions, and the room refuses them. Each accepted action reaches
     * step once, in the order the room received it.
     */
    validateAction?(action: RealtimeAction, playerId: string): void;
    /**
     * The state one player may see, such as their own hand but not others'. playerId is
     * undefined for a connection that holds no seat. Without it every player sees the whole state.
     */
    viewFor?(state: State, playerId: string | undefined): State;
    /** Places a new seat, including one joining a drop-in round in progress. Without it the room lines seats up. */
    onPlayerJoin?(state: State, playerId: string, now: number): State;
    /**
     * Sets up a round when it starts: the owner starts or restarts the match, or a drop-in
     * room starts or restarts a round. finished is the state of the round that just ended,
     * when there is one, so rules can carry a score over.
     */
    onRoundStart?(state: State, now: number, finished?: State): State;
    /** A seat was given up, after the room removed it from players: a drop-in player left, or a lobby seat emptied. */
    onPlayerLeave?(state: State, playerId: string, now: number): State;
}
export type MultiplayerEventType = "room.ready" | "member.joined" | "member.left" | "state.updated" | "turn.changed" | "room.finished" | "room.closed" | "protocol.error";
export type MultiplayerErrorCode = "invalid_command" | "not_your_turn" | "sequence_conflict" | "room_full" | "deployment_mismatch" | "protocol_mismatch" | "not_authorized" | "room_closed" | "rate_limited";
export interface MultiplayerEvent<T = unknown> {
    type: MultiplayerEventType;
    roomId: string;
    deploymentId: string;
    sequence: number;
    serverTime: string;
    payload: T;
}
export interface TurnCommandResult {
    commandId: string;
    accepted: boolean;
    sequence: number;
    error?: {
        code: MultiplayerErrorCode;
        message: string;
    };
}
export interface MultiplayerSnapshot {
    roomId: string;
    gameId: string;
    deploymentId: string;
    mode: MultiplayerMode;
    sequence: number;
    state: MultiplayerGameState;
    serverTime: string;
    /**
     * A realtime room the service runs, on its ticks: for each seat in state.players, the
     * inputId of the newest input the tick read, or -1. A page that predicts its own player
     * replays its inputs after this one.
     */
    acks?: number[];
}
export interface PublicMultiplayerRoom {
    roomId: string;
    clients: number;
    maxClients: number;
}
export declare function isTurnCommand(value: unknown): value is TurnCommand;
/** An input as the game passes it to sendInput, before the SDK numbers it. */
export declare function isRealtimeInput(value: unknown): value is RealtimeInput;
/** An input message as it travels to the service: the game's input with the SDK's increasing inputId. */
/** An action as the game passes it to sendAction and as it travels to the service. */
export declare function isRealtimeAction(value: unknown): value is RealtimeAction;
export declare function isRealtimeInputMessage(value: unknown): value is RealtimeInput & {
    inputId: number;
};
export declare function isMultiplayerEvent(value: unknown): value is MultiplayerEvent;
export declare function isTurnCommandResult(value: unknown): value is TurnCommandResult;
export declare function isMultiplayerSnapshot(value: unknown): value is MultiplayerSnapshot;
export declare function normalizeDisplayName(value: unknown): string;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function isSequence(value: unknown): value is number;
/** A seat change that every page applies at the same frame of a lockstep round. */
export type LockstepEvent = {
    type: "join";
    player: MultiplayerPlayer;
} | {
    type: "leave";
    playerId: string;
} | {
    type: "connected";
    playerId: string;
    connected: boolean;
};
/** One tick of a lockstep round: what every page applies, in order, to step the rules. */
export interface LockstepFrame {
    round: number;
    /** 1 for a round's first tick, then one more each tick. */
    frame: number;
    /** Each player's input the rules read this tick. */
    inputs: Record<string, RealtimeInput>;
    /** Actions in the order the service received them. */
    actions?: {
        playerId: string;
        action: RealtimeAction;
    }[];
    /** Seats that changed since the last frame, applied before the tick. */
    events?: LockstepEvent[];
    /** The inputId of each player's input that first counts in this frame. */
    acks?: Record<string, number>;
}
/**
 * An input for a lockstep round, for the frame the page shows it in. The service applies
 * it at that frame, or at the next one when it arrives too late, so a page that runs ahead
 * of the service can show its own input at once.
 */
export interface LockstepInput {
    inputId: number;
    frame: number;
    input: RealtimeInput;
}
/**
 * Another player's input, passed on as soon as it reaches the service, before the frame it
 * counts in: frame is where the service will count it. Pages guess ahead with it.
 */
export interface LockstepEarlyInput {
    round: number;
    playerId: string;
    inputId: number;
    frame: number;
    input: RealtimeInput;
}
export declare function isLockstepEarlyInput(value: unknown): value is LockstepEarlyInput;
export declare function isLockstepInput(value: unknown): value is LockstepInput;
/**
 * What a page needs to run a lockstep round from where it is now: sent to everyone when a
 * round starts and to a player who arrives or reconnects during one.
 */
export interface LockstepSync {
    round: number;
    tickMs: number;
    /** The round as it began: the room's state with the seed, the clock, and the last round's game. */
    start: {
        state: MultiplayerGameState;
        startedAt: number;
        previous?: Record<string, unknown>;
    };
    /** A later state of the round that a page reported, to run on from instead of the start. */
    checkpoint?: {
        frame: number;
        state: MultiplayerGameState;
    };
    /** Every frame after the checkpoint, or after the start. */
    frames: LockstepFrame[];
}
/** A page's state of a lockstep round after a frame: a checkpoint, or the end of the round. */
export interface LockstepReport {
    round: number;
    frame: number;
    state: MultiplayerGameState;
}
export declare function isLockstepFrame(value: unknown): value is LockstepFrame;
export declare function isLockstepSync(value: unknown): value is LockstepSync;
export declare function isLockstepReport(value: unknown): value is LockstepReport;
/** Changes to one player's state in an owner room: top-level keys set and keys removed. */
export interface OwnerPatch {
    set?: Record<string, unknown>;
    delete?: string[];
    /**
     * The state's version on its page, which counts each setState. Pages that get a
     * player's state straight from that player's page keep whichever version is newer.
     */
    seq?: number;
}
/** One tick of an owner room: every player's state changes since the last, and who left. */
export interface OwnerFrame {
    round: number;
    players?: Record<string, OwnerPatch>;
    left?: string[];
}
/** An owner round as it is now, for a page that starts it or arrives during it. */
export interface OwnerSync {
    round: number;
    players: Record<string, Record<string, unknown>>;
    shared: Record<string, unknown>;
    /** Each player's newest state version the service has. */
    seqs?: Record<string, number>;
}
/**
 * A page's one-off message (owner.emit), with an ID unique on that page so a copy that also
 * arrives straight from it is dropped. Every kind of room passes messages on; the names keep
 * the owner prefix from when only owner rooms did, so published games still read them.
 */
export interface OwnerEmit {
    id: string;
    message: Record<string, unknown>;
}
/** The service passing an owner.emit on (owner.message). */
export interface OwnerMessageEvent extends OwnerEmit {
    from: string;
}
/** The most characters of JSON one p2p.signal may carry: a session description with its candidates. */
export declare const P2P_SIGNAL_MAX_LENGTH = 8192;
/**
 * Connection setup between two players' pages in an owner room, which the service passes
 * on unread (p2p.signal): the page sends { to, data } and the other gets { from, data }.
 */
export interface P2PSignal {
    to: string;
    data: Record<string, unknown>;
}
/**
 * One change to an owner room's shared data: value sets key, and no value removes it. It
 * applies only if key holds expect now (deep JSON equality), or is absent with
 * expectAbsent, so two players cannot both take the same thing.
 */
export interface OwnerSharedChange {
    key: string;
    value?: unknown;
    expect?: unknown;
    expectAbsent?: boolean;
}
/** Shared changes the service applied, all at once, and whose request they were. */
export interface OwnerSharedUpdate {
    round: number;
    by: string;
    changes: {
        key: string;
        value?: unknown;
    }[];
}
export declare function isOwnerState(value: unknown): value is Record<string, unknown>;
export declare function isOwnerPatch(value: unknown): value is OwnerPatch;
export declare function isOwnerSharedChange(value: unknown): value is OwnerSharedChange;
export declare function isOwnerMessage(value: unknown): value is Record<string, unknown>;
export declare function isOwnerEmit(value: unknown): value is OwnerEmit;
export declare function isOwnerMessageEvent(value: unknown): value is OwnerMessageEvent;
export declare function isP2PSignal(value: unknown): value is P2PSignal;
export declare function isOwnerFrame(value: unknown): value is OwnerFrame;
export declare function isOwnerSync(value: unknown): value is OwnerSync;
export declare function isOwnerSharedUpdate(value: unknown): value is OwnerSharedUpdate;
/**
 * Plain JSON equality, as JSON.stringify would see it (keys holding undefined count as
 * absent), without building either string: the service compares a shared value with what a
 * change expects, and a realtime room's whole state with the last one every tick.
 */
export declare function sameJson(left: unknown, right: unknown): boolean;
/** Where a change applies: the keys and array indexes from the room state down. */
export type StatePath = (string | number)[];
/** [path, value] sets the value there; [path] alone removes it. An empty path replaces the whole state. */
export type StateChange = [path: StatePath] | [path: StatePath, value: unknown];
/**
 * A realtime tick's snapshot as what changed since the one before (`base`), which every
 * connection that shares the room's view has. The page applies it to the snapshot it holds
 * whose sequence is `base`, and asks for a whole one (`snapshot.request`) when it holds another.
 */
export interface SnapshotDelta {
    roomId: string;
    sequence: number;
    base: number;
    serverTime: string;
    changes: StateChange[];
    /** As MultiplayerSnapshot.acks, for this tick. */
    acks?: number[];
}
export declare function isSnapshotDelta(value: unknown): value is SnapshotDelta;
/**
 * The changes that turn one JSON state into another, as JSON sees them. Records are compared
 * key by key and same-length arrays index by index, such as a room's seats. An array whose
 * length changed is sent whole, and so is one whose item changes would be longer than it,
 * such as a snake's body moving one cell.
 */
export declare function stateChanges(before: unknown, after: unknown): StateChange[];
/**
 * The state with the changes applied. Only the objects along a changed path are copied; the
 * rest is shared with `state`, which is left as it was.
 */
export declare function applyStateChanges<T>(state: T, changes: readonly StateChange[]): T;
