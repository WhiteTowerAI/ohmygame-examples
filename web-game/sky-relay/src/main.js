import './style.css';
import { init } from './ohmygame/client.js';
import { createMultiplayerClient } from './ohmygame/multiplayer.js';
import rules from './rules.js';

const paints = [
  { id: 'coral', name: '珊瑚红', cat: '橘子舰长', trait: '勇敢、好胜，遇到海盗就冲在最前面。', skill: '强攻 / 小鱼干轰炸', role: '突击手', file: '/assets/imported/comet-transparent.png', pairFile: '/assets/imported/ui/sky-relay-player-coral-cat-plane-extracted.png', icon: '/assets/imported/paint-coral-icon.png', buttonIcon: '/assets/imported/ui/paint-button-coral.png' },
  // The source pair sheets are named opposite to their actual artwork: the
  // mint-labelled sheet is violet, and the violet-labelled sheet is teal.
  // Keep the player IDs and skills stable while pointing each paint at the
  // correct visible cat-and-plane pairing in multiplayer rooms.
  { id: 'teal', name: '青碧', cat: '薄荷船医', trait: '温柔、细心，最在意小鱼干号的安全。', skill: '自救 / 应急抢修', role: '工程维修', file: '/assets/imported/nova-transparent.png', pairFile: '/assets/imported/ui/sky-relay-player-violet-cat-plane-extracted.png', icon: '/assets/imported/paint-teal-icon.png', buttonIcon: '/assets/imported/ui/paint-button-teal.png' },
  { id: 'violet', name: '紫罗兰', cat: '紫薯护卫', trait: '冷静、可靠，总能在危险来临前张开屏障。', skill: '减伤护盾 / 全域坚盾', role: '屏障守护', file: '/assets/imported/cloudwing-transparent.png', pairFile: '/assets/imported/ui/sky-relay-player-mint-cat-plane-extracted.png', icon: '/assets/imported/paint-violet-icon.png', buttonIcon: '/assets/imported/ui/paint-button-violet.png' },
  { id: 'sun', name: '向阳黄', cat: '奶油领航员', trait: '乐观、机灵，喜欢收集每一条闪闪发光的小鱼干。', skill: '短时加速 / 凝霜空域', role: '时序控场', file: '/assets/imported/sunbird-transparent.png', pairFile: '/assets/imported/ui/sky-relay-player-sun-cat-plane-extracted.png', icon: '/assets/imported/paint-sun-icon.png', buttonIcon: '/assets/imported/ui/paint-button-sun.png' }
];
const defaults = { name: 'Sky Pilot', paint: 'coral', matches: 0, wins: 0 };
const state = { screen: 'lobby', profile: { ...defaults }, roomCode: '', roomId: '', players: [], remotePaints: {}, gameState: null, phase: 'lobby', winnerIds: [], localId: '', hosting: false, status: '连接中…', error: '', copyNotice: '', chat: [], chatDraft: '', chatScrollKey: '', practice: false, skillsPractice: false, skillsRoom: false, practicePos: { x: 30, y: 86 }, practiceRunning: false, practiceDone: false, practiceStarted: 0, practiceItems: [], practiceScore: 0, practiceBattlePoints: 0, practiceBreakdown: null, practiceLives: 3, practiceBoost: 0, practiceTime: 180, practiceLastTick: 0, practiceSpawnClock: 0, practiceGame: null, leaderboard: [], leaderboardMe: null, practiceLeaderboard: [], practiceLeaderboardMe: null, leaderboardStatus: 'idle', authPlayer: null, leaving: false, resultRecorded: false, arrivalNoticeUntil: 0, practiceArrivalNoticeUntil: 0 };
let game;
state.chatOpen = false;
let client;
let paintSyncTimer;
let delegatedExitEventsBound = false;
const audio = { enabled: localStorage.getItem('sky-relay:audio') !== 'off', context: null, master: null, last: {} };

function ensureAudio() {
  if (!audio.enabled) return null;
  if (!audio.context) { audio.context = new (window.AudioContext || window.webkitAudioContext)(); audio.master = audio.context.createGain(); audio.master.gain.value = .16; audio.master.connect(audio.context.destination); }
  if (audio.context.state === 'suspended') void audio.context.resume();
  return audio.context;
}
function tone(frequency, duration = .08, type = 'square', delay = 0, endFrequency = frequency) {
  const ctx = ensureAudio(); if (!ctx || !audio.master) return;
  const start = ctx.currentTime + delay; const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start); oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), start + duration);
  gain.gain.setValueAtTime(.001, start); gain.gain.exponentialRampToValueAtTime(.22, start + .008); gain.gain.exponentialRampToValueAtTime(.001, start + duration);
  oscillator.connect(gain).connect(audio.master); oscillator.start(start); oscillator.stop(start + duration + .02);
}
function sfx(kind) {
  if (!ensureAudio()) return;
  if (kind === 'select') tone(440, .05, 'square', 0, 660);
  if (kind === 'shoot') tone(180, .035, 'sawtooth', 0, 90);
  if (kind === 'pickup') { tone(520, .07, 'square'); tone(780, .09, 'square', .06); }
  if (kind === 'skill') { tone(330, .12, 'triangle', 0, 660); tone(660, .14, 'triangle', .1, 990); }
  if (kind === 'danger') { tone(120, .18, 'sawtooth', 0, 70); tone(90, .18, 'sawtooth', .2, 55); }
  if (kind === 'success') { tone(523, .12, 'square'); tone(659, .12, 'square', .1); tone(784, .2, 'square', .2); }
  if (kind === 'failure') { tone(220, .18, 'sawtooth', 0, 110); tone(130, .3, 'sawtooth', .18, 55); }
}
function toggleAudio() { audio.enabled = !audio.enabled; localStorage.setItem('sky-relay:audio', audio.enabled ? 'on' : 'off'); if (audio.enabled) sfx('select'); render(); }

const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const getPaint = (id) => paints.find((paint) => paint.id === id) || paints[0];
const playerById = (id) => state.players.find((player) => player.playerId === id);
const normalizePaint = (value) => {
  const key = String(value || '').toLowerCase();
  return ({ red: 'coral', coral: 'coral', mint: 'teal', teal: 'teal', green: 'teal', purple: 'violet', violet: 'violet', yellow: 'sun', sun: 'sun', gold: 'sun' })[key] || (paints.some((paint) => paint.id === key) ? key : '');
};
// The room service can keep a disconnected seat briefly for reconnects.  That
// seat remains in `state.players`, but must not count as an active pilot in the
// HUD or in the host's start gate.
const connectedPlayers = () => state.players.filter((player) => player.connected !== false);
const connectedPlayerCount = () => connectedPlayers().length;
const paintForPlayer = (id, index = 0, candidate) => {
  if (id === state.localId) return state.profile.paint;
  const player = candidate || playerById(id);
  return normalizePaint(state.remotePaints[id] || player?.paint || player?.paintId || player?.loadout?.paint) || paints[index % paints.length].id;
};
const planeImg = (paintId, extra = '') => `<img class="plane-img ${paintId === 'violet' ? 'purple-plane ' : ''}${extra}" src="${getPaint(paintId).file}" alt="" />`;
const pairedImg = (paintId, extra = '') => `<img class="paired-plane-img ${extra}" src="${getPaint(paintId).pairFile || getPaint(paintId).file}" alt="${getPaint(paintId).cat}" />`;
const coverPlaneImg = () => `<div class="hero-flight">${pairedImg(state.profile.paint, 'hero-paired-img')}</div>`;

function setError(error) {
  state.error = error?.message || String(error || '连接失败');
  render();
}

function isGuestTokenError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('guest token') || (message.includes('guest') && message.includes('token'));
}

function clearExpiredGuestIdentity() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('ohmygame:multiplayer:guest:')) localStorage.removeItem(key);
    }
  } catch { /* storage may be unavailable */ }
}

function readLocalProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem('sky-relay:profile') || 'null');
    return saved && typeof saved === 'object' ? saved : null;
  } catch {
    return null;
  }
}

function writeLocalProfile() {
  try { localStorage.setItem('sky-relay:profile', JSON.stringify(state.profile)); } catch { /* storage may be disabled */ }
}

async function loadProfile() {
  if (!game?.storage) return;
  let saved = readLocalProfile();
  try {
    const cloudSaved = await game.storage.get('profile');
    if (cloudSaved && typeof cloudSaved === 'object') saved = cloudSaved;
  } catch (error) {
    if (!isGuestTokenError(error)) throw error;
    state.status = '本地资料模式';
    state.error = '游客存档已过期，当前仍可游玩；登录后可恢复云端同步。';
  }
  if (saved && typeof saved === 'object') state.profile = { ...defaults, ...saved };
  if (game.auth?.player?.name) state.profile.name = game.auth.player.name;
  writeLocalProfile();
}

async function saveProfile() {
  writeLocalProfile();
  if (!game?.storage) return false;
  try {
    await game.storage.set('profile', state.profile);
    return true;
  } catch (error) {
    if (isGuestTokenError(error)) {
      state.status = '本地资料模式';
      state.error = '游客存档 token 已过期，资料已保存在本机；发布后登录可恢复云端同步。';
      render();
      return false;
    }
    setError(error);
    return false;
  }
}

