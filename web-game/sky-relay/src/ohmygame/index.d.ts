// Generated from @ohmygame/game-sdk 0.0.1.
import { type GameAuth } from "./account.js";
import { type IdentityProvider } from "./identity.js";
import { type GameLeaderboard, type GameStorage } from "./cloud.js";
import { type CloudConfig } from "./cloud-protocol.js";
import { type MultiplayerManifestConfig } from "./multiplayer-protocol.js";
export { isOhMyGameError, OhMyGameError, type OhMyGameErrorCode } from "./errors.js";
export type { GameAuth } from "./account.js";
export type { GameLeaderboard, GameStorage } from "./cloud.js";
export { isCloudConfig, LEADERBOARD_PAGE_MAX, SAVE_MAX_BYTES, SAVE_MAX_KEYS, SCORE_SUBMITS_PER_MINUTE, type CloudConfig, type LeaderboardEntry, type LeaderboardOrder, type PlayerScore, type ScoreResult, } from "./cloud-protocol.js";
export { gameTokenAudience, isGameAccountConfig, type GameAccountConfig, type OhMyGamePlayer, } from "./account-protocol.js";
export { GuestIdentity, type GuestIdentityOptions, type IdentityProvider } from "./identity.js";
export { defineGame, defineRealtimeGame, type ClientAction, type ClientInput, type ClientMoves, type PlayerAction, type RealtimeGameContext, type RealtimeGameDefinition, type GameContext, type GameDefinition, type GameResult, type MoveContext, type MoveDefinition, type MoveFunction, type MoveOptions, } from "./define-game.js";
export interface InitOptions {
    /**
     * The game's manifest, or where to load it. Defaults to manifest.json beside the
     * page, which OhMyGame writes and publishing checks.
     */
    manifest?: {
        multiplayer?: unknown;
        account?: unknown;
        cloud?: unknown;
    } | string | URL;
    /**
     * Who the player is for game services, in place of the OhMyGame account in game.auth.
     * Without either, deployments that allow guests use a guest.
     */
    identity?: IdentityProvider;
    /** Opt in only for loopback development, never for a published deployment. */
    allowLocalhost?: boolean;
}
/**
 * The game's configuration, which every SDK feature starts from. For rooms, pass it to
 * createMultiplayerClient from @ohmygame/game-sdk/multiplayer.
 */
export interface OhMyGame {
    /** The game's multiplayer deployment, or undefined for a single-player game. */
    readonly multiplayer?: MultiplayerManifestConfig;
    /** The player's OhMyGame account. Sign-in is available in games published to OhMyGame. */
    readonly auth: GameAuth;
    /** The player's saves: in this browser, and on the game service when the game has one. */
    readonly storage: GameStorage;
    /** Leaderboards on the game service; leaderboard.available is false without one. */
    readonly leaderboard: GameLeaderboard;
    /** The game service for saves and leaderboards, from manifest.json's "cloud". */
    readonly cloud?: CloudConfig;
}
/** Reads the game's configuration once; every SDK feature starts from what it returns. */
export declare function init(options?: InitOptions): Promise<OhMyGame>;
