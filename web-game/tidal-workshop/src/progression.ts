import type { State, Machine } from './economy';
export type Focus = 'balanced' | 'salvage' | 'industry' | 'fleet' | 'active';
export type Legacy = 'engineering' | 'commerce' | 'supplies';
export interface Expedition { island: number; departed: number; until: number; scrap: number; parts: number; coins: number; blueprints: number }
export const FOCUSES = {
  balanced: { name: '均衡', icon: 'office', detail: '标准生产，无取舍' },
  salvage: { name: '深潜', icon: 'icon-salvage', detail: '打捞 ×1.6 · 加工速度 ×0.85' },
  industry: { name: '制造', icon: 'icon-press', detail: '加工速度 ×1.6 · 打捞 ×0.85' },
  fleet: { name: '贸易', icon: 'icon-boat', detail: '售价 ×1.4、船速 ×1.2 · 打捞 ×0.85' },
  active: { name: '先锋', icon: 'hoist', detail: '手动打捞 +3 · 手动加工速度 ×1.8' },
} as const;
export const REFIT_REQUIREMENTS = [4, 12, 32];
export const REFIT_PRICES: Record<Machine, number[]> = { salvage: [180, 1400, 9000], press: [260, 1800, 12000], boat: [420, 2600, 18000] };
export const REFIT_NAMES = ['增压', '联动', '潮核'];
export const LEGACIES = {
  engineering: { name: '机巧传承', icon: 'icon-auto', detail: '每级打捞、加工与船速 ×1.12' },
  commerce: { name: '群岛商盟', icon: 'icon-coins', detail: '每级交货与委托奖励 ×1.15' },
  supplies: { name: '拓荒补给', icon: 'parts-crate', detail: '每级手动打捞 +1；远航开局 +60 金币、16 废料' },
} as const;
export const legacyCost = (level: number) => 2 ** (level + 1);
export const ISLANDS = [
  { name: '漂木湾', icon: 'crates', region: 0, sales: 96, scrap: 24, parts: 2, seconds: 45, coins: 72, lootScrap: 48, lootParts: 0, prints: 1, first: 2, story: '旧航标重新立起，漂木湾送来了第一份工匠手稿。' },
  { name: '齿轮礁', icon: 'press', region: 0, sales: 400, scrap: 64, parts: 8, seconds: 65, coins: 200, lootScrap: 0, lootParts: 12, prints: 2, first: 3, story: '珊瑚里保存着旧工坊的模具，机械师愿意与你交换技术。' },
  { name: '风帆群岛', icon: 'barge', region: 1, sales: 2400, scrap: 160, parts: 24, seconds: 90, coins: 700, lootScrap: 160, lootParts: 12, prints: 3, first: 5, story: '沿着风向接通商路，群岛船队开始共享航海手稿。' },
  { name: '长明遗址', icon: 'lighthouse', region: 2, sales: 14000, scrap: 400, parts: 64, seconds: 120, coins: 2000, lootScrap: 320, lootParts: 32, prints: 4, first: 8, story: '失落的灯室再次亮起，潮核技术终于回到工坊。' },
] as const;
interface Milestone { id: string; name: string; icon: string; detail: string; current: (s: State) => number; target: number; coins?: number; scrap?: number; blueprints?: number }
export const MILESTONES: Milestone[] = [
  { id: 'hands', name: '从海面开始', icon: 'icon-scrap', detail: '收集 4 废料', current: s => s.scrap >= 4 || s.parts > 0 || s.runSales > 0 || s.salvage > 0 ? 4 : s.scrap, target: 4, scrap: 8 },
  { id: 'sale', name: '第一份收入', icon: 'icon-coins', detail: '完成首次交货', current: s => s.runSales, target: 16, coins: 24 },
  { id: 'crane', name: '吊臂自转', icon: 'icon-salvage', detail: '拥有 1 台打捞机', current: s => s.salvage, target: 1, coins: 40 },
  { id: 'press', name: '工坊开工', icon: 'icon-press', detail: '拥有 1 台加工机', current: s => s.presses.length, target: 1, coins: 60 },
  { id: 'captain', name: '解放双手', icon: 'icon-boat', detail: '雇佣船长', current: s => Number(s.captain), target: 1, coins: 80, blueprints: 2 },
  { id: 'fleet', name: '小小船队', icon: 'boat-loaded', detail: '拥有 4 艘货船', current: s => s.ships.length, target: 4, coins: 160 },
  { id: 'refit', name: '第一次飞跃', icon: 'icon-auto', detail: '完成任意设备改造', current: s => Object.values(s.refits).reduce((a, b) => a + b, 0), target: 1, coins: 200, blueprints: 1 },
  { id: 'explore', name: '海的另一边', icon: 'icon-route', detail: '发现 1 座岛屿', current: s => s.islands.length, target: 1, blueprints: 2 },
  { id: 'contracts', name: '可靠的工匠', icon: 'parts-crate', detail: '本轮完成 3 份委托', current: s => s.contractsCompleted, target: 3, coins: 360, blueprints: 2 },
  { id: 'region', name: '珊瑚间的航道', icon: 'beacon', detail: '开通珊瑚航道', current: s => Number(s.discovered.includes(1)), target: 1, coins: 600, blueprints: 2 },
  { id: 'industry', name: '港口轰鸣', icon: 'warehouse', detail: '拥有 12 台加工机', current: s => s.presses.length, target: 12, coins: 1000, blueprints: 3 },
  { id: 'light', name: '长明的约定', icon: 'icon-light', detail: '点亮灯塔港', current: s => Number(s.discovered.includes(2)), target: 1, coins: 1600, blueprints: 3 },
  { id: 'voyage', name: '带着经验归来', icon: 'icon-charts', detail: '完成首次远航', current: s => s.voyages, target: 1, coins: 120, blueprints: 4 },
  { id: 'archipelago', name: '群岛重连', icon: 'icon-route', detail: '发现全部 4 座岛屿', current: s => s.islands.length, target: 4, blueprints: 8 },
  { id: 'veteran', name: '不止一片海', icon: 'barge', detail: '完成 3 次远航', current: s => s.voyages, target: 3, blueprints: 6 },
];
export const milestoneReady = (s: State, id: string) => {
  const m = MILESTONES.find(m => m.id === id);
  return !!m && !s.milestones.includes(id) && m.current(s) >= m.target;
};
export const nextMilestone = (s: State) => MILESTONES.find(m => milestoneReady(s, m.id)) ?? MILESTONES.find(m => !s.milestones.includes(m.id));
export const focusUnlocked = (s: State) => s.salvage > 0 && s.presses.length > 0 && s.captain;
export const islandUnlocked = (s: State, index: number) => !!ISLANDS[index] && s.region >= ISLANDS[index].region && s.runSales >= ISLANDS[index].sales;
