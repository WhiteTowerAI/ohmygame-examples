import { showBackdrop } from "../../shared/style/components.js";

export function mount(context) {
  const backdrop = showBackdrop(context);
  const button = context.root.querySelector('[data-signal="board"]');
  const board = async () => {
    await context.state.set("boarded", true);
    await context.navigation.emit("board");
  };
  button.addEventListener("click", board);
  return () => {
    backdrop.cleanup();
    button.removeEventListener("click", board);
  };
}
