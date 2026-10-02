import * as THREE from 'three';
import type { WetlandWindFrame } from './wetland-weather';
import type {
  StylizedEnvironmentFeatures,
  StylizedEnvironmentMaterialLook,
} from '../rendering/stylized-environment-material';

// Technique adapted from boona13/threejs-grass-water-shaders (MIT, 2026).
// Local source mirror: Tools/threejs-grass-water-shaders/src/grass/.

export type WetlandBoonaPlacementMode = 'grid' | 'jitter';
export type WetlandBoonaGrassShape = 'legacy' | 'rounded';

export type WetlandBoonaGrassSample = Readonly<{
  height: number;
  meadow: number;
  growth?: number;
  shore: number;
  path: number;
  slope: number;
  normal?: readonly [number, number, number];
  rootColor: THREE.ColorRepresentation;
}>;

export type WetlandBoonaGrassField = Readonly<{
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  spacing: number;
  sample: (x: number, z: number) => WetlandBoonaGrassSample;
}>;

export type WetlandBoonaDiagnostics = Readonly<{
  candidates: number;
  gridTufts: number;
  jitterTufts: number;
  bladesPerTuft: number;
  jitterRejected: Readonly<{
    outsideMeadow: number;
    shore: number;
    path: number;
    slope: number;
    thinning: number;
  }>;
}>;

export type WetlandBoonaGrassRenderer = Readonly<{
  id: 'boona';
  label: 'Boona';
  object: THREE.Object3D;
  count: number;
  diagnostics: WetlandBoonaDiagnostics;
  setVisible: (visible: boolean) => void;
  setPlacementMode: (mode: WetlandBoonaPlacementMode) => void;
  setDebugVisible: (visible: boolean) => void;
  syncLighting: (
    hemisphereLight: THREE.HemisphereLight,
    keyLight: THREE.DirectionalLight,
    fillLight: THREE.DirectionalLight,
    rimLight: THREE.DirectionalLight,
  ) => void;
  setStylizedLook: (look: StylizedEnvironmentMaterialLook) => void;
  setStylizedFeatures: (features: Partial<StylizedEnvironmentFeatures>) => void;
  setLightingVersion: (version: 'elemental' | 'reference') => void;
  setGroundIntegration: (enabled: boolean) => void;
  setGroundTipLift: (amount: number) => void;
  setFinalGroundColor: (
    texture: THREE.Texture,
    worldSize: THREE.Vector2,
    enabled: boolean,
  ) => void;
  update: (elapsed: number, wind?: WetlandWindFrame) => void;
  dispose: () => void;
}>;

export type WetlandBoonaGrassOptions = Readonly<{
  name: string;
  seed: number;
  bladeCount: number;
  shape: WetlandBoonaGrassShape;
  segments: number;
  bladeWidth: number;
  heightRange: readonly [number, number];
  widthRange: readonly [number, number];
  colors: Readonly<{
    base: THREE.ColorRepresentation;
    tip: THREE.ColorRepresentation;
  }>;
  bendStrength: number;
  bendResponse: number;
  directionSpread: number;
  growthMin: readonly [number, number, number];
  stylizedLook?: StylizedEnvironmentMaterialLook;
}>;

type Candidate = Readonly<{
  grid: THREE.Vector3;
  jitter: THREE.Vector3;
  gridWeight: number;
  jitterWeight: number;
  gridGrowth: number;
  jitterGrowth: number;
  gate: number;
  rotation: number;
  height: number;
  width: number;
  variation: number;
  gridRootColor: THREE.Color;
  jitterRootColor: THREE.Color;
  gridNormal: THREE.Vector3;
  jitterNormal: THREE.Vector3;
  gridReason: RejectReason;
  jitterReason: RejectReason;
}>;

type RejectReason = 'accepted' | 'outsideMeadow' | 'shore' | 'path' | 'slope' | 'thinning';

const defaultWindFrame: WetlandWindFrame = {
  direction: new THREE.Vector2(Math.cos(0.56), Math.sin(0.56)),
  speed: 0.74,
  strength: 1,
  gustStrength: 0.55,
  sway: 0,
};

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const mulberry32 = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const slopeAllowance = (slope: number) => 1 - smoothstep(0.28, 0.65, slope);

const sampleWeight = (sample: WetlandBoonaGrassSample) => (
  THREE.MathUtils.clamp(sample.meadow, 0, 1)
  * THREE.MathUtils.clamp(sample.shore, 0, 1)
  * THREE.MathUtils.clamp(sample.path, 0, 1)
  * slopeAllowance(sample.slope)
);

const rejectReason = (sample: WetlandBoonaGrassSample, gate: number): RejectReason => {
  if (sample.shore < 0.5) return 'shore';
  if (sample.path < 0.5) return 'path';
  if (slopeAllowance(sample.slope) < 0.5) return 'slope';
  if (sample.meadow < 0.0005) return 'outsideMeadow';
  if (gate > sampleWeight(sample)) return 'thinning';
  return 'accepted';
};

