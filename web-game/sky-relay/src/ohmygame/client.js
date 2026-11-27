/* @ohmygame/game-sdk 0.0.1 */

// packages/sdk/src/multiplayer-protocol.ts
function isPublishedMultiplayerManifest(value) {
  return isRecord(value) && Object.keys(value).length === 3 && value.version === 1 && value.runtime === "multiplayer-example" && isMultiplayerManifestConfig(value.multiplayer);
}
var identifier = {
  type: "string",
  pattern: "^[A-Za-z0-9_-]{1,100}$"
};
var DEFAULT_TICK_MS = 50;
var TICK_MS_RANGE = { min: 20, max: 1e3 };
var REALTIME_INPUT_MAX_LENGTH = 512;
var MULTIPLAYER_ROOM_LIMIT_CODE = 503;
var MULTIPLAYER_PROTOCOL_VERSION = 1;
var MULTIPLAYER_PROTOCOL_VERSIONS = { min: 1, max: MULTIPLAYER_PROTOCOL_VERSION };
var MULTIPLAYER_PROTOCOL_UNSUPPORTED_CODE = 426;
function negotiateProtocolVersion(options, supported = MULTIPLAYER_PROTOCOL_VERSIONS) {
  const newest = options.protocolVersion;
  const oldest = options.minProtocolVersion ?? newest;
  if (!Number.isInteger(newest) || !Number.isInteger(oldest) || oldest > newest)
    return void 0;
  const version = Math.min(newest, supported.max);
  return version >= Math.max(oldest, supported.min) ? version : void 0;
}
function describeProtocolMismatch(options, supported = MULTIPLAYER_PROTOCOL_VERSIONS) {
  const range = supported.min === supported.max ? `version ${supported.min}` : `versions ${supported.min} to ${supported.max}`;
  const sent = options.protocolVersion;
  if (!Number.isInteger(sent)) return `The game sent no valid multiplayer protocol version; the service speaks ${range}.`;
  return sent < supported.min ? `This game speaks multiplayer protocol version ${String(sent)}, which the service no longer supports (it speaks ${range}). Update the game.` : `This game speaks multiplayer protocol version ${String(sent)}, which the service does not support yet (it speaks ${range}). Update the service.`;
}
var MULTIPLAYER_MIN_CLIENTS = 2;
var MULTIPLAYER_MAX_CLIENTS = 32;
var LOCKSTEP_ADAPTER_ID = "lockstep";
var OWNER_ADAPTER_ID = "owner";
var OWNER_STATE_MAX_LENGTH = 4096;
var OWNER_VALUE_MAX_LENGTH = 1024;
var ROOM_MESSAGES_PER_SECOND = 5;
var OWNER_SHARED_MAX_KEYS = 256;
var OWNER_SHARED_MAX_CHANGES = 8;
var MULTIPLAYER_MANIFEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "enabled",
    "mode",
    "gameId",
    "deploymentId",
    "protocolVersion",
    "serverUrl",
    "authPolicy",
    "roomPolicy",
    "maxClients",
    "reconnectSeconds",
    "adapterId"
  ],
  properties: {
    enabled: { const: true },
    mode: { enum: ["turn-based", "realtime"] },
    gameId: identifier,
    deploymentId: identifier,
    protocolVersion: { const: 1 },
    serverUrl: { type: "string", pattern: "^https://[^/?#@\\s]+/?$" },
    authPolicy: { enum: ["anonymous", "guest-or-account", "account-required"] },
    roomPolicy: { enum: ["invite-or-public", "public", "invite-only", "drop-in"] },
    maxClients: { type: "integer", minimum: MULTIPLAYER_MIN_CLIENTS, maximum: MULTIPLAYER_MAX_CLIENTS },
    reconnectSeconds: { type: "integer", minimum: 0, maximum: 3600 },
    adapterId: identifier,
    tickMs: { type: "integer", minimum: 20, maximum: 1e3 }
  }
};
function matchesManifestSchema(schema, value) {
  if (!isRecord(value)) return false;
  if (!schema.required.every((key) => Object.hasOwn(value, key))) return false;
  return Object.entries(value).every(([key, field]) => {
    if (!Object.hasOwn(schema.properties, key)) return false;
    const rule = schema.properties[key];
    if ("const" in rule) return field === rule.const;
    if (rule.enum) return rule.enum.includes(field);
    if (rule.type === "string")
      return typeof field === "string" && (!rule.pattern || new RegExp(rule.pattern).test(field));
    return Number.isInteger(field) && field >= (rule.minimum ?? -Infinity) && field <= (rule.maximum ?? Infinity);
  });
}
function isMultiplayerManifestConfig(value, options = {}) {
  const schema = options.allowLocalhost ? {
    ...MULTIPLAYER_MANIFEST_SCHEMA,
    properties: { ...MULTIPLAYER_MANIFEST_SCHEMA.properties, serverUrl: { type: "string" } }
  } : MULTIPLAYER_MANIFEST_SCHEMA;
  if (!matchesManifestSchema(schema, value)) return false;
  const config = value;
  if (config.roomPolicy === "drop-in" && config.mode !== "realtime") return false;
  const ticks = config.adapterId === LOCKSTEP_ADAPTER_ID || config.adapterId === OWNER_ADAPTER_ID;
  if (ticks !== (config.tickMs !== void 0)) return false;
  if (ticks && config.mode !== "realtime") return false;
  try {
    const url = new URL(value.serverUrl);
    return (url.protocol === "https:" || options.allowLocalhost === true && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) && !!url.hostname && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}
function multiplayerRoomType(config) {
  return `ohmygame_${config.gameId.length}_${config.gameId}_${config.deploymentId}`;
}
function sameMultiplayerConfig(left, right) {
  return Object.keys(
    MULTIPLAYER_MANIFEST_SCHEMA.properties
  ).every((key) => left[key] === right[key]);
}
var REALTIME_ACTIONS_PER_TICK = 8;
function isTurnCommand(value) {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some(
    (key) => !["commandId", "expectedSequence", "type", "payload"].includes(key)
  ))
    return false;
  if (typeof value.commandId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(value.commandId) || !isSequence(value.expectedSequence))
    return false;
  if (!["start", "restart", "close", "kick", "action"].includes(String(value.type)))
    return false;
  if (value.type === "action") return isRecord(value.payload);
  if (value.type === "kick")
    return isRecord(value.payload) && Object.keys(value.payload).length === 1 && typeof value.payload.playerId === "string" && value.payload.playerId.length <= 100;
  return value.payload === void 0;
}
function isPlainJson(value, depth = 0) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (depth >= 4) return false;
  if (Array.isArray(value)) return value.every((item) => isPlainJson(item, depth + 1));
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && Object.values(value).every((item) => isPlainJson(item, depth + 1));
}
function isRealtimeInput(value) {
  return isRecord(value) && !Object.hasOwn(value, "inputId") && isPlainJson(value) && JSON.stringify(value).length <= REALTIME_INPUT_MAX_LENGTH;
}
function isRealtimeAction(value) {
  return isRecord(value) && isPlainJson(value) && JSON.stringify(value).length <= REALTIME_INPUT_MAX_LENGTH;
}
function isRealtimeInputMessage(value) {
  if (!isRecord(value) || !isSequence(value.inputId)) return false;
  const { inputId: _inputId, ...input } = value;
  return isRealtimeInput(input);
}
function isMultiplayerEvent(value) {
  return isRecord(value) && [
    "room.ready",
    "member.joined",
    "member.left",
    "state.updated",
    "turn.changed",
    "room.finished",
    "room.closed",
    "protocol.error"
  ].includes(String(value.type)) && typeof value.roomId === "string" && typeof value.deploymentId === "string" && isSequence(value.sequence) && isServerTime(value.serverTime) && "payload" in value;
}
function isTurnCommandResult(value) {
  return isRecord(value) && typeof value.commandId === "string" && typeof value.accepted === "boolean" && isSequence(value.sequence) && (value.accepted ? value.error === void 0 : isRecord(value.error) && [
    "invalid_command",
    "not_your_turn",
    "sequence_conflict",
    "room_full",
    "deployment_mismatch",
    "protocol_mismatch",
    "not_authorized",
    "room_closed",
    "rate_limited"
  ].includes(String(value.error.code)) && typeof value.error.message === "string");
}
function isMultiplayerSnapshot(value) {
  if (!isRecord(value) || typeof value.roomId !== "string" || typeof value.gameId !== "string" || typeof value.deploymentId !== "string" || !["turn-based", "realtime"].includes(String(value.mode)) || !isSequence(value.sequence) || !isServerTime(value.serverTime) || !isRecord(value.state) || value.acks !== void 0 && !isAcks(value.acks))
    return false;
  const state = value.state;
  return ["lobby", "playing", "finished", "closed"].includes(String(state.phase)) && typeof state.ownerId === "string" && typeof state.currentPlayerId === "string" && typeof state.winnerPlayerId === "string" && typeof state.turnDeadline === "number" && Number.isFinite(state.turnDeadline) && (state.game === void 0 || isRecord(state.game)) && Array.isArray(state.players) && state.players.length <= 32 && state.players.every(
    (player) => isRecord(player) && typeof player.playerId === "string" && typeof player.displayName === "string" && typeof player.connected === "boolean" && typeof player.x === "number" && Number.isFinite(player.x) && typeof player.y === "number" && Number.isFinite(player.y)
  );
}
function normalizeDisplayName(value) {
  if (typeof value !== "string") return "Guest";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/\s+/g, " ").slice(0, 40) || "Guest";
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isSequence(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function isServerTime(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function isLockstepEarlyInput(value) {
  return isRecord(value) && isSequence(value.round) && typeof value.playerId === "string" && isSequence(value.inputId) && isSequence(value.frame) && isRealtimeInput(value.input);
}
function isLockstepInput(value) {
  return isRecord(value) && Object.keys(value).length === 3 && isSequence(value.inputId) && isSequence(value.frame) && isRealtimeInput(value.input);
}
function isLockstepFrame(value) {
  return isRecord(value) && isSequence(value.round) && isSequence(value.frame) && isRecord(value.inputs) && (value.actions === void 0 || Array.isArray(value.actions)) && (value.events === void 0 || Array.isArray(value.events)) && (value.acks === void 0 || isRecord(value.acks));
}
function isLockstepSync(value) {
  return isRecord(value) && isSequence(value.round) && isSequence(value.tickMs) && isRecord(value.start) && isRecord(value.start.state) && typeof value.start.startedAt === "number" && Array.isArray(value.frames) && value.frames.every(isLockstepFrame) && (value.checkpoint === void 0 || isRecord(value.checkpoint) && isSequence(value.checkpoint.frame) && isRecord(value.checkpoint.state));
}
function isLockstepReport(value) {
  return isRecord(value) && isSequence(value.round) && isSequence(value.frame) && isRecord(value.state);
}
var P2P_SIGNAL_MAX_LENGTH = 8192;
var isValue = (value, max = OWNER_VALUE_MAX_LENGTH) => isPlainJson(value) && JSON.stringify(value).length <= max;
function isOwnerState(value) {
  return isRecord(value) && isValue(value, OWNER_STATE_MAX_LENGTH);
}
function isOwnerPatch(value) {
  return isRecord(value) && Object.keys(value).every((key) => key === "set" || key === "delete" || key === "seq") && (value.seq === void 0 || isSequence(value.seq)) && (value.set === void 0 || isOwnerState(value.set)) && (value.delete === void 0 || Array.isArray(value.delete) && value.delete.length <= 64 && value.delete.every((key) => typeof key === "string"));
}
function isOwnerSharedChange(value) {
  return isRecord(value) && typeof value.key === "string" && value.key.length >= 1 && value.key.length <= 100 && Object.keys(value).every((key) => ["key", "value", "expect", "expectAbsent"].includes(key)) && (value.value === void 0 || isValue(value.value)) && (value.expect === void 0 || isValue(value.expect)) && (value.expectAbsent === void 0 || value.expectAbsent === true);
}
function isOwnerMessage(value) {
  return isRecord(value) && isValue(value);
}
var isMessageId = (value) => typeof value === "string" && /^[A-Za-z0-9_.:-]{1,40}$/.test(value);
function isOwnerEmit(value) {
  return isRecord(value) && Object.keys(value).length === 2 && isMessageId(value.id) && isOwnerMessage(value.message);
}
function isOwnerMessageEvent(value) {
  return isRecord(value) && typeof value.from === "string" && isMessageId(value.id) && isOwnerMessage(value.message);
}
function isP2PSignal(value) {
  return isRecord(value) && typeof value.to === "string" && value.to.length <= 100 && isRecord(value.data) && isPlainJson(value.data) && JSON.stringify(value.data).length <= P2P_SIGNAL_MAX_LENGTH;
}
function isOwnerFrame(value) {
  return isRecord(value) && isSequence(value.round) && (value.players === void 0 || isRecord(value.players)) && (value.left === void 0 || Array.isArray(value.left));
}
function isOwnerSync(value) {
  return isRecord(value) && isSequence(value.round) && isRecord(value.players) && isRecord(value.shared);
}
function isOwnerSharedUpdate(value) {
  return isRecord(value) && isSequence(value.round) && typeof value.by === "string" && Array.isArray(value.changes);
}
function sameJson(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index++) if (!sameJson(left[index], right[index])) return false;
    return true;
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  let keys = 0;
  for (const key in left) {
    if (left[key] === void 0) continue;
    keys++;
    if (!Object.hasOwn(right, key) || !sameJson(left[key], right[key])) return false;
  }
  for (const key in right) if (right[key] !== void 0) keys--;
  return keys === 0;
}
function isAcks(value) {
  return Array.isArray(value) && value.every((ack) => Number.isInteger(ack) && ack >= -1);
}
function isSnapshotDelta(value) {
  return isRecord(value) && typeof value.roomId === "string" && isSequence(value.sequence) && isSequence(value.base) && isServerTime(value.serverTime) && (value.acks === void 0 || isAcks(value.acks)) && Array.isArray(value.changes) && value.changes.every(
    (change) => Array.isArray(change) && (change.length === 1 || change.length === 2) && Array.isArray(change[0]) && change[0].every((key) => typeof key === "string" || typeof key === "number" && Number.isInteger(key) && key >= 0)
  );
}
function stateChanges(before, after) {
  const changes = [];
  collectChanges(before, after, [], changes);
  return changes;
}
function collectChanges(before, after, path, changes) {
  if (before === after) return;
  if (isRecord(before) && isRecord(after)) {
    for (const key in after) {
      const value = after[key];
      if (value === void 0) continue;
      path.push(key);
      if (before[key] === void 0 || !Object.hasOwn(before, key)) changes.push([[...path], value]);
      else collectChanges(before[key], value, path, changes);
      path.pop();
    }
    for (const key in before)
      if (before[key] !== void 0 && (after[key] === void 0 || !Object.hasOwn(after, key))) changes.push([[...path, key]]);
    return;
  }
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    const items = [];
    for (let index = 0; index < after.length; index++) {
      path.push(index);
      collectChanges(before[index], after[index], path, items);
      path.pop();
    }
    if (items.length > 1 && JSON.stringify(after).length < JSON.stringify(items).length) changes.push([[...path], after]);
    else for (const item of items) changes.push(item);
    return;
  }
  if (!sameJson(before, after)) changes.push([[...path], after]);
}
function applyStateChanges(state, changes) {
  const copied = /* @__PURE__ */ new WeakSet();
  let root = state;
  for (const change of changes) {
    const [path] = change;
    if (path.length === 0) {
      root = change.length === 2 ? change[1] : void 0;
      continue;
    }
    root = changeAt(root, path, 0, change, copied);
  }
  return root;
}
function changeAt(node, path, depth, change, copied) {
  const key = path[depth];
  const container = Array.isArray(node) ? copied.has(node) ? node : [...node] : isRecord(node) ? copied.has(node) ? node : { ...node } : typeof key === "number" ? [] : {};
  copied.add(container);
  const last = depth === path.length - 1;
  const value = last ? change[1] : changeAt(container[key], path, depth + 1, change, copied);
  if (last && change.length === 1) {
    if (Array.isArray(container) && typeof key === "number") container.splice(key, 1);
    else delete container[key];
  } else if (key === "__proto__") Object.defineProperty(container, key, { value, writable: true, enumerable: true, configurable: true });
  else container[key] = value;
  return container;
}

