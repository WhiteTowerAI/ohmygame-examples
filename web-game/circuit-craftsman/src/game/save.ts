import { isLanguage } from '../i18n';
import type { Language } from '../i18n';

export const SAVE_KEY = 'circuit-craftsman-save-v1';
export const SKINS = [
  { id: 'sunlight', name: '暖阳', cost: 0, color: '#ffd968', hue: 0 },
  { id: 'mint', name: '薄荷', cost: 12, color: '#8be3b7', hue: 110 },
  { id: 'ocean', name: '海蓝', cost: 36, color: '#7ddcf4', hue: 160 },
  { id: 'rose', name: '玫瑰', cost: 72, color: '#f5a3be', hue: 300 },
] as const;

export interface Resume {
  level: number;
  rotations: number[];
  moves: number;
  usedHint: boolean;
  history: { cell: number; before: number }[];
}

export interface Progress {
  version: 1;
  unlocked: number;
  stars: number[];
  bestMoves: (number | null)[];
  lastLevel: number;
  skin: string;
  muted: boolean;
  reducedMotion: boolean;
  language: Language;
  resume: Resume | null;
}

export function totalStars(progress: Progress): number {
  return progress.stars.reduce((sum, stars) => sum + stars, 0);
}

export function defaultProgress(): Progress {
  return {
    version: 1, unlocked: 1, stars: new Array(40).fill(0), bestMoves: new Array(40).fill(null),
    lastLevel: 0, skin: 'sunlight', muted: false, reducedMotion: false, language: 'en', resume: null,
  };
}

const integer = (value: unknown, low: number, high: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= low && value <= high;

export function parseProgress(raw: string | null): Progress {
  const base = defaultProgress();
  if (!raw) return base;
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || typeof data !== 'object') return base;
    if (integer(data.unlocked, 1, 40)) base.unlocked = data.unlocked;
    if (Array.isArray(data.stars)) base.stars = base.stars.map((_star, index) => integer(data.stars[index], 0, 3) ? data.stars[index] : 0);
    if (Array.isArray(data.bestMoves)) base.bestMoves = base.bestMoves.map((_moves, index) => integer(data.bestMoves[index], 0, 1_000_000) ? data.bestMoves[index] : null);
    if (integer(data.lastLevel, 0, base.unlocked - 1)) base.lastLevel = data.lastLevel;
    base.muted = data.muted === true;
    base.reducedMotion = data.reducedMotion === true;
    if (isLanguage(data.language)) base.language = data.language;
    const skin = SKINS.find((skin) => skin.id === data.skin && totalStars(base) >= skin.cost);
    if (skin) base.skin = skin.id;
    const resume = data.resume;
    if (resume && integer(resume.level, 0, base.unlocked - 1) && integer(resume.moves, 0, 1_000_000)
      && Array.isArray(resume.rotations) && resume.rotations.length === (4 + Math.floor(resume.level / 10)) ** 2
      && resume.rotations.every((rotation: unknown) => integer(rotation, 0, 3))) {
      base.resume = {
        level: resume.level, rotations: resume.rotations, moves: resume.moves, usedHint: resume.usedHint === true,
        history: Array.isArray(resume.history) ? resume.history.slice(-1000).filter((entry: any) =>
          entry && integer(entry.cell, 0, resume.rotations.length - 1) && integer(entry.before, 0, 3)) : [],
      };
    }
    return base;
  } catch {
    return base;
  }
}

export function loadProgress(): Progress {
  try { return parseProgress(localStorage.getItem(SAVE_KEY)); }
  catch { return defaultProgress(); }
}

export function saveProgress(progress: Progress): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    return true;
  } catch { return false; }
}
