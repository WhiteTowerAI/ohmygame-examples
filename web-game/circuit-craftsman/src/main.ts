import './fonts.css';
import './style.css';
import { createElement, Volume2, VolumeX, Shirt, X, ArrowLeft, ArrowRight, Check, Lock, Lightbulb, Sparkles, Languages } from 'lucide';
import type { IconNode } from 'lucide';
import { ART } from './assets';
import type { ArtKey } from './assets';
import { GameAudio } from './audio';
import { startBoard } from './board';
import { REGIONS, LEVELS } from './game/levels';
import { GameSession } from './game/session';
import { loadProgress, saveProgress, SKINS, totalStars } from './game/save';
import { score } from './game/rules';
import type { Hint } from './game/solver';
import { text, isLanguage, levelName, REGION_NAMES, SKIN_NAMES, LANGUAGES } from './i18n';
import type { TextKey } from './i18n';

const icon = (node: IconNode, size = 22) => createElement([node[0], { ...node[1], width: size, height: size, 'stroke-width': 2.2, 'aria-hidden': 'true' }, node[2]]).outerHTML;
const picture = (key: ArtKey, className = '', alt = '') => `<img class="${className}" src="${ART[key]}" alt="${alt}" draggable="false" decoding="async" />`;
const stars = (count: number, className = '') => `<span class="star-line ${className}">${[1,2,3].map((star) => picture(star <= count ? 'star-earned' : 'star-empty')).join('')}</span>`;
const pad = (value: number) => String(value).padStart(2, '0');
const root = document.getElementById('app')!;
root.style.setProperty('--results-image', `url("${ART['results-panel']}")`);
root.style.setProperty('--settings-image', `url("${ART['settings-panel']}")`);
const query = new URLSearchParams(location.search);
const transient = import.meta.env.DEV && query.get('playtest') === '1';
let storageWarning = false;
const audio = new GameAudio();
const session = new GameSession(loadProgress(), (progress) => {
  if (!saveProgress(progress) && !storageWarning) {
    storageWarning = true;
    toast(t('storageError'));
  }
}, transient);
if (transient) session.load(Math.max(0, Math.min(39, Number(query.get('level') || 1) - 1)));
audio.setMuted(session.progress.muted);
let selectedRegion = session.level.region;
let resultTimer = 0;
let hintToken = 0;
let hintWorker: Worker | null = null;
let hintTimeout = 0;
let hintStarted = false;
let displayedLanguage = '';
const t = (key: TextKey, values?: Record<string, string | number>) => text(session.progress.language, key, values);
const localizedLevel = () => levelName(session.progress.language, session.level);
const regionName = (index: number) => REGION_NAMES[session.progress.language][index];