// packages/sdk/src/account-protocol.ts
function gameTokenAudience(gameId) {
  return `ohmygame:game:${gameId}`;
}
function isOrigin(value, allowLocalhost) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || allowLocalhost && loopback && url.protocol === "http:") && url.origin === value.replace(/\/$/, "");
  } catch {
    return false;
  }
}
function isGameAccountConfig(value, options = {}) {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "issuer" && key !== "hostOrigins")) return false;
  const local = options.allowLocalhost === true;
  if (typeof value.issuer !== "string") return false;
  try {
    const issuer = new URL(value.issuer);
    if (!isOrigin(issuer.origin, local) || issuer.username || issuer.password || issuer.search || issuer.hash) return false;
  } catch {
    return false;
  }
  return value.hostOrigins === void 0 || Array.isArray(value.hostOrigins) && value.hostOrigins.length <= 8 && value.hostOrigins.every((origin) => isOrigin(origin, local));
}
function isOhMyGamePlayer(value) {
  return isRecord(value) && typeof value.id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value.id) && typeof value.name === "string" && value.name.length <= 100;
}

// packages/sdk/src/errors.ts
var OhMyGameError = class extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.code = code;
  }
  code;
  name = "OhMyGameError";
};
function isOhMyGameError(value, code) {
  return value instanceof OhMyGameError && (code === void 0 || value.code === code);
}

