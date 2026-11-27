import { type OhMyGamePlayer } from "./account-protocol.js";
import type { IdentityProvider } from "./identity.js";
/** The player's OhMyGame account in this game: game.auth from init. */
export interface GameAuth extends IdentityProvider {
    /** Whether players can sign in: true in games published to OhMyGame, false in local builds. */
    readonly available: boolean;
    /** The signed-in player, or undefined while they play as a guest. */
    readonly player: OhMyGamePlayer | undefined;
    /**
     * Signs the player in and resolves with them. Inside an OhMyGame page that already has the
     * player, this needs no window. Otherwise it opens OhMyGame sign-in in a popup; where the
     * popup is blocked, as on many phones, the page goes to sign-in and comes back, and init()
     * finishes signing in. Throws unsupported in a local build and cancelled when the player
     * closes the window.
     */
    signIn(): Promise<OhMyGamePlayer>;
    /** A current game token for game services, renewed when it is about to expire; undefined for a guest. */
    getToken(): Promise<string | undefined>;
}
