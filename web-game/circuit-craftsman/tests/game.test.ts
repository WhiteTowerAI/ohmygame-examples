import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/game/levels';
import { BASE_MASK, evaluate, isRotatable, referenceRotations, rotateMask, score, turnsToMask } from '../src/game/rules';
import { GameSession } from '../src/game/session';
import { defaultProgress, parseProgress, loadProgress, saveProgress, SKINS } from '../src/game/save';
import { findHint, solveCircuit } from '../src/game/solver';

function unlocked() {
  const progress = defaultProgress();
  progress.unlocked = 40;
  return progress;
}

function finish(session: GameSession, rotations = referenceRotations(session.level)) {
  for (let cell = 0; cell < session.level.tiles.length && session.phase !== 'won'; cell++) {
    const tile = session.level.tiles[cell];
    if (!isRotatable(tile.kind)) continue;
    const count = turnsToMask(tile.kind, session.rotations[cell], rotateMask(BASE_MASK[tile.kind], rotations[cell]));
    for (let step = 0; step < count && !session.circuit.solved; step++) session.rotate(cell);
  }
}

test('all forty authored boards start unsolved, have a validated solution and correct reference moves', () => {
  assert.equal(LEVELS.length, 40);
  for (const level of LEVELS) {
    assert.equal(level.size, 4 + level.region);
    assert.equal(level.tiles.filter((tile) => tile.kind === 'power').length, 1);
    assert(level.goals.length > 0);
    assert.equal(evaluate(level, level.tiles.map((tile) => tile.initial)).solved, false, `Initial level ${level.id}`);
    assert.equal(evaluate(level, referenceRotations(level)).solved, true, `Solution level ${level.id}`);
    const reference = level.tiles.reduce((sum, tile) => sum + (tile.required && isRotatable(tile.kind)
      ? turnsToMask(tile.kind, tile.initial, rotateMask(BASE_MASK[tile.kind], tile.solution)) : 0), 0);
    assert.equal(level.reference, reference);
    assert(level.reference > 0);
    const session = new GameSession(unlocked());
    session.load(level.id - 1);
    let wins = 0;
    session.subscribe((change) => { if (change.type === 'win') wins++; });
    finish(session);
    assert.equal(session.phase, 'won', `Playable solution ${level.id}`);
    assert.equal(session.earned, 3);
    assert.equal(wins, 1, `One completion event ${level.id}`);
    assert.equal(session.rotate(level.source), false);
  }
});

test('rotations are clockwise and straight-wire symmetry costs only one click', () => {
  assert.equal(rotateMask(1, 1), 2);
  assert.equal(rotateMask(2, 1), 4);
  assert.equal(rotateMask(4, 1), 8);
  assert.equal(rotateMask(8, 1), 1);
  assert.equal(turnsToMask('straight', 1, 10), 1);
});

test('undo restores connectivity without refunding moves; restart clears attempt state', () => {
  const session = new GameSession(defaultProgress());
  const initial = [...session.rotations];
  const cell = session.level.tiles.findIndex((tile) => isRotatable(tile.kind));
  assert(session.rotate(cell));
  assert.equal(session.moves, 1);
  assert(session.undo());
  assert.deepEqual(session.rotations, initial);
  assert.equal(session.moves, 1);
  assert.deepEqual([...session.circuit.powered], [...evaluate(session.level, initial).powered]);
  assert.equal(session.undo(), false);
  session.restart();
  assert.equal(session.moves, 0);
  assert.equal(session.usedHint, false);
  assert.equal(session.phase, 'playing');
});

test('fixed objects cannot rotate; overlays and level selection block the board', () => {
  const session = new GameSession(defaultProgress());
  const cell = session.level.tiles.findIndex((tile) => isRotatable(tile.kind));
  assert.equal(session.rotate(session.level.source), false);
  assert.equal(session.rotate(session.level.goals[0]), false);
  assert.equal(session.moves, 0);
  session.setOverlay('settings');
  assert.equal(session.rotate(cell), false);
  session.setOverlay(null);
  session.openLevels();
  assert.equal(session.rotate(cell), false);
  session.returnToGame();
  assert.equal(session.rotate(cell), true);
  assert.equal(session.load(39), false);
});

test('star boundaries, hint cap, retained best result and unlocking', () => {
  assert.equal(score(10, 10, false), 3);
  assert.equal(score(15, 10, false), 2);
  assert.equal(score(16, 10, false), 1);
  assert.equal(score(2, 2, true), 2);
  const session = new GameSession(defaultProgress());
  session.usedHint = true;
  finish(session);
  assert.equal(session.progress.stars[0], 2);
  assert.equal(session.progress.unlocked, 2);
  session.restart();
  finish(session);
  assert.equal(session.progress.stars[0], 3);
  session.restart();
  session.usedHint = true;
  finish(session);
  assert.equal(session.progress.stars[0], 3);
});

