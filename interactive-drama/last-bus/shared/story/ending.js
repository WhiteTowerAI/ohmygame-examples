import { showBackdrop } from "../style/components.js";
import { el, screenOf } from "./dom.js";

/**
 * An ending page: a stamped title, a closing line, and one action that either
 * emits `signal` or runs `onAction(context)`.
 *
 * @param {object} context the Node context passed to mount
 * @param {object} config
 * @param {string} [config.eyebrow]
 * @param {string} [config.title]
 * @param {string} [config.seal]
 * @param {string} [config.body]
 * @param {string} [config.actionLabel]
 * @param {string} [config.signal]
 * @param {(context: object) => void} [config.onAction]
 * @returns {() => void} cleanup
 */
export function mountEnding(context, config = {}) {
  const scene = screenOf(context);
  const backdrop = showBackdrop(context);
  scene.classList.add("is-ending");

  const wrap = el("div", "stage is-ending-copy");
  if (config.eyebrow) wrap.append(el("p", "eyebrow", config.eyebrow));

  const title = el("h2", "title is-display sealed", config.title || "");
  if (config.seal) title.append(el("span", "seal", config.seal));
  wrap.append(title);

  if (config.body) wrap.append(el("p", "body", config.body));

  const actions = el("div", "actions");
  const button = el("button", "action", config.actionLabel || "继续");
  button.type = "button";
  button.dataset.testid = "ending-action";
  button.addEventListener("click", () => {
    cleanup();
    if (typeof config.onAction === "function") config.onAction(context);
    else if (config.signal) void context.navigation.emit(config.signal);
  });
  actions.append(button);
  wrap.append(actions);
  scene.append(wrap);

  function cleanup() {
    wrap.remove();
    scene.classList.remove("is-ending");
    backdrop.cleanup();
  }
  return cleanup;
}