async function loadLeaderboard() {
  state.leaderboardStatus = game?.leaderboard?.available ? 'loading' : 'unavailable';
  render();
  if (!game?.leaderboard?.available) return;
  try {
    state.leaderboard = await game.leaderboard.top('match.wins', { limit: 5 });
    state.leaderboardMe = await game.leaderboard.me('match.wins');
    state.practiceLeaderboard = await game.leaderboard.top('practice.score', { limit: 5 });
    state.practiceLeaderboardMe = await game.leaderboard.me('practice.score');
    state.leaderboardStatus = state.leaderboard.length ? 'ready' : 'empty';
  } catch (error) {
    state.leaderboard = [];
    state.leaderboardMe = null;
    state.practiceLeaderboard = [];
    state.practiceLeaderboardMe = null;
    state.leaderboardStatus = 'error';
    state.error = error.message;
  }
  render();
}

async function recordFinishedMatch() {
  const won = state.winnerIds.includes(state.localId);
  state.profile.matches += 1;
  if (won) state.profile.wins += 1;
  void saveProfile();
}

function onSnapshot(snapshot) {
  if (state.leaving || state.screen === 'lobby') return;
  const roomState = snapshot?.state;
  if (!roomState) return;
  state.roomId = snapshot.roomId || state.roomId;
  state.phase = roomState.phase;
  state.winnerIds = Array.isArray(roomState.winnerPlayerIds) ? roomState.winnerPlayerIds : (roomState.winnerPlayerId ? [roomState.winnerPlayerId] : []);
  state.gameState = roomState.game || roomState;
  const gamePlayers = state.gameState?.players || {};
  const previousPlayers = state.players;
  const roster = Array.isArray(roomState.players) ? roomState.players : [];
  const rosterById = new Map(roster.map((player) => [player.playerId, player]));
  // A consented room leave can remove the seat from the service roster before
  // the authoritative game object is retired. Keep that game object visible,
  // but treat a previously-known missing seat as disconnected/OUT immediately.
  const sourcePlayers = Object.keys(gamePlayers).length
    ? Object.values(gamePlayers)
    : roster.map((player) => ({ ...player, id: player.playerId }));
  state.players = sourcePlayers.map((player, index) => {
    const id = player.playerId || player.id;
    const rosterPlayer = rosterById.get(id);
    const wasKnown = previousPlayers.some((entry) => entry.playerId === id);
    const disconnected = rosterPlayer?.connected === false || (!rosterPlayer && wasKnown);
    return { ...(rosterPlayer || {}), ...player, playerId: id, connected: disconnected ? false : (rosterPlayer?.connected ?? true), alive: disconnected ? false : player.alive, paint: paintForPlayer(id, index, rosterPlayer || player) };
  });
  if (state.phase === 'finished') {
    const arrived = state.gameState?.outcome === 'arrived';
    if (arrived && state.arrivalNoticeUntil === 0) {
      state.arrivalNoticeUntil = Date.now() + 2200;
      window.setTimeout(() => { if (state.phase === 'finished') { state.arrivalNoticeUntil = -1; render(); } }, 2250);
    }
    state.screen = 'race';
    if (!state.resultRecorded) { state.resultRecorded = true; void recordFinishedMatch(); }
    void loadLeaderboard();
  } else if (state.phase === 'playing') { state.resultRecorded = false; state.screen = 'race'; }
  else if (state.screen === 'race' || state.screen === 'result') state.screen = 'hangar';
  render();
}

function onMessage(from, message) {
  if (!message || typeof message !== 'object') return;
  const incomingPaint = normalizePaint(message.paint || message.paintId || message.loadout?.paint);
  if (incomingPaint) {
    state.remotePaints[from] = incomingPaint;
    const player = state.players.find((entry) => entry.playerId === from);
    if (player) player.paint = incomingPaint;
    render();
    return;
  }
  if (typeof message.text !== 'string') return;
  const safe = message.text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 160).trim();
  if (!safe) return;
  state.chat.push({ name: playerById(from)?.displayName || '飞行员', text: safe });
  state.chat = state.chat.slice(-20);
  render();
}

async function initOnline() {
  try {
    game = await init({ allowLocalhost: true });
    await loadProfile();
    state.authPlayer = game.auth?.player || null;
    if (state.authPlayer?.name) state.profile.name = state.authPlayer.name;
    client = createMultiplayerClient(game, {
      onStatus: (status) => { state.status = status; render(); },
      onReady: (playerId, inviteCode) => { state.leaving = false; state.localId = playerId; state.roomCode = inviteCode || client.roomCode || ''; state.remotePaints = {}; clearInterval(paintSyncTimer); const syncPaint = () => { if (client?.status === 'connected' && (state.screen === 'hangar' || state.screen === 'race')) { try { client.emit({ paint: state.profile.paint }); } catch { /* room may still be reconnecting */ } } }; syncPaint(); paintSyncTimer = setInterval(syncPaint, 700); render(); },
      onSnapshot,
      onHost: (hosting) => { state.hosting = hosting; render(); },
      onMessage,
      onError: (error) => {
        if (isGuestTokenError(error)) {
          clearExpiredGuestIdentity();
          state.status = '离线练习';
          state.error = '游客连接已过期，已切换到本地练习；重新创建房间会获取新的连接。';
          render();
          return;
        }
        setError(error);
      },
      onCommandResult: (result) => { if (!result.accepted) setError(result.error?.message || '命令被拒绝'); }
    }, { rules });
    if (game.auth?.onAuthChange) game.auth.onAuthChange((player) => { state.authPlayer = player; if (player?.name) state.profile.name = player.name; void saveProfile(); render(); });
    state.status = '已就绪';
    render();
  } catch (error) { state.status = '离线练习'; state.error = error?.message || 'SDK 未连接'; render(); }
}

async function signIn() {
  try { await game.auth.signIn(); state.authPlayer = game.auth.player; render(); } catch (error) { setError(error); }
}

async function joinRoom() {
  if (!client) return setError('SDK 仍在连接，请稍候');
  try {
    state.profile.name = document.querySelector('#design-pilot-name, #pilot-name')?.value.trim() || defaults.name;
    await saveProfile();
    await client.createRoom({ displayName: state.profile.name });
    state.screen = 'hangar';
    render();
  } catch (error) { setError(error); }
}

async function joinInvite() {
  if (!client) return setError('SDK 仍在连接，请稍候');
  try {
    state.profile.name = document.querySelector('#design-pilot-name, #pilot-name')?.value.trim() || defaults.name;
    const code = (document.querySelector('#join-code')?.value || '').trim();
    await client.joinRoom({ roomCode: code, displayName: state.profile.name });
    state.screen = 'hangar';
    render();
  } catch (error) { setError(error); }
}

function startPractice() {
  if (game?.auth?.available && !game.auth.player) state.error = '游客可练习；登录后才会提交官方排行榜。';
  state.practice = true; state.screen = 'race'; state.practiceRunning = true; state.practiceDone = false; state.practiceArrivalNoticeUntil = 0; state.practicePos = { x: 30, y: 86 }; state.practiceStarted = performance.now(); state.practiceLastTick = state.practiceStarted; state.practiceScore = 0; state.practiceBattlePoints = 0; state.practiceBreakdown = null; state.practiceLives = 3; state.practiceBoost = 0; state.practiceTime = 180; state.practiceSpawnClock = 0;
  state.practiceGame = { convoy: { hp: 1000, maxHp: 1000, progress: 0, goal: 100 }, items: [{ id: 'p-coin', kind: 'coin', x: 22, y: 16 }, { id: 'p-fish', kind: 'fish', x: 82, y: -18 }, { id: 'p-heart', kind: 'heart', x: 42, y: -34 }], enemies: [], playerBullets: [], enemyBullets: [], enemyBombs: [], explosions: [], effects: [], pendingUltimates: [], elapsed: 0, enemyClock: 0, enemyFireClock: 0, bombClock: 0, fireClock: 0, pickupClock: 0, outcome: '', hp: 100, hitFlash: 0, hearts: 0, smallCd: 0, ultimateCd: 0, attackBoost: 0, damageReduction: 0, freezeBombs: 0, shieldField: 0, shieldCharges: 0 };
  state.practiceItems = state.practiceGame.items;
  render();
}

function sendChat() {
  const input = document.querySelector('#chat-input');
  const text = (state.chatDraft || input?.value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 160);
  if (!text) return;
  let sent = true;
  if (!state.practice && client) {
    try { sent = client.emit({ text }); } catch (error) { setError(error); return; }
  }
  if (!sent) { state.error = '当前房间尚未连接，消息未发送。'; render(); return; }
  state.chat.push({ name: state.profile.name, text }); state.chat = state.chat.slice(-20); state.chatDraft = ''; if (input) input.value = '';
  render();
}

async function copyInvite() {
  const code = state.roomCode || state.roomId;
  if (!code) return;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
    else {
      const input = document.createElement('textarea');
      input.value = code; input.style.position = 'fixed'; input.style.opacity = '0';
      document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove();
    }
    state.copyNotice = '邀请码已复制';
    render();
    window.setTimeout(() => { state.copyNotice = ''; render(); }, 1800);
  } catch (error) { state.copyNotice = '复制失败，请手动选择邀请码'; render(); }
}

function setChatOpen(open) {
  state.chatOpen = Boolean(open);
  const chat = document.querySelector('.race-chat');
  const toggle = document.querySelector('.race-chat-toggle');
  if (!chat || !toggle) return;
  chat.classList.toggle('is-open', state.chatOpen);
  chat.classList.toggle('is-collapsed', !state.chatOpen);
  chat.setAttribute('aria-hidden', state.chatOpen ? 'false' : 'true');
  toggle.setAttribute('aria-expanded', state.chatOpen ? 'true' : 'false');
  toggle.setAttribute('aria-label', state.chatOpen ? '收起聊天' : '打开聊天');
  const label = toggle.querySelector('b');
  if (label) label.textContent = state.chatOpen ? '收起聊天' : '打开聊天';
}

