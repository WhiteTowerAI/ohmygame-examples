import { type OwnerSharedChange, type MultiplayerEvent, type MultiplayerManifestConfig, type MultiplayerSnapshot, type PublicMultiplayerRoom, type TurnCommand, type TurnCommandResult } from "./multiplayer-protocol.js";
import { OhMyGameError } from "./errors.js";
import { type IdentityProvider } from "./identity.js";
import type { ClientAction, ClientInput, ClientMoves } from "./define-game.js";
import type { OhMyGame } from "./index.js";
import { type PeerOptions, type PeerStatus } from "./peers.js";
export { Smoother, type SmoothingMode, type SmoothingOptions } from "./smoothing.js";
export type MultiplayerConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "closed" | "error";
export interface MultiplayerClientOptions {
    manifest: MultiplayerManifestConfig;
    /**
     * The signed-in player, asked again before each join. Without a token the client joins
     * as a guest when the deployment allows guests.
     */
    identity?: IdentityProvider;
    /**
     * Both default to localStorage: one browser is one player, in every tab and after it
     * closes, and can come back to its seat. Tests inject separate storage per player.
     */
    storage?: Storage;
    identityStorage?: Storage;
    /** Opt in only for loopback development, never for a published deployment. */
    allowLocalhost?: boolean;
    /**
     * The game's rules from defineGame or defineRealtimeGame, usually the default export of
     * server/rules.ts. Required when the deployment runs its rules on a player's browser
     * (adapterId "host" or "lockstep"). For a realtime room whose rules the service runs,
     * passing the same rules predicts this player's own moves: snapshot shows them at once
     * and confirmed is the service's newest. Rules with playerView are not predicted.
     */
    rules?: unknown;
    connectionTimeoutMs?: number;
    /** Waits before each quick play retry when the service is at its room limit. */
    roomLimitRetryMs?: number[];
    /**
     * Drop-in only: how long a player must be alone before moving to a room with other
     * players, and roughly how often that is checked. Defaults to 5 seconds.
     */
    mergeCheckMs?: number;
    /**
     * Owner rooms: also send states and messages straight to other players' pages over
     * WebRTC where a direct connection opens, without the trip to the service. Everything
     * still goes through the service too, which reaches the players a connection cannot.
     * Players see each other's network addresses, so leave it off unless the game wants
     * the speed. iceServers replaces the default public STUN servers.
     */
    p2p?: boolean | PeerOptions;
}
export interface MultiplayerClientCallbacks {
    onStatus?: (status: MultiplayerConnectionStatus) => void;
    /**
     * Room events, such as a player joining or a match finishing. A realtime room's ticks
     * raise none: watch onSnapshot for their changes.
     */
    onEvent?: (event: MultiplayerEvent) => void;
    onReady?: (playerId: string, inviteCode?: string) => void;
    onCommandResult?: (result: TurnCommandResult) => void;
    onSnapshot?: (snapshot: MultiplayerSnapshot) => void;
    onError?: (error: OhMyGameError) => void;
    /** This player's browser starts or stops running the game's rules for the room. */
    onHost?: (hosting: boolean) => void;
    /** Another player's message from emit, in any kind of room. */
    onMessage?: (from: string, message: Record<string, unknown>) => void;
}
/**
 * Colyseus owns transient reconnects; this wrapper adds refresh and restart recovery.
 * Game is the type of the rules from defineGame, which types client.moves.
 */
