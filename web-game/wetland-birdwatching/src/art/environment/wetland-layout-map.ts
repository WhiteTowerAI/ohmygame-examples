export type WetlandLayoutSemantic = 'grass' | 'water' | 'path' | 'highland' | 'forest' | 'shrubland';

export const wetlandLayoutPalette: Readonly<Record<WetlandLayoutSemantic, string>> = {
  grass: '#6e9d47',
  water: '#3c92c8',
  path: '#d5ab69',
  highland: '#d6c44a',
  forest: '#315f38',
  shrubland: '#7b6a8e',
};

export const wetlandLayoutWorld = {
  width: 120,
  depth: 84,
  columns: 480,
  rows: 336,
} as const;

export type WetlandLayoutWorldSize = Readonly<{
  width: number;
  depth: number;
}>;

export type WetlandEllipticExpansionOptions = Readonly<{
  worldWidth: number;
  worldDepth: number;
  columns?: number;
  rows?: number;
  outsideSemantic?: WetlandLayoutSemantic;
}>;

export type WetlandLayoutDomainShape = 'rectangle' | 'ellipse';

const semanticIds: Readonly<Record<WetlandLayoutSemantic, number>> = {
  grass: 0,
  water: 1,
  path: 2,
  highland: 3,
  forest: 4,
  shrubland: 5,
};

const semantics: readonly WetlandLayoutSemantic[] = [
  'grass',
  'water',
  'path',
  'highland',
  'forest',
  'shrubland',
];
const diagonal = Math.SQRT2;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / Math.max(edge1 - edge0, 0.00001), 0, 1);
  return t * t * (3 - 2 * t);
};

const hash2 = (x: number, y: number, seed: number) => {
  let value = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(y | 0, 0x5f356495) ^ seed;
  value = Math.imul(value ^ (value >>> 15), 0x2c1b3c6d);
  value = Math.imul(value ^ (value >>> 12), 0x297a2d39);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967295;
};

const distanceToSegment = (
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
) => {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared = dx * dx + dz * dz;
  const t = clamp(((x - ax) * dx + (z - az) * dz) / Math.max(lengthSquared, 0.00001), 0, 1);
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
};

const distanceToPolyline = (x: number, z: number, points: readonly [number, number][]) => {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length - 1; index += 1) {
    distance = Math.min(distance, distanceToSegment(
      x,
      z,
      points[index][0],
      points[index][1],
      points[index + 1][0],
      points[index + 1][1],
    ));
  }
  return distance;
};

const parseHex = (hex: string) => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
] as const;

const paletteRgb = semantics.map((semantic) => ({
  semantic,
  rgb: parseHex(wetlandLayoutPalette[semantic]),
}));

const nearestSemantic = (r: number, g: number, b: number): WetlandLayoutSemantic => {
  let nearest = paletteRgb[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of paletteRgb) {
    const dr = r - candidate.rgb[0];
    const dg = g - candidate.rgb[1];
    const db = b - candidate.rgb[2];
    const distance = dr * dr + dg * dg + db * db;
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest.semantic;
};

const createDistanceToSemantic = (
  data: Uint8Array,
  columns: number,
  rows: number,
  semanticId: number,
  invert: boolean,
) => {
  const distances = new Float32Array(data.length);
  distances.fill(Number.POSITIVE_INFINITY);
  const matches = (index: number) => (data[index] === semanticId) !== invert;
  for (let index = 0; index < data.length; index += 1) {
    if (matches(index)) distances[index] = 0;
  }

  const relax = (index: number, candidate: number) => {
    if (candidate < distances[index]) distances[index] = candidate;
  };
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      if (column > 0) relax(index, distances[index - 1] + 1);
      if (row > 0) relax(index, distances[index - columns] + 1);
      if (column > 0 && row > 0) relax(index, distances[index - columns - 1] + diagonal);
      if (column + 1 < columns && row > 0) relax(index, distances[index - columns + 1] + diagonal);
    }
  }
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      const index = row * columns + column;
      if (column + 1 < columns) relax(index, distances[index + 1] + 1);
      if (row + 1 < rows) relax(index, distances[index + columns] + 1);
      if (column + 1 < columns && row + 1 < rows) {
        relax(index, distances[index + columns + 1] + diagonal);
      }
      if (column > 0 && row + 1 < rows) {
        relax(index, distances[index + columns - 1] + diagonal);
      }
    }
  }
  return distances;
};