function handleAction(action) {
  if (action === 'leaderboard') { state.screen = 'leaderboard'; loadLeaderboard(); render(); }
  if (action === 'skills') { state.screen = 'skills'; render(); }
  if (action === 'audio') { toggleAudio(); }
  if (action === 'copy-invite') { void copyInvite(); }
  if (action === 'chat-send') { sendChat(); }
  if (action === 'chat-toggle') { setChatOpen(!state.chatOpen); }
  if (action === 'lobby') {
    if (state.screen === 'lobby') return;
    // Only a real multiplayer room needs the reconnect/leave lock. Navigation
    // from the leaderboard, loadout pages, or local practice must remain
    // reusable; otherwise the first return to the lobby leaves state.leaving
    // stuck and blocks every later "返回大厅" button.
    const leavingRoom = Boolean(client && !state.practice && (state.screen === 'hangar' || state.screen === 'race'));
    if (leavingRoom && state.leaving) return;
    state.leaving = leavingRoom;
    clearInterval(paintSyncTimer); state.screen = 'lobby'; state.practice = false; state.skillsPractice = false; state.skillsRoom = false; state.practiceRunning = false;
    state.gameState = null; state.phase = 'lobby'; state.players = []; state.roomCode = ''; state.roomId = ''; state.error = ''; render();
    const activeClient = client;
    if (leavingRoom && activeClient && activeClient.status !== 'closed') {
      void activeClient.leave().catch(() => {}).finally(() => { if (state.screen === 'lobby') render(); });
    }
  }
  if (action === 'practice') { state.skillsPractice = true; state.skillsRoom = false; state.screen = 'skills'; render(); }
  if (action === 'quickplay') {
    if (state.screen === 'lobby') { state.skillsPractice = false; state.skillsRoom = true; state.screen = 'skills'; render(); }
    else if (state.skillsPractice) { state.skillsPractice = false; startPractice(); }
    else { state.skillsRoom = false; joinRoom(); }
  }
  if (action === 'join') joinInvite();
  if (action === 'signin') signIn();
  if (action === 'start') { if (client) client.sendCommand('start'); }
  if (action === 'again') { if (state.practice) startPractice(); else if (client) client.sendCommand('restart'); }
}

function bind() {
  const audioButton = document.querySelector('.audio-toggle') || document.createElement('button');
  audioButton.className = 'audio-toggle';
  audioButton.dataset.action = 'audio';
  audioButton.dataset.state = audio.enabled ? 'on' : 'off';
  audioButton.setAttribute('aria-label', audio.enabled ? '关闭音效' : '开启音效');
  audioButton.title = audio.enabled ? '关闭音效' : '开启音效';
  audioButton.innerHTML = `<img src="/assets/imported/ui/sound-${audio.enabled ? 'on' : 'off'}.png" alt="" aria-hidden="true"/><span>${audio.enabled ? '音效开' : '音效关'}</span>`;
  if (!audioButton.parentElement) document.querySelector('.shell')?.append(audioButton);
  document.querySelectorAll('[data-action]').forEach((element) => {
    // Chat send has a dedicated pointer handler below so touch and mouse
    // input share one path; skip the generic click binding to avoid sending
    // the same message twice.
    if (element.dataset.action === 'chat-send') return;
    // The race exit controls are rebuilt while the practice simulation is
    // running. Handle those through the stable document listener below rather
    // than retaining a listener on a node that may already have been replaced.
    if (element.matches('.race-exit-hit, .exit-race')) return;
    element.onclick = () => handleAction(element.dataset.action);
  });
  document.querySelectorAll('[data-skill]').forEach((element) => { element.onclick = () => { if (element.disabled) return; if (state.practice) { usePracticeSkill(element.dataset.skill); return; } if (!client || client.status !== 'connected') return; sfx('skill'); try { client.sendAction({ skill: element.dataset.skill, paint: state.profile.paint }); } catch (error) { setError(error); } }; });
  if (!delegatedExitEventsBound) {
    const isExitControl = (target) => target?.closest?.('.race-exit-hit, .exit-race');
    document.addEventListener('pointerdown', (event) => {
      const control = isExitControl(event.target);
      if (!control || control.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      handleAction('lobby');
    });
    document.addEventListener('click', (event) => {
      // Pointer activation is handled above. detail===0 is keyboard activation
      // (Enter/Space) and keeps the exit button accessible without double-run.
      const control = isExitControl(event.target);
      if (!control || control.disabled || event.detail !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      handleAction('lobby');
    });
    delegatedExitEventsBound = true;
  }
  document.querySelectorAll('[data-paint]').forEach((element) => {
    const selectPaint = (event) => {
      event.preventDefault(); event.stopPropagation();
      const nextPaint = element.dataset.paint;
      if (!paints.some((paint) => paint.id === nextPaint)) return;
      // On the home screen a paint card is the entry point to that pilot's
      // detail page. Inside the detail page the same cards only switch the
      // selected pilot while keeping the page open.
      const enteringDetail = state.screen === 'lobby';
      if (state.profile.paint !== nextPaint) {
        state.profile.paint = nextPaint;
        sfx('select');
        saveProfile();
      }
      if (enteringDetail) {
        state.skillsPractice = false;
        state.skillsRoom = false;
        state.screen = 'skills';
      }
      render();
    };
    // pointerdown makes the image cards responsive to mouse, touch and pen;
    // keep click as a keyboard/accessibility fallback without double-selecting.
    element.onpointerdown = selectPaint;
    element.onclick = (event) => { if (event.detail === 0) selectPaint(event); };
  });
  const name = document.querySelector('#design-pilot-name, #pilot-name'); if (name) name.oninput = (event) => { state.profile.name = event.target.value || defaults.name; saveProfile(); };
  const chatInput = document.querySelector('#chat-input'); if (chatInput) chatInput.oninput = (event) => { state.chatDraft = event.target.value; };
  const form = document.querySelector('#chat-form'); if (form) form.onsubmit = (event) => { event.preventDefault(); sendChat(); };
  // Keep the chat toggle on an explicit handler. The race overlay is rebuilt
  // during the live tick, so preventing propagation here avoids a stale
  // overlay listener swallowing the click (especially on touch devices).
  const chatToggle = document.querySelector('.race-chat-toggle');
  if (chatToggle) chatToggle.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleAction('chat-toggle');
  };
  const chatButton = document.querySelector('[data-action="chat-send"]');
  if (chatButton) chatButton.onpointerdown = (event) => { event.preventDefault(); event.stopPropagation(); sendChat(); };
}

function shell(content, className = '') {
  content = content.replaceAll('90 秒', '180 秒').replaceAll('90 SEC', '180 SEC');
  const keepChatFocus = document.activeElement?.id === 'chat-input';
  document.querySelector('#app').innerHTML = `<main class="shell ${className} ${state.practice ? 'practice-mode' : ''}">${content}</main>`;
  if (className === 'race') {
    const field = document.querySelector('.racefield');
    const scorePlayer = state.practice ? { economyPoints: state.practiceScore, battlePoints: state.practiceBattlePoints } : (playerById(state.localId) || {});
    field?.insertAdjacentHTML('afterbegin', `<div class="race-score-hud" aria-label="本局计分"><div class="race-score-card economy"><span>收集分</span><b>${scorePlayer.economyPoints ?? 0}</b></div><div class="race-score-card battle"><span>战斗分</span><b>${scorePlayer.battlePoints ?? 0}</b></div></div>`);
  }
  document.querySelectorAll('.victory-reward').forEach((node) => node.remove());
  if (className === 'race') {
    const overlay = document.querySelector('.race-overlay');
    overlay?.insertAdjacentHTML('beforeend', `<button type="button" class="hit race-chat-toggle" data-action="chat-toggle" aria-label="${state.chatOpen ? '收起聊天' : '打开聊天'}" aria-expanded="${state.chatOpen ? 'true' : 'false'}"><span aria-hidden="true">✉</span><b>${state.chatOpen ? '收起聊天' : '打开聊天'}</b></button>`);
    const chat = document.querySelector('.race-chat');
    chat?.classList.toggle('is-open', state.chatOpen);
    chat?.classList.toggle('is-collapsed', !state.chatOpen);
    chat?.setAttribute('aria-hidden', state.chatOpen ? 'false' : 'true');
  }
  if (state.practice && state.practiceDone && state.screen === 'race' && state.practiceArrivalNoticeUntil <= Date.now()) {
    const outcome = state.practiceGame?.outcome;
    const title = outcome === 'convoy-destroyed' ? '保卫失败' : outcome === 'all-out' ? '全员出局' : '护送成功！';
    const breakdown = state.practiceBreakdown || {};
    document.querySelector('.shell')?.insertAdjacentHTML('beforeend', `<div class="results practice-results"><div class="result-fish-decor" aria-hidden="true"><i></i><i></i><i></i></div><div class="result-showcase"><div class="result-art"><div class="result-characters">${pairedImg(state.profile.paint, 'result-paired-img')}</div><span>${getPaint(state.profile.paint).cat}</span></div><div class="result-copy"><span class="eyebrow">PRACTICE RESULTS</span><h2>${title}</h2><p class="result-caption">${getPaint(state.profile.paint).role} · ${getPaint(state.profile.paint).skill}</p><p class="score-summary">最终得分：<strong>${state.practiceScore}</strong></p><div class="score-breakdown"><p><span>飞艇耐久分</span><b>${breakdown.convoy ?? 0}</b><small>40%</small></p><p><span>经济收集分</span><b>${breakdown.economy ?? 0}</b><small>20%</small></p><p><span>个人生存分</span><b>${breakdown.survival ?? 0}</b><small>20%</small></p><p><span>战斗分</span><b>${breakdown.battle ?? 0}</b><small>20%折算</small></p>${(breakdown.victory ?? 0) > 0 ? `<p><span>护送成功奖励</span><b>+${breakdown.victory}</b><small>额外</small></p>` : ''}</div><p>小鱼干号耐久：${state.practiceGame?.convoy?.hp ?? 0}/${state.practiceGame?.convoy?.maxHp ?? 1000}</p></div></div><div class="result-actions"><button class="primary" data-action="again">再来一局 <span>↗</span></button><button class="text-btn" data-action="lobby">返回大厅</button></div></div>`);
  }
  bind();
  document.querySelectorAll('.score-consensus').forEach((node) => { node.textContent = '结算构成：飞艇耐久 40% · 经济收集 20% · 个人生存 20% · 战斗 20% 折算'; });
  const resultPlayers = Object.values(state.gameState?.players || {}).slice().sort((a, b) => Number(b.alive) - Number(a.alive) || b.score - a.score);
  document.querySelectorAll('.results:not(.practice-results) .result-row').forEach((row, index) => { const player = resultPlayers[index]; const detail = row.querySelector('small'); if (player && detail) detail.textContent = `耐久 ${player.convoyScore ?? 0} · 经济 ${player.economyScore ?? 0} · 生存 ${player.survivalScore ?? 0} · 战斗 ${player.battleScore ?? 0}${player.victoryBonus ? ` · 奖励 +${player.victoryBonus}` : ''}`; });
  document.querySelectorAll('.headquarters span').forEach((label) => label.remove());
  if (state.screen === 'lobby') {
    const lobbyShell = document.querySelector('.shell.lobby');
    if (lobbyShell) {
      lobbyShell.querySelectorAll('.cloud').forEach((cloud) => cloud.remove());
      ['cloud-shape-0 cloud-fixed-a', 'cloud-shape-1 cloud-fixed-b', 'cloud-shape-2 cloud-fixed-c'].forEach((className) => lobbyShell.insertAdjacentHTML('afterbegin', `<div class="cloud ${className}" aria-hidden="true"></div>`));
      const clouds = [...lobbyShell.querySelectorAll('.cloud')];
      const fixedClouds = [{ left: '2%', top: '5%' }, { left: '82%', top: '9%' }, { left: '54%', top: '33%' }];
      clouds.forEach((cloud, index) => {
        const placement = fixedClouds[index] || fixedClouds[2];
        cloud.style.left = placement.left;
        cloud.style.top = placement.top;
        cloud.style.setProperty('--cloud-scale', '0.72');
        cloud.style.animationDelay = `${index * -2.5}s`;
        cloud.style.zIndex = String(index + 1);
      });
    }
  }
  if (state.screen === 'race' && !state.practice) {
    const left = state.gameState?.timeLeft ?? 180;
    const arrivalWindow = Math.min(1, Math.max(0, (8 - left) / 8));
    const convoy = document.querySelector('.convoy-sprite');
    const ring = document.querySelector('.racefield .ring');
    if (convoy) {
      convoy.style.top = `${78 - arrivalWindow * 56}%`;
      convoy.classList.toggle('convoy-arriving', arrivalWindow > 0);
    }
    if (ring) ring.style.display = 'none';
    if (state.arrivalNoticeUntil > Date.now()) {
      document.querySelector('.racefield .results')?.remove();
      const field = document.querySelector('.racefield');
      if (field && !field.querySelector('.arrival-notice')) field.insertAdjacentHTML('beforeend', '<div class="arrival-notice">顺利抵达总部，各位飞行员辛苦了</div>');
    }
  }
  if (state.screen === 'race' && (state.practice ? state.practiceGame?.hitFlash : state.gameState?.players?.[state.localId]?.hitFlash ?? 0) > 0) {
    document.querySelector('.racer.me')?.classList.add('hit');
  }
  const chatInput = document.querySelector('#chat-input');
  if (chatInput) {
    chatInput.value = state.chatDraft;
    if (keepChatFocus) { chatInput.focus(); chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length); }
  }
  const messages = document.querySelector('.race-chat .messages, .chat .messages');
  const chatKey = `${state.screen}:${state.chat.length}`;
  if (messages && chatKey !== state.chatScrollKey) {
    messages.scrollTop = messages.scrollHeight;
    state.chatScrollKey = chatKey;
  }
}

