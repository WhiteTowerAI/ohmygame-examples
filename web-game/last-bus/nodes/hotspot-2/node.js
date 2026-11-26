import { showBackdrop } from "../../shared/style/components.js";
import { hasSeen, markSeen } from "../../shared/story/progress.js";

export function mount(context) {
  const backdrop = showBackdrop(context);
  const spots = [...context.root.querySelectorAll("[data-signal]")];
  const open = (event) => {
    const { signal } = event.currentTarget.dataset;
    // Looking at the notice is remembered for later branches; each look is
    // remembered so its dot stays marked when the player comes back.
    if (signal === "door") context.state.set("heardNotice", true);
    if (signal !== "done") markSeen(context, signal);
    void context.navigation.emit(signal);
  };

  for (const spot of spots) {
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
