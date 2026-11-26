import { showBackdrop } from "../style/components.js";
import { el, screenOf } from "./dom.js";

/**
 * Plays a run of narration and dialogue lines over the Node's backdrop.
 * The player clicks anywhere (or presses Space/Enter) to move on; the last
 * advance either emits `signal` or calls `onDone(context)`.
 *
 * @param {object} context the Node context passed to mount
 * @param {object} config
 * @param {Array<{speaker?: string, text?: string}>|Function} config.beats
 * @param {string} [config.hud] a chapter label shown at the top left
 * @param {string} [config.signal] the Signal emitted when the run ends
 * @param {(context: object) => void} [config.onDone] runs instead of emitting
 * @returns {() => void} cleanup
 */
export function mountCutscene(context, config = {}) {
  const scene = screenOf(context);
  const backdrop = showBackdrop(context);
  const beats = typeof config.beats === "function" ? config.beats(context) : config.beats || [];

  let index = 0;
  let finished = false;
  let cleanup = () => {};
  let handle = () => cleanup();

  if (config.hud) scene.append(el("p", "hud", config.hud));

  const box = el("div", "subtitle");
  const speaker = el("p", "speaker", "");
  const line = el("p", "line", "");
  const count = el("span", "count", "");
  const hint = el("p", "continue-hint");
  const hintText = el("span", "", config.hintLabel || "点击继续 ▸");
  hint.append(hintText, count);
  box.append(speaker, line);
  scene.append(box, hint);

  const render = () => {
    const beat = beats[index] || {};
    speaker.textContent = beat.speaker || "";
    speaker.hidden = !beat.speaker;
    line.textContent = beat.text || "";
    count.textContent = beats.length > 1 ? ` ${index + 1}/${beats.length}` : "";
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    cleanup();
    if (typeof config.onDone === "function") config.onDone(context);
    else if (config.signal) void context.navigation.emit(config.signal);
  };

  const advance = () => {
    if (finished) return;
    if (index < beats.length - 1) {
      index += 1;
      render();
    } else {
      finish();
    }
  };

  const onKey = (event) => {
    if (event.key === " " || event.key === "Enter" || event.key === "ArrowRight") {
      event.preventDefault();
      advance();
    }
  };

  scene.addEventListener("click", advance);
  window.addEventListener("keydown", onKey);
  render();

  cleanup = () => {
    scene.removeEventListener("click", advance);
    window.removeEventListener("keydown", onKey);
    box.remove();
    hint.remove();
    scene.querySelectorAll(".hud").forEach((node) => node.remove());
    backdrop.cleanup();
  };

  handle = () => cleanup();
  return handle;
}
