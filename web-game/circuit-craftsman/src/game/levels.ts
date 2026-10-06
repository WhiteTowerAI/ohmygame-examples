import { BASE_MASK, DIRECTIONS, evaluate, isRotatable, referenceRotations, rotationForMask, rotateMask, turnsToMask } from './rules';
import type { Coordinate, Level, Tile, TileKind } from './rules';

export const REGIONS = [
  { name: '街角', subtitle: '灯火归来', key: 'street', size: 4, accent: '#efbd43' },
  { name: '校园', subtitle: '明亮课堂', key: 'campus', size: 5, accent: '#78afe3' },
  { name: '车站', subtitle: '归途微光', key: 'station', size: 6, accent: '#75b5cf' },
  { name: '广场', subtitle: '万家灯火', key: 'square', size: 7, accent: '#e69285' },
] as const;

type Layout = { name: string; routes: Coordinate[][]; obstacles?: Coordinate[] };

// Fixed authored routes: consecutive waypoints expand to orthogonal grid edges.
const layouts: Layout[] = [
  { name: '第一束光', routes: [[[0,1],[2,1],[2,0]]] },
  { name: '转角灯火', routes: [[[0,2],[3,2],[3,0]]] },
  { name: '小巷回声', routes: [[[0,3],[2,3],[2,1],[1,1],[1,0]]] },
  { name: '绕个弯吧', routes: [[[0,1],[1,1],[1,3],[3,3],[3,0]]] },
  { name: '街尾的灯', routes: [[[0,3],[3,3],[3,1],[1,1],[1,0]]] },
  { name: '曲折小路', routes: [[[0,2],[1,2],[1,3],[3,3],[3,1],[2,1],[2,0]]] },
  { name: '远处微光', routes: [[[0,1],[2,1],[2,3],[3,3],[3,0]]] },
  { name: '穿过后街', routes: [[[0,2],[1,2],[1,3],[2,3],[2,1],[3,1],[3,0]]] },
  { name: '灯下归人', routes: [[[0,3],[3,3],[3,2],[1,2],[1,1],[2,1],[2,0]]] },
  { name: '街角焕新', routes: [[[0,1],[1,1],[1,2],[2,2],[2,3],[3,3],[3,0]]] },
  { name: '教室两端', routes: [[[0,2],[4,2],[4,0]],[[2,2],[2,0]]] },
  { name: '走廊分岔', routes: [[[0,3],[3,3],[3,0]],[[1,3],[1,1]]] },
  { name: '操场灯光', routes: [[[0,4],[4,4],[4,1]],[[2,4],[2,1]]] },
  { name: '窗边书声', routes: [[[0,2],[1,2],[1,4],[4,4],[4,0]],[[3,4],[3,2]]] },
  { name: '拐角课堂', routes: [[[0,3],[2,3],[2,1],[4,1],[4,0]],[[2,3],[3,3],[3,2]]] },
  { name: '放学以后', routes: [[[0,4],[1,4],[1,1],[3,1],[3,0]],[[1,3],[4,3],[4,2]]] },
  { name: '三盏小灯', routes: [[[0,2],[4,2],[4,0]],[[1,2],[1,0]],[[3,2],[3,1]]] },
  { name: '校园夜读', routes: [[[0,4],[4,4],[4,0]],[[1,4],[1,1]],[[3,4],[3,2]]] },
  { name: '交汇时刻', routes: [[[0,3],[2,3],[2,0]],[[2,2],[4,2],[4,1]],[[2,3],[3,3],[3,1]]] },
  { name: '校园焕新', routes: [[[0,2],[4,2],[4,0]],[[2,2],[2,0]],[[2,2],[2,4],[3,4],[3,3]]] },
  { name: '下一站光', routes: [[[0,3],[5,3],[5,0]],[[2,3],[2,1]]], obstacles: [[1,1],[3,2],[4,4]] },
  { name: '月台绕行', routes: [[[0,4],[1,4],[1,2],[4,2],[4,0]],[[1,4],[5,4],[5,1]]], obstacles: [[2,1],[2,3],[3,5]] },
  { name: '信号归位', routes: [[[0,2],[2,2],[2,5],[5,5],[5,1]],[[2,3],[4,3],[4,2]]], obstacles: [[1,1],[3,1],[4,4]] },
  { name: '候车灯火', routes: [[[0,5],[5,5],[5,0]],[[2,5],[2,1]],[[4,5],[4,3]]], obstacles: [[1,2],[3,3]] },
  { name: '检修通道', routes: [[[0,3],[1,3],[1,5],[4,5],[4,1],[5,1],[5,0]],[[4,4],[2,4],[2,2]]], obstacles: [[2,1],[3,3]] },
  { name: '列车将至', routes: [[[0,4],[3,4],[3,1],[5,1],[5,0]],[[3,3],[1,3],[1,1]],[[3,4],[5,4],[5,2]]], obstacles: [[2,2],[4,5]] },
  { name: '环线相遇', routes: [[[0,2],[1,2],[1,5],[5,5],[5,0]],[[3,5],[3,2]],[[1,4],[4,4],[4,1]]], obstacles: [[2,1],[2,3]] },
  { name: '归途支线', routes: [[[0,5],[2,5],[2,1],[4,1],[4,0]],[[2,3],[5,3],[5,1]],[[2,4],[4,4],[4,2]]], obstacles: [[1,2],[3,0]] },
  { name: '四向交汇', routes: [[[0,3],[5,3],[5,0]],[[1,3],[1,1]],[[3,3],[3,5],[4,5],[4,4]],[[3,3],[3,1]]], obstacles: [[2,2],[4,1],[1,5]] },
  { name: '车站焕新', routes: [[[0,4],[5,4],[5,0]],[[1,4],[1,2],[3,2],[3,0]],[[3,4],[3,3]]], obstacles: [[2,1],[2,3],[4,5]] },
  { name: '广场晨光', routes: [[[0,4],[6,4],[6,0]],[[2,4],[2,1]],[[4,4],[4,2]]], obstacles: [[1,1],[3,3],[5,5]] },
  { name: '喷泉两侧', routes: [[[0,5],[1,5],[1,2],[5,2],[5,0]],[[1,4],[6,4],[6,1]],[[3,4],[3,3]]], obstacles: [[2,1],[2,3],[4,5]] },
  { name: '花园深处', routes: [[[0,3],[2,3],[2,6],[6,6],[6,0]],[[2,5],[4,5],[4,1]],[[4,3],[5,3],[5,2]]], obstacles: [[1,1],[3,2],[5,4]] },
  { name: '四盏路灯', routes: [[[0,6],[6,6],[6,0]],[[1,6],[1,1]],[[3,6],[3,2]],[[5,6],[5,4]]], obstacles: [[2,2],[4,3]] },
  { name: '花灯长街', routes: [[[0,4],[1,4],[1,6],[5,6],[5,1],[6,1],[6,0]],[[5,4],[3,4],[3,1]],[[3,4],[2,4],[2,2]]], obstacles: [[2,1],[4,3],[6,5]] },
  { name: '一城星光', routes: [[[0,5],[3,5],[3,1],[6,1],[6,0]],[[3,3],[1,3],[1,0]],[[3,5],[6,5],[6,2]],[[3,4],[5,4],[5,3]]], obstacles: [[2,2],[4,2],[5,6]] },
  { name: '光的回路', routes: [[[0,2],[1,2],[1,6],[6,6],[6,0]],[[3,6],[3,1]],[[1,4],[5,4],[5,2]],[[3,4],[4,4],[4,3]]], obstacles: [[2,1],[2,3],[4,5]] },
  { name: '纵横灯海', routes: [[[0,6],[2,6],[2,1],[5,1],[5,0]],[[2,3],[6,3],[6,1]],[[2,5],[5,5],[5,2]],[[5,4],[3,4],[3,2]]], obstacles: [[1,2],[4,0],[4,6]] },
  { name: '最后的暗角', routes: [[[0,4],[6,4],[6,0]],[[1,4],[1,1]],[[3,4],[3,6],[5,6],[5,5]],[[3,4],[3,1]],[[3,2],[5,2],[5,1]]], obstacles: [[2,2],[4,3],[1,6]] },
  { name: '万家灯火', routes: [[[0,5],[6,5],[6,0]],[[1,5],[1,2],[4,2],[4,0]],[[3,5],[3,3]],[[4,2],[5,2],[5,1]],[[4,2],[4,4],[5,4],[5,3]]], obstacles: [[2,1],[2,4],[4,6]] },
];