root.innerHTML = `
  <div class="game-shell">
    <div class="scene-backdrop" aria-hidden="true"></div>
    <header class="topbar">
      <div class="brand">${picture(session.progress.language === 'en' ? 'logo-small-en' : 'logo-small', 'brand-logo', t('gameTitle'))}</div>
      <nav class="global-controls" data-i18n-label="gameSettings" aria-label="${t('gameSettings')}">
        <span class="star-bank" data-i18n-label="stars" title="${t('stars')}">${picture('star-earned')}<b id="star-total">0</b><span class="bank-max">/120</span></span>
        <button class="icon-control" data-action="skins" data-i18n-label="workshop" title="${t('workshop')}" aria-label="${t('workshop')}">${icon(Shirt)}</button>
        <button class="icon-control" id="sound-button" data-action="sound" title="${t('mute')}" aria-label="${t('mute')}">${icon(Volume2)}</button>
        <button class="icon-control settings-control" data-action="settings" data-i18n-label="settings" title="${t('settings')}" aria-label="${t('settings')}">${picture('button-settings')}</button>
      </nav>
    </header>
    <main class="game-screen" id="game-screen">
      <aside class="left-scenery" aria-hidden="true">
        ${picture('prop-street-lamp', 'scenery-lamp')}
        ${picture('apprentice-idle', 'apprentice-standing')}
        ${picture('companion-dog', 'companion')}
      </aside>
      <section class="play-area" data-i18n-label="level" aria-label="${t('level')}">
        <div class="level-heading">
          <div class="level-title">${picture('apprentice-happy', 'level-avatar')}<div><div class="level-location" id="level-location"></div><h1 id="level-name">${localizedLevel()}</h1></div></div>
          <div class="reference-target">${picture('star-earned')}<span data-i18n="target">${t('target')}</span><b id="reference-value"></b></div>
        </div>
        <div class="status-bar">
          <div class="step-counter"><span data-i18n="moves">${t('moves')}</span><b id="moves">00</b></div>
          <div class="lamp-counter" aria-live="polite">${icon(Lightbulb, 19)}<span id="bulbs">0 / 1</span><span class="lamp-label" data-i18n="lit">${t('lit')}</span></div>
          <div class="attempt-stars" id="attempt-stars">${stars(3)}</div>
        </div>
        <div class="board-frame"><span class="frame-screw screw-tl"></span><span class="frame-screw screw-tr"></span><span class="frame-screw screw-bl"></span><span class="frame-screw screw-br"></span><div id="board-host" tabindex="0" role="application" aria-label="${t('boardLabel', {size: session.level.size, count: 0})}"></div></div>
        <div class="game-toolbar" data-i18n-label="levelActions" aria-label="${t('levelActions')}">
          <button class="tool-button" data-action="undo" id="undo-button" data-i18n-label="undo" title="${t('undo')}" aria-label="${t('undo')}">${picture('button-undo')}<span data-i18n="undo">${t('undo')}</span></button>
          <button class="tool-button" data-action="restart" data-i18n-label="restart" title="${t('restart')}" aria-label="${t('restart')}">${picture('button-restart')}<span data-i18n="restart">${t('restart')}</span></button>
          <button class="tool-button hint-button" data-action="hint" id="hint-button" data-i18n-label="hint" title="${t('hint')}" aria-label="${t('hint')}">${picture('button-hint')}<span id="hint-label">${t('hint')}</span><i class="hint-dot" hidden></i></button>
          <button class="tool-button" data-action="levels" data-i18n-label="levels" title="${t('levels')}" aria-label="${t('levels')}">${picture('button-levels')}<span data-i18n="levels">${t('levels')}</span></button>
        </div>
      </section>
      <aside class="right-scenery" aria-hidden="true">
        ${picture('prop-notice-board', 'scenery-notice')}
        ${picture('prop-toolbox', 'scenery-toolbox')}
        ${picture('prop-traffic-cone', 'scenery-cone')}
      </aside>
    </main>
    <main class="level-screen" id="level-screen" hidden></main>
    <div id="overlay-root"></div>
    <div class="toast" id="toast" role="status" hidden></div>
    <div class="loading-cover" id="loading-cover">${picture(session.progress.language === 'en' ? 'logo-small-en' : 'logo-small', 'loading-logo', t('gameTitle'))}<div class="loading-bar"><i id="loading-fill"></i></div><span id="loading-caption">${t('loading')}</span></div>
  </div>`;

const find = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
const host = find('#board-host');

function toast(message: string): void {
  const element = root.querySelector<HTMLElement>('#toast');
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  window.setTimeout(() => { if (element.textContent === message) element.hidden = true; }, 2600);
}

function sizeBoard(): void {
  const width = root.clientWidth;
  const height = root.clientHeight;
  const mobile = width < 980;
  const shortFrame = height <= 560 && width > 540;
  const side = Math.max(120, Math.floor(Math.min(560, width - (shortFrame ? 248 : mobile ? 32 : 540), height - (shortFrame ? 70 : mobile ? 280 : 326))));
  root.style.setProperty('--board-side', `${side}px`);
  requestAnimationFrame(fitLevelTitle);
  const currentBoard = board;
  if (currentBoard?.scene.ready && session.screen === 'game') {
    requestAnimationFrame(() => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height || session.screen !== 'game') return;
      currentBoard.game.canvas.style.width = `${width}px`;
      currentBoard.game.canvas.style.height = `${height}px`;
      currentBoard.game.scale.resize(width, height);
    });
  }
}