function lobby() {
  const selectedPaint = getPaint(state.profile.paint);
  const paintButtons = paints.map((paint) => `<button class="paint paint-${paint.id} ${state.profile.paint === paint.id ? 'selected' : ''}" data-paint="${paint.id}" title="${paint.cat} · ${paint.skill}" aria-label="${paint.cat}，${paint.skill}"><img src="${paint.icon}" alt="${paint.name}" /></button>`).join('');
  shell(`<div class="design-overlay lobby-overlay" aria-label="大厅操作区域"><header class="lobby-real-top"><div class="lobby-nav"><button class="asset-nav-button signin" data-action="signin">${state.authPlayer ? `👤 ${escapeText(state.authPlayer.name)}` : '登录'}</button><button class="asset-nav-button leaderboard" data-action="leaderboard">♛ 榜单</button></div></header><section class="lobby-controls"><img class="controls-title" src="/assets/imported/ui/sky-relay-home-title-extracted.png" alt="Sky Relay"/><label class="pilot-field">飞行员昵称<input id="design-pilot-name" maxlength="14" value="${escapeText(state.profile.name)}" autocomplete="nickname"/></label><div class="paint-heading">选择飞机涂装 <span>点击套装即可切换</span></div><div class="asset-paint-grid">${paints.map((p, i) => `<button data-paint="${p.id}" class="asset-paint asset-paint-${p.id} ${state.profile.paint === p.id ? 'selected' : ''}" aria-label="选择${p.name}" style="--paint-index:${i}"><img src="${p.buttonIcon}" alt="${p.name}"/></button>`).join('')}</div><div class="selected-loadout"><b>${escapeText(selectedPaint.cat)} · ${escapeText(selectedPaint.name)}</b><span>${escapeText(selectedPaint.role)} · ${escapeText(selectedPaint.skill)}</span></div><button class="asset-create-button" data-action="quickplay" aria-label="创建实时房间"><img src="/assets/imported/ui/sky-relay-fish-create-button-extracted.png" alt=""/><span>创建实时房间</span></button><div class="join-row"><label>加入房间<input id="join-code" placeholder="请输入邀请码" autocomplete="off"/></label><button class="asset-join-button" data-action="join">加入</button></div><button class="asset-practice-button" data-action="practice"><span>🎮</span> 单人练习</button></section>${state.error ? `<p class="error lobby-error">${escapeText(state.error)}</p>` : ''}</div>`,'lobby');
}

function hangar() {
  const pilotCount = connectedPlayerCount();
  const canStart = state.hosting && pilotCount >= 1;
  const invite = state.roomCode || state.roomId.slice(0, 8);
  shell(`<header class="top"><div><span class="eyebrow">FLIGHT DECK</span><h2>房间机库 <b>${escapeText(invite || '连接中…')}</b></h2></div><button class="icon-btn" data-action="lobby">退出房间</button></header><div class="hangar-grid" style="display:grid!important;grid-template-columns:minmax(0,.92fr) minmax(360px,1.08fr)!important;grid-template-areas:'stage roster'!important;gap:24px;width:min(1240px,100%);height:calc(100vh - 150px)!important;min-height:560px;margin:28px auto 0"><section class="hangar-stage" style="grid-area:stage!important"><div class="hangar-sky"><div class="cloud c4"></div><div class="cloud c5"></div><div class="runway"></div>${pairedImg(state.profile.paint, 'hangar-paired-img')}</div><div class="stage-caption"><span>你的套装</span><strong>${getPaint(state.profile.paint).cat} · ${getPaint(state.profile.paint).name}</strong></div><p class="room-invite">邀请码：<b>${escapeText(invite || '连接中…')}</b><button class="copy-invite" data-action="copy-invite" ${invite ? '' : 'disabled'}>复制</button></p>${state.copyNotice ? `<p class="copy-notice">${escapeText(state.copyNotice)}</p>` : ''}</section><section class="roster" style="grid-area:roster!important"><div class="section-head"><span>实时飞行员</span><b>${pilotCount}/4</b></div>${state.players.map((player, index) => `<div class="pilot">${pairedImg(paintForPlayer(player.playerId, index), 'roster-paired-img')}<div><strong>${escapeText(player.displayName || '飞行员')}</strong>${player.playerId === state.localId ? '<small>你</small>' : ''}</div><span class="ready">${player.connected === false ? '○ 离线' : '● 在线'}</span></div>`).join('')}<div class="chat"><div class="section-head"><span>空中频道</span><span class="live">● LIVE</span></div><div class="messages">${state.chat.map((message) => `<p><b>${escapeText(message.name)}</b> ${escapeText(message.text)}</p>`).join('')}</div><form id="chat-form"><input id="chat-input" value="${escapeText(state.chatDraft)}" placeholder="发送消息…" autocomplete="off"/><button type="submit" aria-label="发送消息">↑</button></form></div><div class="waiting">${pilotCount < 1 ? '等待飞行员加入…' : (canStart ? '可单人起飞，队友可中途加入。' : '等待房主开始比赛')}</div>${canStart ? '<button class="primary launch" data-action="start">开始 180 秒护送</button>' : ''}</section></div><div class="design-overlay hangar-overlay"><div class="hangar-live-invite"><span>房间邀请码</span><strong>${escapeText(invite || '连接中…')}</strong><button data-action="copy-invite" ${invite ? '' : 'disabled'}>复制</button></div><button class="hit hangar-back-hit" data-action="lobby" aria-label="返回大厅"></button><button class="hit hangar-start-hit" data-action="start" aria-label="确认出发"></button></div>`,'hangar');
}

