import { type LeaderboardEntry, type LeaderboardOrder, type PlayerScore, type ScoreResult } from "./cloud-protocol.js";
/**
 * Saves that follow the player. Every write lands in the browser first and then on the
 * game service when the game has one ("cloud" in manifest.json): a save made offline is
 * sent when the service can be reached again. Without a service, or in a local build,
 * saves stay in this browser.
 */
export interface GameStorage {
    /** Whether saves reach the game service; false when they stay in this browser. */
    readonly cloud: boolean;
    /**
     * The save under key, or undefined. Reads the service's copy when it can be reached,
     * else this browser's. A save this browser has not sent yet wins over the service's.
     */
    get<T = unknown>(key: string): Promise<T | undefined>;
    /**
     * Keeps value, plain JSON of at most SAVE_MAX_BYTES, under key. Resolves once it is
     * kept in this browser and, when it can be reached, on the service; offline it is sent
     * later. Rejects with quota_exceeded when the player keeps too many saves or it is too large.
     */
    set(key: string, value: unknown): Promise<void>;
    remove(key: string): Promise<void>;
    /** The keys the player keeps. */
    keys(): Promise<string[]>;
    /** Sends saves made while the service could not be reached. The SDK also does this when the browser comes back online. */
    sync(): Promise<void>;
}
/**
 * Leaderboards on the game service. Only signed-in players appear publicly; a guest's
 * score is kept for them, and me() tells them where it would place.
 */
export interface GameLeaderboard {
    /** Whether the game has a game service; without one every call rejects with not_configured. */
    readonly available: boolean;
    /**
     * Submits a score and resolves with the player's best on the board. A board keeps the
     * order of its first score: "desc" (the default) ranks higher scores first, "asc" lower
     * ones, as for a time. Later scores may leave order out; naming the other order rejects
     * with conflict. Rejects with rate_limited after 10 scores in a minute.
     */
    submit(board: string, score: number, options?: {
        order?: LeaderboardOrder;
    }): Promise<ScoreResult>;
    /** Public entries, best first: 10 by default, at most LEADERBOARD_PAGE_MAX. */
    top(board: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<LeaderboardEntry[]>;
    /** The player's best and rank, or undefined before their first score. */
    me(board: string): Promise<PlayerScore | undefined>;
}