let board: ReturnType<typeof startBoard> | undefined;
sizeBoard();
board = startBoard(host, session, {
  progress: (amount) => { find('#loading-fill').style.width = `${Math.round(amount * 100)}%`; },
  error: (key) => {
    find('#loading-caption').innerHTML = `${t('loadError')} <button data-action="reload" class="text-command">${t('retry')}</button>`;
    console.error(`Cannot load art: ${key}`);
  },
  ready: () => {
    root.classList.add('ready');
    find('#loading-cover').hidden = true;
    sizeBoard();
  },
  touch: () => { audio.unlock(); host.focus({ preventScroll: true }); },
});
new ResizeObserver(sizeBoard).observe(root);

function fitLevelTitle(): void {
  const title = find('#level-name');
  if (!title.clientWidth) return;
  title.style.fontSize = '';
  let size = Number.parseFloat(getComputedStyle(title).fontSize);
  while (title.scrollWidth > title.clientWidth && size > 10) title.style.fontSize = `${--size}px`;
}

function syncLanguage(): void {
  const language = session.progress.language;
  if (displayedLanguage === language) return;
  displayedLanguage = language;
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = t('gameTitle');
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) element.textContent = t(element.dataset.i18n as TextKey);
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    const label = t(element.dataset.i18nLabel as TextKey);
    element.title = label;
    element.setAttribute('aria-label', label);
  }
  for (const [selector, key] of [['.brand-logo', language === 'en' ? 'logo-small-en' : 'logo-small'], ['.loading-logo', language === 'en' ? 'logo-small-en' : 'logo-small']] as const) {
    const image = find<HTMLImageElement>(selector);
    image.src = ART[key];
    image.alt = t('gameTitle');
  }
}

function updateHud(): void {
  syncLanguage();
  const level = session.level;
  root.classList.toggle('reduced-motion', session.progress.reducedMotion);
  const region = REGIONS[level.region];
  const current = level.id - level.region * 10;
  find('#star-total').textContent = String(totalStars(session.progress));
  find('#level-location').textContent = `${regionName(level.region)} / ${pad(current)}`;
  find('#level-name').textContent = localizedLevel();
  requestAnimationFrame(fitLevelTitle);
  find('#moves').textContent = pad(session.moves);
  find('#bulbs').textContent = `${session.circuit.lit.size} / ${level.goals.length}`;
  find('.lamp-counter').classList.toggle('all-lit', session.phase === 'won');
  find('#reference-value').textContent = `≤ ${level.reference}${session.progress.language === 'zh' ? ' 步' : ''}`;
  find('#attempt-stars').innerHTML = stars(score(session.moves, level.reference, session.usedHint));
  find<HTMLButtonElement>('#undo-button').disabled = !session.active || session.history.length === 0;
  find<HTMLButtonElement>('#hint-button').disabled = !session.active || session.hintBusy;
  find('#hint-label').textContent = t(session.hintBusy ? 'computing' : 'hint');
  find('.hint-dot').hidden = !session.usedHint;
  find<HTMLButtonElement>('#sound-button').innerHTML = icon(session.progress.muted ? VolumeX : Volume2);
  find<HTMLButtonElement>('#sound-button').title = t(session.progress.muted ? 'unmute' : 'mute');
  find<HTMLButtonElement>('#sound-button').setAttribute('aria-label', t(session.progress.muted ? 'unmute' : 'mute'));
  find('.scene-backdrop').style.backgroundImage = `url("${ART[`background-${region.key}`]}")`;
  root.style.setProperty('--region-accent', region.accent);
  host.setAttribute('aria-label', t('boardLabel', {size: level.size, count: session.circuit.lit.size}));
  const avatar = find<HTMLImageElement>('.level-avatar');
  avatar.src = ART[session.phase === 'won' ? 'apprentice-victory' : session.hintBusy || session.hint ? 'apprentice-thinking' : session.moves > level.reference * 2 ? 'apprentice-surprised' : 'apprentice-happy'];
}

