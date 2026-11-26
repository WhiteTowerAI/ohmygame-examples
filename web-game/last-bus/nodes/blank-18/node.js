import { playScene } from "../../shared/style/components.js";
import { markSeen } from "../../shared/story/progress.js";

export function mount(context) {
  // Looking at the cabin is remembered for the centre, then the player goes
  // back there for the other two looks.
  markSeen(context, "spot-3");
  return playScene(context, { onDone: (ctx) => ctx.navigation.back().catch(() => {}) });
}
