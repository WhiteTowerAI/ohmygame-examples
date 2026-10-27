import { showBackdrop } from "../style/components.js";
import { el, screenOf } from "./dom.js";
import { hasSeen } from "./progress.js";

/**
 * A hotspot centre: a fixed picture with optional things to look at, each
 * opening a side Scene, plus an action that moves the story on. The player
 * may look at any, all, or none of them.
 *
 * @param {object} context the Node context passed to mount
 * @param {object} config
 * @param {string} [config.hud]
 * @param {string} [config.prompt]
 * @param {Array<{id: string, label: string, x: number, y: number, signal: string}>} config.hotspots
 * @param {string} [config.continueLabel]
 * @param {string} config.continueSignal
 * @returns {() => void} cleanup
 */
export function mountHotspots(context, config = {}) {
  const scene = screenOf(context);
  const backdrop = showBackdrop(context);
  if (config.hud) scene.append(el("p", "hud", config.hud));

  if (config.prompt) {
    const box = el("div", "subtitle");
    box.append(el("p", "line", config.prompt));
    scene.append(box);
  }

  const dots = (config.hotspots || []).map((spot) => {
    const button = el("button", "hotspot");
    button.type = "button";
    button.style.left = `${spot.x}%`;
    button.style.top = `${spot.y}%`;
    button.setAttribute("aria-label", spot.label);
    button.dataset.testid = `hotspot-${spot.id}`;
    button.append(el("span", "", spot.label));
    if (hasSeen(context, spot.id)) button.classList.add("is-found");
    button.addEventListener("click", () => {
      if (button.dataset.busy) return;
      button.dataset.busy = "1";
      void context.navigation.emit(spot.signal);
    });
    scene.append(button);
    return button;
  });

  const actions = el("div", "actions hotspot-actions");
  const next = el("button", "action", config.continueLabel || "继续");
  next.type = "button";
  next.dataset.testid = "hotspot-continue";
  next.addEventListener("click", () => {
    cleanup();
    void context.navigation.emit(config.continueSignal);
  });
  actions.append(next);
  scene.append(actions);

  function cleanup() {
    dots.forEach((dot) => dot.remove());
    actions.remove();
    scene.querySelectorAll(".hud, .subtitle").forEach((node) => node.remove());
    backdrop.cleanup();
  }
  return cleanup;
}
