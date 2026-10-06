import { isLanguage } from '../i18n';
import type { Language } from '../i18n';
import { LEVELS } from './levels';
import { evaluate, isRotatable, score, tileMask } from './rules';
import type { Circuit, Level } from './rules';
import { SKINS, totalStars } from './save';
import type { Progress } from './save';
import type { Hint } from './solver';

export type Overlay = 'result' | 'settings' | 'skins' | null;
export interface Change {
  type: 'load' | 'rotate' | 'undo' | 'restart' | 'hint' | 'screen' | 'settings' | 'win';
  cell?: number;
  newlyLit?: number[];
}

export class GameSession {
  levelIndex = 0;
  rotations: number[] = [];
  moves = 0;
  usedHint = false;
  history: { cell: number; before: number }[] = [];
  phase: 'playing' | 'won' = 'playing';
  screen: 'game' | 'levels' = 'game';
  overlay: Overlay = null;
  hint: Hint | null = null;
  hintBusy = false;
  revision = 0;
  earned = 0;
  circuit!: Circuit;
  readonly listeners = new Set<(change: Change) => void>();

  constructor(public progress: Progress, private persist: (progress: Progress) => void = () => {}, private transient = false) {
    const resume = progress.resume;
    this.load(resume?.level ?? progress.lastLevel, true);
    if (resume && resume.level === this.levelIndex) {
      this.rotations = this.level.tiles.map((tile, index) => isRotatable(tile.kind) ? resume.rotations[index] : tile.initial);
      if (!evaluate(this.level, this.rotations).solved) {
        this.moves = resume.moves;
        this.usedHint = resume.usedHint;
        this.history = resume.history.filter((entry) => isRotatable(this.level.tiles[entry.cell].kind));
      } else this.rotations = this.level.tiles.map((tile) => tile.initial);
      this.circuit = evaluate(this.level, this.rotations);
    }
  }

  get level(): Level { return LEVELS[this.levelIndex]; }
  get active(): boolean { return this.screen === 'game' && this.overlay === null && this.phase === 'playing'; }

  subscribe(listener: (change: Change) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(change: Change): void {
    for (const listener of this.listeners) listener(change);
  }

  private store(): void {
    if (this.transient) return;
    this.progress.resume = this.phase === 'playing' ? {
      level: this.levelIndex, rotations: [...this.rotations], moves: this.moves,
      usedHint: this.usedHint, history: this.history.slice(-1000),
    } : null;
    this.persist(this.progress);
  }

  load(index: number, initializing = false): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= LEVELS.length || (!this.transient && index >= this.progress.unlocked)) return false;
    this.levelIndex = index;
    this.rotations = this.level.tiles.map((tile) => tile.initial);
    this.moves = 0;
    this.usedHint = false;
    this.history = [];
    this.phase = 'playing';
    this.screen = 'game';
    this.overlay = null;
    this.hint = null;
    this.hintBusy = false;
    this.earned = 0;
    this.revision++;
    this.circuit = evaluate(this.level, this.rotations);
    if (!initializing) {
      this.progress.lastLevel = index;
      this.store();
      this.emit({ type: 'load' });
    }
    return true;
  }

  rotate(cell: number): boolean {
    if (!this.active || !this.level.tiles[cell] || !isRotatable(this.level.tiles[cell].kind)) return false;
    this.history.push({ cell, before: this.rotations[cell] });
    this.rotations[cell] = (this.rotations[cell] + 1) % 4;
    this.moves++;
    this.revision++;
    this.hint = null;
    this.hintBusy = false;
    this.reconcile({ type: 'rotate', cell });
    return true;
  }

  undo(): boolean {
    if (!this.active || !this.history.length) return false;
    const previous = this.history.pop()!;
    this.rotations[previous.cell] = previous.before;
    this.revision++;
    this.hint = null;
    this.hintBusy = false;
    this.reconcile({ type: 'undo', cell: previous.cell });
    return true;
  }

  restart(): void {
    const screen = this.screen;
    this.load(this.levelIndex);
    this.screen = screen;
    this.emit({ type: 'restart' });
  }

  private reconcile(change: Change): void {
    const previous = this.circuit.lit;
    this.circuit = evaluate(this.level, this.rotations);
    change.newlyLit = [...this.circuit.lit].filter((goal) => !previous.has(goal));
    if (this.circuit.solved && this.phase !== 'won') {
      this.phase = 'won';
      this.earned = score(this.moves, this.level.reference, this.usedHint);
      this.progress.stars[this.levelIndex] = Math.max(this.progress.stars[this.levelIndex], this.earned);
      const best = this.progress.bestMoves[this.levelIndex];
      this.progress.bestMoves[this.levelIndex] = best === null ? this.moves : Math.min(best, this.moves);
      this.progress.unlocked = Math.max(this.progress.unlocked, Math.min(40, this.levelIndex + 2));
      this.progress.lastLevel = Math.min(39, this.levelIndex + 1);
      this.store();
      this.emit(change);
      this.emit({ type: 'win', newlyLit: change.newlyLit });
    } else {
      this.store();
      this.emit(change);
    }
  }

  applyHint(hint: Hint | null, revision: number): boolean {
    if (!this.active || revision !== this.revision || !hint) return false;
    if (!isRotatable(this.level.tiles[hint.cell].kind) || this.circuit.lit.has(hint.bulb)
      || !evaluate(this.level, hint.solution).solved
      || tileMask(this.level.tiles[hint.cell], this.rotations[hint.cell]) === tileMask(this.level.tiles[hint.cell], hint.solution[hint.cell])) return false;
    this.hint = hint;
    this.hintBusy = false;
    this.usedHint = true;
    this.store();
    this.emit({ type: 'hint' });
    return true;
  }

  openLevels(): void {
    this.screen = 'levels';
    this.overlay = null;
    this.hintBusy = false;
    this.emit({ type: 'screen' });
  }

  returnToGame(): void {
    this.screen = 'game';
    this.overlay = this.phase === 'won' ? 'result' : null;
    this.emit({ type: 'screen' });
  }

  setOverlay(overlay: Overlay): void {
    this.overlay = overlay;
    this.emit({ type: 'screen' });
  }

  setMuted(muted: boolean): void {
    this.progress.muted = muted;
    this.store();
    this.emit({ type: 'settings' });
  }

  setReducedMotion(reduced: boolean): void {
    this.progress.reducedMotion = reduced;
    this.store();
    this.emit({ type: 'settings' });
  }

  setLanguage(language: Language): void {
    if (!isLanguage(language) || this.progress.language === language) return;
    this.progress.language = language;
    this.store();
    this.emit({ type: 'settings' });
  }

  setSkin(id: string): boolean {
    const skin = SKINS.find((skin) => skin.id === id);
    if (!skin || totalStars(this.progress) < skin.cost) return false;
    this.progress.skin = id;
    this.store();
    this.emit({ type: 'settings' });
    return true;
  }
}
