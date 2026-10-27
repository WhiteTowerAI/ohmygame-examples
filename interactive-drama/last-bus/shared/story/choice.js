import { showBackdrop } from "../style/components.js";
import { el, screenOf } from "./dom.js";

/**
 * Shows a prompt with a list of answers. The chosen answer's Signal is
 * emitted. An answer whose Signal has no edge is shown disabled, so a draft
 * is still playable.
 *
 * @param {object} context the Node context passed to mount
 * @param {object} config
 * @param {string} [config.hud]
 * @param {string} [config.prompt]
 * @param {Array<{label: string, signal: string, note?: string}>} config.options
 * @returns {() => void} cleanup
 */
export function mountChoice(context, config = {}) {
  const scene = screenOf(context);
  const backdrop = showBackdrop(context);
  if (config.hud) scene.append(el("p", "hud", config.hud));

  if (config.prompt) {
    const box = el("div", "subtitle");
    box.append(el("p", "line", config.prompt));
    scene.append(box);
  }

  const wrap = el("div", "choices");
  let locked = false;
  const buttons = (config.options || []).map((option) => {
    const button = el("button", "option", option.label);
    button.type = "button";
    button.dataset.testid = `option-${option.signal}`;
    if (option.note) button.append(el("small", "", ` ${option.note}`));
    const usable = context.navigation.connected(option.signal);
    if (!usable) {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    } else {
      button.addEventListener("click", () => {
        if (locked) return;
        locked = true;
        button.classList.add("is-picked");
        wrap.classList.add("is-made");
        window.setTimeout(() => {
          cleanup();
          void context.navigation.emit(option.signal);
        }, 240);
      });
    }
    wrap.append(button);
    return button;
  });

  const onKey = (event) => {
    if (locked) return;
    const n = Number(event.key);
    if (Number.isInteger(n) && n >= 1 && n <= buttons.length && !buttons[n - 1].disabled) {
      buttons[n - 1].click();
    }
  };

  scene.append(wrap);
  window.addEventListener("keydown", onKey);

  function cleanup() {
    window.removeEventListener("keydown", onKey);
    wrap.remove();
    scene.querySelectorAll(".hud, .subtitle").forEach((node) => node.remove());
    backdrop.cleanup();
  }
  return cleanup;
}