test('SAT hints find feasible solutions without auto-rotating, and stale hints are discarded', () => {
  for (const id of [1, 11, 20, 27, 40]) {
    const level = LEVELS[id - 1];
    const current = level.tiles.map((tile) => tile.initial);
    const started = Date.now();
    const hint = findHint(level, current)!;
    assert(hint, `Hint ${id}`);
    assert(isRotatable(level.tiles[hint.cell].kind));
    assert(!evaluate(level, current).lit.has(hint.bulb));
    assert(evaluate(level, hint.solution).solved);
    assert(hint.turns > 0);
    console.log(`Hint for level ${id}: ${Date.now() - started}ms`);
  }
  const session = new GameSession(defaultProgress());
  const initial = [...session.rotations];
  const hint = findHint(session.level, session.rotations)!;
  const revision = session.revision;
  assert(session.applyHint(hint, revision));
  assert.deepEqual(session.rotations, initial);
  assert.equal(session.moves, 0);
  assert.equal(session.usedHint, true);
  session.rotate(hint.cell);
  assert.equal(session.applyHint(hint, revision), false);
});

test('victory accepts actual connectivity rather than matching the reference artwork orientations', () => {
  const level = LEVELS[26];
  const solution = solveCircuit(level, level.tiles.map((tile) => tile.initial), false);
  assert(evaluate(level, solution).solved);
  const session = new GameSession(unlocked());
  session.load(26);
  finish(session, solution);
  assert.equal(session.phase, 'won');
});

test('corrupt or unavailable save fields recover safely and locked cosmetics stay locked', () => {
  assert.deepEqual(parseProgress('{broken'), defaultProgress());
  assert.deepEqual(parseProgress('null'), defaultProgress());
  const saved = parseProgress(JSON.stringify({ version: 1, unlocked: 999, stars: [-2,5], skin: 'rose', resume: { level: 0, rotations: [90] } }));
  assert.equal(saved.unlocked, 1);
  assert.equal(saved.skin, 'sunlight');
  assert.equal(saved.resume, null);
  assert(saved.stars.every((stars) => stars === 0));
  const session = new GameSession(defaultProgress());
  const cell = session.level.tiles.findIndex((tile) => isRotatable(tile.kind));
  session.rotate(cell);
  let raw = '';
  const persisted = new GameSession(defaultProgress(), (progress) => { raw = JSON.stringify(progress); });
  persisted.rotate(cell);
  const restored = new GameSession(parseProgress(raw));
  assert.deepEqual(restored.rotations, persisted.rotations);
  assert.equal(restored.moves, persisted.moves);
  assert.deepEqual(restored.history, persisted.history);
  assert.equal(restored.setSkin('rose'), false);
});

test('each authored board also produces a hint from a different current orientation', () => {
  for (const level of LEVELS) {
    const current = level.tiles.map((tile, index) => isRotatable(tile.kind)
      ? (tile.initial + index * 7 + level.id * 11) % 4 : tile.initial);
    if (evaluate(level, current).solved) continue;
    const hint = findHint(level, current);
    assert(hint, `Current-state hint ${level.id}`);
    assert(evaluate(level, hint.solution).solved);
    assert(isRotatable(level.tiles[hint.cell].kind));
    assert(!evaluate(level, current).lit.has(hint.bulb));
  }
});

test('cosmetic thresholds survive serialization and cannot spend unavailable stars', () => {
  for (const skin of SKINS) {
    for (const points of skin.cost === 0 ? [0] : [skin.cost - 1, skin.cost]) {
      const progress = unlocked();
      let remaining = points;
      progress.stars = progress.stars.map(() => { const value = Math.min(3, remaining); remaining -= value; return value; });
      const session = new GameSession(progress);
      assert.equal(session.setSkin(skin.id), points >= skin.cost);
      const restored = parseProgress(JSON.stringify(session.progress));
      assert.equal(restored.skin, points >= skin.cost ? skin.id : 'sunlight');
    }
  }
});

test('storage API round-trips attempts and preferences, and quota or access failures stay recoverable', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let stored = '';
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: () => stored || null,
      setItem: (_key: string, value: string) => { stored = value; },
    } });
    const session = new GameSession(defaultProgress(), saveProgress);
    const cell = session.level.tiles.findIndex((tile) => isRotatable(tile.kind));
    session.rotate(cell);
    session.setMuted(true);
    session.setReducedMotion(true);
    const restored = new GameSession(loadProgress());
    assert.deepEqual(restored.rotations, session.rotations);
    assert.equal(restored.moves, 1);
    assert.equal(restored.progress.muted, true);
    assert.equal(restored.progress.reducedMotion, true);
    assert(restored.undo());
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: () => { throw new Error('Access denied'); },
      setItem: () => { throw new Error('Quota exceeded'); },
    } });
    assert.equal(saveProgress(session.progress), false);
    assert.deepEqual(loadProgress(), defaultProgress());
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
