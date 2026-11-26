import { showBackdrop } from "../../shared/style/components.js";

/** Screens that are menus themselves; a save there is not a game to continue. */
const MENU_SCENES = new Set(["main-menu", "story-map"]);

export function mount(context) {
  const backdrop = showBackdrop(context);
  const entries = [...context.root.querySelectorAll(".choices [data-signal]")];
  const resume = context.root.querySelector("[data-continue]");

  const open = async (event) => {
    const { signal, newGame } = event.currentTarget.dataset;
    // A new game begins with the starting Variables.
    if (newGame !== undefined) await context.session.reset();
    await context.navigation.emit(signal);
  };

  // An entry whose Exit goes nowhere yet shows disabled.
  for (const entry of entries) {
    if (context.navigation.connected(entry.dataset.signal)) {
      entry.addEventListener("click", open);
    } else {
      entry.setAttribute("aria-disabled", "true");
      entry.disabled = true;
    }
  }

  // Continue shows once there is a game in the story to go back to.
  const keepGoing = () => context.session.continue();
  resume.hidden = !(context.session.hasSave() && !MENU_SCENES.has(savedSceneId()));
  resume.addEventListener("click", keepGoing);

  // 设置 opens the in-game menu's settings; without that menu (a thumbnail) it is left out.
  const settings = context.root.querySelector("[data-settings]");
  const openSettings = () => window.__mobanGameMenu?.settings();
  settings.hidden = !window.__mobanGameMenu;
  settings.addEventListener("click", openSettings);

  return () => {
    backdrop.cleanup();
    for (const entry of entries) entry.removeEventListener("click", open);
    resume.removeEventListener("click", keepGoing);
    settings.removeEventListener("click", openSettings);
  };
}

/**
 * The Scene the saved game is in, read from the save the story keeps in this
 * browser (see story/story-web/runtime.js); undefined when it cannot be read.
 */
function savedSceneId() {
  try {
    const story = document.querySelector('meta[name="ohmygame-story"]')?.content;
    const key = `ohmygame:story:${story || new URL("./", document.baseURI).pathname}`;
    return JSON.parse(localStorage.getItem(key) ?? "null")?.currentNodeId;
  } catch {
    return undefined;
  }
}
