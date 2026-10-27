import { showBackdrop } from "../style/components.js";
import { el, screenOf } from "./dom.js";
import { mountCutscene } from "./cutscene.js";

/**
 * A required reveal: the player clicks one hotspot, the backdrop changes to
 * the close-up, and the lines play out. Used for the newspaper that ends the
 * second branch.
 *
 * @param {object} context the Node context passed to mount
 * @param {object} config
 * @param {string} [config.hud]
 * @param {string} [config.prompt]
 * @param {{label: string, x: number, y: number}} config.gate
 * @param {string} config.revealAsset the Asset shown after the click
 * @param {Array<{speaker?: string, text?: string}>} config.beats
 * @param {string} config.signal
 * @returns {() => void} cleanup
 */
export function mountReveal(context, config = {}) {
  const scene = screenOf(context);
  const backdrop = showBackdrop(context);
  if (config.hud) scene.append(el("p", "hud", config.hud));

  const prompt = el("div", "subtitle");
  prompt.append(el("p", "line", config.prompt || ""));
  const spot = el("button", "hotspot");
  spot.type = "button";
  spot.style.left = `${config.gate.x}%`;
  spot.style.top = `${config.gate.y}%`;
  spot.setAttribute("aria-label", config.gate.label);
  spot.dataset.testid = "reveal-gate";
  spot.append(el("span", "", config.gate.label));
  scene.append(spot, prompt);

  let next = null;
  spot.addEventListener("click", () => {
    if (next) return;
    spot.remove();
    prompt.remove();
    backdrop.cleanup();
    const layer = scene.querySelector('[data-media="backdrop"]');
    layer?.setAttribute("data-asset", config.revealAsset);
    layer?.setAttribute("data-type", "image");
    next = mountCutscene(context, { hud: config.hud, beats: config.beats, signal: config.signal });
  });

  function cleanup() {
    spot.remove();
    prompt.remove();
    scene.querySelectorAll(".hud").forEach((node) => node.remove());
    backdrop.cleanup();
    if (next) next();
  }
  return cleanup;
}