function race() {
  const sim = state.practice ? state.practiceGame : state.gameState;
  const local = state.practice ? { x: state.practicePos.x, y: state.practicePos.y, lives: state.practiceLives, hp: state.practiceGame?.hp ?? 100, score: state.practiceScore, economyPoints: state.practiceScore, battlePoints: state.practiceBattlePoints, alive: !state.practiceDone, hitFlash: state.practiceGame?.hitFlash ?? 0, smallCd: state.practiceGame?.smallCd ?? 0, ultimateCd: state.practiceGame?.ultimateCd ?? 0 } : (playerById(state.localId) || {});
  const gamePlayers = Object.values(state.practice ? {} : (state.gameState?.players || {})).map((rawPlayer) => {
    const player = { ...rawPlayer, id: rawPlayer.id || rawPlayer.playerId, score: rawPlayer.score ?? 0, alive: rawPlayer.alive !== false };
    const rosterPlayer = playerById(player.id);
    return rosterPlayer?.connected === false ? { ...player, alive: false, lives: 0 } : player;
  });
  const racers = gamePlayers.filter((player) => player.id !== state.localId).map((player, index) => `<div class="racer ${player.alive === false ? 'down' : ''} ${player.hitFlash > 0 ? 'hit' : ''}" style="left:${player.x ?? 50}%;top:${player.y ?? 50}%">${pairedImg(paintForPlayer(player.id, index + 1), 'racer-paired-img')}</div>`).join('');
  const items = (sim?.items || []).map((item) => `<div class="pickup ${item.kind}" aria-label="${item.kind}" style="left:${item.x}%;top:${item.y}%"></div>`).join('');
  const enemies = (sim?.enemies || []).map((enemy) => { const maxHp = enemy.maxHp || (enemy.kind === 'bomber' ? 10 : 6); const frozen = sim?.freezeBombs > 0; return `<div class="enemy-wrap ${frozen ? 'frozen' : ''}" style="left:${enemy.x}%;top:${enemy.y}%" aria-label="骷髅头空中海盗敌机${frozen ? '，已被冰冻' : ''}，耐久 ${enemy.hp}/${maxHp}"><div class="enemy-sprite ${enemy.kind}"></div><div class="enemy-hp"><i style="width:${Math.max(0, Math.min(100, (enemy.hp / maxHp) * 100))}%"></i></div></div>`; }).join('');
  const projectiles = [...(sim?.playerBullets || []).map((bullet) => `<div class="projectile player-shot" style="left:${bullet.x}%;top:${bullet.y}%"></div>`), ...(sim?.enemyBullets || []).map((bullet) => `<div class="projectile enemy-shot" style="left:${bullet.x}%;top:${bullet.y}%"></div>`), ...(sim?.enemyBombs || []).map((bomb) => `<div class="projectile enemy-bomb" style="left:${bomb.x}%;top:${bomb.y}%"></div>`), ...(sim?.explosions || []).map((explosion) => { const elapsed = Math.max(0, 2 - (explosion.ttl ?? 0)); const frame = Math.min(7, Math.floor(elapsed / .25)); return `<img class="explosion-sprite" src="/assets/imported/explosion-frames/frame-${String(frame).padStart(4, '0')}.png" alt="" aria-hidden="true" style="left:${explosion.x}%;top:${explosion.y}%" />`; })].join('') + (sim?.effects || []).map((effect) => { const y = Math.max(8, Math.min(92, effect.y)); return `<div class="ultimate-effect ultimate-${effect.kind}" role="img" style="left:${effect.x}%;top:${y}%;width:160px;height:160px;z-index:9999!important" aria-label="大招特效"></div>`; }).join('');
  const effects = (sim?.effects || []).map((effect) => { const y = Math.max(8, Math.min(92, effect.y)); return `<div class="ultimate-effect ultimate-${effect.kind}" role="img" style="left:${effect.x}%;top:${y}%;width:160px;height:160px;z-index:9999!important" aria-label="大招特效"></div>`; }).join('');
  const me = state.practice ? state.practicePos : { x: local.x ?? 50, y: local.y ?? 78 };
  const left = state.practice ? state.practiceTime : (state.gameState?.timeLeft ?? 180);
  const arrivalWindow = Math.min(1, Math.max(0, (8 - left) / 8));
  // Keep the protected ship low in the playfield, matching the supplied
  // convoy layout; it only rises during the final headquarters approach.
  const convoyTop = 84 - arrivalWindow * 58;
  const arrivalNotice = state.practice ? state.practiceArrivalNoticeUntil > Date.now() : state.arrivalNoticeUntil > Date.now();
  const ranking = gamePlayers.slice().sort((a, b) => Number(b.alive) - Number(a.alive) || b.score - a.score);
  const pilotCount = connectedPlayerCount();
  const localDown = local.alive === false;
  const convoy = sim?.convoy || { hp: 1000, maxHp: 1000, progress: 0, goal: 100 };
  const convoyPct = Math.round((convoy.hp / Math.max(1, convoy.maxHp)) * 100);
  const convoyState = convoyPct <= 0 ? 3 : convoyPct <= 25 ? 2 : convoyPct <= 50 ? 1 : 0;
  const skillPaint = getPaint(state.profile.paint);
  const skillSmall = local.smallCd ?? 0;
  const skillUltimate = local.ultimateCd ?? 0;
  const outcome = sim?.outcome || '';
  const raceEnding = outcome === 'convoy-destroyed' ? '保卫失败' : outcome === 'all-out' ? '全员出局' : outcome === 'arrived' ? '护送成功！' : '本局结束';
  const friendlies = state.practice ? [{ name: state.profile.name, hp: local.hp, maxHp: 100, alive: !localDown }] : gamePlayers;
  // Keep the HUD focused on the live health bars; hull damage is already
  // communicated by the four convoy sprites and the numeric durability.
  // Keep the arrival banner as the only transient event card. A separate
  // bottom-right “飞行员 OUT” card covered the chat control and duplicated
  // the player's health/status feedback already shown in the HUD.
  const liveEvent = arrivalNotice ? '护送成功！' : '';
  const playerHp = Math.max(0, Math.min(100, Math.round(local.hp ?? 100)));
  const healthSprite = `/assets/imported/ui/hud/player-health-${state.profile.paint}.png`;
  const chatToggle = `<button class="hit race-chat-toggle" data-action="chat-toggle" aria-expanded="${state.chatOpen ? 'true' : 'false'}"><span aria-hidden="true">✉</span><b>${state.chatOpen ? '收起聊天' : '打开聊天'}</b></button>`;
  const smallName = skillPaint.skill.split(' / ')[0];
  const ultimateName = skillPaint.skill.split(' / ')[1];
  shell(`<header class="race-top"><div><span class="eyebrow">${state.practice ? 'PRACTICE' : 'LIVE SURVIVAL'} · SKY RELAY</span><strong>${state.practiceDone ? '完成飞行' : '护送小鱼干号 · 躲避炸弹'}</strong></div><div class="race-stats"><span>● ${state.practice ? '小鱼干号·单人' : `${pilotCount}/4 猫猫飞行员`}</span><span class="timer ${left <= 30 ? 'urgent' : left <= 60 ? 'warning' : ''}" aria-label="剩余时间 ${Math.ceil(left)} 秒"><i>TIME</i><b>${Math.ceil(left)}</b><small>SEC</small></span><button class="exit-race" data-action="lobby">退出本局</button></div></header><section class="racefield"><div class="scroll-clouds"></div><div class="horizon"></div><img class="race-background left" src="/assets/imported/ui/sky-relay-in-game-left-background-transparent.png" alt="" aria-hidden="true"/><img class="race-background right" src="/assets/imported/ui/sky-relay-in-game-right-background-transparent.png" alt="" aria-hidden="true"/>${arrivalWindow > 0 ? '<div class="headquarters"><img class="headquarters-sprite" src="/assets/imported/sky-relay-headquarters.png" alt="云端总部"/><span>总部</span></div>' : ''}<div class="convoy-sprite convoy-state-${convoyState}" aria-label="小鱼干号主舰艇，耐久 ${convoyPct}%" style="left:50%;top:${convoyTop}%"></div>${items}${enemies}${projectiles}${racers}<div class="racer me ${localDown ? 'down' : ''}" style="left:${me.x}%;top:${me.y}%">${pairedImg(paintForPlayer(state.localId), 'racer-paired-img')}</div><aside class="race-hud"><b>小鱼干号</b><div class="convoy-bar"><i style="width:${convoyPct}%"></i></div><div class="hud-route">耐久 ${convoy.hp}/${convoy.maxHp} · 航程 ${Math.round(convoy.progress)}%</div><hr/><b>友军耐久</b><div class="friendly-hp-list">${friendlies.map((player) => `<div class="friendly-hp"><span>${escapeText(player.name || state.players.find((entry) => entry.playerId === player.id)?.displayName || '飞行员')}</span><b>${player.alive === false ? 'OUT' : `${Math.max(0, Math.round((player.hp ?? 0) / (player.maxHp ?? 100) * 100))}%`}</b><i><em style="width:${player.alive === false ? 0 : Math.max(0, Math.min(100, (player.hp ?? 0) / (player.maxHp ?? 100) * 100))}%"></em></i></div>`).join('')}</div><div class="hud-meta">${localDown ? 'OUT · 生存分 0' : `经济 ${local.economyPoints ?? 0} · 战斗 ${local.battlePoints ?? 0}`}</div><div class="hud-speed">${state.practice ? (state.practiceBoost > 0 ? `⚡ 加速 ${state.practiceBoost.toFixed(1)}s` : '⚡ 普通速度') : (local.boost > 0 ? `⚡ 加速 ${local.boost.toFixed(1)}s` : `⚡ 普通速度`)}</div><div class="skill-hud"><button class="skill-button ${skillSmall > 0 ? 'cooling' : ''}" data-skill="small" ${skillSmall > 0 || localDown ? 'disabled' : ''}><i class="skill-icon skill-icon-${state.profile.paint}"></i><b>E</b><span>${smallName}</span><small>${skillSmall > 0 ? `${skillSmall.toFixed(1)}s` : '可用'}</small></button><button class="skill-button ultimate ${skillUltimate > 0 ? 'cooling' : ''}" data-skill="ultimate" ${skillUltimate > 0 || localDown ? 'disabled' : ''}><i class="skill-icon skill-icon-${state.profile.paint}"></i><b>Q</b><span>${ultimateName}</span><small>${skillUltimate > 0 ? `${skillUltimate.toFixed(1)}s` : '大招可用'}</small></button></div></aside><div class="race-hint">WASD / 方向键移动 · E 小技能 · Q 大招</div>${arrivalNotice ? '<div class="arrival-notice">顺利抵达总部，各位飞行员辛苦了</div>' : ''}${state.phase === 'finished' && !arrivalNotice ? `<div class="results"><span class="eyebrow">FLIGHT RESULTS</span><h2>${raceEnding}</h2><p class="score-consensus">结算构成：飞艇耐久 40% · 经济收集 20% · 个人生存 20% · 战斗 20% 折算${ranking[0]?.victoryBonus ? ' · 护送奖励 +100' : ''}</p>${ranking.map((p, i) => `<div class="result-row"><b>${String(i + 1).padStart(2, '0')}</b><span>${escapeText(state.players.find((x) => x.playerId === p.id)?.displayName || '飞行员')} · ${p.alive ? '存活' : '出局'} · <strong>${p.score} 分</strong> · ${p.rating || 'C'} 级<small>耐久 ${p.convoyScore ?? 0} · 经济 ${p.economyScore ?? 0} · 生存 ${p.survivalScore ?? 0} · 战斗 ${p.battleScore ?? 0}${p.victoryBonus ? ` · 奖励 +${p.victoryBonus}` : ''}</small></span></div>`).join('')}<button class="primary" data-action="again">再来一局 <span>↗</span></button><button class="text-btn" data-action="lobby">返回大厅</button></div>` : ''}<div class="design-overlay race-overlay"><div class="race-battle-hud"><div class="convoy-health-widget"><div class="hud-title"><span>主舰艇 · 小鱼干号</span><b>${convoy.hp}/${convoy.maxHp}</b></div><div class="health-art convoy-health-art" style="--health-pct:${convoyPct}%;--missing-pct:${(63 - convoyPct * .63).toFixed(2)}%"><img src="/assets/imported/ui/hud/convoy-health.png" alt="主舰艇血量条"/><i></i></div></div><div class="player-health-widget paint-${state.profile.paint}"><div class="hud-title"><span>我的耐久</span><b>${playerHp}/100</b></div><div class="health-art player-health-art" style="--health-pct:${playerHp}%;--fill-pct:${(playerHp * .59).toFixed(2)}%"><img src="${healthSprite}" alt="玩家血量条"/><i></i></div></div></div><div class="race-live-time">${Math.ceil(left)}</div><div class="race-live-economy">${local.economyPoints ?? 0}</div><div class="race-live-battle">${local.battlePoints ?? 0}</div>${liveEvent ? `<div class="race-live-event">${liveEvent}</div>` : ''}<button class="hit race-exit-hit" data-action="lobby" aria-label="退出本局"></button><button class="hit race-small-hit race-skill-hit paint-${state.profile.paint}" data-skill="small" aria-label="E ${smallName}" ${skillSmall > 0 || localDown ? 'disabled' : ''}><img src="/assets/imported/ui/hud/skill-${state.profile.paint}-small.png" alt=""/><span class="skill-key">E</span><span class="skill-copy"><b>${smallName}</b><small>${skillSmall > 0 ? `冷却 ${skillSmall.toFixed(1)}s` : '可用'}</small></span><i class="cooldown-mask" style="height:${Math.min(100, skillSmall / 6 * 100)}%"></i></button><button class="hit race-ultimate-hit race-skill-hit paint-${state.profile.paint}" data-skill="ultimate" aria-label="Q ${ultimateName}" ${skillUltimate > 0 || localDown ? 'disabled' : ''}><img src="/assets/imported/ui/hud/skill-${state.profile.paint}-ultimate.png" alt=""/><span class="skill-key">Q</span><span class="skill-copy"><b>${ultimateName}</b><small>${skillUltimate > 0 ? `冷却 ${skillUltimate.toFixed(1)}s` : '可用'}</small></span><i class="cooldown-mask" style="height:${Math.min(100, skillUltimate / 20 * 100)}%"></i></button></div></section><aside class="race-chat"><div class="section-head"><span>频道</span><span class="live">● LIVE</span></div><div class="messages">${state.chat.slice(-4).map((message) => `<p><b>${escapeText(message.name)}</b> ${escapeText(message.text)}</p>`).join('')}</div><form id="chat-form"><input id="chat-input" value="${escapeText(state.chatDraft)}" placeholder="快速消息…" autocomplete="off"/><button type="button" data-action="chat-send" aria-label="发送消息">↑</button></form></aside>`,'race');
}