const generateCandidates = (
  field: WetlandBoonaGrassField,
  options: WetlandBoonaGrassOptions,
) => {
  const random = mulberry32(options.seed);
  const candidates: Candidate[] = [];
  const jitterRadius = field.spacing * 1.12;
  const startX = field.minX + field.spacing * 0.5;
  const startZ = field.minZ + field.spacing * 0.5;

  for (let x = startX; x < field.maxX; x += field.spacing) {
    for (let z = startZ; z < field.maxZ; z += field.spacing) {
      const jitterX = x + (random() * 2 - 1) * jitterRadius;
      const jitterZ = z + (random() * 2 - 1) * jitterRadius;
      const gridSample = field.sample(x, z);
      const jitterSample = field.sample(jitterX, jitterZ);
      const gate = random();
      candidates.push({
        grid: new THREE.Vector3(x, gridSample.height + 0.012, z),
        jitter: new THREE.Vector3(jitterX, jitterSample.height + 0.012, jitterZ),
        gridWeight: sampleWeight(gridSample),
        jitterWeight: sampleWeight(jitterSample),
        gridGrowth: THREE.MathUtils.clamp(gridSample.growth ?? 1, 0, 1),
        jitterGrowth: THREE.MathUtils.clamp(jitterSample.growth ?? 1, 0, 1),
        gate,
        rotation: random() * Math.PI * 2,
        height: THREE.MathUtils.lerp(options.heightRange[0], options.heightRange[1], random()),
        width: THREE.MathUtils.lerp(options.widthRange[0], options.widthRange[1], random()),
        variation: random(),
        gridRootColor: new THREE.Color(gridSample.rootColor),
        jitterRootColor: new THREE.Color(jitterSample.rootColor),
        gridNormal: new THREE.Vector3(...(gridSample.normal ?? [0, 1, 0])).normalize(),
        jitterNormal: new THREE.Vector3(...(jitterSample.normal ?? [0, 1, 0])).normalize(),
        gridReason: rejectReason(gridSample, gate),
        jitterReason: rejectReason(jitterSample, gate),
      });
    }
  }
  return candidates;
};

