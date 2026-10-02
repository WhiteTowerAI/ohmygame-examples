import * as THREE from 'three';
import { getEnvironmentLookById } from '../art/environment/environment-look';
import { createStylizedObjectShadowSystem } from '../art/rendering/stylized-object-shadow';
import { createWetlandGodRays } from '../art/rendering/wetland-god-rays';
import { createWetlandScene } from '../art/environment/wetland-scene';
import type { WetlandLayer } from '../art/environment/wetland-scene';
import { createWetlandWeatherSystem } from '../art/environment/wetland-weather';
import type { WetlandWindFrame } from '../art/environment/wetland-weather';
import {
  applySharedWetlandLighting,
  createSharedWetlandLayoutMap,
  evaluateWetlandDayLighting,
  sharedWetlandGenerationDefaults,
  sharedWetlandAppearanceDefaults,
  sharedWetlandGameplayGenerationProfile,
  sharedWetlandLightingDefaults,
  sharedWetlandMapPreset,
} from '../art/environment/wetland-shared-world';
import {
  loadPublishedWetlandScene,
  wetlandMinimumSunElevation,
} from '../art/environment/wetland-published-scene';
import { wetlandMapPresets } from '../art/environment/wetland-map-presets';
import type { EnvironmentLightingRig } from '../art/environment/environment-lighting';
import type { HabitatNode } from '../gameplay/birds/contracts';
import { HabitatRegistry } from '../gameplay/habitat/registry';

type WetlandGameplayLocation = 'wetland-path' | 'wetland-shore' | 'wetland-meadow';

type WetlandGameplayWorld = Readonly<{
  root: THREE.Group;
  wetland: Awaited<ReturnType<typeof createWetlandScene>>;
  habitatRegistry: HabitatRegistry;
  groundLeaves: readonly THREE.Mesh[];
  blackbirdInitialNodeId: string;
  grayMagpieInitialNodeId: string;
  habitatProviderIds: readonly string[];
  spawn: THREE.Vector3;
  playableDomain: Readonly<{ shape: 'rectangle'; width: number; depth: number }>;
  airWallProbe: Readonly<{
    visualRingRejected: boolean;
    sweptMovementContained: boolean;
    diagonalMovementContained: boolean;
  }>;
  sampleHeight: (x: number, z: number) => number;
  isTerrainWalkable: (x: number, z: number) => boolean;
  isWalkable: (x: number, z: number) => boolean;
  resolvePlayerMovement: (previous: THREE.Vector3, desired: THREE.Vector3) => void;
  constrainPlayerPosition: (position: THREE.Vector3) => void;
  locationAt: (position: THREE.Vector3) => WetlandGameplayLocation;
  update: (elapsed: number, camera: THREE.Camera) => WetlandWindFrame;
  updateFinalGroundColor: (renderer: THREE.WebGLRenderer, scene: THREE.Scene) => void;
  render: (camera: THREE.PerspectiveCamera) => void;
  dispose: () => void;
}>;

type WetlandGameplayWorldOptions = Readonly<{
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  lighting: EnvironmentLightingRig;
}>;

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const shouldUseObjectShadowMaterial = (mesh: THREE.Mesh) => (
  mesh.name === 'wetland-path-and-shore-rocks'
  || mesh.name.startsWith('procedural-tree-level-')
  || mesh.userData.environmentRole === 'bush-stem'
);