function renderLevels(): void {
  const rows = REGIONS.map((region, regionIndex) => {
    return `<section class="district-row ${selectedRegion === regionIndex ? 'current-district' : ''}">
      <div class="district-header">${picture(`thumbnail-${region.key}`, 'district-thumb')}<h3>${regionName(regionIndex)}</h3></div>
      <div class="level-grid">${LEVELS.slice(regionIndex * 10, regionIndex * 10 + 10).map((level) => {
        const locked = !transient && level.id > session.progress.unlocked;
        const count = session.progress.stars[level.id - 1];
        return `<button data-action="level" data-level="${level.id - 1}" data-testid="level-${level.id}" class="level-cell ${locked ? 'locked' : ''} ${level.id === session.level.id ? 'current-level' : ''}" ${locked ? 'disabled' : ''} aria-label="${t('levelLabel', {level: level.id, name: levelName(session.progress.language, level), status: locked ? t('locked') : t('starPrice', {count})})}" title="${levelName(session.progress.language, level)}">${picture(locked ? 'level-locked' : 'level-unlocked')}<b>${pad(level.id)}</b>${!locked ? stars(count) : ''}</button>`;
      }).join('')}</div>
    </section>`;
  }).join('');
  find('#level-screen').innerHTML = `<div class="selection-heading"><button class="icon-control selection-back" data-action="back-game" title="${t('backBoard')}" aria-label="${t('backBoard')}">${icon(ArrowLeft)}</button><h2>${t('levels')}</h2></div><div class="district-list">${rows}</div>`;
}

function actionButton(action: string, label: string, gold = false): string {
  return `<button data-action="${action}" class="action-button ${gold ? 'gold' : ''}">${picture(gold ? 'action-gold' : 'action-blue')}<span>${label}</span>${action === 'next' ? icon(ArrowRight, 18) : ''}</button>`;
}

