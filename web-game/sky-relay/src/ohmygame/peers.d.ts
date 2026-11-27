export type PeerStatus = "connecting" | "open" | "failed";
/** Public STUN servers, which tell a page its public address; both answer from mainland China. */
export declare const DEFAULT_ICE_SERVERS: RTCIceServer[];
/** Rooms with more players connect none: every page would hold a connection to each other one. */
export declare const P2P_MAX_PLAYERS = 8;
/** How long a connection may take to open before it is given up. */
export declare const P2P_CONNECT_TIMEOUT_MS = 15000;
/** How long after giving up the offering page tries again. */
export declare const P2P_RETRY_MS = 60000;
export interface PeerOptions {
    iceServers?: RTCIceServer[];
}
export interface PeerHooks {
    /** Sends connection setup to another player through the service. */
    signal(to: string, data: Record<string, unknown>): void;
    playerId(): string | undefined;
    /** A state packet straight from a player. */
    state(from: string, packet: unknown): void;
    /** A message packet straight from a player. */
    message(from: string, packet: unknown): void;
}
export declare class PeerMesh {
    private readonly hooks;
    private readonly peers;
    /** Players whose connection was given up, and when the offering page may try again. */
    private readonly failed;
    private wanted;
    private readonly factory?;
    private readonly iceServers;
    constructor(hooks: PeerHooks, options?: PeerOptions);
    /** Whether this browser can connect directly at all. */
    get available(): boolean;
    /** Each other player this page has tried to reach directly, and how that went. */
    status(): Record<string, PeerStatus>;
    /** Whether a state or message would reach anyone directly now. */
    get open(): boolean;
    /** The players in the room now: connects to new ones, drops those gone. */
    update(players: readonly string[]): void;
    /** Connection setup another player sent through the service. */
    receive(from: string, data: unknown): Promise<void>;
    /** Sends a state packet to every player reached directly. */
    sendState(packet: unknown): void;
    /** Sends a message packet to every player reached directly. */
    sendMessage(packet: unknown): void;
    close(): void;
    private send;
    private offer;
    private create;
    private deliver;
    private addIncoming;
    /** Gives up a connection; the offering page tries again after P2P_RETRY_MS. */
    private fail;
    private drop;
}
