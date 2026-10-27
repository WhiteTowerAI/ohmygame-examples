import { playScene } from "../../shared/style/components.js";
import { markSeen } from "../../shared/story/progress.js";

/** Back to the Scene that opened this one, for another look around. */
const back = (ctx) => {
  ctx.navigation.back().catch(() => {});
};

export function mount(context) {
  // Looking at the phone is remembered, so the centre can mark it found.
  markSeen(context, "door");
  // With a callback the story goes on inside this look; without one it ends
  // here and the player returns to the centre.
  const calledBack = context.state.get("calledBack") === true;
  return playScene(context, calledBack ? { signal: "called" } : { onDone: back });
}
