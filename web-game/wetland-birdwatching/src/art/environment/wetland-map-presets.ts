import {
  compactWetlandStudyGenerationProfile,
  type WetlandStudyGenerationProfile,
} from './wetland-study';

export type WetlandMapPresetId = 'compact-v116' | 'park-third' | 'park-third-expanded' | 'large-semantic';

export type WetlandMapPreset = Readonly<{
  id: WetlandMapPresetId;
  label: string;
  worldWidth: number;
  worldDepth: number;
  semanticInset?: number;
  cameraScale: number;
  shadowExtent: number;
  generationProfile: WetlandStudyGenerationProfile;
}>;

const largeWetlandStudyGenerationProfile: WetlandStudyGenerationProfile = {
  terrainVertexSpacing: 0.5,
  surfaceMapTexelSpacing: 0.32,
  grassCandidateBudgetScale: 2.4,
  flowerSpacing: 0.9,
  shrubCandidateCount: 2600,
  plannedShrubLimit: 36,
  naturalShrubLimit: 14,
  rockCandidateCount: 1200,
  rockLimit: 24,
  treeCandidateCount: 44000,
  camphorTreeLimit: 144,
  willowTreeLimit: 24,
  camphorTreeSpacing: 3.8,
  willowTreeSpacing: 1.55,
  treeShadowLimit: 48,
  debugCandidateSpacing: 1.2,
};

const parkThirdGenerationProfile: WetlandStudyGenerationProfile = {
  terrainVertexSpacing: 0.35,
  surfaceMapTexelSpacing: 0.24,
  grassCandidateBudgetScale: 1.3,
  flowerSpacing: 0.6,
  shrubCandidateCount: 1400,
  plannedShrubLimit: 18,
  naturalShrubLimit: 8,
  rockCandidateCount: 700,
  rockLimit: 14,
  treeCandidateCount: 14000,
  camphorTreeLimit: 42,
  willowTreeLimit: 8,
  camphorTreeSpacing: 3.9,
  willowTreeSpacing: 1.55,
  treeShadowLimit: 50,
  debugCandidateSpacing: 0.64,
};

export const wetlandMapPresets: Readonly<Record<WetlandMapPresetId, WetlandMapPreset>> = {
  'compact-v116': {
    id: 'compact-v116',
    label: 'Current map',
    worldWidth: 120,
    worldDepth: 84,
    cameraScale: 1,
    shadowExtent: 72,
    generationProfile: compactWetlandStudyGenerationProfile,
  },
  'park-third': {
    id: 'park-third',
    label: 'Park zones',
    worldWidth: 140,
    worldDepth: 98,
    cameraScale: 140 / 120,
    shadowExtent: 84,
    generationProfile: parkThirdGenerationProfile,
  },
  'park-third-expanded': {
    id: 'park-third-expanded',
    label: 'Park, elliptic expansion',
    worldWidth: 210,
    worldDepth: 147,
    cameraScale: 1.5,
    shadowExtent: 126,
    generationProfile: {
      ...parkThirdGenerationProfile,
      terrainVertexSpacing: 0.5,
      surfaceMapTexelSpacing: 0.32,
      grassCandidateBudgetScale: 1.9,
      flowerSpacing: 0.75,
      shrubCandidateCount: 2100,
      plannedShrubLimit: 28,
      naturalShrubLimit: 11,
      rockCandidateCount: 1000,
      rockLimit: 20,
      treeCandidateCount: 28000,
      camphorTreeLimit: 84,
      willowTreeLimit: 14,
      treeShadowLimit: 50,
      debugCandidateSpacing: 0.9,
    },
  },
  'large-semantic': {
    id: 'large-semantic',
    label: 'Large semantic map',
    worldWidth: 420,
    worldDepth: 294,
    cameraScale: 3.5,
    shadowExtent: 245,
    generationProfile: largeWetlandStudyGenerationProfile,
  },
};
