import {
  proceduralCamphorTreeRecipe,
  type ProceduralTreeRecipe,
} from '../trees/procedural-camphor-tree';
import type {
  ProceduralTreeFoliageParameters,
  ProceduralTreeFoliageRole,
} from '../trees/procedural-tree-builder';
import type { ProceduralTreeParameters } from '../trees/procedural-tree-skeleton';

const sharedSkeleton: ProceduralTreeParameters = {
  preset: 'dome',
  seed: 2411,
  height: 10.2,
  trunkRadius: 0.62,
  crownStart: 0.45,
  crownWidth: 0.69,
  crownDepth: 1.11,
  primaryBranches: 7,
  levels: 3,
  branchDensity: 3,
  branchLengthScale: 1.4,
  branchAngle: 54,
  upward: 0.54,
  droop: 0.24,
  wander: 0.1,
  asymmetry: 0.14,
};

const sharedFoliage: ProceduralTreeFoliageParameters = {
  density: 1.45,
  cardsPerAnchor: 2,
  scale: 1.12,
  hollow: 0.03,
  leafPreset: 'camphor',
  leafSize: 1.87,
  leafWidth: 0.94,
  leafTip: 0.52,
  serration: 0.02,
  cardLeafCount: 17,
  leafVariation: 0.38,
  leafOverlap: 0.7,
  leafSpread: 0.58,
  sdfThickness: 0,
  growthMode: 'outward',
  outwardStrength: 0.62,
  directionJitter: 0.22,
  bounceStrength: 0.28,
  branchRadiusLimit: 0.22,
  branchWrapLength: 0.32,
};

const allFoliageRoles: readonly ProceduralTreeFoliageRole[] = ['spur', 'inner', 'mid', 'outer'];
const spurOnly: readonly ProceduralTreeFoliageRole[] = ['spur'];

const createPreset = (
  id: string,
  skeletonOverrides: Partial<ProceduralTreeParameters>,
  foliageOverrides: Partial<ProceduralTreeFoliageParameters>,
  visibleFoliageRoles: readonly ProceduralTreeFoliageRole[],
): ProceduralTreeRecipe => ({
  ...proceduralCamphorTreeRecipe,
  id,
  generationVersion: 'species-v004',
  skeleton: { ...sharedSkeleton, ...skeletonOverrides },
  foliage: { ...sharedFoliage, ...foliageOverrides },
  visibleFoliageRoles,
  bounceEnabled: true,
  crownIntegrationEnabled: true,
});

export const wetlandCamphorTreePresets: readonly ProceduralTreeRecipe[] = [
  createPreset('wetland-camphor-large-1', {}, {}, allFoliageRoles),
  createPreset(
    'wetland-camphor-small-1',
    { branchLengthScale: 1.1 },
    { density: 1.9, scale: 1.38 },
    spurOnly,
  ),
  createPreset(
    'wetland-camphor-large-2',
    { height: 15.6 },
    { density: 1.9, scale: 1.38 },
    spurOnly,
  ),
  createPreset(
    'wetland-camphor-large-3',
    {
      height: 15.6,
      trunkRadius: 0.9,
      crownStart: 0.5,
      crownWidth: 1.02,
      branchAngle: 65,
    },
    { density: 0.95, scale: 1.26 },
    ['spur', 'inner', 'outer'],
  ),
  createPreset(
    'wetland-camphor-large-4',
    {
      height: 15.6,
      crownStart: 0.64,
      crownWidth: 1.25,
      branchAngle: 38,
      upward: 0.2,
      droop: 0.74,
      wander: 0.4,
    },
    { density: 1.9, scale: 1.38 },
    spurOnly,
  ),
];

export const wetlandCamphorTreePresetLabels: Readonly<Record<string, string>> = {
  'wetland-camphor-large-1': 'Wetland camphor · large 1',
  'wetland-camphor-small-1': 'Wetland camphor · small 1',
  'wetland-camphor-large-2': 'Wetland camphor · large 2',
  'wetland-camphor-large-3': 'Wetland camphor · large 3',
  'wetland-camphor-large-4': 'Wetland camphor · large 4',
};

// Horizontal clearance follows the authored crown and primary-branch reach of
// each fixed preset. Placement combines the radii of both trees.
export const wetlandCamphorTreeClearanceRadii: readonly number[] = [4.8, 3.8, 5.3, 5.8, 6.2];
