import { defineRealtimeGame } from "../src/ohmygame/define-game.js";

const ROUND_SECONDS = 180;
const MAX_ITEMS = 14;
const CONVOY_MAX_HP = 1000;
const FIRE_INTERVAL = 0.58;
const PIRATE_HP = { scout: 6, bomber: 10 };
const ENEMY_INTERVAL = 3.8;
const BOMB_INTERVAL = 3.2;
const SCOUT_FIRE_INTERVAL = 2.25;
const BOMB_START_DELAY = 12;
const MAX_ENEMIES = 7;
const MAX_BOMBS = 5;
const MAX_ENEMY_BULLETS = 6;

function spawnItem(ctx: any, kind?: string) {
  const roll = ctx.random();
  return {
    id: `${Math.floor(ctx.now())}-${Math.floor(ctx.random() * 100000)}`,
    kind: kind || (roll < 0.82 ? "coin" : roll < 0.96 ? "fish" : "heart"),
    x: 8 + Math.floor(ctx.random() * 84),
    y: -6,
  };
}

function spawnPlayer(id: string, index: number) {
  return { id, x: 20 + index * 20, y: 78, lives: 3, hp: 100, maxHp: 100, score: 0, finalScore: 0, rating: "C", coins: 0, fish: 0, hearts: 0, economyPoints: 0, battlePoints: 0, convoyScore: 0, economyScore: 0, survivalScore: 0, victoryBonus: 0, enemyKills: 0, survivalSeconds: 0, boost: 0, alive: true, hitFlash: 0, paint: "coral", smallCd: 0, ultimateCd: 0, attackBoost: 0, damageReduction: 0 };
}

function detonateBomb(G: any, ctx: any, bomb: any, multiplier = 1, forceConvoyHit = false) {
  G.explosions.push({ id: `ex-${Math.floor(ctx.now())}-${Math.floor(ctx.random() * 1e5)}`, x: bomb.x, y: bomb.y, ttl: 2, kind: "bomb" });
  const convoyDx = bomb.x - 50, convoyDy = bomb.y - 78;
  if (forceConvoyHit || convoyDx * convoyDx + convoyDy * convoyDy < 180) {
    G.convoy.hp = Math.max(0, G.convoy.hp - Math.round(35 * multiplier));
  }
  let shieldBlocked = false;
  for (const player of Object.values<any>(G.players)) {
    if (!player.alive) continue;
    const dx = player.x - bomb.x, dy = player.y - bomb.y;
    if (dx * dx + dy * dy >= 144) continue;
    if (G.shieldField > 0 && G.shieldCharges > 0) { shieldBlocked = true; continue; }
    const reduction = player.damageReduction > 0 ? .45 : 1;
    player.hp = Math.max(0, player.hp - Math.round(18 * multiplier * reduction));
    player.hitFlash = .6;
    if (player.hp <= 0) { player.alive = false; player.lives = 0; }
  }
  if (shieldBlocked) {
    G.shieldCharges = 0;
    G.shieldField = 0;
    G.effects = G.effects.filter((effect: any) => effect.kind !== "shield");
    G.effects.push({ id: `shield-block-${Math.floor(ctx.now())}`, kind: "shield-block", x: bomb.x, y: bomb.y, ttl: .45 });
  }
}

function finalizeScores(G: any) {
  if (G.scoresFinalized) return;
  const convoyBase = Math.max(0, Math.min(1, G.convoy.hp / G.convoy.maxHp));
  for (const player of Object.values<any>(G.players)) {
    const economyBase = Math.max(0, player.economyPoints);
    const survivalBase = player.alive ? Math.max(0, Math.min(1, player.survivalSeconds / ROUND_SECONDS)) * Math.max(0, Math.min(1, player.hp / player.maxHp)) : 0;
    player.convoyScore = Math.round(convoyBase * 400);
    player.economyScore = Math.round(economyBase * 0.20);
    player.survivalScore = Math.round(survivalBase * 200);
    player.battleScore = Math.round(Math.max(0, player.battlePoints) * 0.20);
    player.finalScore = player.convoyScore + player.economyScore + player.survivalScore + player.battleScore;
    player.score = player.finalScore;
    player.rating = player.finalScore >= 850 ? "S" : player.finalScore >= 700 ? "A" : player.finalScore >= 500 ? "B" : "C";
  }
  G.scoresFinalized = true;
}

