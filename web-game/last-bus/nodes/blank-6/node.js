import { playScene } from "../../shared/style/components.js";

export function mount(context) {
  // This is the 回拨 path: the player called the number back.
  context.state.set("calledBack", true);
  return playScene(context, { signal: "next" });
}
