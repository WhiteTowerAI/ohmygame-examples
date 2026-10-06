import type { Level } from './game/rules';

export type Language = 'en' | 'zh';
export const LANGUAGES = ['en', 'zh'] as const;

const en = {
  gameTitle: 'Circuit Craftsman', settings: 'Settings', gameSettings: 'Game settings',
  stars: 'Total stars', workshop: 'Bulb Workshop', mute: 'Mute', unmute: 'Enable sound',
  level: 'Level', target: '3-Star', targetGoal: '3-Star Goal', moves: 'Moves', lit: 'Lit',
  undo: 'Undo', restart: 'Restart', hint: 'Hint', computing: 'Thinking', levels: 'Levels',
  levelActions: 'Level actions', loading: 'Loading', loadError: 'Artwork failed to load', retry: 'Retry',
  storageError: 'Progress cannot be saved in this browser', hintError: 'Hint unavailable. Try again.',
  backBoard: 'Back to board', close: 'Close', repairComplete: 'Repair Complete', townComplete: 'Town Restored!',
  levelNumber: 'Level {level}', thisMoves: 'Moves', best: 'Best', starUnit: 'stars',
  hintUsed: 'Hint used', tryAgain: 'Try Again', next: 'Next Level', backLevels: 'Back to Levels',
  sound: 'Game Sound', motion: 'Reduce Motion', on: 'On', off: 'Off', backGame: 'Back to Game',
  language: 'Language', initialSkin: 'Default', starPrice: '{count} stars',
  skinLocked: 'Requires {count} stars', selected: 'Selected', locked: 'Locked',
  levelLabel: 'Level {level}: {name}, {status}', boardLabel: 'Circuit board, {size} by {size}, {count} lights on',
};
export type TextKey = keyof typeof en;
const zh: Record<TextKey, string> = {
  gameTitle: '电路小工匠', settings: '设置', gameSettings: '游戏设置',
  stars: '累计星星', workshop: '灯泡工坊', mute: '静音', unmute: '开启声音',
  level: '关卡', target: '三星目标', targetGoal: '三星目标', moves: '步数', lit: '已点亮',
  undo: '撤销', restart: '重开', hint: '提示', computing: '计算中', levels: '选关',
  levelActions: '关卡操作', loading: '正在载入', loadError: '素材载入失败', retry: '重试',
  storageError: '当前浏览器无法保存进度', hintError: '提示暂不可用，请重试',
  backBoard: '返回棋盘', close: '关闭', repairComplete: '修复完成', townComplete: '小镇全亮了',
  levelNumber: '第 {level} 关', thisMoves: '本次步数', best: '历史最佳', starUnit: '星',
  hintUsed: '提示已使用', tryAgain: '再试一次', next: '下一关', backLevels: '返回选关',
  sound: '游戏声音', motion: '减少动画', on: '开启', off: '关闭', backGame: '返回游戏',
  language: '语言', initialSkin: '初始外观', starPrice: '{count} 星',
  skinLocked: '需要 {count} 星', selected: '已选用', locked: '未解锁',
  levelLabel: '第{level}关 {name}，{status}', boardLabel: '电路棋盘，{size}行{size}列，{count}盏已点亮',
};
export const TEXT: Record<Language, Record<TextKey, string>> = { en, zh };
export function text(language: Language, key: TextKey, values: Record<string, string | number> = {}): string {
  return TEXT[language][key].replace(/\{(\w+)\}/g, (match, name: string) => values[name] === undefined ? match : String(values[name]));
}
export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'zh';
}
export const REGION_NAMES: Record<Language, readonly string[]> = {
  en: ['Street', 'Campus', 'Station', 'Square'], zh: ['街角', '校园', '车站', '广场'],
};
export const ENGLISH_LEVEL_NAMES = [
  'First Light', 'Corner Lights', 'Alley Echoes', 'Around the Bend', 'Street-end Light',
  'Winding Path', 'Distant Glow', 'Backstreet Route', 'Home by Lamplight', 'Street Restored',
  'Classroom Ends', 'Hallway Fork', 'Playground Lights', 'Window Reading', 'Corner Classroom',
  'After School', 'Three Little Lamps', 'Campus Night', 'Crossing Paths', 'Campus Restored',
  'Next Stop: Light', 'Platform Detour', 'Signals Aligned', 'Waiting Lights', 'Service Passage',
  'Train Approaching', 'Loop Line', 'Homebound Branch', 'Four-way Crossing', 'Station Restored',
  'Morning Square', 'Fountain Sides', 'Garden Depths', 'Four Streetlights', 'Lantern Street',
  'City of Stars', 'Light Loop', 'Sea of Lights', 'Last Dark Corner', 'Every Home Alight',
] as const;
export function levelName(language: Language, level: Pick<Level, 'id' | 'name'>): string {
  return language === 'en' ? ENGLISH_LEVEL_NAMES[level.id - 1] ?? level.name : level.name;
}
export const SKIN_NAMES: Record<Language, Record<string, string>> = {
  en: { sunlight: 'Sunshine', mint: 'Mint', ocean: 'Ocean', rose: 'Rose' },
  zh: { sunlight: '暖阳', mint: '薄荷', ocean: '海蓝', rose: '玫瑰' },
};
