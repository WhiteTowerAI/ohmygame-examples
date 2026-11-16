import { init, isOhMyGameError, type OhMyGame } from "@ohmygame/sdk";
import { createMultiplayerClient } from "@ohmygame/sdk/multiplayer";
import rules, { type ArenaState } from "./rules";
import "./style.css";

type Profile = { displayName: string; wins: number; games: number; practiceScore: number };
type Room = ReturnType<typeof createMultiplayerClient<typeof rules>>;

const app = document.querySelector<HTMLElement>("#app") ?? (() => { throw new Error("Missing app root."); })();

let game: OhMyGame;
let room: Room | undefined;
let profile: Profile = { displayName: "Arena player", wins: 0, games: 0, practiceScore: 0 };
let notice = "Connect your game services to start a shared round.";
let rooms: Awaited<ReturnType<Room["publicRooms"]>> = [];
const recordedRounds = new Set<string>();

function validProfile(value: unknown): Profile {
  if (typeof value !== "object" || value === null) return profile;
  const saved = value as Partial<Profile>;
  return {
    displayName:
      typeof saved.displayName === "string" && saved.displayName.trim()
        ? saved.displayName.slice(0, 32)
        : profile.displayName,
    wins: typeof saved.wins === "number" && Number.isSafeInteger(saved.wins) ? saved.wins : 0,
    games: typeof saved.games === "number" && Number.isSafeInteger(saved.games) ? saved.games : 0,
    practiceScore:
      typeof saved.practiceScore === "number" && Number.isSafeInteger(saved.practiceScore)
        ? saved.practiceScore
        : 0,
  };
}

function message(error: unknown): string {
  return isOhMyGameError(error)
    ? `${error.code}: ${error.message}`
    : error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
}

async function saveProfile() {
  await game.storage.set("social-arena.profile", profile);
}

async function signIn() {
  try {
    await game.auth.signIn();
    notice = "Signed in. Your leaderboard score can now be public.";
  } catch (error) {
    if (!isOhMyGameError(error, "cancelled")) notice = message(error);
  }
  render();
}

async function refreshLeaderboard() {
  if (!game.leaderboard.available) {
    notice = "Leaderboards become available after game_sdk_setup configures cloud services.";
    render();
    return;
  }
  try {
    const top = await game.leaderboard.top("social-arena.practice", { limit: 5 });
    notice = top.length
      ? `Leaderboard: ${top.map((entry) => `${entry.name} ${entry.score}`).join(" · ")}`
      : "No public practice scores yet — publish one to be first.";
  } catch (error) {
    notice = message(error);
  }
  render();
}

async function publishPracticeScore() {
  if (!game.auth.player) {
    notice = "Sign in before publishing a public practice score.";
    render();
    return;
  }
  try {
    const result = await game.leaderboard.submit("social-arena.practice", profile.practiceScore);
    notice = result.public
      ? `Published practice score ${result.score} at rank ${result.rank}.`
      : "Your practice score was saved privately.";
  } catch (error) {
    notice = message(error);
  }
  render();
}

async function recordRound() {
  const state = room?.snapshot?.state;
  if (!state || state.phase !== "finished" || !room?.roomCode || !room.playerId) return;
  const winners = state.winnerPlayerIds ?? [];
  const key = `${room.roomCode}:${winners.join(",")}`;
  if (recordedRounds.has(key)) return;
  recordedRounds.add(key);

  profile = { ...profile, games: profile.games + 1 };
  const won = winners.includes(room.playerId);
  if (won) {
    profile = { ...profile, wins: profile.wins + 1 };
  }
  try {
    await saveProfile();
  } catch (error) {
    notice = `The result could not be saved: ${message(error)}`;
  }
  notice = won ? "You won! Your cloud profile was updated." : "Round complete. Your cloud profile was updated.";
  render();
}

function connectRoom() {
  if (!game.multiplayer) return;
  room = createMultiplayerClient(
    game,
    {
      onStatus: (status) => {
        notice = `Room connection: ${status}.`;
        render();
      },
      onReady: (_playerId, inviteCode) => {
        notice = `Room ready. Share invite code ${inviteCode}.`;
        render();
      },
      onSnapshot: () => {
        void recordRound();
        render();
      },
      onMessage: (from, value) => {
        if (typeof value === "object" && value !== null && "text" in value) {
          notice = `${from}: ${String(value.text).slice(0, 80)}`;
          render();
        }
      },
      onError: (error) => {
        notice = message(error);
        render();
      },
    },
    { rules },
  );
  void room.reconnect().then((restored) => {
    if (restored) notice = "Reconnected to your previous room.";
    render();
  });
}

