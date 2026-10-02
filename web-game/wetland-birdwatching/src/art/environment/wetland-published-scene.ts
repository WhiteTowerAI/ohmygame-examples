import * as THREE from 'three';
import type { FoliageTreePaletteStyle } from '../rendering/foliage-light-direction';
import type { WetlandMapPresetId } from './wetland-map-presets';
import type {
  WetlandBrushStroke,
  WetlandGrassDistribution,
  WetlandGrassShape,
  WetlandRegionParams,
  WetlandShoreStyle,
} from './wetland-region-fields';
import type { WetlandSkyVersion, WetlandWeatherId } from './wetland-weather';
import type { WetlandLayer, WetlandPalette } from './wetland-scene';

export const wetlandMinimumSunElevation = 21;
const wetlandPublishedSceneStorageKey = 'bird.wetland.published-scene.v1';

type WetlandPublishedLight = Readonly<{
  enabled: boolean;
  color: string;
  groundColor?: string;
  intensity: number;
  position: readonly [number, number, number];
}>;

type WetlandPublishedAppearance = Readonly<{
  shadowStrength: number;
  groundDappleEnabled: boolean;
  groundDappleStrength: number;
  lightingVersion: 'elemental' | 'reference';
  weather: WetlandWeatherId;
  skyVersion: WetlandSkyVersion;
  referenceSkyEnabled: boolean;
  dropShadowEnabled: boolean;
  colorShadowFusionEnabled: boolean;
  barkRoundnessEnabled: boolean;
  treeFoliageLightEnabled: boolean;
  treeFoliagePaletteStyle: FoliageTreePaletteStyle;
  treeFoliageHeight: number;
  treeFoliageDetail: number;
  treeFoliageKeyEnabled: boolean;
  treeFoliageKey: number;
  treeFoliageSkyEnabled: boolean;
  treeFoliageSky: number;
  treeFoliageGroundEnabled: boolean;
  treeFoliageGround: number;
  treeFoliageBacklightEnabled: boolean;
  treeFoliageBacklight: number;
  foliageShadowOcclusion: number;
  foliageShadowOcclusionEnabled: boolean;
  grassGroundIntegrationEnabled: boolean;
  grassGroundTipLift: number;
  grassFinalGroundColorEnabled: boolean;
  terrainSlopeLightEnabled: boolean;
  terrainSlopeStrength: number;
  terrainSelfShadowEnabled: boolean;
  terrainShadowTintEnabled: boolean;
  terrainShadowTint: number;
  terrainShadowSoftEnabled: boolean;
  terrainShadowContact: number;
  terrainShadowFar: number;
  terrainContactDarkeningEnabled: boolean;
  terrainContactStrength: number;
  godRaysEnabled: boolean;
  godRaysStrength: number;
  godRaysThreshold: number;
  godRaysDensity: number;
  godRaysDecay: number;
  godRaysShape: number;
  godRaysContrast: number;
  godRaysAntiEnabled: boolean;
  godRaysAntiScale: number;
  canopyShaftsEnabled: boolean;
  canopyShaftsStrength: number;
  canopyShaftsLength: number;
  canopyShaftsWidth: number;
  canopyShaftsCount: number;
  canopyShaftsForwardScatter: number;
}>;

type WetlandPublishedScene = Readonly<{
  schemaVersion: 1 | 2;
  savedAt: string;
  mapPresetId: WetlandMapPresetId;
  params: WetlandRegionParams;
  grassDistribution: WetlandGrassDistribution;
  grassShape: WetlandGrassShape;
  shoreStyle: WetlandShoreStyle;
  brushStrokes: readonly WetlandBrushStroke[];
  palette: WetlandPalette;
  layers: Record<Exclude<WetlandLayer, 'candidates'>, boolean>;
  layout: Readonly<{
    columns: number;
    rows: number;
    data: string;
  }>;
  domain?: Readonly<{
    shape: 'rectangle' | 'ellipse';
    visualWorldWidth: number;
    visualWorldDepth: number;
    detailWorldWidth: number;
    detailWorldDepth: number;
    detailLayout?: Readonly<{ columns: number; rows: number; data: string }>;
  }>;
  dayProgress: number;
  sun: Readonly<{ azimuth: number; elevation: number }>;
  windStrength: number;
  lights: Readonly<{
    hemisphere: WetlandPublishedLight;
    key: WetlandPublishedLight;
    fill: WetlandPublishedLight;
    rim: WetlandPublishedLight;
  }>;
  appearance: WetlandPublishedAppearance;
}>;

export const decodeWetlandLayout = (data: string) => {
  const binary = atob(data);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    result[index] = binary.charCodeAt(index);
  }
  return result;
};

export const loadPublishedWetlandScene = (): WetlandPublishedScene | null => {
  try {
    const source = localStorage.getItem(wetlandPublishedSceneStorageKey);
    if (!source) return null;
    const parsed = JSON.parse(source) as Partial<WetlandPublishedScene>;
    if ((parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2)
      || !parsed.layout?.data || !parsed.appearance) return null;
    return {
      ...parsed,
      dayProgress: THREE.MathUtils.clamp(parsed.dayProgress ?? 0.25, 0, 1),
      appearance: {
        ...parsed.appearance,
        shadowStrength: THREE.MathUtils.clamp(parsed.appearance.shadowStrength ?? 1, 0, 1),
        groundDappleEnabled: parsed.appearance.groundDappleEnabled ?? true,
        groundDappleStrength: THREE.MathUtils.clamp(
          parsed.appearance.groundDappleStrength ?? 0.55,
          0,
          1.5,
        ),
      },
    } as WetlandPublishedScene;
  } catch {
    return null;
  }
};
