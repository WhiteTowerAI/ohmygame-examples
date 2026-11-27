/**
 * Runs rules from defineGame and defineRealtimeGame: the room's own commands, and the
 * compiler that turns rules into the adapter a room calls. The game service uses it, and so
 * does the browser of a player who hosts a game whose rules run there. Free of Node APIs.
 */
import { type GameDefinition, type MoveDefinition, type RealtimeGameDefinition } from "./define-game.js";
import { type MultiplayerGameAdapter, type MultiplayerGameState, type MultiplayerMode, type TurnCommand } from "./multiplayer-protocol.js";
/** Rules as a room calls them. */
export type GameAdapter = MultiplayerGameAdapter<MultiplayerGameState, TurnCommand>;
export declare const TURN_SECONDS = 60;
/** A realtime adapter's tick in milliseconds: its own, or the default. */
export declare function tickMsOf(adapter: {
    tickMs?: number;
}): number;
/** Throws unless the tick is a whole number of milliseconds the service can run. */
export declare function checkTickMs(tickMs: number): void;
export declare function nextTurn(state: MultiplayerGameState, now?: any): void;
/** Ends the match with these winners: one, several for a team, or none for a draw. */
export declare function finishMatch(state: MultiplayerGameState, winners: readonly string[]): void;
/**
 * The room's own commands: the owner starts, restarts once a match has finished, closes and
 * removes players. The room sets up each round through onRoundStart. Rules build on it
 * and handle their game's commands themselves; any other command is rejected. A match left
 * with fewer than players.min seats after a removal ends without a winner.
 */
export declare function createRoomAdapter(mode: MultiplayerMode, players?: {
    min: number;
    max: number;
}): MultiplayerGameAdapter<MultiplayerGameState, TurnCommand>;
/**
 * Turns rules from defineGame or defineRealtimeGame into the adapter rooms run. The room
 * keeps its own lobby, start, restart, close and kick commands; for turn-based rules every other
 * command is a move named by payload.action, and realtime rules read each player's input.
 */
export declare function compileGame<G extends object, Moves extends Record<string, MoveDefinition<G>>>(definition: GameDefinition<G, Moves>): GameAdapter;
export declare function compileGame<G extends object, Input extends object, Action extends object>(definition: RealtimeGameDefinition<G, Input, Action>): GameAdapter;
export declare function compileGame(definition: GameDefinition<object, Record<string, MoveDefinition<object>>> | RealtimeGameDefinition<object, object, object>): GameAdapter;