export default defineRealtimeGame({
  players: { min: 1, max: 4 },
  tickMs: 80,
  setup: (ctx: any) => ({
    elapsed: 0,
    timeLeft: ROUND_SECONDS,
    started: true,
    convoy: { hp: CONVOY_MAX_HP, maxHp: CONVOY_MAX_HP, progress: 0, goal: 100 },
    scoresFinalized: false,
    outcome: "",
    enemies: [], playerBullets: [], enemyBullets: [], enemyBombs: [], explosions: [], effects: [], pendingUltimates: [], fireClock: 0, enemyClock: 0, enemyFireClock: 0, bombClock: 0, freezeBombs: 0, shieldField: 0, shieldCharges: 0,
    items: Array.from({ length: 8 }, (_, index) => spawnItem(ctx, index < 6 ? "coin" : index === 6 ? "fish" : "heart")),
    players: Object.fromEntries(ctx.players.map((id: string, index: number) => [id, spawnPlayer(id, index)])),
  }),
  input(value: Record<string, unknown>) {
    const x = Number(value.x ?? 0);
    const y = Number(value.y ?? 0);
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1 || Math.abs(y) > 1) throw new Error("Invalid flight input.");
    return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  },
  action(value: Record<string, unknown>) {
    if (value.boost === true) return { boost: true };
    if (value.repair === true) return { repair: true };
    const skill = value.skill === "small" || value.skill === "ultimate" ? value.skill : "";
    const paint = ["coral", "teal", "violet", "sun"].includes(String(value.paint)) ? String(value.paint) : "coral";
    if (!skill) throw new Error("Invalid skill action.");
    return { skill, paint };
  },
  tick(G: any, ctx: any, inputs: Readonly<Record<string, { x: number; y: number }>>, dt: number, actions: readonly any[]) {
    if (!G.started) return;
    G.elapsed += dt;
    G.timeLeft = Math.max(0, ROUND_SECONDS - G.elapsed);
    for (const action of actions) {
      const player = G.players[action.playerId];
      if (!player?.alive) continue;
      if (action.repair === true && player.paint === "teal" && player.hearts > 0) { player.hearts -= 1; G.convoy.hp = Math.min(G.convoy.maxHp, G.convoy.hp + 100); }
      if (action.boost === true) player.boost = Math.max(player.boost, 3.5);
      if (action.paint) player.paint = action.paint;
      if (action.skill === "small" && player.smallCd <= 0) {
        player.smallCd = 6;
        if (player.paint === "coral") { player.attackBoost = 4; G.effects.push({ id: `fx-${ctx.now()}-${player.id}-small`, kind: "small-attack", x: player.x, y: player.y, ttl: 0.8 }); }
        if (player.paint === "teal") { player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.1); G.effects.push({ id: `fx-${ctx.now()}-${player.id}-small`, kind: "small-heal", x: player.x, y: player.y, ttl: 0.8 }); }
        if (player.paint === "violet") { player.damageReduction = 4; G.effects.push({ id: `fx-${ctx.now()}-${player.id}-small`, kind: "small-shield", x: player.x, y: player.y, ttl: 4 }); }
        if (player.paint === "sun") { player.boost = Math.max(player.boost, 5); G.effects.push({ id: `fx-${ctx.now()}-${player.id}-small`, kind: "small-speed", x: player.x, y: player.y, ttl: 1.2 }); }
      }
      if (action.skill === "ultimate" && player.ultimateCd <= 0) {
        player.ultimateCd = 20;
        if (player.paint === "coral") { G.pendingUltimates.push({ kind: "coral-fish-bomb", owner: player.id, x: player.x, y: player.y, delay: 0.55 }); G.effects.push({ id: `fx-${ctx.now()}-${player.id}-fish`, kind: "fish-bomb", x: player.x, y: player.y - 18, ttl: 0.55 }); }
        if (player.paint === "teal") { G.convoy.hp = Math.min(G.convoy.maxHp, G.convoy.hp + G.convoy.maxHp * 0.2); G.effects.push({ id: `fx-${ctx.now()}-${player.id}-self`, kind: "heal-ultimate", x: player.x, y: player.y, ttl: 2.4 }); G.effects.push({ id: `fx-${ctx.now()}-${player.id}`, kind: "repair", x: 50, y: 22, ttl: 2.4 }); }
        if (player.paint === "violet") { G.shieldField = 4; G.shieldCharges = 1; G.effects.push({ id: `fx-${ctx.now()}-${player.id}`, kind: "shield", x: player.x, y: player.y, ttl: 4 }); }
        if (player.paint === "sun") { G.freezeBombs = 3; player.boost = Math.max(player.boost, 3); G.effects.push({ id: `fx-${ctx.now()}-${player.id}`, kind: "freeze", x: player.x, y: player.y, ttl: 3 }); }
      }
    }
    for (const player of Object.values<any>(G.players)) {
      if (!player.alive) continue;
      const input = inputs[player.id] || { x: 0, y: 0 };
      const speed = player.boost > 0 ? 29 : 18;
      player.x = Math.max(5, Math.min(95, player.x + input.x * speed * dt));
      player.y = Math.max(8, Math.min(92, player.y + input.y * speed * dt));
      player.boost = Math.max(0, player.boost - dt);
      player.smallCd = Math.max(0, player.smallCd - dt);
      player.ultimateCd = Math.max(0, player.ultimateCd - dt);
      player.attackBoost = Math.max(0, player.attackBoost - dt);
      player.damageReduction = Math.max(0, player.damageReduction - dt);
      player.hitFlash = Math.max(0, player.hitFlash - dt);
      player.survivalSeconds = Math.min(ROUND_SECONDS, player.survivalSeconds + dt);
    }
    for (const pending of G.pendingUltimates) pending.delay -= dt;
    for (let index = G.pendingUltimates.length - 1; index >= 0; index -= 1) {
      const pending = G.pendingUltimates[index];
      if (pending.delay > 0) continue;
      if (pending.kind === "coral-fish-bomb") {
        for (let enemyIndex = G.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
          const enemy = G.enemies[enemyIndex];
          if ((enemy.x - pending.x) ** 2 + (enemy.y - pending.y) ** 2 >= 900) continue;
          enemy.hp -= 24;
          if (enemy.hp <= 0) { const owner = G.players[pending.owner]; if (owner) { owner.enemyKills += 1; owner.battlePoints += enemy.kind === "bomber" ? 10 : 5; } G.enemies.splice(enemyIndex, 1); }
        }
        G.enemyBombs.length = 0;
        G.explosions.push({ id: `fish-boom-${ctx.now()}`, x: pending.x, y: pending.y - 10, ttl: 0.9, kind: "bomb" });
        G.effects.push({ id: `fx-${ctx.now()}-${pending.owner}-boom`, kind: "cannon", x: pending.x, y: pending.y - 10, ttl: 0.9 });
      }
      G.pendingUltimates.splice(index, 1);
    }
    // The convoy only advances here; its HP never regenerates by itself.
    G.convoy.progress = Math.min(G.convoy.goal, G.convoy.progress + dt * (100 / ROUND_SECONDS));
    G.fireClock += dt; G.enemyClock += dt; G.enemyFireClock += dt; G.bombClock += dt;
    if (G.fireClock >= FIRE_INTERVAL) {
      G.fireClock = 0;
      for (const player of Object.values<any>(G.players)) if (player.alive) {
        const baseDamage = player.paint === "coral" ? 2 : player.paint === "teal" ? 1 : 1.5;
        G.playerBullets.push({ id: `pb-${Math.floor(ctx.now())}-${Math.floor(ctx.random() * 1e5)}`, owner: player.id, damage: baseDamage * (player.attackBoost > 0 ? 1.5 : 1), x: player.x, y: player.y - 5, vy: -52 });
      }
    }
    const pressure = Math.max(0, Object.values<any>(G.players).filter((player) => player.alive).length - 1);
    if (G.enemyClock >= ENEMY_INTERVAL - pressure * 0.22 && G.enemies.length < MAX_ENEMIES) {
      G.enemyClock = 0;
      const kind = ctx.random() < 0.7 ? "scout" : "bomber";
      G.enemies.push({ id: `enemy-${Math.floor(ctx.now())}`, kind, x: 10 + ctx.random() * 80, y: -8, hp: PIRATE_HP[kind], maxHp: PIRATE_HP[kind] });
    }
    if (G.elapsed >= BOMB_START_DELAY && G.bombClock >= BOMB_INTERVAL - pressure * 0.15 && G.enemyBombs.length < MAX_BOMBS) {
      G.bombClock = 0;
      const bombers = G.enemies.filter((enemy: any) => enemy.kind === "bomber");
      const enemy = bombers[Math.floor(ctx.random() * bombers.length)];
      if (enemy) G.enemyBombs.push({ id: `eb-${Math.floor(ctx.now())}-${Math.floor(ctx.random() * 1e5)}`, x: enemy.x, y: enemy.y, targetX: 50, vy: 18 });
    }
    if (G.enemyFireClock >= SCOUT_FIRE_INTERVAL && G.enemyBullets.length < MAX_ENEMY_BULLETS) {
      const scouts = G.enemies.filter((enemy: any) => enemy.kind === "scout");
      const scout = scouts[Math.floor(ctx.random() * scouts.length)];
      G.enemyFireClock = 0;
      if (scout) G.enemyBullets.push({ id: `sb-${Math.floor(ctx.now())}-${Math.floor(ctx.random() * 1e5)}`, x: scout.x, y: scout.y + 4, vx: 0, vy: 25 });
    }
    if (G.freezeBombs <= 0) for (const enemy of G.enemies) enemy.y += (enemy.kind === "bomber" ? 8 : 13) * dt;
    for (const bullet of G.playerBullets) bullet.y += bullet.vy * dt;
    if (G.freezeBombs <= 0) for (const bullet of G.enemyBullets) { bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; }
    if (G.freezeBombs > 0) G.freezeBombs = Math.max(0, G.freezeBombs - dt);
    if (G.shieldField > 0) { G.shieldField = Math.max(0, G.shieldField - dt); if (G.shieldField === 0) G.shieldCharges = 0; }
    for (const explosion of G.explosions) explosion.ttl -= dt;
    G.explosions = G.explosions.filter((explosion: any) => explosion.ttl > 0);
    for (const effect of G.effects) effect.ttl -= dt;
    G.effects = G.effects.filter((effect: any) => effect.ttl > 0);
    for (const bomb of G.enemyBombs) if (G.freezeBombs <= 0) { bomb.y += bomb.vy * dt; bomb.x += ((bomb.targetX ?? 50) - bomb.x) * Math.min(1, dt * 1.5); }
    for (let bi = G.playerBullets.length - 1; bi >= 0; bi -= 1) {
      const bullet = G.playerBullets[bi];
      const enemyShot = G.enemyBullets.findIndex((shot: any) => (bullet.x - shot.x) ** 2 + (bullet.y - shot.y) ** 2 < 34);
      if (enemyShot >= 0) { G.playerBullets.splice(bi, 1); G.enemyBullets.splice(enemyShot, 1); }
    }
    for (let bi = G.playerBullets.length - 1; bi >= 0; bi--) {
      const bullet = G.playerBullets[bi];
      let hit = -1;
      for (let ei = 0; ei < G.enemies.length; ei++) { const enemy = G.enemies[ei]; const dx = bullet.x - enemy.x, dy = bullet.y - enemy.y; if (dx * dx + dy * dy < 90) { hit = ei; break; } }
      if (hit >= 0) { const enemy = G.enemies[hit]; enemy.hp -= bullet.damage || 1; if (enemy.hp <= 0) { const owner = G.players[bullet.owner]; if (owner) { owner.enemyKills += 1; owner.battlePoints += enemy.kind === "bomber" ? 10 : 5; } G.enemies.splice(hit, 1); } G.playerBullets.splice(bi, 1); }
    }
    // Player shots can intercept pirate bombs before they reach the convoy.
    for (let bi = G.playerBullets.length - 1; bi >= 0; bi--) {
      const bullet = G.playerBullets[bi];
      const bombIndex = G.enemyBombs.findIndex((bomb: any) => {
        const dx = bullet.x - bomb.x, dy = bullet.y - bomb.y;
        return dx * dx + dy * dy < 82;
      });
      if (bombIndex >= 0) {
        const bomb = G.enemyBombs[bombIndex];
        detonateBomb(G, ctx, bomb, .62);
        G.enemyBombs.splice(bombIndex, 1);
        G.playerBullets.splice(bi, 1);
      }
    }
    for (let bi = G.enemyBullets.length - 1; bi >= 0; bi -= 1) {
      const bullet = G.enemyBullets[bi];
      if ((bullet.x - 50) ** 2 + (bullet.y - 78) ** 2 < 80) {
        G.convoy.hp = Math.max(0, G.convoy.hp - 8);
        G.enemyBullets.splice(bi, 1);
        continue;
      }
      const hit = Object.values<any>(G.players).find((player) => player.alive && (player.x - bullet.x) ** 2 + (player.y - bullet.y) ** 2 < 42);
      if (hit) {
        hit.hp = Math.max(0, hit.hp - Math.round(8 * (hit.damageReduction > 0 ? .45 : 1)));
        hit.hitFlash = .35;
        if (hit.hp <= 0) { hit.alive = false; hit.lives = 0; }
        G.enemyBullets.splice(bi, 1);
        continue;
      }
      if (bullet.x < -6 || bullet.x > 106 || bullet.y < -6 || bullet.y > 106) G.enemyBullets.splice(bi, 1);
    }
    G.enemies = G.enemies.filter((enemy: any) => enemy.y < 110);
    for (let bi = G.enemyBombs.length - 1; bi >= 0; bi--) {
      const bomb = G.enemyBombs[bi];
      const convoyDx = bomb.x - 50, convoyDy = bomb.y - 78;
      const playerHit = Object.values<any>(G.players).some((player) => player.alive && (player.x - bomb.x) ** 2 + (player.y - bomb.y) ** 2 < 144);
      const consumed = bomb.y > 104 || convoyDx * convoyDx + convoyDy * convoyDy < 95 || playerHit;
      if (consumed) detonateBomb(G, ctx, bomb, 1, bomb.y > 104);
      if (consumed) G.enemyBombs.splice(bi, 1);
    }
    for (const item of G.items) item.y += 11 * dt;
    G.items = G.items.filter((item: any) => item.y < 108);
    if (G.items.length < MAX_ITEMS && ctx.random() < dt * 0.95) G.items.push(spawnItem(ctx));
    for (const player of Object.values<any>(G.players)) {
      if (!player.alive) continue;
      for (let index = G.items.length - 1; index >= 0; index -= 1) {
        const item = G.items[index];
        const dx = item.x - player.x;
        const dy = item.y - player.y;
        if (dx * dx + dy * dy > 45) continue;
        if (item.kind === "coin") { player.coins += 1; player.economyPoints += 5; }
        else if (item.kind === "fish") { player.fish += 1; player.economyPoints += 10; player.hp = Math.min(player.maxHp, player.hp + 5); }
        else if (item.kind === "heart") { player.hp = Math.min(player.maxHp, player.hp + 10); player.hearts += 1; }
        G.items.splice(index, 1);
        break;
      }
    }
  },
  join(G: any, ctx: any, playerId: string) { G.players[playerId] = spawnPlayer(playerId, ctx.players.indexOf(playerId)); },
  // Leaving a live round is a surrender. Keep the state entry so the other
  // clients receive one authoritative frame with this plane marked defeated.
  leave(G: any, _ctx: any, playerId: string) {
    if (G.players[playerId]) {
      G.players[playerId].alive = false;
      G.players[playerId].lives = 0;
    }
  },
  endIf(G: any, ctx: any) {
    const players = Object.values<any>(G.players);
    const alive = players.filter((player) => player.alive);
    if (G.timeLeft <= 0 || G.convoy.hp <= 0 || alive.length === 0) {
      G.outcome = G.convoy.hp <= 0 ? "convoy-destroyed" : alive.length === 0 ? "all-out" : "arrived";
      finalizeScores(G);
      const ranking = players.slice().sort((a, b) => Number(b.alive) - Number(a.alive) || b.score - a.score);
      return { winners: ranking.length ? [ranking[0].id] : [] };
    }
    return undefined;
  },
  playerView: (G: any) => G,
});