const createSignedDistanceField = (
  data: Uint8Array,
  columns: number,
  rows: number,
  semanticId: number,
  metersPerCell: number,
  treatMapEdgeAsBoundary = true,
) => {
  const distanceToInside = createDistanceToSemantic(data, columns, rows, semanticId, false);
  const distanceToOutside = createDistanceToSemantic(data, columns, rows, semanticId, true);
  const signed = new Float32Array(data.length);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      if (data[index] === semanticId) {
        const distanceToMapEdge = treatMapEdgeAsBoundary
          ? Math.min(column + 1, columns - column, row + 1, rows - row)
          : Number.POSITIVE_INFINITY;
        const distanceToSemanticEdge = Number.isFinite(distanceToOutside[index])
          ? distanceToOutside[index]
          : Math.hypot(columns, rows);
        const insideDistance = Math.min(distanceToSemanticEdge, distanceToMapEdge);
        signed[index] = -insideDistance * metersPerCell;
      } else {
        const outsideDistance = Number.isFinite(distanceToInside[index])
          ? distanceToInside[index]
          : Math.hypot(columns, rows);
        signed[index] = outsideDistance * metersPerCell;
      }
    }
  }
  return signed;
};

const smoothDistanceField = (
  input: Float32Array,
  columns: number,
  rows: number,
  radius = 4,
  passes = 2,
) => {
  let source = input.slice();
  for (let pass = 0; pass < passes; pass += 1) {
    const horizontal = new Float32Array(source.length);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        let total = 0;
        let count = 0;
        for (let offset = -radius; offset <= radius; offset += 1) {
          const sampleColumn = clamp(column + offset, 0, columns - 1);
          total += source[row * columns + sampleColumn];
          count += 1;
        }
        horizontal[row * columns + column] = total / count;
      }
    }
    const vertical = new Float32Array(source.length);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        let total = 0;
        let count = 0;
        for (let offset = -radius; offset <= radius; offset += 1) {
          const sampleRow = clamp(row + offset, 0, rows - 1);
          total += horizontal[sampleRow * columns + column];
          count += 1;
        }
        vertical[row * columns + column] = total / count;
      }
    }
    source = vertical;
  }
  return source;
};

export type WetlandLayoutSample = Readonly<{
  waterDistance: number;
  pathDistance: number;
  highlandDistance: number;
  forestDistance: number;
  shrublandDistance: number;
}>;

export class WetlandLayoutMap {
  readonly columns: number;
  readonly rows: number;
  readonly worldWidth: number;
  readonly worldDepth: number;
  readonly domainShape: WetlandLayoutDomainShape;
  readonly detailWorldWidth: number;
  readonly detailWorldDepth: number;
  readonly data: Uint8Array;

  private dirty = true;
  private waterDistance = new Float32Array();
  private pathDistance = new Float32Array();
  private highlandDistance = new Float32Array();
  private forestDistance = new Float32Array();
  private shrublandDistance = new Float32Array();

  constructor(
    columns: number = wetlandLayoutWorld.columns,
    rows: number = wetlandLayoutWorld.rows,
    worldWidth: number = wetlandLayoutWorld.width,
    worldDepth: number = wetlandLayoutWorld.depth,
    domainShape: WetlandLayoutDomainShape = 'rectangle',
    detailWorldWidth: number = worldWidth,
    detailWorldDepth: number = worldDepth,
  ) {
    this.columns = columns;
    this.rows = rows;
    this.worldWidth = worldWidth;
    this.worldDepth = worldDepth;
    this.domainShape = domainShape;
    this.detailWorldWidth = Math.min(Math.max(detailWorldWidth, 0), worldWidth);
    this.detailWorldDepth = Math.min(Math.max(detailWorldDepth, 0), worldDepth);
    this.data = new Uint8Array(columns * rows);
  }

  containsWorldPoint(x: number, z: number, inset = 0) {
    const radiusX = Math.max(0.0001, this.worldWidth * 0.5 - inset);
    const radiusZ = Math.max(0.0001, this.worldDepth * 0.5 - inset);
    if (this.domainShape === 'ellipse') {
      return x * x / (radiusX * radiusX) + z * z / (radiusZ * radiusZ) <= 1;
    }
    return Math.abs(x) <= radiusX && Math.abs(z) <= radiusZ;
  }

  containsDetailPoint(x: number, z: number, inset = 0) {
    const halfWidth = Math.max(0, this.detailWorldWidth * 0.5 - inset);
    const halfDepth = Math.max(0, this.detailWorldDepth * 0.5 - inset);
    return Math.abs(x) <= halfWidth && Math.abs(z) <= halfDepth;
  }