// packages/sdk/src/account.ts
function browserAccountEnvironment() {
  if (typeof window === "undefined" || typeof window.crypto?.subtle === "undefined") return void 0;
  let storage;
  try {
    storage = window.localStorage;
  } catch {
    storage = void 0;
  }
  return {
    fetch: (...args) => fetch(...args),
    storage,
    location: window.location,
    replaceUrl: (url) => window.history.replaceState(window.history.state, "", url),
    openPopup: (url) => window.open(url, "ohmygame-sign-in", "popup,width=480,height=680"),
    opener: window.opener,
    parent: window.parent !== window ? window.parent : null,
    close: () => window.close(),
    listen(listener) {
      const receive = (event) => listener(event);
      window.addEventListener("message", receive);
      return () => window.removeEventListener("message", receive);
    },
    crypto: window.crypto,
    now: () => Date.now(),
    ...typeof navigator !== "undefined" && navigator.locks ? { exclusive: (name, task) => navigator.locks.request(name, task) } : {}
  };
}
var SIGN_IN_MESSAGE = "ohmygame:sign-in";
var HOST_REQUEST = "ohmygame:account-request";
var HOST_RESPONSE = "ohmygame:account";
var RENEW_BEFORE_MS = 3e4;
var PENDING_MS = 10 * 6e4;
var HOST_WAIT_MS = 1500;
function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function readSession(value, now) {
  if (!isRecord(value) || typeof value.access_token !== "string" || !value.access_token || typeof value.expires_in !== "number" || !(value.expires_in > 0) || value.refresh_token !== void 0 && typeof value.refresh_token !== "string" || !isOhMyGamePlayer(value.player))
    return void 0;
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresAt: now + value.expires_in * 1e3,
    player: { id: value.player.id, name: value.player.name }
  };
}
function isStoredSession(value) {
  return isRecord(value) && typeof value.accessToken === "string" && (value.refreshToken === void 0 || typeof value.refreshToken === "string") && typeof value.expiresAt === "number" && isOhMyGamePlayer(value.player);
}
var OhMyGameAccount = class {
  constructor(config, env) {
    this.config = config;
    this.env = env;
    const issuer = config?.issuer.replace(/\/+$/, "");
    this.key = `ohmygame:account:${issuer ?? ""}`;
    this.hostOrigins = config ? config.hostOrigins ?? [new URL(config.issuer).origin] : [];
    this.session = this.load();
  }
  config;
  env;
  session;
  renewing;
  signingIn;
  hostAnswer;
  key;
  hostOrigins;
  get available() {
    return this.config !== void 0 && this.env !== void 0;
  }
  get player() {
    return this.session?.player;
  }
  /**
   * Finishes a sign-in that left this page, and asks an embedding OhMyGame page for its
   * player. Returns "popup" when this page is the sign-in popup handing its result back;
   * the popup then closes, and the game should not start in it.
   */
  async start() {
    if (!this.available) return void 0;
    const handed = await this.finishRedirect();
    if (handed) return handed;
    if (!this.session && this.env.parent) this.hostAnswer = this.askHost();
    return void 0;
  }
  async getToken() {
    if (!this.available) return void 0;
    if (!this.session && this.hostAnswer) await this.hostAnswer;
    const session = this.session;
    if (!session) return void 0;
    if (session.expiresAt - this.env.now() > RENEW_BEFORE_MS) return session.accessToken;
    const renew = () => this.renew(session);
    this.renewing ??= (this.env.exclusive ? this.env.exclusive(`${this.key}:renew`, renew) : renew()).finally(() => {
      this.renewing = void 0;
    });
    return (await this.renewing)?.accessToken;
  }
  signIn() {
    if (!this.available)
      return Promise.reject(
        new OhMyGameError(
          "unsupported",
          "OhMyGame sign-in is available once the game is published to OhMyGame. Local builds play as guests."
        )
      );
    this.signingIn ??= this.interactiveSignIn().finally(() => {
      this.signingIn = void 0;
    });
    return this.signingIn;
  }
  async interactiveSignIn() {
    const env = this.env;
    if (env.parent) {
      const handed = await (this.hostAnswer ?? (this.hostAnswer = this.askHost()));
      if (handed) return handed.player;
    }
    const verifier = base64url(env.crypto.getRandomValues(new Uint8Array(32)));
    const challenge = base64url(new Uint8Array(await env.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    const current = new URL(env.location.href);
    const pending = {
      state: base64url(env.crypto.getRandomValues(new Uint8Array(16))),
      verifier,
      redirectUri: `${current.origin}${current.pathname}`,
      popup: true,
      createdAt: env.now()
    };
    const authorize = new URL(`${this.issuer}/v1/game-auth/authorize`);
    for (const [name, value] of Object.entries({
      response_type: "code",
      redirect_uri: pending.redirectUri,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: pending.state
    }))
      authorize.searchParams.set(name, value);
    this.savePending(pending);
    const popup = env.openPopup(authorize.href);
    if (!popup) {
      if (env.parent) {
        this.savePending(void 0);
        throw new OhMyGameError("cancelled", "The sign-in window was blocked. Allow pop-ups for this game and try again.");
      }
      this.savePending({ ...pending, popup: false });
      env.location.assign(authorize.href);
      return new Promise(() => {
      });
    }
    const before = this.load()?.accessToken;
    const code = await new Promise((resolve, reject) => {
      const timer = setInterval(() => {
        if (!popup.closed) return;
        finish();
        const saved = this.load();
        if (saved && saved.accessToken !== before) resolve(void 0);
        else reject(new OhMyGameError("cancelled", "Sign-in was closed before it finished."));
      }, 500);
      const stop = env.listen(({ data, origin, source }) => {
        if (origin !== env.location.origin || source !== popup || !isRecord(data) || data.type !== SIGN_IN_MESSAGE || data.state !== pending.state)
          return;
        finish();
        if (typeof data.code === "string" && data.code) resolve(data.code);
        else reject(new OhMyGameError("cancelled", "Sign-in did not complete."));
      });
      const finish = () => {
        clearInterval(timer);
        stop();
      };
    }).finally(() => this.savePending(void 0));
    if (code === void 0) {
      this.session = this.load();
      return this.session.player;
    }
    return (await this.exchange(code, pending)).player;
  }
  /** Handles the account service's return to this page, when this sign-in started here. */
  async finishRedirect() {
    const env = this.env;
    const url = new URL(env.location.href);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code") ?? void 0;
    const pending = this.loadPending();
    if (state && pending?.state !== state && env.opener && (code || url.searchParams.has("error"))) {
      env.opener.postMessage({ type: SIGN_IN_MESSAGE, state, code }, env.location.origin);
      env.close();
      return "popup";
    }
    if (!state || !pending || pending.state !== state) return void 0;
    if (pending.popup) {
      if (env.opener) env.opener.postMessage({ type: SIGN_IN_MESSAGE, state, code }, env.location.origin);
      else if (code) await this.exchange(code, pending).catch(() => void 0);
      env.close();
      return "popup";
    }
    for (const name of ["code", "state", "error", "error_description"]) url.searchParams.delete(name);
    env.replaceUrl(url.href);
    this.savePending(void 0);
    if (code) await this.exchange(code, pending).catch(() => void 0);
    return void 0;
  }
  async exchange(code, pending) {
    const session = await this.token({
      grant_type: "authorization_code",
      code,
      code_verifier: pending.verifier,
      redirect_uri: pending.redirectUri
    });
    if (!session) throw new OhMyGameError("request_failed", "OhMyGame did not accept the sign-in. Try again.");
    this.save(session);
    return session;
  }
  async renew(session) {
    const stored = this.load();
    if (stored && stored.expiresAt - this.env.now() > RENEW_BEFORE_MS) {
      this.session = stored;
      return stored;
    }
    const latest = stored ?? session;
    if (!latest.refreshToken) {
      this.save(void 0);
      return this.hostAnswer = this.askHost();
    }
    const renewed = await this.token({ grant_type: "refresh_token", refresh_token: latest.refreshToken });
    this.save(renewed);
    return renewed;
  }
  /** The token endpoint's session; undefined when it refuses the grant, so the player is signed out. */
  async token(body) {
    let response;
    try {
      response = await this.env.fetch(`${this.issuer}/v1/game-auth/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(1e4)
      });
    } catch (cause) {
      throw new OhMyGameError("request_failed", "OhMyGame sign-in could not be reached.", { cause });
    }
    if (response.status === 400 || response.status === 401) return void 0;
    if (!response.ok) throw new OhMyGameError("request_failed", `OhMyGame sign-in failed (${response.status}).`);
    const session = readSession(await response.json().catch(() => void 0), this.env.now());
    if (!session) throw new OhMyGameError("invalid_response", "OhMyGame sign-in answered with an invalid session.");
    return session;
  }
  /** Asks the embedding page for its signed-in player; only OhMyGame's own pages are believed. */
  askHost() {
    const env = this.env;
    const parent = env.parent;
    if (!parent) return Promise.resolve(void 0);
    return new Promise((resolve) => {
      const timer = setTimeout(() => done(void 0), HOST_WAIT_MS);
      const stop = env.listen(({ data, origin, source }) => {
        if (source !== parent || !this.hostOrigins.includes(origin) || !isRecord(data) || data.type !== HOST_RESPONSE) return;
        const session = readSession(data.session, env.now());
        if (session) this.save(session);
        done(session);
      });
      const done = (session) => {
        clearTimeout(timer);
        stop();
        resolve(session);
      };
      for (const origin of this.hostOrigins) parent.postMessage({ type: HOST_REQUEST }, origin);
    });
  }
  get issuer() {
    return this.config.issuer.replace(/\/+$/, "");
  }
  load() {
    try {
      const value = JSON.parse(this.env?.storage?.getItem(this.key) ?? "null");
      return isStoredSession(value) ? value : void 0;
    } catch {
      return void 0;
    }
  }
  save(session) {
    this.session = session;
    try {
      if (session) this.env?.storage?.setItem(this.key, JSON.stringify(session));
      else this.env?.storage?.removeItem(this.key);
    } catch {
    }
  }
  loadPending() {
    try {
      const value = JSON.parse(this.env?.storage?.getItem(`${this.key}:pending`) ?? "null");
      if (isRecord(value) && typeof value.state === "string" && typeof value.verifier === "string" && typeof value.redirectUri === "string" && typeof value.popup === "boolean" && typeof value.createdAt === "number" && this.env.now() - value.createdAt < PENDING_MS)
        return value;
    } catch {
    }
    return void 0;
  }
  savePending(pending) {
    try {
      if (pending) this.env?.storage?.setItem(`${this.key}:pending`, JSON.stringify(pending));
      else this.env?.storage?.removeItem(`${this.key}:pending`);
    } catch {
    }
  }
};

// packages/sdk/src/identity.ts
var GuestIdentity = class {
  constructor(options) {
    this.options = options;
    this.storage = options.storage ?? browserStorage();
    this.key = `ohmygame:multiplayer:guest:${options.serverUrl}`;
  }
  options;
  storage;
  key;
  issuing;
  async getToken() {
    try {
      const value = JSON.parse(this.storage?.getItem(this.key) ?? "null");
      if (isRecord(value) && typeof value.token === "string" && typeof value.expiresAt === "number" && value.expiresAt > Date.now() + 6e4)
        return value.token;
    } catch {
    }
    this.issuing ??= this.issue().finally(() => {
      this.issuing = void 0;
    });
    return this.issuing;
  }
  async issue() {
    const previous = this.saved();
    const response = await serviceRequest(this.options.endpoint ?? this.options.serverUrl, "/v1/guests", {
      method: "POST",
      ...previous ? { headers: { Authorization: `Bearer ${previous}` } } : {}
    });
    const value = await response.json();
    if (!isRecord(value) || typeof value.token !== "string" || typeof value.expiresAt !== "number")
      throw new OhMyGameError("invalid_response", "Invalid guest session.");
    try {
      this.storage?.setItem(this.key, JSON.stringify(value));
    } catch {
    }
    return value.token;
  }
  saved() {
    try {
      const value = JSON.parse(this.storage?.getItem(this.key) ?? "null");
      return isRecord(value) && typeof value.token === "string" ? value.token : void 0;
    } catch {
      return void 0;
    }
  }
};
var SERVICE_CODES = /* @__PURE__ */ new Set(["quota_exceeded", "rate_limited", "conflict"]);
async function serviceRequest(serverUrl, path, options, accept = []) {
  let response;
  try {
    response = await fetch(new URL(path, serverUrl), { credentials: "omit", ...options, signal: AbortSignal.timeout(1e4) });
  } catch (cause) {
    const timedOut = isRecord(cause) && cause.name === "TimeoutError";
    throw new OhMyGameError(
      timedOut ? "timeout" : "offline",
      timedOut ? "The game service did not answer in time." : "The game service could not be reached.",
      { cause }
    );
  }
  if (!response.ok && !accept.includes(response.status)) {
    const value = await response.json().catch(() => void 0);
    const code = isRecord(value) && SERVICE_CODES.has(value.code) ? value.code : "request_failed";
    throw new OhMyGameError(
      code,
      isRecord(value) && typeof value.error === "string" ? value.error.slice(0, 300) : `The game service request failed (${response.status}).`
    );
  }
  return response;
}
function browserStorage() {
  try {
    return typeof window === "undefined" ? void 0 : window.localStorage;
  } catch {
    return void 0;
  }
}

// packages/sdk/src/cloud-protocol.ts
var CLOUD_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
var SAVE_MAX_KEYS = 32;
var SAVE_MAX_BYTES = 64 * 1024;
var SCORE_SUBMITS_PER_MINUTE = 10;
var LEADERBOARD_PAGE_MAX = 100;
function isCloudConfig(value, options = {}) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const { serverUrl, gameId, ...rest } = value;
  if (Object.keys(rest).length || typeof serverUrl !== "string" || typeof gameId !== "string") return false;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(gameId)) return false;
  try {
    const url = new URL(serverUrl);
    const local = options.allowLocalhost === true && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || local) && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}

// packages/sdk/src/cloud.ts
function cloudPlayer(config, identity, account, storage) {
  const guest = new GuestIdentity({ serverUrl: config.serverUrl, storage });
  const custom = identity !== void 0 && identity !== account;
  return {
    guestOwner: "guest",
    owner: () => account.player ? `account:${account.player.id}` : custom ? "player" : "guest",
    async token() {
      return await identity?.getToken() ?? guest.getToken();
    }
  };
}
function checkName(value, what) {
  if (typeof value !== "string" || !CLOUD_NAME_PATTERN.test(value))
    throw new OhMyGameError("invalid_option", `A ${what} is 1 to 64 letters, digits, dots, dashes or underscores.`);
  return value;
}
function unreachable(cause) {
  return isOhMyGameError(cause, "offline") || isOhMyGameError(cause, "timeout");
}
var CloudStorage = class {
  constructor(config, player, storage, gameKey) {
    this.config = config;
    this.player = player;
    this.storage = storage;
    this.gameKey = gameKey;
    this.cloud = !!config && !!player;
    if (this.cloud && typeof window !== "undefined") window.addEventListener("online", () => void this.sync().catch(() => {
    }));
  }
  config;
  player;
  storage;
  gameKey;
  cloud;
  syncing;
  async get(key) {
    checkName(key, "save key");
    if (!this.cloud) return this.local("local", key)?.value;
    const owner = this.player.owner();
    const mine = this.local(owner, key);
    if (mine?.dirty) {
      await this.send(owner, key, mine).catch((cause) => {
        if (!unreachable(cause)) throw cause;
      });
      return mine.value;
    }
    let remote;
    try {
      const response = await this.request(`/saves/${key}`, {}, [404]);
      remote = response.status === 404 ? void 0 : await response.json();
    } catch (cause) {
      if (unreachable(cause)) return mine?.value;
      throw cause;
    }
    if (remote) {
      this.keep(owner, key, { value: remote.value });
      return remote.value;
    }
    if (owner !== this.player.guestOwner) {
      const guest = this.local(this.player.guestOwner, key);
      if (guest && !guest.deleted) {
        await this.set(key, guest.value);
        this.forget(this.player.guestOwner, key);
        return guest.value;
      }
    }
    this.forget(owner, key);
    return void 0;
  }
  async set(key, value) {
    checkName(key, "save key");
    let json;
    try {
      json = JSON.stringify(value);
    } catch {
      json = void 0;
    }
    if (json === void 0) throw new OhMyGameError("invalid_option", "A save must be JSON data.");
    if (new TextEncoder().encode(json).length > SAVE_MAX_BYTES)
      throw new OhMyGameError("quota_exceeded", `A save holds at most ${SAVE_MAX_BYTES / 1024} KB of JSON.`);
    const copy = JSON.parse(json);
    if (!this.cloud) return this.keep("local", key, { value: copy });
    await this.write(key, { value: copy, dirty: true });
  }
  async remove(key) {
    checkName(key, "save key");
    if (!this.cloud) return this.forget("local", key);
    await this.write(key, { deleted: true, dirty: true });
  }
  async keys() {
    if (!this.cloud) return this.localKeys("local");
    const owner = this.player.owner();
    try {
      await this.sync();
      const response = await this.request("/saves");
      const remote = (await response.json()).map((save) => save.key);
      return [.../* @__PURE__ */ new Set([...remote, ...this.localKeys(owner)])].sort();
    } catch (cause) {
      if (!unreachable(cause)) throw cause;
      return this.localKeys(owner);
    }
  }
  sync() {
    if (!this.cloud) return Promise.resolve();
    this.syncing ??= (async () => {
      try {
        const owner = this.player.owner();
        for (const key of this.dirtyKeys(owner)) await this.send(owner, key, this.local(owner, key));
      } finally {
        this.syncing = void 0;
      }
    })();
    return this.syncing;
  }
  /** Keeps the change here first, then tells the service; out of reach, it waits for sync. */
  async write(key, save) {
    const owner = this.player.owner();
    this.keep(owner, key, save);
    try {
      await this.send(owner, key, save);
    } catch (cause) {
      if (!unreachable(cause)) {
        this.forget(owner, key);
        throw cause;
      }
    }
  }
  async send(owner, key, save) {
    if (save.deleted) {
      await this.request(`/saves/${key}`, { method: "DELETE" });
      this.forget(owner, key);
    } else {
      await this.request(`/saves/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: save.value })
      });
      if (JSON.stringify(this.local(owner, key)) === JSON.stringify(save)) this.keep(owner, key, { value: save.value });
    }
  }
  async request(path, init2 = {}, accept = []) {
    const token = await this.player.token();
    return serviceRequest(
      this.config.serverUrl,
      `/v1/games/${encodeURIComponent(this.config.gameId)}${path}`,
      { ...init2, headers: { ...init2.headers, Authorization: `Bearer ${token}` } },
      accept
    );
  }
  prefix(owner) {
    return `ohmygame:save:${this.gameKey}:${owner}:`;
  }
  local(owner, key) {
    try {
      const value = JSON.parse(this.storage?.getItem(this.prefix(owner) + key) ?? "null");
      return isRecord(value) ? value : void 0;
    } catch {
      return void 0;
    }
  }
  keep(owner, key, save) {
    try {
      this.storage?.setItem(this.prefix(owner) + key, JSON.stringify(save));
    } catch {
    }
  }
  forget(owner, key) {
    try {
      this.storage?.removeItem(this.prefix(owner) + key);
    } catch {
    }
  }
  entries(owner) {
    const prefix = this.prefix(owner);
    const found = [];
    for (let index = 0; index < (this.storage?.length ?? 0); index++) {
      const name = this.storage.key(index);
      if (!name?.startsWith(prefix)) continue;
      const save = this.local(owner, name.slice(prefix.length));
      if (save) found.push([name.slice(prefix.length), save]);
    }
    return found;
  }
  localKeys(owner) {
    return this.entries(owner).filter(([, save]) => !save.deleted).map(([key]) => key).sort();
  }
  dirtyKeys(owner) {
    return this.entries(owner).filter(([, save]) => save.dirty).map(([key]) => key);
  }
};
var CloudLeaderboard = class {
  constructor(config, player) {
    this.config = config;
    this.player = player;
    this.available = !!config && !!player;
  }
  config;
  player;
  available;
  async submit(board, score, options = {}) {
    checkName(board, "leaderboard name");
    if (typeof score !== "number" || !Number.isFinite(score)) throw new OhMyGameError("invalid_option", "A score is a finite number.");
    if (options.order !== void 0 && options.order !== "desc" && options.order !== "asc")
      throw new OhMyGameError("invalid_option", 'order is "desc" or "asc".');
    const response = await this.request(`/leaderboards/${board}/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, ...options.order ? { order: options.order } : {} })
    });
    return await response.json();
  }
  async top(board, options = {}) {
    checkName(board, "leaderboard name");
    const limit = options.limit ?? 10;
    const offset = options.offset ?? 0;
    if (!Number.isInteger(limit) || limit < 1 || limit > LEADERBOARD_PAGE_MAX || !Number.isInteger(offset) || offset < 0)
      throw new OhMyGameError("invalid_option", `limit is 1 to ${LEADERBOARD_PAGE_MAX}, and offset a whole number.`);
    const response = await this.request(`/leaderboards/${board}?limit=${limit}&offset=${offset}`);
    return await response.json();
  }
  async me(board) {
    checkName(board, "leaderboard name");
    const response = await this.request(`/leaderboards/${board}/me`, {}, [404]);
    return response.status === 404 ? void 0 : await response.json();
  }
  async request(path, init2 = {}, accept = []) {
    if (!this.available)
      throw new OhMyGameError("not_configured", 'This game has no game service for leaderboards. Publish it to OhMyGame, or add "cloud" to manifest.json.');
    const token = await this.player.token();
    return serviceRequest(
      this.config.serverUrl,
      `/v1/games/${encodeURIComponent(this.config.gameId)}${path}`,
      { ...init2, headers: { ...init2.headers, Authorization: `Bearer ${token}` } },
      accept
    );
  }
};

// packages/sdk/src/define-game.ts
function defineGame(definition) {
  return definition;
}
function defineRealtimeGame(definition) {
  return definition;
}
function isRealtimeGameDefinition(value) {
  return typeof value === "object" && value !== null && typeof value.tick === "function";
}

// packages/sdk/src/index.ts
async function init(options = {}) {
  const manifest = typeof options.manifest === "object" && !(options.manifest instanceof URL) ? options.manifest : await loadManifest(options.manifest);
  const declared = manifest.multiplayer;
  if (declared !== void 0 && !isMultiplayerManifestConfig(declared, { allowLocalhost: options.allowLocalhost }))
    throw new OhMyGameError(
      "not_configured",
      options.allowLocalhost || !isMultiplayerManifestConfig(declared, { allowLocalhost: true }) ? "The multiplayer deployment in manifest.json is invalid." : "This multiplayer deployment runs on this computer only. Pass allowLocalhost: true for local playtests."
    );
  const account = manifest.account;
  if (account !== void 0 && !isGameAccountConfig(account, { allowLocalhost: options.allowLocalhost }))
    throw new OhMyGameError("not_configured", "The account settings in manifest.json are invalid.");
  const cloud = manifest.cloud;
  if (cloud !== void 0 && !isCloudConfig(cloud, { allowLocalhost: options.allowLocalhost }))
    throw new OhMyGameError("not_configured", "The cloud settings in manifest.json are invalid.");
  const auth = new OhMyGameAccount(account, options.accountEnvironment ?? browserAccountEnvironment());
  if (await auth.start() === "popup") return new Promise(() => {
  });
  const identity = options.identity ?? (auth.available ? auth : void 0);
  const storage = options.storage ?? browserStorage();
  const player = cloud ? cloudPlayer(cloud, identity, auth, storage) : void 0;
  return {
    multiplayer: declared,
    auth,
    storage: new CloudStorage(cloud, player, storage, cloud?.gameId ?? "local"),
    leaderboard: new CloudLeaderboard(cloud, player),
    ...cloud ? { cloud } : {},
    identity,
    allowLocalhost: options.allowLocalhost
  };
}
async function loadManifest(location) {
  const url = location === void 0 ? new URL("./manifest.json", typeof document === "undefined" ? void 0 : document.baseURI) : new URL(location, typeof document === "undefined" ? void 0 : document.baseURI);
  let value;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`manifest.json returned ${response.status}.`);
    value = await response.json();
  } catch (cause) {
    throw new OhMyGameError("not_configured", `Could not load ${url.pathname}. Copy public/manifest.json into the build output.`, { cause });
  }
  if (!isRecord(value)) throw new OhMyGameError("not_configured", "manifest.json must contain a JSON object.");
  return value;
}
export {
  DEFAULT_TICK_MS,
  GuestIdentity,
  LEADERBOARD_PAGE_MAX,
  LOCKSTEP_ADAPTER_ID,
  MULTIPLAYER_MANIFEST_SCHEMA,
  MULTIPLAYER_MAX_CLIENTS,
  MULTIPLAYER_MIN_CLIENTS,
  MULTIPLAYER_PROTOCOL_UNSUPPORTED_CODE,
  MULTIPLAYER_PROTOCOL_VERSION,
  MULTIPLAYER_PROTOCOL_VERSIONS,
  MULTIPLAYER_ROOM_LIMIT_CODE,
  OWNER_ADAPTER_ID,
  OWNER_SHARED_MAX_CHANGES,
  OWNER_SHARED_MAX_KEYS,
  OWNER_STATE_MAX_LENGTH,
  OWNER_VALUE_MAX_LENGTH,
  OhMyGameError,
  P2P_SIGNAL_MAX_LENGTH,
  REALTIME_ACTIONS_PER_TICK,
  REALTIME_INPUT_MAX_LENGTH,
  ROOM_MESSAGES_PER_SECOND,
  SAVE_MAX_BYTES,
  SAVE_MAX_KEYS,
  SCORE_SUBMITS_PER_MINUTE,
  TICK_MS_RANGE,
  applyStateChanges,
  browserStorage,
  defineGame,
  defineRealtimeGame,
  describeProtocolMismatch,
  gameTokenAudience,
  init,
  isCloudConfig,
  isGameAccountConfig,
  isLockstepEarlyInput,
  isLockstepFrame,
  isLockstepInput,
  isLockstepReport,
  isLockstepSync,
  isMultiplayerEvent,
  isMultiplayerManifestConfig,
  isMultiplayerSnapshot,
  isOhMyGameError,
  isOwnerEmit,
  isOwnerFrame,
  isOwnerMessage,
  isOwnerMessageEvent,
  isOwnerPatch,
  isOwnerSharedChange,
  isOwnerSharedUpdate,
  isOwnerState,
  isOwnerSync,
  isP2PSignal,
  isPublishedMultiplayerManifest,
  isRealtimeAction,
  isRealtimeGameDefinition,
  isRealtimeInput,
  isRealtimeInputMessage,
  isRecord,
  isSequence,
  isSnapshotDelta,
  isTurnCommand,
  isTurnCommandResult,
  multiplayerRoomType,
  negotiateProtocolVersion,
  normalizeDisplayName,
  sameJson,
  sameMultiplayerConfig,
  serviceRequest,
  stateChanges
};