const createLegacyTuftGeometry = (bladeCount = 3, segments = 4, width = 0.065) => {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const lean = 0.1;

  for (let bladeIndex = 0; bladeIndex < bladeCount; bladeIndex += 1) {
    const angle = (bladeIndex / bladeCount) * Math.PI;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const vertexOffset = positions.length / 3;

    for (let row = 0; row < segments; row += 1) {
      const t = row / segments;
      const halfWidth = width * 0.5 * Math.pow(1 - t, 1.2);
      const bend = lean * t * t;
      positions.push(
        -halfWidth * cosine + bend * sine, t, halfWidth * sine + bend * cosine,
        halfWidth * cosine + bend * sine, t, -halfWidth * sine + bend * cosine,
      );
      uvs.push(0, t, 1, t);

      if (row < segments - 1) {
        const base = vertexOffset + row * 2;
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }

    const tip = vertexOffset + segments * 2;
    positions.push(lean * sine, 1, lean * cosine);
    uvs.push(0.5, 1);
    const finalLeft = vertexOffset + (segments - 1) * 2;
    indices.push(finalLeft, finalLeft + 1, tip);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
};

const createRoundedTuftGeometry = (bladeCount = 3, segments = 6, width = 0.065) => {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const widthProfile = (t: number) => {
    if (t < 0.56) {
      return THREE.MathUtils.lerp(0.62, 1, smoothstep(0, 0.56, t));
    }
    return THREE.MathUtils.lerp(1, 0.52, smoothstep(0.56, 1, t));
  };

  for (let bladeIndex = 0; bladeIndex < bladeCount; bladeIndex += 1) {
    const angle = (bladeIndex / bladeCount) * Math.PI;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const vertexOffset = positions.length / 3;

    for (let row = 0; row <= segments; row += 1) {
      const t = (row / segments) * 0.94;
      const halfWidth = width * 0.5 * widthProfile(t);
      const ridge = width * 0.105 * Math.sin(Math.PI * t);
      positions.push(
        -halfWidth * cosine, t, halfWidth * sine,
        ridge * sine, t, ridge * cosine,
        halfWidth * cosine, t, -halfWidth * sine,
      );
      uvs.push(0, t, 0.5, t, 1, t);

      if (row < segments) {
        const base = vertexOffset + row * 3;
        const next = base + 3;
        indices.push(
          base, base + 1, next,
          base + 1, next + 1, next,
          base + 1, base + 2, next + 1,
          base + 2, next + 2, next + 1,
        );
      }
    }

    const tip = vertexOffset + (segments + 1) * 3;
    positions.push(0, 1, 0);
    uvs.push(0.5, 1);
    const finalLeft = vertexOffset + segments * 3;
    indices.push(
      finalLeft, finalLeft + 1, tip,
      finalLeft + 1, finalLeft + 2, tip,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
};

const windLattice = /* glsl */`
  float windHash(uvec2 point) {
    uint y = point.y;
    uint hash = y + (y << 10u);
    hash ^= hash >> 6u;
    hash += hash << 3u;
    hash ^= hash >> 11u;
    uint x = point.x;
    hash = ((x * 1664525u) + (hash + (hash << 15u)) + 1013904223u) * 1664525u;
    hash ^= hash >> 11u;
    hash ^= (hash << 7u) & 2636928640u;
    hash ^= (hash << 15u) & 4022730752u;
    hash ^= hash >> 18u;
    return uintBitsToFloat((hash & 8388607u) | 1065353216u) - 1.0;
  }

  float windNoise(vec2 worldXZ, float time) {
    vec2 uv = worldXZ * 0.1 + vec2(time * 1.2, 0.0);
    ivec2 cell = ivec2(floor(uv));
    vec2 local = fract(uv);
    vec2 eased = local * local * (3.0 - 2.0 * local);
    float n00 = windHash(uvec2(cell));
    float n10 = windHash(uvec2(cell + ivec2(1, 0)));
    float n01 = windHash(uvec2(cell + ivec2(0, 1)));
    float n11 = windHash(uvec2(cell + ivec2(1)));
    return mix(mix(n00, n10, eased.x), mix(n01, n11, eased.x), eased.y);
  }
`;

const vertexShader = /* glsl */`
  precision highp float;
  precision highp int;

  #include <common>
  #include <shadowmap_pars_vertex>

  attribute vec3 aJitterOffset;
  attribute float aGridWeight;
  attribute float aJitterWeight;
  attribute float aGridGrowth;
  attribute float aJitterGrowth;
  attribute float aGate;
  attribute float aVariation;
  attribute vec3 aGridRootColor;
  attribute vec3 aJitterRootColor;

  uniform float uTime;
  uniform float uWindSpeed;
  uniform float uJitterAmount;
  uniform float uWindStrength;
  uniform float uGustStrength;
  uniform float uBendStrength;
  uniform float uBendResponse;
  uniform float uDirectionSpread;
  uniform vec3 uGrowthMin;
  uniform vec2 uWindDirection;

  varying float vGradient;
  varying float vVariation;
  varying vec3 vRootColor;
  varying float vFogDepth;
  varying vec3 vLightingNormal;
  varying vec3 vGroundLightingNormal;
  varying vec3 vStylizedWorldPosition;
  varying vec2 vGroundSampleWorld;

  ${windLattice}

  void main() {
    float weight = mix(aGridWeight, aJitterWeight, uJitterAmount);
    if (aGate > weight || weight <= 0.004) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    vec3 transformed = position;
    float gradient = uv.y;
    float tipWeight = gradient * gradient;
    float growth = mix(aGridGrowth, aJitterGrowth, uJitterAmount);
    transformed.x *= mix(uGrowthMin.x, 1.0, growth);
    transformed.y *= mix(uGrowthMin.y, 1.0, growth);
    transformed.z *= mix(uGrowthMin.z, 1.0, growth);
    vec3 gridOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 instanceOrigin = gridOrigin + aJitterOffset * uJitterAmount;
    float viewDistance = length(cameraPosition - instanceOrigin);
    float widthBoost = 1.0 + smoothstep(12.0, 28.0, viewDistance) * 0.14;
    float windDamping = 1.0 - smoothstep(14.0, 30.0, viewDistance) * 0.45;

    transformed.x *= widthBoost;
    mat3 instanceBasis = mat3(modelMatrix) * mat3(instanceMatrix);
    vec2 windDirection = normalize(uWindDirection);
    float directionOffset = (aVariation - 0.5) * uDirectionSpread * 1.2;
    float directionCosine = cos(directionOffset);
    float directionSine = sin(directionOffset);
    vec2 bladeWindDirection = vec2(
      windDirection.x * directionCosine - windDirection.y * directionSine,
      windDirection.x * directionSine + windDirection.y * directionCosine
    );
    vec2 perpendicular = vec2(-windDirection.y, windDirection.x);
    float primaryWave = sin(
      dot(instanceOrigin.xz, windDirection) * 0.5 + uTime * 1.1 * uWindSpeed
    );
    float secondaryWave = sin(
      dot(instanceOrigin.xz, perpendicular) * 0.83 + uTime * 0.73 * uWindSpeed
    ) * uGustStrength;
    float turbulence = (windNoise(instanceOrigin.xz + vec2(13.7, -9.1), uTime * 0.62) - 0.5) * 0.34;
    float windAmount = (
      (primaryWave + secondaryWave + turbulence) * 0.105 * uWindStrength
      + uBendStrength * uBendResponse
    ) * windDamping;
    vec3 worldWind = vec3(bladeWindDirection.x, 0.0, bladeWindDirection.y) * windAmount;
    vec3 axisX = vec3(instanceBasis[0]);
    vec3 axisY = vec3(instanceBasis[1]);
    vec3 axisZ = vec3(instanceBasis[2]);
    vec3 localWind = vec3(
      dot(worldWind, axisX) / max(dot(axisX, axisX), 0.00001),
      dot(worldWind, axisY) / max(dot(axisY, axisY), 0.00001),
      dot(worldWind, axisZ) / max(dot(axisZ, axisZ), 0.00001)
    );
    transformed += localWind * tipWeight;

    vec3 grassWorldPosition = instanceOrigin + instanceBasis * transformed;
    vec4 worldPosition = vec4(grassWorldPosition, 1.0);
    vGradient = gradient;
    vVariation = aVariation;
    vRootColor = mix(aGridRootColor, aJitterRootColor, uJitterAmount);
    vec3 worldNormal = normalize(instanceBasis * normal);
    vec3 grassLightingNormal = normalize(worldNormal * 0.35 + vec3(0.0, 1.0, 0.0) * 0.65);
    vec3 transformedNormal = normalize(mat3(viewMatrix) * grassLightingNormal);
    vec3 groundWorldNormal = normalize(instanceBasis * vec3(0.0, 1.0, 0.0));
    vLightingNormal = transformedNormal;
    vGroundLightingNormal = normalize(mat3(viewMatrix) * groundWorldNormal);
    vStylizedWorldPosition = grassWorldPosition;
    vGroundSampleWorld = instanceOrigin.xz;
    vec4 viewPosition = viewMatrix * worldPosition;
    vFogDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
    #include <shadowmap_vertex>
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;

  #include <common>
  #include <packing>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>

  uniform vec3 uGrassTip;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  uniform vec3 uKeyDirection;
  uniform vec3 uFillDirection;
  uniform vec3 uFillColor;
  uniform float uFillIntensity;
  uniform vec3 uRimDirection;
  uniform vec3 uRimColor;
  uniform float uRimIntensity;
  uniform vec3 uLitTint;
  uniform float uLitTintAmount;
  uniform float uLitIntensity;
  uniform vec3 uShadowColor;
  uniform float uShadowBaseStrength;
  uniform float uShadowColorMix;
  uniform vec3 uBounceColor;
  uniform float uBounceStrength;
  uniform float uBounceDistance;
  uniform float uGroundY;
  uniform float uCoreShadowLow;
  uniform float uCoreShadowHigh;
  uniform float uCoreShadowEnabled;
  uniform float uDropShadowEnabled;
  uniform float uGroundBounceEnabled;
  uniform float uElementalLightingEnabled;
  uniform float uGroundIntegrationEnabled;
  uniform float uGroundTipLift;
  uniform sampler2D uFinalGroundColorMap;
  uniform vec2 uFinalGroundWorldSize;
  uniform float uFinalGroundColorEnabled;

  varying float vGradient;
  varying float vVariation;
  varying vec3 vRootColor;
  varying float vFogDepth;
  varying vec3 vLightingNormal;
  varying vec3 vGroundLightingNormal;
  varying vec3 vStylizedWorldPosition;
  varying vec2 vGroundSampleWorld;
  out vec4 fragColor;
  #define gl_FragColor fragColor

  void main() {
    float legacyTipBlend = smoothstep(0.38, 1.0, vGradient);
    // The integrated path has exactly two authored bands. Keep the terrain
    // root through the lower blade, then make one compact transition into the
    // tip instead of stacking legacy-root, root, tint and highlight bands.
    float integratedTipBlend = smoothstep(0.08, 0.92, vGradient);
    float tipBlend = mix(legacyTipBlend, integratedTipBlend, uGroundIntegrationEnabled);
    float groundBlend = uGroundIntegrationEnabled;
    // Each instance already stores the appearance color at its foot. The old
    // green multiplier detached that color from the terrain as soon as terrain
    // received its own lighting. At the root, keep the same albedo instead.
    vec3 legacyGrassRoot = vRootColor * vec3(0.35, 0.47, 0.64);
    vec3 terrainMatchedRoot = mix(legacyGrassRoot, vRootColor, groundBlend);
    // Derive the integrated tip from this blade's own terrain root. A uniform
    // RGB lift preserves the root hue instead of steering every blade toward
    // the old fixed yellow-green tip.
    vec3 derivedTip = min(vRootColor * (1.0 + uGroundTipLift), vec3(1.0));
    vec3 bladeTip = mix(uGrassTip, derivedTip, uGroundIntegrationEnabled);
    vec3 baseColor = mix(terrainMatchedRoot, bladeTip, tipBlend);
    if (uFinalGroundColorEnabled > 0.5) {
      vec2 groundUv = vec2(
        vGroundSampleWorld.x / uFinalGroundWorldSize.x + 0.5,
        0.5 - vGroundSampleWorld.y / uFinalGroundWorldSize.y
      );
      vec4 finalGroundSample = texture2D(
        uFinalGroundColorMap,
        clamp(groundUv, vec2(0.0), vec2(1.0))
      );
      // The overhead capture clears to transparent black, but the standard
      // material pipeline is not required to preserve alpha in every render
      // target configuration. Treat any non-black captured color as terrain
      // too, otherwise a valid lit ground pixel silently falls back to the
      // darker authored root color in backlit views.
      float finalGroundCoverage = step(
        0.001,
        max(finalGroundSample.a, max(finalGroundSample.r, max(finalGroundSample.g, finalGroundSample.b)))
      );
      vec3 finalGroundColor = mix(vRootColor, finalGroundSample.rgb, finalGroundCoverage);
      vec3 finalGroundTip = min(finalGroundColor * (1.0 + uGroundTipLift), vec3(1.0));
      vec3 color = mix(finalGroundColor, finalGroundTip, integratedTipBlend);
      color = mix(color, fogColor, smoothstep(fogNear, fogFar, vFogDepth));
      fragColor = vec4(color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      return;
    }
    vec3 worldNormal = normalize(inverseTransformDirection(normalize(vLightingNormal), viewMatrix));
    vec3 viewNormal = normalize(vLightingNormal);
    vec3 groundWorldNormal = normalize(inverseTransformDirection(
      normalize(vGroundLightingNormal),
      viewMatrix
    ));
    vec3 groundViewNormal = normalize(vGroundLightingNormal);
    worldNormal = normalize(mix(worldNormal, groundWorldNormal, groundBlend));
    viewNormal = normalize(mix(viewNormal, groundViewNormal, groundBlend));

    // Elemental Serenity uses standard light irradiance: one shadowed key,
    // unshadowed fill/rim directionals and ambient illumination. Keep the
    // wetland blade's authored root/tip color as the diffuse albedo.
    vec3 elementalIrradiance = ambientLightColor;
    vec3 terrainRootIrradiance = ambientLightColor;
    vec3 rootKeyIrradiance = vec3(0.0);
    float rootKeyShadow = 1.0;
    #if NUM_DIR_LIGHTS > 0
      #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
        rootKeyShadow = getShadow(
          directionalShadowMap[0],
          directionalLightShadows[0].shadowMapSize,
          directionalLightShadows[0].shadowIntensity,
          directionalLightShadows[0].shadowBias,
          directionalLightShadows[0].shadowRadius,
          vDirectionalShadowCoord[0]
        );
      #endif
      elementalIrradiance += directionalLights[0].color
        * max(dot(viewNormal, directionalLights[0].direction), 0.0)
        * mix(1.0, rootKeyShadow, uDropShadowEnabled);
      rootKeyIrradiance = directionalLights[0].color
        * max(dot(groundViewNormal, directionalLights[0].direction), 0.0);
      terrainRootIrradiance += rootKeyIrradiance
        * mix(1.0, rootKeyShadow, uDropShadowEnabled);
    #endif
    #if NUM_DIR_LIGHTS > 1
      elementalIrradiance += directionalLights[1].color
        * max(dot(viewNormal, directionalLights[1].direction), 0.0);
      terrainRootIrradiance += directionalLights[1].color
        * max(dot(groundViewNormal, directionalLights[1].direction), 0.0);
    #endif
    #if NUM_DIR_LIGHTS > 2
      elementalIrradiance += directionalLights[2].color
        * max(dot(viewNormal, directionalLights[2].direction), 0.0);
      terrainRootIrradiance += directionalLights[2].color
        * max(dot(groundViewNormal, directionalLights[2].direction), 0.0);
    #endif
    // MeshStandardMaterial applies Lambert's reciprocal-pi normalization to
    // every diffuse light contribution. Keep the grass root on that same
    // scale or the shared terrain albedo becomes an overbright yellow-green.
    // Keep a restrained part of the same key response in a cast shadow. This
    // avoids a black-green root while preserving the shadow direction.
    terrainRootIrradiance += rootKeyIrradiance
      * (1.0 - rootKeyShadow) * uDropShadowEnabled * 0.46;
    terrainRootIrradiance *= RECIPROCAL_PI;
    float terrainKeyFacing = max(dot(groundWorldNormal, normalize(uKeyDirection)), 0.0);
    float terrainFlatFacing = max(normalize(uKeyDirection).y, 0.15);
    float terrainBackSlope = max(terrainFlatFacing - terrainKeyFacing, 0.0) / terrainFlatFacing;
    float terrainSlopeShade = 1.0 - smoothstep(0.02, 0.62, terrainBackSlope)
      * 0.18;
    terrainRootIrradiance *= terrainSlopeShade;
    vec3 elementalColor = baseColor * mix(
      elementalIrradiance,
      terrainRootIrradiance,
      groundBlend
    );
    float downwardFacing = smoothstep(0.08, 0.82, -worldNormal.y);
    float heightFromGround = max(vStylizedWorldPosition.y - uGroundY, 0.0);
    float bounceProximity = pow(max(1.0 - heightFromGround / max(uBounceDistance, 0.001), 0.0), 2.0);
    float bounceMix = downwardFacing * bounceProximity * uBounceStrength * uGroundBounceEnabled;
    vec3 litTint = mix(vec3(1.0), uLitTint, uLitTintAmount);
    vec3 litColor = baseColor * litTint * uLitIntensity;
    float coreShadow = (1.0 - smoothstep(
      uCoreShadowLow,
      uCoreShadowHigh,
      dot(worldNormal, normalize(uKeyDirection))
    )) * uCoreShadowEnabled;
    float dropShadow = 0.0;
    #if NUM_DIR_LIGHTS > 0
      float keyShadow = 1.0;
      #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
        keyShadow = getShadow(
          directionalShadowMap[0],
          directionalLightShadows[0].shadowMapSize,
          directionalLightShadows[0].shadowIntensity,
          directionalLightShadows[0].shadowBias,
          directionalLightShadows[0].shadowRadius,
          vDirectionalShadowCoord[0]
        );
      #endif
      dropShadow = (1.0 - keyShadow) * uDropShadowEnabled;
    #endif
    float combinedShadow = clamp(max(coreShadow, dropShadow), 0.0, 1.0);
    vec3 shadowColor = mix(baseColor * uShadowBaseStrength, uShadowColor, uShadowColorMix);
    vec3 shadedColor = mix(litColor, shadowColor, combinedShadow);
    float fillFacing = max(dot(worldNormal, normalize(uFillDirection)), 0.0);
    float fillAmount = fillFacing * uFillIntensity * 0.14 * combinedShadow;
    vec3 filledColor = shadedColor + baseColor * uFillColor * fillAmount;
    vec3 viewDirection = normalize(cameraPosition - vStylizedWorldPosition);
    float viewEdge = pow(1.0 - clamp(dot(worldNormal, viewDirection), 0.0, 1.0), 2.5);
    float rimFacing = smoothstep(-0.15, 0.65, dot(worldNormal, normalize(uRimDirection)));
    float rimAmount = viewEdge * rimFacing * uRimIntensity * 0.22;
    vec3 referenceColor = mix(filledColor, uBounceColor, clamp(bounceMix, 0.0, 1.0));
    referenceColor += uRimColor * rimAmount;
    vec3 color = mix(referenceColor, elementalColor, uElementalLightingEnabled);
    color = mix(color, fogColor, smoothstep(fogNear, fogFar, vFogDepth));
    fragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const reasonColors: Readonly<Record<RejectReason, THREE.ColorRepresentation>> = {
  accepted: '#67df72',
  outsideMeadow: '#687d73',
  shore: '#58b8e8',
  path: '#f0c25c',
  slope: '#ef6f73',
  thinning: '#b195c8',
};

const createDebugPoints = (candidates: readonly Candidate[], mode: WetlandBoonaPlacementMode) => {
  const positions = new Float32Array(candidates.length * 3);
  const colors = new Float32Array(candidates.length * 3);
  const color = new THREE.Color();
  candidates.forEach((candidate, index) => {
    const position = mode === 'grid' ? candidate.grid : candidate.jitter;
    const reason = mode === 'grid' ? candidate.gridReason : candidate.jitterReason;
    positions[index * 3] = position.x;
    positions[index * 3 + 1] = position.y + 0.07;
    positions[index * 3 + 2] = position.z;
    color.set(reasonColors[reason]);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.065,
    sizeAttenuation: true,
    vertexColors: true,
    depthWrite: false,
    opacity: 0.92,
    transparent: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = `wetland-boona-${mode}-diagnostics`;
  points.renderOrder = 8;
  return points;
};

export const createWetlandBoonaGrassRenderer = (
  field: WetlandBoonaGrassField,
  inputOptions: Partial<WetlandBoonaGrassOptions> = {},
): WetlandBoonaGrassRenderer => {
  const options: WetlandBoonaGrassOptions = {
    name: inputOptions.name ?? 'boona',
    seed: inputOptions.seed ?? 0xb00a13,
    bladeCount: inputOptions.bladeCount ?? 1,
    shape: inputOptions.shape ?? 'rounded',
    segments: inputOptions.segments ?? 6,
    bladeWidth: inputOptions.bladeWidth ?? 0.065,
    heightRange: inputOptions.heightRange ?? [0.42, 0.68],
    widthRange: inputOptions.widthRange ?? [0.88, 1.16],
    colors: inputOptions.colors ?? {
      base: '#7fae58',
      tip: '#c5d87c',
    },
    bendStrength: inputOptions.bendStrength ?? 0.18,
    bendResponse: inputOptions.bendResponse ?? 0.72,
    directionSpread: inputOptions.directionSpread ?? 1.6,
    growthMin: inputOptions.growthMin ?? [0.42, 0.22, 0.42],
    stylizedLook: inputOptions.stylizedLook,
  };
  const stylizedLook = options.stylizedLook ?? {
    enabled: true,
    litTint: '#ffd7aa',
    litTintAmount: 0.1,
    litIntensity: 1.28,
    shadowColor: '#66729a',
    shadowBaseStrength: 0.78,
    shadowColorMix: 0.08,
    bounceColor: '#9eb774',
    bounceStrength: 0.42,
    bounceDistance: 1.65,
    groundY: -0.05,
    coreShadowLow: -0.3,
    coreShadowHigh: 0.18,
  };
  const bladeCount = options.bladeCount;
  const candidates = generateCandidates(field, options);
  const renderCandidates = candidates.filter((candidate) => (
    candidate.gate <= Math.max(candidate.gridWeight, candidate.jitterWeight)
  ));
  const geometry = options.shape === 'legacy'
    ? createLegacyTuftGeometry(bladeCount, options.segments, options.bladeWidth)
    : createRoundedTuftGeometry(bladeCount, options.segments, options.bladeWidth);
  const jitterOffsets = new Float32Array(renderCandidates.length * 3);
  const gridWeights = new Float32Array(renderCandidates.length);
  const jitterWeights = new Float32Array(renderCandidates.length);
  const gridGrowth = new Float32Array(renderCandidates.length);
  const jitterGrowth = new Float32Array(renderCandidates.length);
  const gates = new Float32Array(renderCandidates.length);
  const variations = new Float32Array(renderCandidates.length);
  const gridRootColors = new Float32Array(renderCandidates.length * 3);
  const jitterRootColors = new Float32Array(renderCandidates.length * 3);
  const fallbackGroundColorTexture = new THREE.DataTexture(
    new Uint8Array([255, 255, 255, 255]),
    1,
    1,
    THREE.RGBAFormat,
  );
  fallbackGroundColorTexture.needsUpdate = true;

  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    side: THREE.DoubleSide,
    fog: true,
    lights: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
      uTime: { value: 0 },
      uWindSpeed: { value: 0.74 },
      uJitterAmount: { value: 1 },
      uWindStrength: { value: 1 },
      uGustStrength: { value: 0.55 },
      uBendStrength: { value: options.bendStrength },
      uBendResponse: { value: options.bendResponse },
      uDirectionSpread: { value: options.directionSpread },
      uGrowthMin: { value: new THREE.Vector3(...options.growthMin) },
      uWindDirection: { value: new THREE.Vector2(Math.cos(0.56), Math.sin(0.56)) },
      uGrassTip: { value: new THREE.Color(options.colors.tip) },
      uKeyDirection: { value: new THREE.Vector3(-0.42, 0.76, 0.49).normalize() },
      uFillDirection: { value: new THREE.Vector3(0.62, 0.42, -0.66).normalize() },
      uFillColor: { value: new THREE.Color('#8fb8c4') },
      uFillIntensity: { value: 0 },
      uRimDirection: { value: new THREE.Vector3(0.48, 0.64, -0.60).normalize() },
      uRimColor: { value: new THREE.Color('#d8eff1') },
      uRimIntensity: { value: 0 },
      uLitTint: { value: new THREE.Color(stylizedLook.litTint) },
      uLitTintAmount: { value: stylizedLook.litTintAmount },
      uLitIntensity: { value: stylizedLook.litIntensity },
      uShadowColor: { value: new THREE.Color(stylizedLook.shadowColor) },
      uShadowBaseStrength: { value: stylizedLook.shadowBaseStrength },
      uShadowColorMix: { value: stylizedLook.shadowColorMix },
      uBounceColor: { value: new THREE.Color(stylizedLook.bounceColor) },
      uBounceStrength: { value: stylizedLook.bounceStrength },
      uBounceDistance: { value: stylizedLook.bounceDistance },
      uGroundY: { value: stylizedLook.groundY },
      uCoreShadowLow: { value: stylizedLook.coreShadowLow },
      uCoreShadowHigh: { value: stylizedLook.coreShadowHigh },
      uCoreShadowEnabled: { value: 1 },
      uDropShadowEnabled: { value: 1 },
      uGroundBounceEnabled: { value: 1 },
      uElementalLightingEnabled: { value: 1 },
      uGroundIntegrationEnabled: { value: 1 },
      uGroundTipLift: { value: 0.26 },
      uFinalGroundColorMap: { value: fallbackGroundColorTexture },
      uFinalGroundWorldSize: { value: new THREE.Vector2(1, 1) },
      uFinalGroundColorEnabled: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, renderCandidates.length);
  mesh.name = `wetland-grass-${options.name}-jittered-tufts`;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  renderCandidates.forEach((candidate, index) => {
    quaternion.setFromUnitVectors(up, candidate.jitterNormal);
    spin.setFromAxisAngle(up, candidate.rotation);
    quaternion.multiply(spin);
    // Width scales the ribbon's X axis only. Keeping Z unscaled preserves the
    // geometry's world-space lean instead of flattening it on narrow blades.
    scale.set(candidate.width, candidate.height, 1);
    matrix.compose(candidate.grid, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    jitterOffsets[index * 3] = candidate.jitter.x - candidate.grid.x;
    jitterOffsets[index * 3 + 1] = candidate.jitter.y - candidate.grid.y;
    jitterOffsets[index * 3 + 2] = candidate.jitter.z - candidate.grid.z;
    gridWeights[index] = candidate.gridWeight;
    jitterWeights[index] = candidate.jitterWeight;
    gridGrowth[index] = candidate.gridGrowth;
    jitterGrowth[index] = candidate.jitterGrowth;
    gates[index] = candidate.gate;
    variations[index] = candidate.variation;
    candidate.gridRootColor.toArray(gridRootColors, index * 3);
    candidate.jitterRootColor.toArray(jitterRootColors, index * 3);
  });
  geometry.setAttribute('aJitterOffset', new THREE.InstancedBufferAttribute(jitterOffsets, 3));
  geometry.setAttribute('aGridWeight', new THREE.InstancedBufferAttribute(gridWeights, 1));
  geometry.setAttribute('aJitterWeight', new THREE.InstancedBufferAttribute(jitterWeights, 1));
  geometry.setAttribute('aGridGrowth', new THREE.InstancedBufferAttribute(gridGrowth, 1));
  geometry.setAttribute('aJitterGrowth', new THREE.InstancedBufferAttribute(jitterGrowth, 1));
  geometry.setAttribute('aGate', new THREE.InstancedBufferAttribute(gates, 1));
  geometry.setAttribute('aVariation', new THREE.InstancedBufferAttribute(variations, 1));
  geometry.setAttribute('aGridRootColor', new THREE.InstancedBufferAttribute(gridRootColors, 3));
  geometry.setAttribute('aJitterRootColor', new THREE.InstancedBufferAttribute(jitterRootColors, 3));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();

  const gridPoints = createDebugPoints(candidates, 'grid');
  const jitterPoints = createDebugPoints(candidates, 'jitter');
  const group = new THREE.Group();
  group.name = `wetland-grass-${options.name}-study`;
  group.add(mesh, gridPoints, jitterPoints);

  let placementMode: WetlandBoonaPlacementMode = 'jitter';
  let debugVisible = false;
  const syncDebug = () => {
    gridPoints.visible = debugVisible && placementMode === 'grid';
    jitterPoints.visible = debugVisible && placementMode === 'jitter';
  };
  syncDebug();

  const jitterRejected = {
    outsideMeadow: candidates.filter((candidate) => candidate.jitterReason === 'outsideMeadow').length,
    shore: candidates.filter((candidate) => candidate.jitterReason === 'shore').length,
    path: candidates.filter((candidate) => candidate.jitterReason === 'path').length,
    slope: candidates.filter((candidate) => candidate.jitterReason === 'slope').length,
    thinning: candidates.filter((candidate) => candidate.jitterReason === 'thinning').length,
  };
  const diagnostics: WetlandBoonaDiagnostics = {
    candidates: candidates.length,
    gridTufts: candidates.filter((candidate) => candidate.gridReason === 'accepted').length,
    jitterTufts: candidates.filter((candidate) => candidate.jitterReason === 'accepted').length,
    bladesPerTuft: bladeCount,
    jitterRejected,
  };

  return {
    id: 'boona',
    label: 'Boona',
    object: group,
    count: diagnostics.jitterTufts * bladeCount,
    diagnostics,
    setVisible(visible) {
      group.visible = visible;
    },
    setPlacementMode(mode) {
      placementMode = mode;
      material.uniforms.uJitterAmount.value = mode === 'jitter' ? 1 : 0;
      syncDebug();
    },
    setDebugVisible(visible) {
      debugVisible = visible;
      syncDebug();
    },
    syncLighting(_hemisphereLight, keyLight, fillLight, rimLight) {
      material.uniforms.uKeyDirection.value.copy(keyLight.position).sub(keyLight.target.position).normalize();
      material.uniforms.uFillDirection.value.copy(fillLight.position).sub(fillLight.target.position).normalize();
      material.uniforms.uFillColor.value.copy(fillLight.color);
      material.uniforms.uFillIntensity.value = fillLight.intensity;
      material.uniforms.uRimDirection.value.copy(rimLight.position).sub(rimLight.target.position).normalize();
      material.uniforms.uRimColor.value.copy(rimLight.color);
      material.uniforms.uRimIntensity.value = rimLight.intensity;
    },
    setStylizedLook(look) {
      material.uniforms.uLitTint.value.set(look.litTint);
      material.uniforms.uLitTintAmount.value = look.litTintAmount;
      material.uniforms.uLitIntensity.value = look.litIntensity;
      material.uniforms.uShadowColor.value.set(look.shadowColor);
      material.uniforms.uShadowBaseStrength.value = look.shadowBaseStrength;
      material.uniforms.uShadowColorMix.value = look.shadowColorMix;
      material.uniforms.uBounceColor.value.set(look.bounceColor);
      material.uniforms.uBounceStrength.value = look.bounceStrength;
      material.uniforms.uBounceDistance.value = look.bounceDistance;
      material.uniforms.uGroundY.value = look.groundY;
      material.uniforms.uCoreShadowLow.value = look.coreShadowLow;
      material.uniforms.uCoreShadowHigh.value = look.coreShadowHigh;
    },
    setStylizedFeatures(features) {
      if (features.coreShadow !== undefined) material.uniforms.uCoreShadowEnabled.value = features.coreShadow ? 1 : 0;
      if (features.dropShadow !== undefined) material.uniforms.uDropShadowEnabled.value = features.dropShadow ? 1 : 0;
      if (features.groundBounce !== undefined) material.uniforms.uGroundBounceEnabled.value = features.groundBounce ? 1 : 0;
    },
    setLightingVersion(version) {
      material.uniforms.uElementalLightingEnabled.value = version === 'elemental' ? 1 : 0;
    },
    setGroundIntegration(enabled) {
      material.uniforms.uGroundIntegrationEnabled.value = enabled ? 1 : 0;
    },
    setGroundTipLift(amount) {
      material.uniforms.uGroundTipLift.value = THREE.MathUtils.clamp(amount, 0, 0.35);
    },
    setFinalGroundColor(texture, worldSize, enabled) {
      material.uniforms.uFinalGroundColorMap.value = texture;
      material.uniforms.uFinalGroundWorldSize.value.copy(worldSize);
      material.uniforms.uFinalGroundColorEnabled.value = enabled ? 1 : 0;
    },
    update(elapsed, wind = defaultWindFrame) {
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uWindSpeed.value = wind.speed;
      material.uniforms.uWindStrength.value = wind.strength;
      material.uniforms.uGustStrength.value = wind.gustStrength;
      material.uniforms.uWindDirection.value.copy(wind.direction);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      fallbackGroundColorTexture.dispose();
      gridPoints.geometry.dispose();
      (gridPoints.material as THREE.Material).dispose();
      jitterPoints.geometry.dispose();
      (jitterPoints.material as THREE.Material).dispose();
    },
  };
};