export const createWetlandGameplayWorld = async (
  options: WetlandGameplayWorldOptions,
): Promise<WetlandGameplayWorld> => {
  const { scene, renderer, lighting } = options;
  const published = loadPublishedWetlandScene();
  const appearance = sharedWetlandAppearanceDefaults;
  const savedAppearance = published?.appearance ?? appearance;
  const dayLighting = evaluateWetlandDayLighting(published?.dayProgress ?? appearance.dayProgress);
  const godRays = createWetlandGodRays();
  godRays.setSettings({
    enabled: savedAppearance.godRaysEnabled,
    strength: savedAppearance.godRaysStrength * dayLighting.screenShaftStrength,
    threshold: savedAppearance.godRaysThreshold,
    density: savedAppearance.godRaysDensity,
    decay: savedAppearance.godRaysDecay,
    shape: savedAppearance.godRaysShape,
    contrast: savedAppearance.godRaysContrast * dayLighting.shadowContrast,
    antiSolarEnabled: savedAppearance.godRaysAntiEnabled,
    antiScale: savedAppearance.godRaysAntiScale,
  });
  let godRayWidth = 0;
  let godRayHeight = 0;
  let godRayPixelRatio = 0;
  const syncGodRaySize = () => {
    const width = Math.max(1, renderer.domElement.clientWidth);
    const height = Math.max(1, renderer.domElement.clientHeight);
    const pixelRatio = renderer.getPixelRatio();
    if (width === godRayWidth && height === godRayHeight && pixelRatio === godRayPixelRatio) return;
    godRayWidth = width;
    godRayHeight = height;
    godRayPixelRatio = pixelRatio;
    godRays.resize(width, height, pixelRatio);
  };
  const root = new THREE.Group();
  root.name = 'shared-wetland-gameplay-world';
  const baseLook = getEnvironmentLookById('reference-morning');
  const weather = createWetlandWeatherSystem(scene, lighting, baseLook, {
    syncKeyToSky: false,
    applyLighting: false,
  });
  weather.applyWeather(savedAppearance.weather);
  weather.setSkyVersion(savedAppearance.skyVersion);
  weather.setWindStrength(published?.windStrength ?? sharedWetlandLightingDefaults.windStrength);
  const activeMapPreset = published
    ? wetlandMapPresets[published.mapPresetId] ?? sharedWetlandMapPreset
    : sharedWetlandMapPreset;
  applySharedWetlandLighting(lighting, renderer, activeMapPreset);

  const ambientLight = new THREE.AmbientLight(
    sharedWetlandLightingDefaults.ambient.color,
    sharedWetlandLightingDefaults.ambient.intensity,
  );
  ambientLight.name = 'shared-wetland-elemental-ambient-light';

  if (published) {
    const applyDirectionalLight = (id: 'key' | 'fill' | 'rim') => {
      const config = published.lights[id];
      const light = id === 'key' ? lighting.keyLight : id === 'fill' ? lighting.fillLight : lighting.rimLight;
      light.color.set(config.color);
      light.intensity = config.enabled ? config.intensity : 0;
      light.position.set(...config.position);
    };
    applyDirectionalLight('key');
    applyDirectionalLight('fill');
    applyDirectionalLight('rim');

    const environment = published.lights.hemisphere;
    if (savedAppearance.lightingVersion === 'elemental') {
      lighting.hemisphereLight.intensity = 0;
      ambientLight.color.set(environment.color);
      ambientLight.intensity = environment.enabled ? environment.intensity : 0;
    } else {
      ambientLight.intensity = 0;
      lighting.hemisphereLight.color.set(environment.color);
      if (environment.groundColor) lighting.hemisphereLight.groundColor.set(environment.groundColor);
      lighting.hemisphereLight.intensity = environment.enabled ? environment.intensity : 0;
      lighting.hemisphereLight.position.set(...environment.position);
    }
    const elevation = Math.max(wetlandMinimumSunElevation, dayLighting.sunElevation);
    const azimuth = THREE.MathUtils.degToRad(dayLighting.sunAzimuth);
    const elevationRadians = THREE.MathUtils.degToRad(elevation);
    const direction = new THREE.Vector3(
      Math.cos(azimuth) * Math.cos(elevationRadians),
      Math.sin(elevationRadians),
      Math.sin(azimuth) * Math.cos(elevationRadians),
    );
    lighting.keyLight.position.copy(direction).multiplyScalar(lighting.keyLight.position.length());
    lighting.keyLight.target.position.set(0, 0, 0);
  }
  const baseKeyColor = published?.lights.key.color ?? sharedWetlandLightingDefaults.key.color;
  lighting.keyLight.color.set(baseKeyColor).lerp(new THREE.Color(dayLighting.keyColor), 0.72);
  const baseKeyIntensity = published?.lights.key.intensity ?? sharedWetlandLightingDefaults.key.intensity;
  const keyEnabled = published?.lights.key.enabled ?? true;
  lighting.keyLight.intensity = keyEnabled ? baseKeyIntensity * dayLighting.keyIntensity : 0;
  lighting.keyLight.shadow.intensity = THREE.MathUtils.clamp(
    savedAppearance.shadowStrength * dayLighting.shadowStrength,
    0,
    1,
  );
  weather.setSunDirection(lighting.keyLight.position);
  weather.setDayLighting(dayLighting);
  root.add(ambientLight);

  const layoutMap = await createSharedWetlandLayoutMap(activeMapPreset);
  const defaults = published ? {
    ...sharedWetlandGenerationDefaults,
    params: { ...published.params },
    grassDistribution: published.grassDistribution,
    grassShape: published.grassShape,
    shoreStyle: published.shoreStyle,
    palette: { ...published.palette },
  } : sharedWetlandGenerationDefaults;
  const wetland = await createWetlandScene({
    look: weather.getLook(),
    hemisphereLight: lighting.hemisphereLight,
    keyLight: lighting.keyLight,
    fillLight: lighting.fillLight,
    rimLight: lighting.rimLight,
    params: { ...defaults.params },
    grassDistribution: defaults.grassDistribution,
    grassShape: defaults.grassShape,
    shoreStyle: defaults.shoreStyle,
    fieldView: 'appearance',
    showCandidates: false,
    layoutMap,
    palette: { ...defaults.palette },
    brushStrokes: published?.brushStrokes ?? [],
    generationProfile: published ? activeMapPreset.generationProfile : sharedWetlandGameplayGenerationProfile,
  });
  wetland.setLightingVersion(savedAppearance.lightingVersion);
  wetland.setStylizedLightingFeatures({
    coreShadow: false,
    dropShadow: savedAppearance.dropShadowEnabled,
    groundBounce: false,
  });
  wetland.setTreeFoliageLightResponse(savedAppearance.treeFoliageLightEnabled);
  wetland.setTreeFoliagePaletteStyle(savedAppearance.treeFoliagePaletteStyle);
  wetland.setTreeFoliageHeightInfluence(savedAppearance.treeFoliageHeight);
  wetland.setTreeFoliageDetailStrength(savedAppearance.treeFoliageDetail);
  wetland.setTreeFoliageLightingResponse({
    keyEnabled: savedAppearance.treeFoliageKeyEnabled,
    keyStrength: savedAppearance.treeFoliageKey,
    skyEnabled: savedAppearance.treeFoliageSkyEnabled,
    skyStrength: savedAppearance.treeFoliageSky,
    groundEnabled: savedAppearance.treeFoliageGroundEnabled,
    groundStrength: savedAppearance.treeFoliageGround,
    backlightEnabled: savedAppearance.treeFoliageBacklightEnabled,
    backlightStrength: savedAppearance.treeFoliageBacklight,
  });
  wetland.setFoliageShadowOcclusion(
    savedAppearance.foliageShadowOcclusionEnabled,
    savedAppearance.foliageShadowOcclusion,
  );
  wetland.setGrassGroundIntegration(savedAppearance.grassGroundIntegrationEnabled);
  wetland.setGrassGroundTipLift(savedAppearance.grassGroundTipLift);
  wetland.setGrassFinalGroundColor(savedAppearance.grassFinalGroundColorEnabled);
  wetland.setTerrainLightingFeatures({
    slopeLight: savedAppearance.terrainSlopeLightEnabled,
    slopeStrength: savedAppearance.terrainSlopeStrength,
    selfShadow: savedAppearance.terrainSelfShadowEnabled,
    shadowTint: savedAppearance.terrainShadowTintEnabled,
    shadowTintStrength: savedAppearance.terrainShadowTint * dayLighting.shadowContrast,
    distanceSoftShadow: savedAppearance.terrainShadowSoftEnabled,
    contactSoftness: savedAppearance.terrainShadowContact,
    farSoftness: savedAppearance.terrainShadowFar,
    contactDarkening: savedAppearance.terrainContactDarkeningEnabled,
    contactStrength: savedAppearance.terrainContactStrength,
  });
  wetland.setCanopyShaftSettings({
    enabled: savedAppearance.canopyShaftsEnabled,
    strength: savedAppearance.canopyShaftsStrength * dayLighting.canopyShaftStrength,
    length: savedAppearance.canopyShaftsLength,
    width: savedAppearance.canopyShaftsWidth,
    count: savedAppearance.canopyShaftsCount,
    forwardScatter: savedAppearance.canopyShaftsForwardScatter,
  });
  wetland.setGroundDappleSettings({
    enabled: savedAppearance.groundDappleEnabled,
    strength: savedAppearance.groundDappleStrength * dayLighting.groundDappleStrength,
  });
  if (published) {
    for (const [layer, visible] of Object.entries(published.layers)) {
      wetland.setLayerVisible(layer as WetlandLayer, visible);
    }
  }
  wetland.syncLighting(
    savedAppearance.lightingVersion === 'elemental' ? ambientLight : lighting.hemisphereLight,
  );
  root.add(wetland.root);
  scene.add(root);

  const objectShadow = createStylizedObjectShadowSystem(baseLook.material);
  objectShadow.register(wetland.root, shouldUseObjectShadowMaterial);
  objectShadow.setTerrainHeightSource(wetland.terrainHeightMap, wetland.terrainWorldSize);
  objectShadow.setFeatures({
    coreShadow: false,
    dropShadow: savedAppearance.dropShadowEnabled,
    groundBounce: false,
    colorShadowFusion: savedAppearance.colorShadowFusionEnabled,
  });
  objectShadow.setBarkRoundness(savedAppearance.barkRoundnessEnabled);
  objectShadow.setEnabled(true);
  objectShadow.updateLighting(lighting.keyLight);

  const playerRadius = 0.34;
  const playerObstacles: Array<{ x: number; z: number; radius: number }> = [];
  wetland.treeProviders.forEach(({ tree }) => {
    const position = tree.root.getWorldPosition(new THREE.Vector3());
    playerObstacles.push({ x: position.x, z: position.z, radius: 0.72 });
  });
  const shrubLayer = wetland.root.getObjectByName('wetland-field-driven-shrubs');
  shrubLayer?.children.forEach((bush) => {
    const position = bush.getWorldPosition(new THREE.Vector3());
    const radius = Math.max(bush.scale.x, bush.scale.z) * 0.34;
    playerObstacles.push({ x: position.x, z: position.z, radius: Math.max(0.30, radius) });
  });
  const isTerrainWalkable = (x: number, z: number) => {
    if (!layoutMap.containsDetailPoint(x, z, playerRadius)) return false;
    const sample = wetland.field.sample(x, z);
    return sample.pondDistance > 0.18 && sample.slope < 0.62;
  };
  const isWalkable = (x: number, z: number) => {
    if (!isTerrainWalkable(x, z)) return false;
    return !playerObstacles.some((obstacle) => (
      Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + playerRadius
    ));
  };

  const centerTree = [...wetland.treeProviders].sort((left, right) => (
    left.tree.root.position.lengthSq() - right.tree.root.position.lengthSq()
  ))[0];
  const habitatCenter = centerTree?.tree.root.position ?? new THREE.Vector3();
  const random = createSeededRandom(defaults.params.vegetationSeed ^ 0x57e7);
  const groundNodes: HabitatNode[] = [];
  const groundTargetCount = 36;
  for (let attempt = 0; attempt < 2400 && groundNodes.length < groundTargetCount; attempt += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 2.4 + Math.sqrt(random()) * 19;
    const x = habitatCenter.x + Math.sin(angle) * radius;
    const z = habitatCenter.z + Math.cos(angle) * radius;
    if (!isTerrainWalkable(x, z)) continue;
    const sample = wetland.field.sample(x, z);
    if (sample.pathSurface > 0.7 || sample.groundGrass < 0.08) continue;
    if (groundNodes.some((node) => Math.hypot(node.position.x - x, node.position.z - z) < 1.15)) continue;
    const index = groundNodes.length.toString().padStart(2, '0');
    groundNodes.push({
      id: `wetland-floor:ground-${index}`,
      providerId: 'wetland-floor',
      kind: 'ground',
      level: 'ground',
      capabilities: ['forage'],
      position: { x, y: wetland.field.heightAt(x, z), z },
      forward: { x: Math.sin(angle), y: 0, z: Math.cos(angle) },
      clearance: 0.42,
    });
  }
  if (groundNodes.length < groundTargetCount) {
    throw new Error(`Wetland gameplay generated ${groundNodes.length}/${groundTargetCount} ground nodes`);
  }

  const habitatRegistry = new HabitatRegistry(15);
  habitatRegistry.registerNodes('wetland-floor', groundNodes);
  const nearestTreeProviders = [...wetland.treeProviders]
    .sort((left, right) => (
      left.tree.root.position.distanceToSquared(habitatCenter)
      - right.tree.root.position.distanceToSquared(habitatCenter)
    ))
    .slice(0, 14);
  nearestTreeProviders.forEach(({ providerId, tree }) => habitatRegistry.registerTree(providerId, tree));
  const habitatProviderIds = ['wetland-floor', ...nearestTreeProviders.map(({ providerId }) => providerId)];
  const perchNodes = habitatRegistry.query({ kind: 'perch' });
  const grayMagpieInitialNode = perchNodes
    .filter((node) => node.level === 'high' && node.capabilities.includes('sing'))
    .sort((left, right) => (
      Math.hypot(left.position.x - groundNodes[0].position.x, left.position.z - groundNodes[0].position.z)
      - Math.hypot(right.position.x - groundNodes[0].position.x, right.position.z - groundNodes[0].position.z)
    ))[0]
    ?? perchNodes.find((node) => node.level === 'high')
    ?? perchNodes[0];
  if (!grayMagpieInitialNode) throw new Error('Wetland gameplay requires at least one tree perch');

  const spawnNode = groundNodes.find((node) => (
    Math.hypot(
      node.position.x - groundNodes[0].position.x,
      node.position.z - groundNodes[0].position.z,
    ) > 7
  )) ?? groundNodes[1];
  const spawn = new THREE.Vector3(spawnNode.position.x, spawnNode.position.y, spawnNode.position.z);

  const resolvePlayerMovement = (previous: THREE.Vector3, desired: THREE.Vector3) => {
    const current = new THREE.Vector3(previous.x, 0, previous.z);
    const target = new THREE.Vector3(desired.x, 0, desired.z);
    const distance = current.distanceTo(target);
    const steps = Math.max(1, Math.ceil(distance / 0.22));
    const step = new THREE.Vector3();
    for (let index = 1; index <= steps; index += 1) {
      const next = current.clone().lerp(target, 1 / (steps - index + 1));
      if (isWalkable(next.x, next.z)) {
        current.copy(next);
        continue;
      }
      // Try each tangent independently. This produces a stable slide along
      // a shore, map edge, trunk, or bush instead of radial teleport jitter.
      const xSlide = new THREE.Vector3(next.x, 0, current.z);
      const zSlide = new THREE.Vector3(current.x, 0, next.z);
      if (isWalkable(xSlide.x, xSlide.z)) current.copy(xSlide);
      else if (isWalkable(zSlide.x, zSlide.z)) current.copy(zSlide);
      break;
    }
    step.set(current.x, wetland.field.heightAt(current.x, current.z), current.z);
    desired.copy(step);
  };

  const constrainPlayerPosition = (position: THREE.Vector3) => {
    if (!isWalkable(position.x, position.z)) {
      const originX = position.x;
      const originZ = position.z;
      let found = false;
      for (let radius = 0.15; radius <= 3.5 && !found; radius += 0.15) {
        for (let step = 0; step < 24; step += 1) {
          const angle = step / 24 * Math.PI * 2;
          const x = originX + Math.sin(angle) * radius;
          const z = originZ + Math.cos(angle) * radius;
          if (isWalkable(x, z)) {
            position.set(x, wetland.field.heightAt(x, z), z);
            found = true;
            break;
          }
        }
      }
      if (!found) position.copy(spawn);
      return;
    }
    position.y = wetland.field.heightAt(position.x, position.z);
  };

  const playableHalfWidth = layoutMap.detailWorldWidth * 0.5;
  const playableHalfDepth = layoutMap.detailWorldDepth * 0.5;
  const visualRingPoint = new THREE.Vector3(
    (playableHalfWidth + layoutMap.worldWidth * 0.5) * 0.5,
    0,
    0,
  );
  const sweepResult = spawn.clone();
  resolvePlayerMovement(spawn, sweepResult.set(playableHalfWidth + 8, 0, spawn.z));
  const diagonalResult = spawn.clone();
  resolvePlayerMovement(spawn, diagonalResult.set(
    playableHalfWidth + 5,
    0,
    playableHalfDepth - 9,
  ));
  const airWallProbe = {
    visualRingRejected: layoutMap.containsWorldPoint(visualRingPoint.x, visualRingPoint.z)
      && !isTerrainWalkable(visualRingPoint.x, visualRingPoint.z),
    sweptMovementContained: layoutMap.containsDetailPoint(
      sweepResult.x,
      sweepResult.z,
      playerRadius,
    ),
    diagonalMovementContained: layoutMap.containsDetailPoint(
      diagonalResult.x,
      diagonalResult.z,
      playerRadius,
    ),
  };

  return {
    root,
    wetland,
    habitatRegistry,
    groundLeaves: [],
    blackbirdInitialNodeId: groundNodes[0].id,
    grayMagpieInitialNodeId: grayMagpieInitialNode.id,
    habitatProviderIds,
    spawn,
    playableDomain: {
      shape: 'rectangle',
      width: layoutMap.detailWorldWidth,
      depth: layoutMap.detailWorldDepth,
    },
    airWallProbe,
    sampleHeight: wetland.field.heightAt,
    isTerrainWalkable,
    isWalkable,
    resolvePlayerMovement,
    constrainPlayerPosition,
    locationAt(position) {
      const sample = wetland.field.sample(position.x, position.z);
      if (sample.pathSurface > 0.35) return 'wetland-path';
      if (sample.pondDistance < 1.6) return 'wetland-shore';
      return 'wetland-meadow';
    },
    update(elapsed, camera) {
      const wind = weather.update(elapsed, camera.position, camera);
      if (camera instanceof THREE.PerspectiveCamera) {
        wetland.update(elapsed, wind, camera, lighting.fog);
      } else {
        wetland.update(elapsed, wind);
      }
      objectShadow.updateLighting(lighting.keyLight);
      return wind;
    },
    updateFinalGroundColor(activeRenderer, activeScene) {
      wetland.updateGrassFinalGroundColor(activeRenderer, activeScene);
    },
    render(activeCamera) {
      syncGodRaySize();
      godRays.render(renderer, scene, activeCamera, lighting.keyLight);
    },
    dispose() {
      godRays.dispose();
      objectShadow.dispose();
      scene.remove(root);
      wetland.dispose();
      weather.dispose();
    },
  };
};
