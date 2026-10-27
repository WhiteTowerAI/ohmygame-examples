import { showBackdrop } from "../../shared/style/components.js";
import { hasSeen } from "../../shared/story/progress.js";

export function mount(context) {
  const backdrop = showBackdrop(context);
  const spots = [...context.root.querySelectorAll("[data-signal]")];
  const open = (event) => context.navigation.emit(event.currentTarget.dataset.signal);

  for (const spot of spots) {
    // What the player already looked at stays marked after they come back.
    if (hasSeen(context, spot.dataset.signal)) spot.classList.add("is-found");
    // An entry whose Exit goes nowhere yet shows disabled instead of emitting.
    if (context.navigation.connected(spot.dataset.signal)) {
      spot.addEventListener("click", open);
    } else {
      spot.setAttribute("aria-disabled", "true");
      spot.disabled = true;
    }
  }

  return () => {
    backdrop.cleanup();
    for (const spot of spots) spot.removeEventListener("click", open);
  };
}