async function createRoom() {
  if (!room) return;
  try {
    await room.createRoom({ displayName: profile.displayName });
  } catch (error) {
    notice = message(error);
    render();
  }
}

async function joinRoom(roomCode: string) {
  if (!room) return;
  try {
    await room.joinRoom({ roomCode: roomCode.trim().toUpperCase(), displayName: profile.displayName });
  } catch (error) {
    notice = message(error);
    render();
  }
}

async function leaveRoom() {
  if (!room) return;
  try {
    await room.leave();
    rooms = [];
    notice = "Left the room. You can create or join another one.";
  } catch (error) {
    notice = message(error);
  }
  render();
}

async function joinPublicRoom(roomId: string) {
  if (!room) return;
  try {
    await room.joinRoom({ roomId, displayName: profile.displayName });
  } catch (error) {
    notice = message(error);
    render();
  }
}

async function listRooms() {
  if (!room) return;
  try {
    rooms = await room.publicRooms();
    notice = rooms.length ? "Choose an open public room, or create your own." : "No public rooms are waiting.";
  } catch (error) {
    notice = message(error);
  }
  render();
}

function currentArena() {
  const state = room?.snapshot?.state;
  const arena = state?.game as ArenaState | undefined;
  return { state, arena };
}

function render() {
  const { state, arena } = currentArena();
  const signedIn = game.auth.player?.name;
  const roomReady = Boolean(room?.roomCode);
  const invite = room?.roomCode ?? "—";
  const players = state?.players ?? [];
  const scores = Object.entries(arena?.scores ?? {});
  const canPulse = state?.phase === "playing";

  app.innerHTML = `
    <section class="hero">
      <p class="eyebrow">OhMyGame SDK service example</p>
      <h1>Social Arena</h1>
      <p>Sign in, save a profile, publish a practice score, and play a live shared tap round with friends.</p>
    </section>
    <section class="grid">
      <article>
        <h2>1. Identity</h2>
        <p>${signedIn ? `Signed in as <strong>${escapeHtml(signedIn)}</strong>.` : "Play as a guest or sign in to publish your score."}</p>
        <button data-action="sign-in" ${game.auth.available && !signedIn ? "" : "disabled"}>${signedIn ? "Signed in" : "Sign in"}</button>
      </article>
      <article>
        <h2>2. Cloud profile</h2>
        <label>Display name <input data-field="name" maxlength="32" value="${escapeHtml(profile.displayName)}" /></label>
        <p><strong>${profile.wins}</strong> wins · <strong>${profile.games}</strong> rounds · ${game.storage.cloud ? "cloud sync enabled" : "saved in this browser"}</p>
        <button data-action="save-profile">Save profile</button>
      </article>
      <article>
        <h2>3. Leaderboard</h2>
        <p>Practice score: <strong>${profile.practiceScore}</strong>. Custom host-room results stay out of public rankings. ${game.leaderboard.available ? "The game service is ready." : "Set up cloud services first."}</p>
        <div class="room-actions">
          <button data-action="practice">Practice +1</button>
          <button data-action="publish-practice" ${game.leaderboard.available && signedIn ? "" : "disabled"}>Publish practice score</button>
        </div>
        <button data-action="leaderboard">Refresh top 5</button>
      </article>
      <article class="room-card">
        <h2>4. Live room</h2>
        <p>${game.multiplayer ? "Create a room, share its code, then race to pulse." : "Run multiplayer_setup to configure a host realtime room for this game."}</p>
        <div class="room-actions">
          <button data-action="create" ${room ? "" : "disabled"}>Create room</button>
          <button data-action="list" ${room ? "" : "disabled"}>Find public rooms</button>
        </div>
        <label>Invite code <input data-field="invite" placeholder="ABC123" ${room ? "" : "disabled"} /></label>
        <button data-action="join" ${room ? "" : "disabled"}>Join room</button>
        <p class="invite">Your room: <strong>${invite}</strong></p>
        ${roomReady ? `<p class="room-presence"><strong>Players: ${players.length} / 4</strong>${players.length ? ` · ${players.map((player) => escapeHtml(player.displayName ?? "Player")).join(", ")}` : ""}</p>` : ""}
        <button data-action="leave" ${roomReady ? "" : "disabled"}>Leave room</button>
        ${rooms.length ? `<ul class="rooms">${rooms.map((open) => `<li><button data-room="${escapeHtml(open.roomId)}">Join public room (${open.clients}/${open.maxClients})</button></li>`).join("")}</ul>` : ""}
      </article>
    </section>
    <section class="arena">
      <div>
        <p class="eyebrow">Shared realtime round</p>
        <h2>${state?.phase === "finished" ? "Round complete" : roomReady ? state?.phase ?? "Waiting for players" : "No room connected"}</h2>
        <p>${arena ? `${arena.remaining} pulses remain` : "Create or join a configured room to begin."}</p>
        <button class="pulse" data-action="pulse" ${canPulse ? "" : "disabled"}>Pulse!</button>
        <button data-action="start" ${state?.phase === "lobby" ? "" : "disabled"}>Start round</button>
        <button data-action="cheer" ${roomReady ? "" : "disabled"}>Send “Good luck!”</button>
      </div>
      <ol class="scoreboard">${scores.length ? scores.map(([id, score]) => `<li class="${id === room?.playerId ? "you" : ""}"><span>${escapeHtml(players.find((player) => player.playerId === id)?.displayName ?? "Player")}</span><strong>${score}</strong></li>`).join("") : "<li>Scores appear after the room starts.</li>"}</ol>
    </section>
    <p class="notice" role="status">${escapeHtml(notice)}</p>
    <aside>
      <h2>Setup note</h2>
      <p>Inside OhMyGame, run <code>game_sdk_setup</code> for sign-in, cloud saves and leaderboards, then run <code>multiplayer_setup</code> with a host realtime room and a 200 ms tick. Those tools write <code>manifest.json</code>; do not hand-edit production service settings.</p>
    </aside>
  `;

  app.querySelector<HTMLInputElement>('[data-field="name"]')?.addEventListener("input", (event) => {
    profile = { ...profile, displayName: (event.target as HTMLInputElement).value.slice(0, 32) };
  });
  app.querySelector('[data-action="sign-in"]')?.addEventListener("click", () => void signIn());
  app.querySelector('[data-action="save-profile"]')?.addEventListener("click", () => {
    void saveProfile().then(() => { notice = "Profile saved."; render(); }).catch((error) => { notice = message(error); render(); });
  });
  app.querySelector('[data-action="leaderboard"]')?.addEventListener("click", () => void refreshLeaderboard());
  app.querySelector('[data-action="practice"]')?.addEventListener("click", () => {
    profile = { ...profile, practiceScore: profile.practiceScore + 1 };
    void saveProfile().then(() => { notice = "Practice score saved to your profile."; render(); }).catch((error) => { notice = message(error); render(); });
  });
  app.querySelector('[data-action="publish-practice"]')?.addEventListener("click", () => void publishPracticeScore());
  app.querySelector('[data-action="create"]')?.addEventListener("click", () => void createRoom());
  app.querySelector('[data-action="list"]')?.addEventListener("click", () => void listRooms());
  app.querySelector('[data-action="join"]')?.addEventListener("click", () => void joinRoom(app.querySelector<HTMLInputElement>('[data-field="invite"]')?.value ?? ""));
  app.querySelector('[data-action="leave"]')?.addEventListener("click", () => void leaveRoom());
  app.querySelectorAll<HTMLButtonElement>("[data-room]").forEach((button) => button.addEventListener("click", () => void joinPublicRoom(button.dataset.room ?? "")));
  app.querySelector('[data-action="start"]')?.addEventListener("click", () => room?.sendCommand("start"));
  app.querySelector('[data-action="pulse"]')?.addEventListener("click", () => room?.sendAction({ type: "pulse" }));
  app.querySelector('[data-action="cheer"]')?.addEventListener("click", () => room?.emit({ text: "Good luck!" }));
}

async function start() {
  try {
    game = await init({ allowLocalhost: true });
    profile = validProfile(await game.storage.get<unknown>("social-arena.profile"));
    connectRoom();
    render();
  } catch (error) {
    app.textContent = message(error);
  }
}

void start();