export declare class MultiplayerClient<Game = unknown> {
    private readonly options;
    private readonly callbacks;
    /**
     * Sends one move of the game's rules, for example client.moves.play({ cards }).
     * Returns the command ID that onCommandResult reports. The key "action" is reserved.
     */
    readonly moves: ClientMoves<Game>;
    private readonly client;
    private readonly storage?;
    private readonly guest;
    private readonly storageKey;
    private room?;
    private saved?;
    private current?;
    /** The service's latest snapshot, which a hosting player's own ticks build on. */
    private fromService?;
    private lastEventSequence;
    /** Whether a whole snapshot is on its way, so a tick's changes that do not fit wait for it. */
    private awaitingSnapshot;
    /** Whether this connection has already reported a snapshot it could not read. */
    private reportedUnreadable;
    private generation;
    private busy;
    private disposed;
    private inputId;
    private latestInput?;
    /** The room's tick, from the service; input goes out no faster. */
    private roomTickMs;
    /** Where the service's tick falls, so input and owner states reach it just before it. */
    private readonly tickClock;
    private readonly inputPacer;
    private pingTimer?;
    /** The input the page last sent, so a change can go out before the next tick's send. */
    private sentInput?;
    /** Early sends left: a few a second, so an input that changes every frame cannot double the messages. */
    private earlySends;
    private earlySendsAt;
    /** Owner rooms: messages this page has emitted, which number their IDs. */
    private messageCount;
    /** Messages sent in the current second, against ROOM_MESSAGES_PER_SECOND. */
    private messagesSent;
    private displayName?;
    private mergeTimer?;
    private aloneSince?;
    private merging;
    private connectionStatus;
    /** The compiled rules, for a deployment whose rules run on a player's browser. */
    private readonly hostRules?;
    private hostLoop?;
    private hostingRoom;
    /** Runs the rules in step with every other player, for a lockstep deployment. */
    private readonly lockstep?;
    /** This player's part of the round, for an owner deployment. */
    private readonly owner?;
    /** Owner rooms with p2p: connections straight to other players' pages. */
    private readonly mesh?;
    /** Messages already passed to onMessage, by sender and ID, so a copy from the other path is dropped. */
    private readonly delivered;
    /** This player's own moves shown before the service's tick reads them, when the page passes the rules the service runs. */
    private readonly prediction?;
    constructor(options: MultiplayerClientOptions, callbacks?: MultiplayerClientCallbacks);
    /**
     * The room's tick in milliseconds, as the service reports it when the player joins: how
     * often a realtime room's snapshots, and an owner room's player states, arrive at most.
     * Pass it to a Smoother as intervalMs.
     */
    get tickMs(): number;
    /**
     * Owner rooms with p2p: each other player this page has tried to reach directly, by
     * playerId: "connecting", "open" (states and messages go straight there too), or
     * "failed" (only through the service; tried again later). Empty without p2p.
     */
    get peers(): Record<string, PeerStatus>;
    get status(): MultiplayerConnectionStatus;
    get roomId(): string | undefined;
    get playerId(): string | undefined;
    get roomCode(): string | undefined;
    /**
     * The room as onSnapshot last reported it. In a lockstep round this runs ahead of the
     * service, so the player's own input shows at once, and other players' parts of it are a
     * guess that the next frame may correct.
     */
    get snapshot(): MultiplayerSnapshot | undefined;
    /**
     * The room at the newest frame the service sent, with no guess: in a lockstep round it
     * trails snapshot by about a round trip and is never corrected, so drawing other players
     * from it shows them a little late but without jumps. With predicted moves it is the
     * service's newest snapshot. Otherwise it is snapshot.
     */
    get confirmed(): MultiplayerSnapshot | undefined;
    /** Whether this player's browser runs the game's rules for the room now. */
    get hosting(): boolean;
    createRoom(options?: {
        displayName?: string;
    }): Promise<void>;
    /**
     * Drop-in deployments only: join the fullest room with a free seat, or open a new one
     * when every room is full. A service at its room limit is retried a few times before
     * the error reaches the game.
     */
    quickPlay(options?: {
        displayName?: string;
    }): Promise<void>;
    joinRoom(options?: {
        displayName?: string;
        roomCode?: string;
        roomId?: string;
    }): Promise<void>;
    reconnect(): Promise<boolean>;
    sendCommand(type: TurnCommand["type"], payload?: TurnCommand["payload"]): string;
    /**
     * Sends what the player is doing now in a realtime game, in the shape the rules read,
     * such as { x, y } for a direction. Safe to call every frame: the latest input goes out
     * about once per service tick, timed to reach the service just before its tick, and
     * keeps going out while the game keeps calling, so a held key stays fresh. A changed
     * input, such as a key just pressed, goes out at once, a few times a second at most.
     * Sending faster would only be discarded, and a flood closes the connection. Throws
     * invalid_option for an input that is not plain JSON of at most
     * REALTIME_INPUT_MAX_LENGTH characters, or that uses the reserved key inputId.
     */
    sendInput(input: ClientInput<Game>): void;
    /** Whether an early send is allowed now; refills EARLY_SENDS_PER_SECOND, up to EARLY_SENDS_BURST. */
    private earlySend;
    /**
     * Sends something the player does once in a realtime game, such as { fire: true }, in
     * the shape the rules' action function reads. The rules read it in exactly one tick, so
     * send it once per press, not every frame. Returns false when no room is connected, in
     * which case nothing is sent: an action is about this moment, so it is never queued.
     * Throws invalid_option for an action that is not plain JSON of at most
     * REALTIME_INPUT_MAX_LENGTH characters. The service reports a refused action through onError.
     */
    /**
     * Owner rooms: sets this player's state, a small plain object of JSON data that the page
     * keeps up to date as its player moves, such as { x, y, dir }. It shows in
     * snapshot.state.game.players at once and reaches everyone else within a tick; only the
     * top-level keys that changed are sent, so keep large parts that rarely change in their
     * own keys. Throws invalid_option for anything else, or outside an owner deployment.
     */
    setState(state: Record<string, unknown>): void;
    /**
     * Owner rooms: changes snapshot.state.game.shared, the data every player shares, such as
     * food or a door. All the changes apply or none: each may require its key to hold expect
     * or to be absent (expectAbsent), so when two players take the same thing, only the first
     * gets it. Resolves true when the service applied them, false otherwise.
     */
    updateShared(changes: OwnerSharedChange[]): Promise<boolean>;
    /**
     * Sends every other player in the room a one-off message, which reaches them through
     * onMessage: an emote, a quick phrase or a ready check, in any kind of room and before a
     * match starts. In an owner room it also carries what only this page saw, such as a
     * collision. A message never reaches the rules and is not kept: a player who is away
     * misses it. In a rules room, and above all in a lockstep room, where pages receive it at
     * different moments, change the game with a move, input or action, never a message.
     * Returns false when the room is not connected; throws rate_limited past
     * ROOM_MESSAGES_PER_SECOND.
     */
    emit(message: Record<string, unknown>): boolean;
    /** Owner rooms: ends the round with these winners; the first page to say so decides. */
    finishRound(winners: string[]): void;
    /** Passes a message on once, whichever path brought it first. */
    private deliverMessage;
    /** Connects straight to the room's connected players, and drops those who left. */
    private updatePeers;
    /** Shows an owner round: the room's seats and phase, with every player's state and the shared data. */
    private showOwner;
    sendAction(action: ClientAction<Game>): boolean;
    private flushInput;
    /**
     * Predicts this player from the rules the service runs: realtime rules from
     * defineRealtimeGame, or a compiled realtime adapter. Rules with playerView are not
     * predicted, since the page does not see the whole state they step.
     */
    private predictionFor;
    /** Shows this player's predicted moves on the room's latest seats and phase. */
    private showPredicted;
    /** What the lockstep runner does with the round: show it, and report to the service. */
    private lockstepHooks;
    /** Shows a lockstep round's state on the room's latest seats and phase. */
    private showLockstep;
    /**
     * The loop this player runs for the room while they host a round: their own input and
     * actions go straight to it, as the service would only pass them back. Between rounds
     * they go to the service, which explains why it refuses them.
     */
    private localLoop;
    /**
     * Shows a tick of this player's own loop at once, as the service will once the tick has
     * made the trip: the room's part from the service, the game's from the rules, in this
     * player's view.
     */
    private showHosted;
    /**
     * Quick play only places a player when they arrive, so two players can end up alone
     * in separate rooms, for example after one returns to a held seat. A drop-in player
     * who stays alone moves to the busiest room that has others and a free seat.
     * Checks are jittered so two lonely players rarely move at the same moment; when they
     * do, quick play's room creation lock still brings them together.
     */
    private scheduleMerge;
    private stopMerge;
    private alone;
    private checkMerge;
    private stopInput;
    /**
     * Rooms whose service tick reads what the page sends once a tick, a realtime room the
     * service runs and an owner room, time those sends to it: the page measures its round trip.
     * A host's loop and lockstep frames keep their own time.
     */
    private pacesToServiceTick;
    private startPinging;
    publicRooms(): Promise<PublicMultiplayerRoom[]>;
    leave(): Promise<void>;
    /** Leaves without reporting a closed connection, for moving to another room. */
    private leaveRoom;
    dispose(): void;
    private connect;
    /** Takes or gives up running the rules for the room, when the service asks. */
    private setHosting;
    private stopHosting;
    private bindHost;
    private bind;
    private receiveSnapshot;
    /**
     * A realtime tick as the changes since the snapshot before. Applied to the snapshot this
     * page holds when that is the one they follow; otherwise the page asks for a whole one,
     * once, and drops changes until it arrives.
     */
    private receiveDelta;
    private joinOptions;
    private token;
    private resolveRoom;
    private request;
    private endpoint;
    private persist;
    private setStatus;
    private error;
}
export type MultiplayerOptions = Omit<MultiplayerClientOptions, "manifest" | "identity" | "allowLocalhost">;
/**
 * A client for one player's room connection, from the game that init returned. Game is the
 * type of the rules from defineGame, which types client.moves. Throws not_configured when
 * the game has no multiplayer deployment.
 */
export declare function createMultiplayerClient<Game = unknown>(game: OhMyGame, callbacks?: MultiplayerClientCallbacks, options?: MultiplayerOptions & {
    rules?: Game;
}): MultiplayerClient<Game>;
