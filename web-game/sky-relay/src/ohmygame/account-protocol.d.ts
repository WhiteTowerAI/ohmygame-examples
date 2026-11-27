/** Where a published game signs players in, written to manifest.json as "account" by OhMyGame publishing. */
export interface GameAccountConfig {
    /** The OhMyGame account service, such as https://api.ohmygame.ai. */
    issuer: string;
    /**
     * Pages that may embed the game and hand it the signed-in player, such as OhMyGame's game
     * page. Defaults to the issuer's origin.
     */
    hostOrigins?: string[];
}
/** The player a game token names: the OhMyGame account ID and the name to show. */
export interface OhMyGamePlayer {
    id: string;
    name: string;
}
/** The audience of a game token: the one game it signs a player in to. */
export declare function gameTokenAudience(gameId: string): string;
export declare function isGameAccountConfig(value: unknown, options?: {
    allowLocalhost?: boolean;
}): value is GameAccountConfig;
export declare function isOhMyGamePlayer(value: unknown): value is OhMyGamePlayer;
