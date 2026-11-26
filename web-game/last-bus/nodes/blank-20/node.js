import { playScene } from "../../shared/style/components.js";

/** Back to the Scene that opened this one, for another look around. */
const back = (ctx) => {
  ctx.navigation.back().catch(() => {});
};

export function mount(context) {
  // Only asking the aunt goes on inside this branch; otherwise the look ends
  // and the player returns to the centre.
  const asked = context.state.get("askedAunt") === true;
  return playScene(context, asked ? { signal: "asked" } : { onDone: back });
}
