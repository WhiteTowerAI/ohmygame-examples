import { playScene } from "../../shared/style/components.js";

export function mount(context) {
  // The look ends here: back to the centre for the other two.
  return playScene(context, { onDone: (ctx) => ctx.navigation.back().catch(() => {}) });
}