function hash(value: number): number {
  let h = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function createLevel(layout: Layout, ordinal: number): Level {
  const region = Math.floor(ordinal / 10);
  const size = REGIONS[region].size;
  const interfaces = new Array<number>(size * size).fill(0);
  const indexOf = ([x, y]: Coordinate) => {
    if (x < 0 || y < 0 || x >= size || y >= size) throw new Error(`Out-of-bounds level ${ordinal + 1}`);
    return y * size + x;
  };
  for (const route of layout.routes) {
    for (let step = 1; step < route.length; step++) {
      let [x, y] = route[step - 1];
      const [endX, endY] = route[step];
      if (x !== endX && y !== endY) throw new Error('Diagonal authored route');
      const dx = Math.sign(endX - x);
      const dy = Math.sign(endY - y);
      const direction = DIRECTIONS.find((d) => d.dx === dx && d.dy === dy)!;
      while (x !== endX || y !== endY) {
        const current = indexOf([x, y]);
        x += dx;
        y += dy;
        const next = indexOf([x, y]);
        interfaces[current] |= direction.bit;
        interfaces[next] |= direction.opposite;
      }
    }
  }
  const source = indexOf(layout.routes[0][0]);
  const obstacleSet = new Set((layout.obstacles ?? []).map(indexOf));
  for (const index of obstacleSet) if (interfaces[index]) throw new Error(`Obstacle overlaps a route in level ${ordinal + 1}: ${index}`);
  const goals: number[] = [];
  const tiles: Tile[] = interfaces.map((mask, index) => {
    const degree = [1,2,4,8].filter((bit) => mask & bit).length;
    let kind: TileKind;
    if (index === source) {
      if (degree !== 1) throw new Error(`Source has multiple ports in level ${ordinal + 1}`);
      kind = 'power';
    } else if (degree === 1) {
      kind = 'bulb';
      goals.push(index);
    } else if (degree === 2) kind = mask === 5 || mask === 10 ? 'straight' : 'elbow';
    else if (degree === 3) kind = 'tee';
    else if (degree === 4) kind = 'cross';
    else if (obstacleSet.has(index)) kind = 'obstacle';
    else {
      const choice = hash((ordinal + 1) * 73 + index) % 10;
      kind = ordinal < 3 ? 'empty' : choice < 5 ? 'empty' : choice < 7 ? 'straight' : 'elbow';
    }
    const required = mask !== 0;
    const solution = required ? rotationForMask(kind, mask) : hash(index * 47 + ordinal) % 4;
    let initial = solution;
    if (isRotatable(kind)) {
      if (required) {
        const offset = ordinal < 3 ? 1 : hash(ordinal * 83 + index * 41) % 4;
        initial = (solution - offset + 4) % 4;
      } else initial = hash(index * 31 + ordinal * 11) % 4;
    }
    return { kind, required, initial, solution };
  });
  const level: Level = { id: ordinal + 1, name: layout.name, region, size, tiles, source, goals, reference: 0 };
  if (!evaluate(level, referenceRotations(level)).solved) throw new Error(`Invalid solution in level ${level.id}`);
  if (evaluate(level, tiles.map((tile) => tile.initial)).solved) {
    const direction = DIRECTIONS.findIndex((d) => interfaces[source] & d.bit);
    const first = source + DIRECTIONS[direction].dy * size + DIRECTIONS[direction].dx;
    const tile = tiles[first];
    if (!isRotatable(tile.kind)) throw new Error('Cannot scramble source neighbor');
    tile.initial = [0,1,2,3].find((rotation) => !(rotateMask(BASE_MASK[tile.kind], rotation) & DIRECTIONS[direction].opposite))!;
  }
  level.reference = tiles.reduce((sum, tile) => sum + (tile.required && isRotatable(tile.kind)
    ? turnsToMask(tile.kind, tile.initial, rotateMask(BASE_MASK[tile.kind], tile.solution)) : 0), 0);
  return level;
}

export const LEVELS = layouts.map(createLevel);
