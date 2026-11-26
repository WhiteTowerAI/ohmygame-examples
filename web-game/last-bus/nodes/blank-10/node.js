import { playScene } from "../../shared/style/components.js";

export function mount(context) {
  // The aunt's answer ends here: back to the centre for the other look.
  return playScene(context, { onDone: (ctx) => ctx.navigation.back().catch(() => {}) });
}
