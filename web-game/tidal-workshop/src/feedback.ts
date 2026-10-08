import type { Production } from './economy';

export type Resource = 'scrap' | 'parts' | 'coins' | 'charts';
export type GainSource = 'automatic' | 'manual' | 'contract';
export interface Gain { resource: Resource; amount: number; source: GainSource }
export const GAIN_INTERVAL = 780;
const RESOURCES: Resource[] = ['scrap', 'parts', 'coins', 'charts'];

// Batch actual production, not inventory deltas: machines can consume gains immediately.
export class GainQueue {
  private pending = new Map<Resource, Gain>();
  private lastShown = new Map<Resource, number>();
  add(resource: Resource, amount: number, source: GainSource = 'automatic') {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const previous = this.pending.get(resource);
    this.pending.set(resource, {
      resource, amount: (previous?.amount ?? 0) + amount,
      source: previous?.source === 'manual' ? 'manual' : source,
    });
  }
  production(result: Production, manual = false) {
    this.add('scrap', result.scrap);
    this.add('parts', result.parts, manual ? 'manual' : 'automatic');
    this.add('coins', result.coins);
  }
  drain(now: number): Gain[] {
    const gains: Gain[] = [];
    for (const resource of RESOURCES) {
      const gain = this.pending.get(resource);
      if (!gain) continue;
      const interval = gain.source === 'automatic' ? GAIN_INTERVAL : 240;
      if (now - (this.lastShown.get(resource) ?? -Infinity) < interval) continue;
      gains.push(gain); this.pending.delete(resource); this.lastShown.set(resource, now);
    }
    return gains;
  }
  clear() { this.pending.clear(); this.lastShown.clear(); }
  snapshot() { return [...this.pending.values()].map((gain) => ({ ...gain })); }
}

export function gainNumber(amount: number): string {
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}
