import { mountHomeButton } from "../../shared/components/home-button.js";
import { showBackdrop } from "../../shared/style/components.js";

export function mount(context) {
  const backdrop = showBackdrop(context);
  const removeHomeButton = mountHomeButton(context);
  return () => {
    backdrop.cleanup();
    removeHomeButton();
  };
}