function result() {
  const ranking = Object.values(state.gameState?.players || {}).slice().sort((a, b) => Number(b.alive) - Number(a.alive) || b.score - a.score);
  const outcome = state.gameState?.outcome || '';
  const failed = outcome === 'convoy-destroyed';
  const allOut = outcome === 'all-out';
  const localPaint = getPaint(state.profile.paint);
  const score = ranking[0]?.score ?? state.practiceScore ?? 0;
  shell(`<div class="results-page ${failed || allOut ? 'convoy-failed' : ''}"><div class="result-board"><div class="result-banner"><span>🏆</span><h1>${failed ? '保卫失败' : allOut ? '全员出局' : outcome === 'arrived' ? '护送成功！' : '本局结束'}</h1><span>🏆</span></div><div class="result-subtitle">🐾 FLIGHT RESULTS 🐾</div><div class="result-columns"><div class="result-hero"><img src="${localPaint.pairFile}" alt="${localPaint.cat} 与飞机"/><div class="result-convoy"><b>🐟 护送飞艇耐久（四阶段）</b><span>Ⅰ　　Ⅱ　　Ⅲ　　Ⅳ</span><strong>${ranking[0]?.convoyScore ?? 0}/1000</strong></div></div><div class="result-summary"><div class="final-score"><small>最终得分</small><b>${score}</b></div><div class="score-line heart">❤️ 飞艇耐久分 <b>40%</b></div><div class="score-line fish">🐟 经济收集分 <b>20%</b></div><div class="score-line cat">🐱 个人生存分 <b>20%</b></div><div class="score-line battle">⚔ 战斗分 <b>20%</b></div><div class="victory-reward">🎁 护送成功奖励 <b>+${ranking[0]?.victoryBonus ?? 0}</b></div></div></div>${failed ? '<p class="failure-note">小鱼干号完全损坏，护送任务终止。</p>' : allOut ? '<p class="failure-note">所有猫猫飞行员均已 OUT，护送任务终止。</p>' : ''}<div class="result-rankings">${ranking.map((p, i) => `<div class="result-row"><b>${String(i + 1).padStart(2, '0')}</b><span>${escapeText(state.players.find((x) => x.playerId === p.id)?.displayName || '飞行员')} · ${p.alive ? '存活' : '出局'} · <strong>${p.score} 分</strong><small>耐久 ${p.convoyScore ?? 0} · 经济 ${p.economyScore ?? 0} · 生存 ${p.survivalScore ?? 0} · 战斗 ${p.battlePoints ?? 0}</small></span></div>`).join('')}</div><div class="result-actions"><button class="primary" data-action="again">再来一局 ↗</button><button class="secondary" data-action="lobby">返回大厅</button></div></div></div><div class="design-overlay result-overlay"><div class="result-live-outcome">${failed ? '保卫失败' : allOut ? '全员出局' : outcome === 'arrived' ? '护送成功！' : '本局结束'}</div><div class="result-live-score">${score}</div><div class="result-live-convoy">${ranking[0]?.convoyScore ?? 0}/1000</div><button class="hit result-again-hit" data-action="again" aria-label="再来一局"></button><button class="hit result-lobby-hit" data-action="lobby" aria-label="返回大厅"></button></div>`,'result');
}

