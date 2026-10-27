import { playScene } from "../../shared/style/components.js";
import { markSeen } from "../../shared/story/progress.js";

/** Back to the Scene that opened this one, for another look around. */
const back = (ctx) => {
  ctx.navigation.back().catch(() => {});
};

export function mount(context) {
  // Looking at the bus front is remembered for the centre.
  markSeen(context, "window");
  // Only a look at the notice goes on inside this branch.
  const seenNotice = context.state.get("heardNotice") === true;
  return playScene(context, seenNotice ? { signal: "notice" } : { onDone: back });
}