function renderOverlay(): void {
  const overlayRoot = find('#overlay-root');
  const overlay = session.overlay;
  const previousFocus = document.activeElement as HTMLElement | null;
  const focusKey = previousFocus && overlayRoot.contains(previousFocus)
    ? ['language', 'action', 'setting', 'skin'].find((key) => previousFocus.dataset[key]) : undefined;
  const focusValue = focusKey ? previousFocus!.dataset[focusKey] : undefined;
  if (!overlay) {
    const returning = previousFocus && overlayRoot.contains(previousFocus);
    overlayRoot.innerHTML = '';
    if (returning && session.screen === 'game') host.focus({ preventScroll: true });
    return;
  }
  let content = '';
  let title = '';
  let className = '';
  if (overlay === 'result') {
    title = t(session.level.id === 40 ? 'townComplete' : 'repairComplete');
    className = 'result-dialog';
    content = `<div class="result-title">${title}</div>${picture('apprentice-victory', 'result-portrait')}
      <div class="result-stars">${session.earned === 3 ? picture('fx-completion-stars', 'perfect-stars') : stars(session.earned, 'large-stars')}</div>
      <h2>${localizedLevel()}</h2><span class="result-location">${regionName(session.level.region)} · ${t('levelNumber', {level: pad(session.level.id)})}</span>
      <div class="result-stats"><div><span>${t('thisMoves')}</span><b>${pad(session.moves)}</b></div><div><span>${t('targetGoal')}</span><b>≤ ${session.level.reference}</b></div><div><span>${t('best')}</span><b>${session.progress.stars[session.levelIndex]}<small>${t('starUnit')}</small></b></div></div>
      ${session.usedHint ? `<span class="hint-result">${t('hintUsed')}</span>` : ''}
      <div class="result-actions">${actionButton('retry', t('tryAgain'))}${actionButton(session.level.id === 40 ? 'levels' : 'next', t(session.level.id === 40 ? 'backLevels' : 'next'), true)}</div>`;
  } else if (overlay === 'settings') {
    title = t('settings');
    className = 'settings-dialog';
    content = `<h2 class="settings-title">${t('settings')}</h2><div class="settings-body">
      <label class="setting-row"><span>${icon(session.progress.muted ? VolumeX : Volume2, 25)}${t('sound')}</span><span class="setting-control"><span class="setting-state">${t(session.progress.muted ? 'off' : 'on')}</span><span class="switch"><input type="checkbox" role="switch" data-setting="sound" aria-label="${t('sound')}" ${session.progress.muted ? '' : 'checked'} /><i aria-hidden="true"></i></span></span></label>
      <label class="setting-row"><span>${icon(Sparkles, 25)}${t('motion')}</span><span class="setting-control"><span class="setting-state">${t(session.progress.reducedMotion ? 'on' : 'off')}</span><span class="switch"><input type="checkbox" role="switch" data-setting="motion" aria-label="${t('motion')}" ${session.progress.reducedMotion ? 'checked' : ''} /><i aria-hidden="true"></i></span></span></label>
      <div class="setting-row language-row"><span>${icon(Languages, 25)}${t('language')}</span><div class="language-options" role="group" aria-label="${t('language')}">${LANGUAGES.map(language => `<button data-action="language" data-language="${language}" lang="${language === 'zh' ? 'zh-CN' : 'en'}" aria-pressed="${session.progress.language === language}">${language === 'en' ? 'English' : '中文'}</button>`).join('')}</div></div>
      <div class="settings-actions">${actionButton('close', t(session.screen === 'game' ? 'backGame' : 'backLevels'), true)}</div></div>`;
  } else {
    title = t('workshop');
    className = 'skins-dialog';
    content = `<div class="dialog-heading">${icon(Shirt, 25)}<h2>${t('workshop')}</h2></div><div class="workshop-stars">${picture('star-earned')}<b>${totalStars(session.progress)}</b><span>/ 120</span></div><div class="skin-grid">${SKINS.map((skin) => {
      const locked = totalStars(session.progress) < skin.cost;
      const selected = session.progress.skin === skin.id;
      const name = SKIN_NAMES[session.progress.language][skin.id];
      const status = locked ? t('skinLocked', {count: skin.cost}) : selected ? t('selected') : '';
      return `<button class="skin-item ${selected ? 'selected' : ''} ${locked ? 'locked' : ''}" data-action="skin" data-skin="${skin.id}" ${locked ? 'disabled' : ''} aria-label="${name}${status ? `, ${status}` : ''}"><span class="skin-preview"><img src="${board?.scene.bulbArt.get(skin.id) ?? ART['tile-bulb-on']}" alt="" draggable="false" />${selected ? `<i>${icon(Check, 16)}</i>` : locked ? `<i>${icon(Lock, 16)}</i>` : ''}</span><b>${name}</b><span class="skin-price">${picture('star-earned')}${skin.cost === 0 ? t('initialSkin') : t('starPrice', {count: skin.cost})}</span></button>`;
    }).join('')}</div>`;
  }
  overlayRoot.innerHTML = `<div class="modal-backdrop"><section class="dialog ${className}" role="dialog" aria-modal="true" aria-label="${title}"><button class="dialog-close icon-control" data-action="close" title="${t('close')}" aria-label="${t('close')}">${icon(X, 20)}</button>${content}</section></div>`;
  requestAnimationFrame(() => {
    const retained = focusKey && focusValue ? overlayRoot.querySelector<HTMLElement>(`[data-${focusKey}="${CSS.escape(focusValue)}"]`) : null;
    (retained ?? overlayRoot.querySelector<HTMLElement>('button:not(:disabled)'))?.focus({ preventScroll: true });
  });
}

function updateScreens(): void {
  find('#game-screen').hidden = session.screen !== 'game';
  find('#level-screen').hidden = session.screen !== 'levels';
  if (session.screen === 'levels') renderLevels();
  renderOverlay();
  sizeBoard();
}