function leaderboard() {
  const note = state.leaderboardStatus === 'loading' ? '正在读取官方榜单…' : state.leaderboardStatus === 'unavailable' ? '榜单服务尚未连接。' : state.leaderboardStatus === 'error' ? '榜单读取失败，请稍后重试。' : '当前 host 自定义规则不由 SDK 自动写入官方胜场。';
  const entries = state.practiceLeaderboard.length ? state.practiceLeaderboard.slice(0, 5) : [{ name: state.profile.name || 'Sky Pilot', score: state.practiceScore || 0, rank: 1 }];
  while (entries.length < 5) entries.push({ name: '等待飞行员', score: '—', rank: entries.length + 1, placeholder: true });
  const row = (entry, index) => `<div class="rank ${index < 3 ? `podium-rank podium-${index + 1}` : ''} ${entry.placeholder ? 'placeholder-rank' : ''}"><span class="rank-place rank-place-${index < 3 ? index + 1 : 'other'}"><em>${String(entry.rank || index + 1).padStart(2, '0')}</em></span><img class="rank-pilot-art" src="${paints[index % paints.length].pairFile}" alt=""/><strong>${escapeText(entry.name || '飞行员')}</strong><b>${entry.score ?? '—'}${entry.score === '—' ? '' : '<small> 分</small>'}</b></div>`;
  const rows = entries.map(row).join('');
  const personal = state.practiceLeaderboardMe || (state.practiceScore ? { rank: '—', score: state.practiceScore } : null);
  const personalText = personal ? `我的记录　排名 ${personal.rank ?? '—'}　得分 ${personal.score ?? 0}` : '我的记录　排名 —　得分 0';
  shell(`<header class="top"><div><span class="eyebrow">SKY RELAY · SDK</span></div><button class="icon-btn" data-action="lobby">← 返回主页</button></header><section class="leaderboard leaderboard-design"><div class="leaderboard-title"><img src="/assets/imported/ui/sky-relay-leaderboard-medals-extracted.png" alt="奖牌与桂冠"/><h1>飞行员榜单</h1></div><div class="leader-tabs"><b>🏅 全服前 5　SCORE</b><b>⚔ 多人胜场　WINS</b></div><div class="leaderboard-rows" aria-label="全服前五名">${rows}</div><div class="leader-note personal-score" aria-label="我的记录">${escapeText(personalText)}</div><p class="leaderboard-status">${note}</p></section><div class="design-overlay leaderboard-overlay"><div class="leader-live-note">${escapeText(state.profile.name || 'Sky Pilot')} · 本地记录 ${state.practiceScore || 0}</div><button class="hit leaderboard-back-hit" data-action="lobby" aria-label="返回主页"></button></div>`,'leaderboard');
}

function skills() {
  const paint = getPaint(state.profile.paint);
  const cards = paints.map((item) => `<button class="loadout-card ${item.id === paint.id ? 'selected' : ''}" data-paint="${item.id}"><img src="${item.pairFile}" alt="${item.cat} 与飞机"/><b>${item.cat} · ${item.name}</b></button>`).join('');
  const [skillE, skillQ] = paint.skill.split(' / ');
  shell(`<header class="top"><button class="icon-btn" data-action="lobby">← 大厅 / 套装详情</button><div><span class="eyebrow">SKY RELAY</span></div><span class="detail-blimp">🐟</span></header><section class="loadout-detail"><h1>🐾 猫猫飞行员套装详情 🐾</h1><div class="loadout-main"><div class="loadout-hero"><img src="${paint.pairFile}" alt="${paint.cat} 与飞机"/><strong>${paint.cat} · ${paint.name}</strong></div><div class="loadout-skills"><h2>套装技能</h2><article><b>E</b><h3>${skillE}</h3><small>冷却：6 秒</small><p>${paint.trait}</p></article><article><b>Q</b><h3>${skillQ}</h3><small>冷却：20 秒</small><p>投放专属技能，改变护送战局。</p></article></div></div><div class="loadout-picker"><h2>选择套装（猫猫与飞机为固定搭配）</h2><div class="loadout-cards">${cards}</div></div><div class="loadout-actions"><button class="secondary" data-action="lobby">← 返回大厅</button><button class="fish-room-button" data-action="quickplay"><span>确认出发</span></button></div></section><div class="design-overlay skills-overlay"><button class="hit skills-top-back-hit" data-action="lobby" aria-label="返回大厅"></button><button class="hit skills-back-hit" data-action="lobby" aria-label="返回大厅"></button>${paints.map((p) => `<button data-paint="${p.id}" class="hit skill-paint-hit skill-paint-hit-${p.id}" aria-label="选择${p.name}"></button>`).join('')}<button class="hit skills-confirm-hit" data-action="quickplay" aria-label="确认出发"></button></div>`,'skills skills-' + paint.id);
}

function render() { if (state.screen === 'lobby') lobby(); else if (state.screen === 'hangar') hangar(); else if (state.screen === 'race') race(); else if (state.screen === 'result') result(); else if (state.screen === 'skills') skills(); else leaderboard(); }

const keys = new Set();
const controlKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);
window.addEventListener('keydown', (event) => { if (controlKeys.has(event.code)) { event.preventDefault(); keys.add(event.code); } });
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('keydown', (event) => { if (state.screen !== 'race' || event.repeat) return; const skill = event.code === 'KeyE' ? 'small' : event.code === 'KeyQ' ? 'ultimate' : ''; if (!skill) return; event.preventDefault(); if (state.practice) { usePracticeSkill(skill); return; } if (client?.status !== 'connected') return; sfx('skill'); try { client.sendAction({ skill, paint: state.profile.paint }); } catch (error) { setError(error); } });

function usePracticeSkill(skill) {
  const P = state.practiceGame; if (!P || state.practiceDone || P[skill === 'small' ? 'smallCd' : 'ultimateCd'] > 0) return;
  const paint = state.profile.paint; P[skill === 'small' ? 'smallCd' : 'ultimateCd'] = skill === 'small' ? 6 : 20; sfx('skill');
  if (skill === 'small') { if (paint === 'coral') { P.attackBoost = 4; P.effects.push({ kind: 'small-attack', x: state.practicePos.x, y: state.practicePos.y, ttl: .8 }); } if (paint === 'teal') { P.hp = Math.min(100, P.hp + 10); P.effects.push({ kind: 'small-heal', x: state.practicePos.x, y: state.practicePos.y, ttl: .8 }); } if (paint === 'violet') { P.damageReduction = 4; P.effects.push({ kind: 'small-shield', x: state.practicePos.x, y: state.practicePos.y, ttl: 6 }); } if (paint === 'sun') { state.practiceBoost = Math.max(state.practiceBoost, 5); P.effects.push({ kind: 'small-speed', x: state.practicePos.x, y: state.practicePos.y, ttl: 1.2 }); } }
  else { if (paint === 'coral') { const x = state.practicePos.x, y = state.practicePos.y; P.pendingUltimates.push({ kind: 'coral-fish-bomb', x, y, delay: .55 }); P.effects.push({ kind: 'fish-bomb', x, y: y - 18, ttl: .55 }); } if (paint === 'teal') { P.convoy.hp = Math.min(P.convoy.maxHp, P.convoy.hp + P.convoy.maxHp * .2); P.effects.push({ kind: 'heal-ultimate', x: state.practicePos.x, y: state.practicePos.y, ttl: 2.4 }); P.effects.push({ kind: 'repair', x: 50, y: 22, ttl: 2.4 }); } if (paint === 'violet') { P.shieldField = 6; P.shieldCharges = 1; P.effects.push({ kind: 'shield', x: state.practicePos.x, y: state.practicePos.y, ttl: 6 }); } if (paint === 'sun') { P.freezeBombs = 3; state.practiceBoost = Math.max(state.practiceBoost, 3); P.effects.push({ kind: 'freeze', x: state.practicePos.x, y: state.practicePos.y, ttl: 4 }); } }
}

function finishPractice(outcome) {
  const P = state.practiceGame; if (!P || state.practiceDone) return; P.outcome = outcome; state.practiceDone = true; state.practiceRunning = false; state.profile.matches += 1;
  const convoyBase = P.convoy.hp / P.convoy.maxHp; const survivalBase = outcome === 'all-out' ? 0 : (state.practiceTime <= 0 ? 1 : 1 - state.practiceTime / 180) * Math.max(0, P.hp / 100);
  const convoyScore = Math.round(Math.max(0, Math.min(1, convoyBase)) * 400); const economyScore = Math.round(Math.max(0, state.practiceScore) * 0.20); const survivalScore = Math.round(Math.max(0, Math.min(1, survivalBase)) * 200); const battleScore = Math.round(Math.max(0, state.practiceBattlePoints) * 0.20);
  state.practiceBreakdown = { convoy: convoyScore, economy: economyScore, survival: survivalScore, battle: battleScore };
  state.practiceScore = convoyScore + economyScore + survivalScore + battleScore; void saveProfile();
  if (game?.leaderboard?.available) void game.leaderboard.submit('practice.score', state.practiceScore, { order: 'desc' }).catch(() => {});
  if (outcome === 'arrived') {
    state.practiceArrivalNoticeUntil = Date.now() + 2200;
    window.setTimeout(() => { if (state.practiceDone) { state.practiceArrivalNoticeUntil = -1; render(); } }, 2250);
  }
}

function detonatePracticeBomb(P, bomb, multiplier = 1, forceConvoyHit = false) {
  P.explosions.push({ id: `boom-${performance.now()}-${Math.random()}`, x: bomb.x, y: bomb.y, ttl: 2 });
  if (forceConvoyHit || (bomb.x - 50) ** 2 + (bomb.y - 78) ** 2 < 180) P.convoy.hp = Math.max(0, P.convoy.hp - Math.round(35 * multiplier));
  if ((state.practicePos.x - bomb.x) ** 2 + (state.practicePos.y - bomb.y) ** 2 < 144) {
    if (P.shieldField > 0 && P.shieldCharges > 0) { P.shieldCharges = 0; P.shieldField = 0; P.effects = P.effects.filter((effect) => effect.kind !== 'shield'); P.effects.push({ kind: 'shield-block', x: bomb.x, y: bomb.y, ttl: .45 }); return; }
    P.hp = Math.max(0, P.hp - Math.round(18 * multiplier * (P.damageReduction > 0 ? .45 : 1)));
    P.hitFlash = .6;
  }
}

