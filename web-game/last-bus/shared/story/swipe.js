import { showBackdrop } from "../style/components.js";
import { el, screenOf } from "./dom.js";

/** The phone glyph inside the green answer knob. */
const PHONE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>' +
  "</svg>";

/**
 * A slide-to-answer control. The player drags the knob across the track, or
 * presses it with the keyboard; the story waits without a timer or a fail
 * state until they do.
 *
 * @param {object} context the Node context passed to mount
 * @param {object} config
 * @param {string} [config.caller]
 * @param {string} [config.time]
 * @param {string} [config.label]
 * @param {(context: object) => void} config.onDone
 * @returns {() => void} cleanup
 */
export function mountSwipe(context, config = {}) {
  const scene = screenOf(context);
  const backdrop = showBackdrop(context);

  const panel = el("div", "swipe-call");
  if (config.caller) panel.append(el("p", "swipe-caller", config.caller));
  if (config.time) panel.append(el("p", "swipe-time", config.time));
  const track = el("div", "swipe-track");
  const label = el("span", "swipe-label", config.label || "滑动接听");
  const knob = el("button", "swipe-knob");
  knob.type = "button";
  knob.setAttribute("aria-label", config.label || "滑动接听");
  knob.dataset.testid = "swipe-answer";
  knob.innerHTML = PHONE_ICON;
  track.append(label, knob);
  panel.append(track);
  scene.append(panel);

  let dragging = false;
  let startX = 0;
  let x = 0;
  let max = 0;
  let done = false;

  const measure = () => {
    // The knob may sit at a CSS offset (its `translate`), while the drag uses
    // `transform`; fold the offset in so the end position stays in the track.
    const offset = parseFloat(getComputedStyle(knob).translate) || 0;
    max = Math.max(1, track.clientWidth - knob.clientWidth - 8 - offset);
  };
  const place = (value) => {
    x = Math.max(0, Math.min(max, value));
    knob.style.transform = `translateX(${x}px)`;
  };
  const answer = () => {
    if (done) return;
    done = true;
    panel.classList.add("is-answered");
    window.setTimeout(() => {
      cleanup();
      config.onDone?.(context);
    }, 260);
  };
  const onDown = (event) => {
    if (done) return;
    measure();
    dragging = true;
    startX = event.clientX - x;
    knob.setPointerCapture?.(event.pointerId);
  };
  const onMove = (event) => {
    if (!dragging || done) return;
    place(event.clientX - startX);
    if (x >= max - 2) answer();
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    if (!done) place(0);
  };

  knob.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  knob.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      answer();
    }
  });

  function cleanup() {
    knob.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    panel.remove();
    backdrop.cleanup();
  }
  return cleanup;
}
