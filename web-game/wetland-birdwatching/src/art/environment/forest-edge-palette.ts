const forestEdgeSurfacePalette = {
  grass: '#8db06b',
  ridgeGrass: '#a2ba78',
  hollowGrass: '#76985f',
  path: '#aaa07e',
  bareSoil: '#806b59',
  leafLitter: '#8d6449',
} as const;

export const forestEdgePalette = {
  ground: forestEdgeSurfacePalette.grass,
  path: forestEdgeSurfacePalette.path,
  surface: forestEdgeSurfacePalette,
  tree: {
    bark: ['#6d4f46', '#805f50', '#967359'],
    foliage: ['#47794c', '#568a54', '#659b5d', '#76aa67'],
  },
  bush: ['#4f7f4b', '#5d9053', '#6ca15e'],
  grass: ['#6f984e', '#86ad58'],
  fallenLeaf: ['#9a643d', '#ad7b4b'],
  accent: '#e9b85f',
} as const;
