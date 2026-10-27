import { showBackdrop } from "../style/components.js";
import { el, screenOf } from "./dom.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const RING_LENGTH = 276.5;

/** The page shake that runs while the window is open. */
const SHAKE = [
  { transform: "translate(0, 0)" },
  { transform: "translate(-3px, 2px)" },
  { transform: "translate(3px, -2px)" },
  { transform: "translate(-2px, -3px)" },
  { transform: "translate(0, 0)" },
];

/**
 * The parking-bell QTE: separate taps that have to be completed inside the
 * window. A tap counts once; holding does not accumulate, and a wrong tap
 * neither counts nor clears progress. Hitting the target ends the window
 * early. Both outcomes continue to the same merge Scene; only the feedback
 * differs.
 *
 * @param {object} context the Node context passed to mount
 * @param {object} config
 * @param {string} [config.hud]
 * @param {string} [config.prompt]
 * @param {number} [config.required] taps needed (default 5)
 * @param {number} [config.duration] window in ms (default 3000)
 * @param {boolean} [config.startOnFirstTap] wait for the first tap before
 *   the window and the shake start (default false: start on mount)
 * @param {number} [config.lateMs] ms into the window when the ring turns red
 *   (default: 70% of the window)
 * @param {boolean} [config.shake] shake the screen while the window is open
 * @param {string} [config.bellLabel] text on the target (default 按铃)
 * @param {string} config.successSignal
 * @param {string} config.failSignal
 * @returns {() => void} cleanup
 */
export function runQte(context, config = {}) {
  const scene = screenOf(context);
  const backdrop = showBackdrop(context);
  const required = config.required ?? 5;
  const duration = config.duration ?? 3000;
  const lateAfter = config.lateMs ?? duration * 0.7;

  if (config.hud) scene.append(el("p", "hud", config.hud));

  const panel = el("div", "qte-panel");
  const prompt = el("p", "qte-prompt", config.prompt || `3 秒内快速点击停车铃 ${required} 次`);
  const qte = el("div", "qte");

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.classList.add("qte-ring");
  const track = document.createElementNS(SVG_NS, "circle");
  track.classList.add("qte-track");
  const time = document.createElementNS(SVG_NS, "circle");
  time.classList.add("qte-time");
  for (const circle of [track, time]) {
    circle.setAttribute("cx", "50");
    circle.setAttribute("cy", "50");
    circle.setAttribute("r", "44");
  }
  time.style.strokeDasharray = String(RING_LENGTH);
  svg.append(track, time);

  const bell = el("button", "key", config.bellLabel ?? "按铃");
  bell.type = "button";
  bell.setAttribute("aria-label", config.bellLabel || "按铃");
  bell.dataset.testid = "qte-bell";
  qte.append(svg, bell);

  const progress = el("p", "qte-progress", `0 / ${required}`);
  panel.append(prompt, qte, progress);
  scene.append(panel);

  let hits = 0;
  let done = false;
  let started = false;
  let raf = 0;
  let startedAt = 0;
  let lateTimer = 0;
  let shake = null;

  const openWindow = () => {
    if (started || done) return;
    started = true;
    startedAt = performance.now();
    raf = requestAnimationFrame(tick);
    lateTimer = window.setTimeout(() => qte.classList.add("is-late"), lateAfter);
    if (config.shake) shake = scene.animate(SHAKE, { duration: 110, iterations: Infinity });
  };

  const onHit = (event) => {
    event.preventDefault();
    if (done) return;
    openWindow();
    hits += 1;
    progress.textContent = `${hits} / ${required}`;
    bell.classList.remove("is-hit");
    void bell.offsetWidth;
    bell.classList.add("is-hit");
    if (hits >= required) finish(true);
  };

  const onKey = (event) => {
    if (event.repeat) return;
    if (event.key === " " || event.key === "Enter") onHit(event);
  };

  const tick = (now) => {
    if (done || !started) return;
    const ratio = Math.min(1, (now - startedAt) / duration);
    time.style.strokeDashoffset = String(RING_LENGTH * ratio);
    if (ratio >= 1) {
      finish(false);
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  function finish(success) {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(lateTimer);
    shake?.cancel();
    bell.removeEventListener("pointerdown", onHit);
    window.removeEventListener("keydown", onKey);
    qte.classList.add(success ? "is-hit" : "is-missed");
    panel.classList.add("is-resolved");
    window.setTimeout(() => {
      cleanup();
      void context.navigation.emit(success ? config.successSignal : config.failSignal);
    }, success ? 420 : 620);
  }

  function cleanup() {
    cancelAnimationFrame(raf);
    window.clearTimeout(lateTimer);
    shake?.cancel();
    bell.removeEventListener("pointerdown", onHit);
    window.removeEventListener("keydown", onKey);
    panel.remove();
    scene.querySelectorAll(".hud").forEach((node) => node.remove());
    backdrop.cleanup();
  }

  bell.addEventListener("pointerdown", onHit);
  window.addEventListener("keydown", onKey);
  if (!config.startOnFirstTap) openWindow();
  return cleanup;
}
