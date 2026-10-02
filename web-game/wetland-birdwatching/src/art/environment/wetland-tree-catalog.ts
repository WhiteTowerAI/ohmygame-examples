import type { ProceduralTreeRecipe } from '../trees/procedural-camphor-tree';
import {
  wetlandCamphorTreeClearanceRadii,
  wetlandCamphorTreePresetLabels,
  wetlandCamphorTreePresets,
} from './wetland-tree-presets';

type WetlandTreeCatalogEntry = Readonly<{
  id: string;
  name: string;
  recipe: ProceduralTreeRecipe;
  clearanceRadius: number;
}>;

type WetlandTreeCatalogDocument = Readonly<{
  schemaVersion: 1;
  entries: readonly WetlandTreeCatalogEntry[];
}>;

const storageKey = 'bird.wetland.tree-working-catalog';
let pageReloadHandled = false;

const resetCatalogForPageReload = () => {
  if (pageReloadHandled || typeof performance === 'undefined') return;
  pageReloadHandled = true;
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (navigation?.type !== 'reload' || typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(storageKey);
};

const cloneRecipe = (recipe: ProceduralTreeRecipe): ProceduralTreeRecipe => ({
  ...recipe,
  skeleton: { ...recipe.skeleton },
  foliage: { ...recipe.foliage },
  visibleFoliageRoles: recipe.visibleFoliageRoles
    ? [...recipe.visibleFoliageRoles]
    : undefined,
});

const cloneEntry = (entry: WetlandTreeCatalogEntry): WetlandTreeCatalogEntry => ({
  ...entry,
  recipe: cloneRecipe(entry.recipe),
});

const createDefaultWetlandTreeCatalog = (): WetlandTreeCatalogEntry[] => (
  wetlandCamphorTreePresets.map((recipe, index) => ({
    id: recipe.id,
    name: wetlandCamphorTreePresetLabels[recipe.id] ?? recipe.id,
    recipe: cloneRecipe(recipe),
    clearanceRadius: wetlandCamphorTreeClearanceRadii[index] ?? 4.2,
  }))
);

const isCatalogEntry = (value: unknown): value is WetlandTreeCatalogEntry => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<WetlandTreeCatalogEntry>;
  const recipe = entry.recipe as Partial<ProceduralTreeRecipe> | undefined;
  return typeof entry.id === 'string'
    && entry.id.length > 0
    && typeof entry.name === 'string'
    && entry.name.trim().length > 0
    && typeof entry.clearanceRadius === 'number'
    && Number.isFinite(entry.clearanceRadius)
    && entry.clearanceRadius >= 2
    && entry.clearanceRadius <= 10
    && typeof recipe?.id === 'string'
    && recipe.generationVersion === 'species-v004'
    && Boolean(recipe.skeleton)
    && recipe.skeleton?.preset !== 'willow'
    && Boolean(recipe.foliage)
    && Boolean(recipe.perchGeneration);
};

export const readWetlandTreeCatalog = (): WetlandTreeCatalogEntry[] => {
  resetCatalogForPageReload();
  if (typeof sessionStorage === 'undefined') return createDefaultWetlandTreeCatalog();
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) return createDefaultWetlandTreeCatalog();
    const document = JSON.parse(stored) as Partial<WetlandTreeCatalogDocument>;
    if (document.schemaVersion !== 1
      || !Array.isArray(document.entries)
      || document.entries.length === 0
      || !document.entries.every(isCatalogEntry)) {
      return createDefaultWetlandTreeCatalog();
    }
    return document.entries.map(cloneEntry);
  } catch {
    return createDefaultWetlandTreeCatalog();
  }
};
