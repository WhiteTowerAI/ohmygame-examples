/**
 * Who the player is, as a bearer token for the game service. A provider returns
 * undefined when it has no player, for example before sign-in.
 */
export interface IdentityProvider {
    getToken(): Promise<string | undefined>;
}
export interface GuestIdentityOptions {
    serverUrl: string;
    /** Defaults to localStorage, so one browser stays one guest across tabs and visits. */
    storage?: Storage;
}
/**
 * A guest issued by the game service: no account, kept in browser storage until it
 * expires. The SDK falls back to it when the deployment allows guests.
 */
export declare class GuestIdentity implements IdentityProvider {
    private readonly options;
    private readonly storage?;
    private readonly key;
    private issuing?;
    constructor(options: GuestIdentityOptions);
    getToken(): Promise<string>;
    private issue;
    private saved;
}