function practiceTick() {
  if (state.practice && state.practiceRunning && !state.practiceDone) {
    const now = performance.now();
    const dt = Math.min(.05, Math.max(0, (now - state.practiceLastTick) / 1000));
    state.practiceLastTick = now;
    const dx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const dy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    state.practiceBoost = Math.max(0, state.practiceBoost - dt);
    const moveSpeed = state.practiceBoost > 0 ? 1.45 : 0.8;
    state.practicePos.x = Math.max(8, Math.min(92, state.practicePos.x + dx * moveSpeed));
    state.practicePos.y = Math.max(10, Math.min(90, state.practicePos.y + dy * moveSpeed));
    state.practiceTime = Math.max(0, state.practiceTime - dt);
    const P = state.practiceGame; P.elapsed += dt; P.convoy.progress = Math.min(100, P.convoy.progress + dt * (100 / 180)); P.enemyClock += dt; P.enemyFireClock += dt; P.bombClock += dt; P.fireClock += dt; P.pickupClock += dt; P.smallCd = Math.max(0, P.smallCd - dt); P.ultimateCd = Math.max(0, P.ultimateCd - dt); P.attackBoost = Math.max(0, P.attackBoost - dt); P.damageReduction = Math.max(0, P.damageReduction - dt); P.hitFlash = Math.max(0, P.hitFlash - dt); P.freezeBombs = Math.max(0, P.freezeBombs - dt); P.shieldField = Math.max(0, P.shieldField - dt); if (P.shieldField === 0) P.shieldCharges = 0;
    for (const pending of P.pendingUltimates) pending.delay -= dt;
    for (let i = P.pendingUltimates.length - 1; i >= 0; i -= 1) { const pending = P.pendingUltimates[i]; if (pending.delay > 0) continue; if (pending.kind === 'coral-fish-bomb') { for (let e = P.enemies.length - 1; e >= 0; e -= 1) { const enemy = P.enemies[e]; if ((enemy.x - pending.x) ** 2 + (enemy.y - pending.y) ** 2 >= 900) continue; enemy.hp -= 24; if (enemy.hp <= 0) { state.practiceBattlePoints += enemy.kind === 'bomber' ? 10 : 5; P.enemies.splice(e, 1); } } P.enemyBombs = []; P.explosions.push({ id: `fish-boom-${performance.now()}`, x: pending.x, y: pending.y - 10, ttl: .9 }); P.effects.push({ kind: 'cannon', x: pending.x, y: pending.y - 10, ttl: .9 }); } P.pendingUltimates.splice(i, 1); }
    if (P.enemyClock > 3.8 && P.enemies.length < 7) { P.enemyClock = 0; const kind = Math.random() < .7 ? 'scout' : 'bomber'; const maxHp = kind === 'bomber' ? 10 : 6; P.enemies.push({ id: `enemy-${now}`, kind, x: 10 + Math.random() * 80, y: -8, hp: maxHp, maxHp }); }
    if (P.elapsed >= 12 && P.bombClock > 3.2 && P.enemyBombs.length < 5) { P.bombClock = 0; const bombers = P.enemies.filter((enemy) => enemy.kind === 'bomber'); const enemy = bombers[Math.floor(Math.random() * bombers.length)]; if (enemy) P.enemyBombs.push({ id: `bomb-${now}-${enemy.id}`, x: enemy.x, y: enemy.y, targetX: 50, vy: 18 }); }
    if (P.enemyFireClock > 2.25 && P.enemyBullets.length < 5) { const scouts = P.enemies.filter((enemy) => enemy.kind === 'scout'); const enemy = scouts[Math.floor(Math.random() * scouts.length)]; P.enemyFireClock = 0; if (enemy) P.enemyBullets.push({ id: `pirate-shot-${now}-${enemy.id}`, x: enemy.x, y: enemy.y + 4, vx: 0, vy: 25 }); }
    if (P.fireClock > .58) { P.fireClock = 0; const base = state.profile.paint === 'coral' ? 2 : state.profile.paint === 'teal' ? 1 : 1.5; P.playerBullets.push({ id: `shot-${now}`, x: state.practicePos.x, y: state.practicePos.y - 5, vy: -52, damage: base * (P.attackBoost > 0 ? 1.5 : 1) }); }
    if (P.pickupClock > 1.05 && P.items.length < 12) { P.pickupClock = 0; const roll = Math.random(); P.items.push({ id: `drop-${now}`, kind: roll < .82 ? 'coin' : roll < .96 ? 'fish' : 'heart', x: 10 + Math.random() * 80, y: -8 }); }
    if (!P.freezeBombs) P.enemies.forEach((enemy) => enemy.y += (enemy.kind === 'bomber' ? 8 : 13) * dt); P.enemies = P.enemies.filter((enemy) => enemy.y < 110); P.playerBullets.forEach((shot) => shot.y += shot.vy * dt); P.playerBullets = P.playerBullets.filter((shot) => shot.y > -10); if (!P.freezeBombs) P.enemyBullets.forEach((shot) => { shot.x += shot.vx * dt; shot.y += shot.vy * dt; }); if (!P.freezeBombs) P.enemyBombs.forEach((bomb) => { bomb.y += bomb.vy * dt; bomb.x += ((bomb.targetX ?? 50) - bomb.x) * Math.min(1, dt * 1.5); });
    // Practice runs locally, so transient visuals must be advanced here too.
    // Without this cleanup, explosions stayed at frame 0000 forever.
    P.explosions.forEach((explosion) => { explosion.ttl -= dt; }); P.explosions = P.explosions.filter((explosion) => explosion.ttl > 0);
    P.effects.forEach((effect) => { effect.ttl -= dt; }); P.effects = P.effects.filter((effect) => effect.ttl > 0);
    for (let s = P.playerBullets.length - 1; s >= 0; s--) { const shot = P.playerBullets[s], target = P.enemyBullets.findIndex((enemyShot) => (shot.x - enemyShot.x) ** 2 + (shot.y - enemyShot.y) ** 2 < 34); if (target >= 0) { P.playerBullets.splice(s, 1); P.enemyBullets.splice(target, 1); } }
    for (let s = P.playerBullets.length - 1; s >= 0; s--) { const shot = P.playerBullets[s]; const target = P.enemies.findIndex((enemy) => (shot.x-enemy.x)**2 + (shot.y-enemy.y)**2 < 90); if (target >= 0) { const enemy = P.enemies[target]; enemy.hp -= shot.damage; if (enemy.hp <= 0) { state.practiceBattlePoints += enemy.kind === 'bomber' ? 10 : 5; P.enemies.splice(target, 1); } P.playerBullets.splice(s, 1); } }
    for (let s = P.playerBullets.length - 1; s >= 0; s--) { const shot = P.playerBullets[s]; const target = P.enemyBombs.findIndex((bomb) => (shot.x-bomb.x)**2 + (shot.y-bomb.y)**2 < 82); if (target >= 0) { const bomb = P.enemyBombs[target]; detonatePracticeBomb(P, bomb, .62); P.enemyBombs.splice(target, 1); P.playerBullets.splice(s, 1); } }
    for (let s = P.enemyBullets.length - 1; s >= 0; s--) { const shot = P.enemyBullets[s]; if ((shot.x - 50) ** 2 + (shot.y - 78) ** 2 < 80) { P.convoy.hp = Math.max(0, P.convoy.hp - 8); P.enemyBullets.splice(s, 1); continue; } if ((shot.x - state.practicePos.x) ** 2 + (shot.y - state.practicePos.y) ** 2 < 42) { P.hp = Math.max(0, P.hp - Math.round(8 * (P.damageReduction > 0 ? .45 : 1))); P.hitFlash = .35; P.enemyBullets.splice(s, 1); continue; } if (shot.x < -6 || shot.x > 106 || shot.y < -6 || shot.y > 106) P.enemyBullets.splice(s, 1); }
    for (let b = P.enemyBombs.length - 1; b >= 0; b--) { const bomb = P.enemyBombs[b], convoyHit = (bomb.x-50)**2 + (bomb.y-78)**2 < 95, playerHit = (state.practicePos.x-bomb.x)**2 + (state.practicePos.y-bomb.y)**2 < 144; if (bomb.y > 104 || convoyHit || playerHit) { detonatePracticeBomb(P, bomb, 1, bomb.y > 104); P.enemyBombs.splice(b, 1); } }
    for (const item of P.items) item.y += 11 * dt;
    for (let i = P.items.length - 1; i >= 0; i -= 1) {
      const item = P.items[i];
      // Match the online simulation: pickups disappear before entering the
      // convoy's visual footprint instead of drawing over the ship.
      if (item.y > 108 || (item.y > 66 && item.y < 96 && item.x > 26 && item.x < 74)) { P.items.splice(i, 1); continue; }
      const dxItem = item.x - state.practicePos.x, dyItem = item.y - state.practicePos.y;
      if (dxItem * dxItem + dyItem * dyItem > 55) continue;
      if (item.kind === 'coin') state.practiceScore += 5;
      else if (item.kind === 'fish') { state.practiceScore += 10; P.hp = Math.min(100, P.hp + 5); }
      else if (item.kind === 'heart') { P.hp = Math.min(100, P.hp + 10); P.hearts += 1; }
      P.items.splice(i, 1);
    }
    if (P.convoy.hp <= 0) finishPractice('convoy-destroyed'); else if (state.practiceLives <= 0 || P.hp <= 0) finishPractice('all-out'); else if (state.practiceTime <= 0) finishPractice('arrived');
    render();
  }
  if (client?.status === 'connected' && state.screen === 'race' && !state.practice) {
    const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    try { client.sendInput({ x, y }); } catch (error) { state.error = error.message; }
  }
  requestAnimationFrame(practiceTick);
}

render();
requestAnimationFrame(practiceTick);
initOnline();