  regenerate(seed: number) {
    const referenceScaleX = wetlandLayoutWorld.width / 76;
    const referenceScaleZ = wetlandLayoutWorld.depth / 54;
    const worldScaleX = this.worldWidth / wetlandLayoutWorld.width;
    const worldScaleZ = this.worldDepth / wetlandLayoutWorld.depth;
    const lakeOffset = (hash2(2, 7, seed) - 0.5) * 2.2;
    const highlandOffset = (hash2(5, 13, seed) - 0.5) * 2.4;
    const pathPoints: readonly [number, number][] = [
      [-60.5, 34.5],
      [-43.4, 35.9],
      [-24, 37.3],
      [-3.8, 37.8],
      [18.6, 36.6],
      [39.8, 32.2],
      [60.5, 28.9],
    ];
    for (let row = 0; row < this.rows; row += 1) {
      const z = this.worldDepth * (row / (this.rows - 1) - 0.5) / worldScaleZ;
      for (let column = 0; column < this.columns; column += 1) {
        const x = this.worldWidth * (column / (this.columns - 1) - 0.5) / worldScaleX;
        const noise = hash2(column, row, seed + 1709) - 0.5;
        const lakeX = x - (24.2 + lakeOffset) * referenceScaleX;
        const lakeZ = z + 5.4 * referenceScaleZ;
        const lake = Math.hypot(
          lakeX / (8.5 * referenceScaleX),
          lakeZ / (5.9 * referenceScaleZ),
        )
          - 1 + noise * 0.05;
        const path = distanceToPolyline(x, z, pathPoints) - (0.92 + noise * 0.15);

        const highlandX = (
          x - (-8.5 + highlandOffset) * referenceScaleX
        ) / (18 * referenceScaleX);
        const highlandZ = (z + 3.8 * referenceScaleZ) / (14.5 * referenceScaleZ);
        const highland = Math.hypot(highlandX, highlandZ) - 1 + noise * 0.025;

        const forestWest = Math.hypot((x + 47) / 15.5, (z + 18) / 20) - 1
          + noise * 0.06;
        const forestNorth = Math.hypot((x + 19) / 19, (z - 25) / 9.5) - 1
          + noise * 0.06;
        const forestEast = Math.hypot((x - 43) / 14, (z - 22) / 11) - 1
          + noise * 0.06;
        const forest = Math.min(forestWest, forestNorth, forestEast);
        const shrubRibbon = distanceToPolyline(x, z, [
          [-54, -31],
          [-36, -27],
          [-17, -29],
          [2, -25],
        ]) - (2.5 + noise * 0.35);
        const shrubPatch = Math.hypot((x - 34) / 10, (z + 29) / 4.4) - 1
          + noise * 0.08;
        const shrubland = Math.min(shrubRibbon, shrubPatch);

        let semantic: WetlandLayoutSemantic = 'grass';
        if (forest < 0) semantic = 'forest';
        if (shrubland < 0) semantic = 'shrubland';
        if (highland < 0) semantic = 'highland';
        if (path < 0) semantic = 'path';
        if (lake < 0) semantic = 'water';
        this.data[row * this.columns + column] = semanticIds[semantic];
      }
    }
    this.dirty = true;
    this.compile();
  }

  semanticAt(column: number, row: number): WetlandLayoutSemantic {
    const safeColumn = clamp(Math.round(column), 0, this.columns - 1);
    const safeRow = clamp(Math.round(row), 0, this.rows - 1);
    return semantics[this.data[safeRow * this.columns + safeColumn]];
  }

  paint(column: number, row: number, radius: number, semantic: WetlandLayoutSemantic) {
    const centerColumn = clamp(Math.round(column), 0, this.columns - 1);
    const centerRow = clamp(Math.round(row), 0, this.rows - 1);
    const brushRadius = Math.max(0.5, radius);
    const minColumn = Math.max(0, Math.floor(centerColumn - brushRadius));
    const maxColumn = Math.min(this.columns - 1, Math.ceil(centerColumn + brushRadius));
    const minRow = Math.max(0, Math.floor(centerRow - brushRadius));
    const maxRow = Math.min(this.rows - 1, Math.ceil(centerRow + brushRadius));
    const semanticId = semanticIds[semantic];
    for (let paintRow = minRow; paintRow <= maxRow; paintRow += 1) {
      for (let paintColumn = minColumn; paintColumn <= maxColumn; paintColumn += 1) {
        if (Math.hypot(paintColumn - centerColumn, paintRow - centerRow) > brushRadius) continue;
        this.data[paintRow * this.columns + paintColumn] = semanticId;
      }
    }
    this.dirty = true;
  }

