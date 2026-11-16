import { defineRealtimeGame } from "@ohmygame/sdk/game";

export type ArenaState = {
  remaining: number;
  scores: Record<string, number>;
};

/** A short shared round. Every tap is an action, applied on the next server tick. */
export default defineRealtimeGame({
  players: { min: 2, max: 4 },
  tickMs: 200,
  setup: (ctx) => ({
    remaining: 30,
    scores: Object.fromEntries(ctx.players.map((playerId) => [playerId, 0])),
  }),
  playerView: (game) => game,
  input: () => ({}),
  action: (value) => {
    if (value.type !== "pulse") throw new Error("Choose the Pulse action.");
    return { type: "pulse" as const };
  },
  tick: (game, _ctx, _inputs, _dt, actions) => {
    for (const { playerId } of actions) {
      if (game.remaining <= 0) break;
      game.scores[playerId] = (game.scores[playerId] ?? 0) + 1;
      game.remaining -= 1;
    }
  },
  endIf: (game) => {
    if (game.remaining > 0) return undefined;
    const highest = Math.max(...Object.values(game.scores));
    return {
      winners: Object.entries(game.scores)
        .filter(([, score]) => score === highest)
        .map(([playerId]) => playerId),
    };
  },
});