function requestHint(): void {
  if (!session.active || session.hintBusy) return;
  audio.unlock();
  if (!hintWorker) {
    hintWorker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
    hintWorker.onerror = (event) => {
      console.error('Hint worker failed:', event.message);
      clearTimeout(hintTimeout);
      session.hintBusy = false;
      hintWorker?.terminate();
      hintWorker = null;
      updateHud();
      toast(t('hintError'));
    };
  }
  const revision = session.revision;
  const token = ++hintToken;
  // The response is tied to the exact board revision; rotation and restart discard it.
  hintWorker.onmessage = (event: MessageEvent<{ token: number; hint: Hint | null; error?: string }>) => {
    if (event.data.token !== hintToken) return;
    clearTimeout(hintTimeout);
    session.hintBusy = false;
    if (event.data.error) {
      console.error('Cannot compute circuit hint:', event.data.error);
      toast(t('hintError'));
    }
    else if (session.applyHint(event.data.hint, revision)) audio.hint();
    updateHud();
  };
  session.hintBusy = true;
  hintStarted = true;
  updateHud();
  hintWorker.postMessage({ token, level: session.levelIndex, rotations: [...session.rotations] });
  hintTimeout = window.setTimeout(() => {
    if (token !== hintToken) return;
    hintWorker?.terminate();
    hintWorker = null;
    session.hintBusy = false;
    updateHud();
    toast(t('hintError'));
  }, 8000);
}

root.addEventListener('click', (event) => {
  const target = event.target as Element;
  if (target.matches('.modal-backdrop') && session.overlay !== 'result') {
    session.setOverlay(null);
    return;
  }
  const button = target.closest<HTMLButtonElement>('button[data-action]');
  if (!button || button.disabled) return;
  audio.unlock();
  const action = button.dataset.action;
  if (action !== 'sound') audio.select();
  switch (action) {
    case 'undo': session.undo(); break;
    case 'restart': case 'retry': session.restart(); break;
    case 'hint': requestHint(); break;
    case 'levels': selectedRegion = session.level.region; session.openLevels(); break;
    case 'back-game': session.returnToGame(); break;
    case 'next': session.load(session.levelIndex + 1); break;
    case 'level': session.load(Number(button.dataset.level)); break;
    case 'sound': session.setMuted(!session.progress.muted); break;
    case 'skins': session.setOverlay('skins'); break;
    case 'settings': session.setOverlay('settings'); break;
    case 'skin': session.setSkin(button.dataset.skin!); break;
    case 'language': if (isLanguage(button.dataset.language)) session.setLanguage(button.dataset.language); break;
    case 'close': session.setOverlay(null); break;
    case 'reload': location.reload(); break;
  }
});

root.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.setting === 'sound') session.setMuted(!input.checked);
  if (input.dataset.setting === 'motion') session.setReducedMotion(input.checked);
});