  snapshot() {
    return this.data.slice();
  }

  detailSnapshot() {
    const columns = Math.max(1, Math.round(this.columns * this.detailWorldWidth / Math.max(this.worldWidth, 0.0001)));
    const rows = Math.max(1, Math.round(this.rows * this.detailWorldDepth / Math.max(this.worldDepth, 0.0001)));
    const snapshot = new Uint8Array(columns * rows);
    for (let row = 0; row < rows; row += 1) {
      const z = this.detailWorldDepth * (row / Math.max(rows - 1, 1) - 0.5);
      const sourceRow = clamp(
        (z / this.worldDepth + 0.5) * (this.rows - 1),
        0,
        this.rows - 1,
      );
      for (let column = 0; column < columns; column += 1) {
        const x = this.detailWorldWidth * (column / Math.max(columns - 1, 1) - 0.5);
        const sourceColumn = clamp(
          (x / this.worldWidth + 0.5) * (this.columns - 1),
          0,
          this.columns - 1,
        );
        snapshot[row * columns + column] = this.data[
          Math.round(sourceRow) * this.columns + Math.round(sourceColumn)
        ];
      }
    }
    return { columns, rows, data: snapshot };
  }

  restore(snapshot: Uint8Array) {
    if (snapshot.length !== this.data.length) throw new Error('Wetland layout snapshot size mismatch');
    this.data.set(snapshot);
    this.dirty = true;
    this.compile();
  }

  importRgba(source: ArrayLike<number>, sourceWidth: number, sourceHeight: number) {
    for (let row = 0; row < this.rows; row += 1) {
      const sourceRow = clamp(Math.round(row / Math.max(this.rows - 1, 1) * (sourceHeight - 1)), 0, sourceHeight - 1);
      for (let column = 0; column < this.columns; column += 1) {
        const sourceColumn = clamp(
          Math.round(column / Math.max(this.columns - 1, 1) * (sourceWidth - 1)),
          0,
          sourceWidth - 1,
        );
        const sourceOffset = (sourceRow * sourceWidth + sourceColumn) * 4;
        const semantic = nearestSemantic(
          source[sourceOffset] ?? 0,
          source[sourceOffset + 1] ?? 0,
          source[sourceOffset + 2] ?? 0,
        );
        this.data[row * this.columns + column] = semanticIds[semantic];
      }
    }
    this.dirty = true;
    this.compile();
  }

  exportRgba(options: Readonly<{ transparentOutsideDomain?: boolean }> = {}) {
    const rgba = new Uint8ClampedArray(this.data.length * 4);
    for (let index = 0; index < this.data.length; index += 1) {
      const color = paletteRgb[this.data[index]].rgb;
      rgba[index * 4] = color[0];
      rgba[index * 4 + 1] = color[1];
      rgba[index * 4 + 2] = color[2];
      const row = Math.floor(index / this.columns);
      const column = index - row * this.columns;
      const x = this.worldWidth * (column / Math.max(this.columns - 1, 1) - 0.5);
      const z = this.worldDepth * (row / Math.max(this.rows - 1, 1) - 0.5);
      rgba[index * 4 + 3] = options.transparentOutsideDomain && !this.containsWorldPoint(x, z)
        ? 0
        : 255;
    }
    return rgba;
  }

  compile() {
    if (!this.dirty) return;
    const metersPerCell = (this.worldWidth / this.columns + this.worldDepth / this.rows) * 0.5;
    this.waterDistance = smoothDistanceField(createSignedDistanceField(
      this.data,
      this.columns,
      this.rows,
      semanticIds.water,
      metersPerCell,
      false,
    ), this.columns, this.rows);
    this.pathDistance = smoothDistanceField(createSignedDistanceField(
      this.data,
      this.columns,
      this.rows,
      semanticIds.path,
      metersPerCell,
    ), this.columns, this.rows);
    this.highlandDistance = smoothDistanceField(createSignedDistanceField(
      this.data,
      this.columns,
      this.rows,
      semanticIds.highland,
      metersPerCell,
    ), this.columns, this.rows);
    this.forestDistance = smoothDistanceField(createSignedDistanceField(
      this.data,
      this.columns,
      this.rows,
      semanticIds.forest,
      metersPerCell,
    ), this.columns, this.rows);
    this.shrublandDistance = smoothDistanceField(createSignedDistanceField(
      this.data,
      this.columns,
      this.rows,
      semanticIds.shrubland,
      metersPerCell,
    ), this.columns, this.rows);
    this.dirty = false;
  }

