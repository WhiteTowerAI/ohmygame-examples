/**
 * The in-game menu, over every Scene of the story: the button at the top
 * right, or Esc, pauses the Scene and opens 继续 / 设置 / 故事线 / 回到主菜单.
 *
 * This is page code beside the story runtime, not a Scene. index.html loads
 * it; it keeps the context of the Scene on screen and acts through it, so the
 * runtime under story/ stays as OhMyGame ships it. Scenes off the story map
 * (the main menu and the story map) are menus themselves and show no button;
 * the main menu opens the same settings through window.__mobanGameMenu.
 * A thumbnail capture (ohmygame-silent=1) leaves the menu out, so the canvas
 * shows each Scene as it is; the editor's preview shows it like the game.
 */
const params = new URLSearchParams(location.search);
if (params.get("ohmygame-silent") !== "1") {
  window.addEventListener("ohmygame:story-ready", () => install(window.__OHMYGAME_STORY__), { once: true });
}

function install({ host, graph }) {
  const base = new URL("./", document.baseURI);
  /** Scenes that are menus themselves, by ID; like the story map's OFF_MAP. */
  const offMap = new Set(["main-menu", "story-map"]);
  /** The Scene on screen, with the context the runtime gave it. */
  let current;
  let view = "closed";
  /** Settings opened straight from the main menu go back there, not to the pause panel. */
  let settingsOnly = false;
  let paused = [];
  let closeMap;

  const layer = document.createElement("div");
  layer.dataset.gameMenu = "";
  Object.assign(layer.style, { position: "absolute", inset: "0", zIndex: "10", pointerEvents: "none" });
  host.projectRoot.append(layer);
  const root = layer.attachShadow({ mode: "open" });
  root.innerHTML = `
    <link rel="stylesheet" href="${new URL("shared/game-menu.css", base)}" />
    <button type="button" class="game-menu-button" data-open hidden>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
      <span>菜单</span>
    </button>
    <div class="game-menu" data-menu hidden>
      <div class="game-menu-panel" data-view="main">
        <h2 class="title">暂停</h2>
        <button type="button" class="option" data-close>继续</button>
        <button type="button" class="option" data-show="settings">设置</button>
        <button type="button" class="option" data-map>故事线</button>
        <button type="button" class="option" data-title>回到主菜单</button>
      </div>
      <div class="game-menu-panel" data-view="settings" hidden>
        <h2 class="title">设置</h2>
        <label class="game-menu-setting">
          <span>音量</span>
          <input type="range" min="0" max="100" step="1" data-volume />
          <output data-volume-value></output>
        </label>
        <button type="button" class="action is-quiet" data-show="main">返回</button>
      </div>
    </div>`;
  const button = root.querySelector("[data-open]");
  const menu = root.querySelector("[data-menu]");
  const volume = root.querySelector("[data-volume]");
  const volumeValue = root.querySelector("[data-volume-value]");

  const update = () => {
    button.hidden = view !== "closed" || !current || offMap.has(current.id);
  };
  const show = (next) => {
    view = next;
    menu.hidden = view === "closed";
    for (const panel of root.querySelectorAll("[data-view]")) panel.hidden = panel.dataset.view !== view;
    update();
  };

  const open = () => {
    if (view !== "closed" || button.hidden) return;
    pause();
    show("main");
    root.querySelector("[data-close]").focus();
  };
  const pause = () => {
    // Pause what the Scene is playing, so nothing goes on behind the menu.
    paused = [...host.projectRoot.querySelectorAll("[data-playable-surface]")]
      .flatMap((surface) => [...(surface.shadowRoot?.querySelectorAll("video, audio") ?? [])])
      .filter((media) => !media.paused);
    for (const media of paused) media.pause();
  };
  const close = () => {
    closeMap?.();
    settingsOnly = false;
    show("closed");
    for (const media of paused) void media.play().catch(() => {});
    paused = [];
  };

  const showSettings = () => {
    if (!current) return;
    const level = Math.round((current.context.preferences.get().soundVolume ?? 1) * 100);
    volume.value = String(level);
    volumeValue.textContent = String(level);
    show("settings");
  };
  volume.addEventListener("input", () => {
    volumeValue.textContent = volume.value;
    void current?.context.preferences.set({ soundVolume: Number(volume.value) / 100 }).catch(() => {});
  });

  // The story map Scene draws the map here too, with this Scene's progress.
  const openMap = async () => {
    const scene = graph.nodes.find((node) => node.id === "story-map");
    if (!scene || !current) return;
    const holder = document.createElement("div");
    holder.className = "game-menu-map";
    const mapRoot = holder.attachShadow({ mode: "open" });
    const lifecycle = new AbortController();
    let cleanup;
    closeMap = () => {
      closeMap = undefined;
      lifecycle.abort();
      void Promise.resolve(typeof cleanup === "function" ? cleanup() : undefined).catch(() => {});
      holder.remove();
    };
    try {
      const html = await (await fetch(new URL(scene.source.html, base))).text();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = new URL(scene.source.css, base).href;
      const styled = new Promise((resolve) => { link.onload = link.onerror = resolve; });
      const template = document.createElement("template");
      template.innerHTML = html;
      mapRoot.append(link, template.content);
      root.append(holder);
      await styled;
      const { mount } = await import(`${new URL(scene.source.javascript, base).href}?menu=${Date.now()}`);
      cleanup = await mount({
        root: mapRoot,
        story: current.context.story,
        assets: current.context.assets,
        navigation: { back: async () => closeMap?.(), emit: async () => {}, connected: () => false },
        lifecycle: { signal: lifecycle.signal },
      });
    } catch (cause) {
      console.error(cause);
      closeMap?.();
    }
  };

  // Back to the main menu: keep the game where it is and start the page again.
  const toTitle = async () => {
    await current?.context.session.save().catch(() => {});
    const url = new URL(location.href);
    for (const key of ["scene", "ohmygame-new-game", "ohmygame-forget-seen"]) url.searchParams.delete(key);
    location.replace(url);
  };

  button.addEventListener("click", open);
  root.querySelector("[data-close]").addEventListener("click", close);
  root.querySelector("[data-map]").addEventListener("click", () => void openMap());
  root.querySelector("[data-title]").addEventListener("click", () => void toTitle());
  const back = () => (settingsOnly ? close() : show("main"));
  for (const target of root.querySelectorAll("[data-show]")) {
    target.addEventListener("click", () => (target.dataset.show === "settings" ? showSettings() : back()));
  }

  // The main menu's 设置 opens the same panel.
  window.__mobanGameMenu = {
    settings: () => {
      if (view !== "closed" || !current) return;
      pause();
      settingsOnly = true;
      showSettings();
    },
  };

  // Esc opens and closes the menu; while it is open, keys do not reach the Scene.
  window.addEventListener("keydown", (event) => {
    if (closeMap) {
      // The map handles its own Esc and goes back to the menu.
      if (event.key !== "Escape") event.stopImmediatePropagation();
      return;
    }
    if (event.key === "Escape" && (view !== "closed" || !button.hidden)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (view === "settings") back();
      else if (view === "main") close();
      else open();
    } else if (view !== "closed") {
      event.stopImmediatePropagation();
    }
  }, { capture: true });

  // Follow the Scene on screen; a Scene that moves on by itself closes the menu.
  const mountNode = host.mountNode.bind(host);
  host.mountNode = (surface, context) => {
    current = { id: surface.id, context };
    if (view !== "closed") close();
    update();
    return mountNode(surface, context);
  };
}
