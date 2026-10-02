import { mountHomeButton } from "../../shared/components/home-button.js";
import { showBackdrop } from "../../shared/style/components.js";

export function mount(context) {
  const backdrop = showBackdrop(context);
  const button = context.root.querySelector('[data-signal="continue"]');
  const proceed = () => context.navigation.emit("continue");
  button.addEventListener("click", proceed);
  const removeHomeButton = mountHomeButton(context);
  return () => {
    backdrop.cleanup();
    button.removeEventListener("click", proceed);
    removeHomeButton();
  };
}