  distanceField(semantic: Exclude<WetlandLayoutSemantic, 'grass'>) {
    this.compile();
    if (semantic === 'water') return this.waterDistance;
    if (semantic === 'path') return this.pathDistance;
    if (semantic === 'highland') return this.highlandDistance;
    if (semantic === 'forest') return this.forestDistance;
    return this.shrublandDistance;
  }

  sample(x: number, z: number): WetlandLayoutSample {
    this.compile();
    const column = clamp((x / this.worldWidth + 0.5) * (this.columns - 1), 0, this.columns - 1);
    const row = clamp((z / this.worldDepth + 0.5) * (this.rows - 1), 0, this.rows - 1);
    const column0 = Math.floor(column);
    const row0 = Math.floor(row);
    const column1 = Math.min(column0 + 1, this.columns - 1);
    const row1 = Math.min(row0 + 1, this.rows - 1);
    const tx = column - column0;
    const tz = row - row0;
    const sampleField = (field: Float32Array) => {
      const a = field[row0 * this.columns + column0];
      const b = field[row0 * this.columns + column1];
      const c = field[row1 * this.columns + column0];
      const d = field[row1 * this.columns + column1];
      return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * tz;
    };
    return {
      waterDistance: sampleField(this.waterDistance),
      pathDistance: sampleField(this.pathDistance),
      highlandDistance: sampleField(this.highlandDistance),
      forestDistance: sampleField(this.forestDistance),
      shrublandDistance: sampleField(this.shrublandDistance),
    };
  }
}

export const createEllipticallyExpandedWetlandLayoutMap = (
  source: WetlandLayoutMap,
  options: WetlandEllipticExpansionOptions,
) => {
  const worldWidth = Math.max(source.worldWidth, options.worldWidth);
  const worldDepth = Math.max(source.worldDepth, options.worldDepth);
  const columns = Math.max(
    source.columns,
    Math.round(options.columns ?? source.columns * worldWidth / source.worldWidth),
  );
  const rows = Math.max(
    source.rows,
    Math.round(options.rows ?? source.rows * worldDepth / source.worldDepth),
  );
  const expanded = new WetlandLayoutMap(
    columns,
    rows,
    worldWidth,
    worldDepth,
    'ellipse',
    source.worldWidth,
    source.worldDepth,
  );
  const outsideSemanticId = semanticIds[options.outsideSemantic ?? 'grass'];
  const ellipseRadiusX = worldWidth * 0.5;
  const ellipseRadiusZ = worldDepth * 0.5;
  const sourceHalfWidth = source.worldWidth * 0.5;
  const sourceHalfDepth = source.worldDepth * 0.5;

  for (let row = 0; row < rows; row += 1) {
    const z = worldDepth * (row / Math.max(rows - 1, 1) - 0.5);
    for (let column = 0; column < columns; column += 1) {
      const x = worldWidth * (column / Math.max(columns - 1, 1) - 0.5);
      const ellipseDistance = (
        x * x / (ellipseRadiusX * ellipseRadiusX)
        + z * z / (ellipseRadiusZ * ellipseRadiusZ)
      );
      const targetIndex = row * columns + column;
      if (ellipseDistance > 1) {
        expanded.data[targetIndex] = outsideSemanticId;
        continue;
      }

      const sourceX = clamp(x, -sourceHalfWidth, sourceHalfWidth);
      const sourceZ = clamp(z, -sourceHalfDepth, sourceHalfDepth);
      const sourceColumn = (sourceX / source.worldWidth + 0.5) * (source.columns - 1);
      const sourceRow = (sourceZ / source.worldDepth + 0.5) * (source.rows - 1);
      expanded.data[targetIndex] = semanticIds[source.semanticAt(sourceColumn, sourceRow)];
    }
  }

  expanded.compile();
  return expanded;
};

export const createDefaultWetlandLayoutMap = (
  seed: number,
  worldSize: WetlandLayoutWorldSize = wetlandLayoutWorld,
) => {
  const map = new WetlandLayoutMap(
    wetlandLayoutWorld.columns,
    wetlandLayoutWorld.rows,
    worldSize.width,
    worldSize.depth,
  );
  map.regenerate(seed);
  return map;
};
