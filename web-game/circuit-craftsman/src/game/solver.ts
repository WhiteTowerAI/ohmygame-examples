import Logic from 'logic-solver';
import { BASE_MASK, DIRECTIONS, evaluate, isRotatable, neighbor, rotateMask, tileMask, turnsToMask } from './rules';
import type { Level } from './rules';

export interface Hint {
  cell: number;
  bulb: number;
  turns: number;
  solution: number[];
}

export function solveCircuit(level: Level, current: number[], preserve = true): number[] {
  const circuit = evaluate(level, current);
  if (circuit.solved) return [...current];
  const solver = new Logic.Solver();
  const options = level.tiles.map((tile, index) => {
    if (!isRotatable(tile.kind)) return [{ mask: tileMask(tile, tile.initial), symbol: Logic.TRUE, rotation: tile.initial }];
    const masks = [...new Set([0,1,2,3].map((rotation) => rotateMask(BASE_MASK[tile.kind], rotation)))];
    const choices = masks.map((mask, choice) => ({ mask, symbol: `tile_${index}_${choice}`, rotation: 0 }));
    solver.require(Logic.exactlyOne(choices.map((choice) => choice.symbol)));
    return choices;
  });
  const supports = (index: number, bit: number) => Logic.or(options[index].filter((choice) => choice.mask & bit).map((choice) => choice.symbol));
  const adjacency: { next: number; edge: string }[][] = level.tiles.map(() => []);
  level.tiles.forEach((_tile, index) => {
    [1,2].forEach((direction) => {
      const next = neighbor(index, direction, level.size);
      if (next === null) return;
      const d = DIRECTIONS[direction];
      if (!options[index].some((choice) => choice.mask & d.bit) || !options[next].some((choice) => choice.mask & d.opposite)) return;
      const edge = `edge_${index}_${next}`;
      solver.require(Logic.equiv(edge, Logic.and(supports(index, d.bit), supports(next, d.opposite))));
      adjacency[index].push({ next, edge });
      adjacency[next].push({ next: index, edge });
    });
  });
  const active = level.tiles.map((_tile, index) => index).filter((index) => options[index].some((choice) => choice.mask !== 0));
  let previous: string[] = level.tiles.map((_tile, index) => index === level.source ? Logic.TRUE : Logic.FALSE);
  // Bounded reachability cannot admit a disconnected cycle as a powered component.
  for (let depth = 1; depth < active.length; depth++) {
    const nextLayer = [...previous];
    for (const index of active) {
      if (index === level.source) continue;
      const reached = `reach_${depth}_${index}`;
      solver.require(Logic.equiv(reached, Logic.or(previous[index], adjacency[index].map(({ next, edge }) => Logic.and(edge, previous[next])))));
      nextLayer[index] = reached;
    }
    previous = nextLayer;
  }
  for (const goal of level.goals) solver.require(previous[goal]);
  let solution = solver.solve();
  if (!solution) throw new Error(`No feasible solution for level ${level.id}`);
  if (preserve) {
    const candidates = active.filter((index) => isRotatable(level.tiles[index].kind))
      .sort((a, b) => Number(circuit.powered.has(b)) - Number(circuit.powered.has(a)) || a - b);
    for (const index of candidates) {
      const preferred = options[index].find((choice) => choice.mask === circuit.masks[index])!.symbol;
      if (solution.evaluate(preferred)) solver.require(preferred);
      else {
        const candidate = solver.solveAssuming(preferred);
        if (candidate) {
          solver.require(preferred);
          solution = candidate;
        }
      }
    }
  }
  const rotations = level.tiles.map((tile, index) => {
    if (!isRotatable(tile.kind)) return tile.initial;
    const mask = options[index].find((choice) => solution.evaluate(choice.symbol))!.mask;
    return (current[index] + turnsToMask(tile.kind, current[index], mask)) % 4;
  });
  if (!evaluate(level, rotations).solved) throw new Error('Solver returned a disconnected answer');
  return rotations;
}

export function findHint(level: Level, current: number[]): Hint | null {
  const existing = evaluate(level, current);
  if (existing.solved) return null;
  const solution = solveCircuit(level, current);
  const completed = evaluate(level, solution);
  const parents = new Map<number, number>([[level.source, -1]]);
  const queue = [level.source];
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    DIRECTIONS.forEach((d, direction) => {
      const next = neighbor(index, direction, level.size);
      if (next === null || parents.has(next) || !(completed.masks[index] & d.bit) || !(completed.masks[next] & d.opposite)) return;
      parents.set(next, index);
      queue.push(next);
    });
  }
  for (const bulb of level.goals.filter((goal) => !existing.lit.has(goal))) {
    const path: number[] = [];
    let at = bulb;
    while (at !== -1) {
      path.unshift(at);
      at = parents.get(at) ?? -1;
    }
    const cell = path.find((index) => isRotatable(level.tiles[index].kind) && existing.masks[index] !== completed.masks[index]);
    if (cell !== undefined) return {
      cell, bulb, solution,
      turns: turnsToMask(level.tiles[cell].kind, current[cell], completed.masks[cell]),
    };
  }
  return null;
}