document.addEventListener('keydown', (event) => {
  const focused = document.activeElement as HTMLElement | null;
  if (session.overlay === 'settings' && isLanguage(focused?.dataset.language) && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const language = event.key === 'Home' ? 'en' : event.key === 'End' ? 'zh' : LANGUAGES[(LANGUAGES.indexOf(focused.dataset.language) + 1) % LANGUAGES.length];
    session.setLanguage(language);
    requestAnimationFrame(() => find<HTMLButtonElement>(`[data-language="${language}"]`).focus({ preventScroll: true }));
    return;
  }
  if (session.overlay && event.key === 'Tab') {
    const buttons = [...find('#overlay-root').querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')];
    if (!buttons.length) return;
    const first = buttons[0];
    const last = buttons.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    if (session.overlay === 'result') session.openLevels();
    else if (session.overlay) session.setOverlay(null);
    else if (session.screen === 'levels') session.returnToGame();
    else session.openLevels();
  }
  if (document.activeElement !== host || !session.active) return;
  const movement: Record<string, [number, number]> = { ArrowUp: [0,-1], ArrowRight: [1,0], ArrowDown: [0,1], ArrowLeft: [-1,0] };
  if (event.key in movement) {
    event.preventDefault();
    board?.scene.moveSelection(...movement[event.key]);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    audio.unlock();
    session.rotate(board!.scene.selected);
  }
});

session.subscribe((change) => {
  audio.setMuted(session.progress.muted);
  if (change.type === 'load' || change.type === 'restart') {
    clearTimeout(resultTimer);
    clearTimeout(hintTimeout);
    hintToken++;
    selectedRegion = session.level.region;
    updateScreens();
  }
  if (change.type === 'rotate' || change.type === 'undo') {
    audio.rotate();
    if (hintStarted) { hintToken++; clearTimeout(hintTimeout); hintStarted = false; }
  }
  if (change.newlyLit?.length && change.type !== 'win') audio.light();
  if (change.type === 'win') {
    audio.complete();
    const revision = session.revision;
    resultTimer = window.setTimeout(() => {
      if (revision === session.revision && session.phase === 'won' && session.screen === 'game') session.setOverlay('result');
    }, session.progress.reducedMotion ? 60 : 600);
  }
  if (change.type === 'screen' || change.type === 'settings') updateScreens();
  updateHud();
});
updateHud();
updateScreens();
void document.fonts.ready.then(fitLevelTitle);

if (import.meta.env.DEV) {
  const box = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), right: Math.round(rect.right), bottom: Math.round(rect.bottom) };
  };
  (globalThis as any).__OHMYGAME_PLAYTEST__ = {
    snapshot: () => ({
      title: t('gameTitle'), language: session.progress.language, persistedLanguage: loadProgress().language,
      focusedLanguage: (document.activeElement as HTMLElement | null)?.dataset.language ?? null,
      focusedAction: (document.activeElement as HTMLElement | null)?.dataset.action ?? null,
      focusedSetting: (document.activeElement as HTMLElement | null)?.dataset.setting ?? null,
      logo: { source: find<HTMLImageElement>('.brand-logo').src, loaded: find<HTMLImageElement>('.brand-logo').complete && find<HTMLImageElement>('.brand-logo').naturalWidth > 0 },
      titleFits: find('#level-name').scrollWidth <= find('#level-name').clientWidth,
      bootId: performance.timeOrigin, ready: board?.scene.ready ?? false, screen: session.screen, overlay: session.overlay,
      phase: session.phase, level: session.level.id, region: regionName(session.level.region), size: session.level.size,
      moves: session.moves, reference: session.level.reference, usedHint: session.usedHint, hintBusy: session.hintBusy,
      hint: session.hint ? { cell: session.hint.cell, bulb: session.hint.bulb, turns: session.hint.turns } : null,
      litBulbs: session.circuit.lit.size, totalBulbs: session.level.goals.length,
      stars: session.earned, unlocked: session.progress.unlocked, totalStars: totalStars(session.progress),
      muted: session.progress.muted, reducedMotion: session.progress.reducedMotion, skin: session.progress.skin, historyDepth: session.history.length,
      cellPixels: Math.round(host.clientWidth / session.level.size),
      layout: {
        width: root.clientWidth, height: root.clientHeight, horizontalOverflow: document.documentElement.scrollWidth > root.clientWidth,
        board: box(host), canvas: box(board?.game.canvas ?? host), toolbar: box(find('.game-toolbar')), footer: null,
        dialog: root.querySelector('.dialog') ? box(find('.dialog')) : null,
        settingsControls: [...root.querySelectorAll<HTMLElement>('[data-setting]')].map((element) => ({setting: element.dataset.setting, checked: (element as HTMLInputElement).checked, ...box(element)})),
        languageOptions: [...root.querySelectorAll<HTMLElement>('[data-language]')].map(element => ({language: element.dataset.language, selected: element.getAttribute('aria-pressed') === 'true', ...box(element)})),
        fontsLoaded: ['Nunito', 'Noto Sans SC'].every((family) => [...document.fonts].some((face) => face.family.includes(family) && face.status === 'loaded')),
        fontErrors: [...document.fonts].filter((face) => face.status === 'error').length,
      },
      cells: board?.scene.snapshotCells() ?? [],
    }),
    reset: () => session.restart(),
  };
}

window.addEventListener('pagehide', () => { hintWorker?.terminate(); });
