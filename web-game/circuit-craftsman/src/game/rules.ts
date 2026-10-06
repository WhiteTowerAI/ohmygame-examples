export type TileKind = 'power' | 'straight' | 'elbow' | 'tee' | 'cross' | 'bulb' | 'obstacle' | 'empty';
export type Coordinate = readonly [number, number];

export interface Tile {
  kind: TileKind;
  initial: number;
  solution: number;
  required: boolean;
}

export interface Level {
  id: number;
  name: string;
  region: number;
  size: number;
  tiles: Tile[];
  source: number;
  goals: number[];
  reference: number;
}

export const DIRECTIONS = [
  { bit: 1, opposite: 4, dx: 0, dy: -1 },
  { bit: 2, opposite: 8, dx: 1, dy: 0 },
  { bit: 4, opposite: 1, dx: 0, dy: 1 },
  { bit: 8, opposite: 2, dx: -1, dy: 0 },
] as const;

export const BASE_MASK: Record<TileKind, number> = {
  power: 2, straight: 10, elbow: 6, tee: 14, cross: 15, bulb: 4, obstacle: 0, empty: 0,
};

export function isRotatable(kind: TileKind): boolean {
  return kind === 'straight' || kind === 'elbow' || kind === 'tee';
}

export function rotateMask(mask: number, turns: number): number {
  for (let i = 0; i < ((turns % 4 + 4) % 4); i++) mask = ((mask << 1) & 15) | (mask >> 3);
  return mask;
}

export function tileMask(tile: Tile, rotation: number): number {
  return rotateMask(BASE_MASK[tile.kind], isRotatable(tile.kind) ? rotation : tile.initial);
}

export function rotationForMask(kind: TileKind, mask: number): number {
  for (let rotation = 0; rotation < 4; rotation++) {
    if (rotateMask(BASE_MASK[kind], rotation) === mask) return rotation;
  }
  throw new Error(`Unsupported ${kind} interface mask ${mask}`);
}

export function turnsToMask(kind: TileKind, current: number, mask: number): number {
  for (let steps = 0; steps < 4; steps++) {
    if (rotateMask(BASE_MASK[kind], current + steps) === mask) return steps;
  }
  return 0;
}

export function neighbor(index: number, direction: number, size: number): number | null {
  const d = DIRECTIONS[direction];
  const x = index % size + d.dx;
  const y = Math.floor(index / size) + d.dy;
  return x < 0 || y < 0 || x >= size || y >= size ? null : y * size + x;
}

export interface Circuit {
  powered: Set<number>;
  lit: Set<number>;
  solved: boolean;
  masks: number[];
  edges: [number, number][];
}

export function evaluate(level: Level, rotations: readonly number[]): Circuit {
  const masks = level.tiles.map((tile, index) => tileMask(tile, rotations[index] ?? tile.initial));
  const powered = new Set<number>([level.source]);
  const queue = [level.source];
  const edges: [number, number][] = [];
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    DIRECTIONS.forEach((d, direction) => {
      if (!(masks[index] & d.bit)) return;
      const next = neighbor(index, direction, level.size);
      if (next === null || !(masks[next] & d.opposite)) return;
      if (next > index) edges.push([index, next]);
      if (!powered.has(next)) {
        powered.add(next);
        queue.push(next);
      }
    });
  }
  const lit = new Set(level.goals.filter((index) => powered.has(index)));
  return { powered, lit, masks, edges, solved: lit.size === level.goals.length };
}

export function referenceRotations(level: Level): number[] {
  return level.tiles.map((tile) => tile.required ? tile.solution : tile.initial);
}

export function score(moves: number, reference: number, usedHint: boolean): number {
  const earned = moves <= reference ? 3 : moves <= Math.ceil(1.5 * reference) ? 2 : 1;
  return usedHint ? Math.min(2, earned) : earned;
}
