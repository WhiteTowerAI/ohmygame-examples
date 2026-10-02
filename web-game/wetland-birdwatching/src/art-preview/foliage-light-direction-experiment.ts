import * as THREE from 'three';

type FoliagePlantKind = 'tree' | 'bush';

export type FoliageTreeColorMode = 'gradient-detail' | 'card-bands' | 'continuous' | 'hard-bands';
export type FoliageTreePaletteStyle = 'authored-three-color' | 'sakura-green';

type FoliagePlantSource = Readonly<{
  kind: FoliagePlantKind;
  root: THREE.Object3D;
}>;

type ExperimentUniforms = Readonly<{
  center: THREE.IUniform<THREE.Vector3>;
  heightRange: THREE.IUniform<THREE.Vector2>;
  horizontalRadius: THREE.IUniform<number>;
  lightDirection: THREE.IUniform<THREE.Vector3>;
  heightInfluence: THREE.IUniform<number>;
  detailStrength: THREE.IUniform<number>;
  treeCrownMode: THREE.IUniform<number>;
  treeColorMode: THREE.IUniform<number>;
  treePaletteStyle: THREE.IUniform<number>;
  forestOcclusionStrength: THREE.IUniform<number>;
  shadowColor: THREE.IUniform<THREE.Color>;
  midColor: THREE.IUniform<THREE.Color>;
  highlightColor: THREE.IUniform<THREE.Color>;
  keyColor: THREE.IUniform<THREE.Color>;
  keyIntensity: THREE.IUniform<number>;
  fillColor: THREE.IUniform<THREE.Color>;
  fillIntensity: THREE.IUniform<number>;
  rimColor: THREE.IUniform<THREE.Color>;
  rimIntensity: THREE.IUniform<number>;
  skyColor: THREE.IUniform<THREE.Color>;
  groundColor: THREE.IUniform<THREE.Color>;
  hemisphereIntensity: THREE.IUniform<number>;
  keyResponseStrength: THREE.IUniform<number>;
  skyResponseStrength: THREE.IUniform<number>;
  groundResponseStrength: THREE.IUniform<number>;
  backlightStrength: THREE.IUniform<number>;
}>;

export type FoliageLightingResponse = Readonly<{
  keyEnabled: boolean;
  keyStrength: number;
  skyEnabled: boolean;
  skyStrength: number;
  groundEnabled: boolean;
  groundStrength: number;
  backlightEnabled: boolean;
  backlightStrength: number;
}>;

type FoliageEntry = Readonly<{
  kind: FoliagePlantKind;
  mesh: THREE.InstancedMesh;
  baseMaterial: THREE.Material;
  experimentMaterial: THREE.Material;
}>;

export type FoliageLightDirectionExperiment = Readonly<{
  setActive: (active: boolean) => void;
  setHeightInfluence: (value: number) => void;
  setDetailStrength: (value: number) => void;
  setTreeColorMode: (mode: FoliageTreeColorMode) => void;
  setTreePaletteStyle: (style: FoliageTreePaletteStyle) => void;
  setForestOcclusion: (enabled: boolean, strength: number) => void;
  setLightingResponse: (response: Partial<FoliageLightingResponse>) => void;
  updateKeyDirection: (keyLight: THREE.DirectionalLight) => void;
  updateLighting: (
    keyLight: THREE.DirectionalLight,
    fillLight: THREE.DirectionalLight,
    rimLight: THREE.DirectionalLight,
    environmentLight?: THREE.HemisphereLight | THREE.AmbientLight,
  ) => void;
  update: () => void;
  getSnapshot: () => Readonly<{
    active: boolean;
    heightInfluence: number;
    detailStrength: number;
    treeColorMode: FoliageTreeColorMode;
    treePaletteStyle: FoliageTreePaletteStyle;
    forestOcclusionEnabled: boolean;
    forestOcclusionStrength: number;
    lightingResponse: FoliageLightingResponse;
    plantCount: number;
    meshCount: number;
    treeCount: number;
    bushCount: number;
    mountedMeshCount: number;
    mountedTreeMeshCount: number;
    keyDirection: readonly [number, number, number];
  }>;
  dispose: () => void;
}>;

const vertexPars = /* glsl */ `
varying float vFoliageLightBand;
uniform vec3 uFoliagePlantCenter;
uniform vec2 uFoliageHeightRange;
uniform float uFoliageHorizontalRadius;
uniform vec3 uFoliageLightDirection;
uniform float uFoliageHeightInfluence;
uniform float uFoliageDetailStrength;
uniform float uFoliageTreeCrownMode;
`;

const treeColorModeValue: Readonly<Record<FoliageTreeColorMode, number>> = {
  'card-bands': 0,
  continuous: 1,
  'hard-bands': 2,
  'gradient-detail': 3,
};

const treePaletteStyleValue: Readonly<Record<FoliageTreePaletteStyle, number>> = {
  'authored-three-color': 0,
  'sakura-green': 1,
};

const vertexBand = /* glsl */ `
vec3 foliageInstanceCenter = vec3(0.0);
#ifdef USE_INSTANCING
  foliageInstanceCenter = vec3(instanceMatrix[3].xyz);
#endif
vec3 foliageWorldCenter = (modelMatrix * vec4(foliageInstanceCenter, 1.0)).xyz;
vec3 foliageSamplePosition = mix(
  foliageWorldCenter,
  worldPosition.xyz,
  uFoliageTreeCrownMode
);
vec2 foliageOffset = foliageSamplePosition.xz - uFoliagePlantCenter.xz;
float foliageHeightRadius = max(
  (uFoliageHeightRange.y - uFoliageHeightRange.x) * 0.5,
  0.001
);
vec3 foliageCrownOffset = vec3(
  foliageOffset.x / max(uFoliageHorizontalRadius, 0.001),
  (foliageSamplePosition.y - uFoliagePlantCenter.y) / foliageHeightRadius,
  foliageOffset.y / max(uFoliageHorizontalRadius, 0.001)
);
vec3 foliageHorizontalLight = vec3(uFoliageLightDirection.x, 0.0, uFoliageLightDirection.z);
vec3 foliageHorizontalOffset = vec3(foliageCrownOffset.x, 0.0, foliageCrownOffset.z);
if (length(foliageHorizontalLight) < 0.001) foliageHorizontalLight = vec3(0.0, 0.0, 1.0);
if (length(foliageHorizontalOffset) < 0.001) foliageHorizontalOffset = vec3(0.0, 0.0, 1.0);
float foliageHorizontalBand = dot(
  normalize(foliageHorizontalOffset),
  normalize(foliageHorizontalLight)
) * 0.5 + 0.5;
float foliageVerticalSign = uFoliageLightDirection.y >= 0.0 ? 1.0 : -1.0;
float foliageVerticalBand = clamp(
  foliageCrownOffset.y * foliageVerticalSign * 0.5 + 0.5,
  0.0,
  1.0
);
float foliageDirectionalBand = foliageHorizontalBand
  + (foliageVerticalBand - 0.5) * clamp(uFoliageHeightInfluence, 0.0, 1.0);
vFoliageLightBand = clamp(foliageDirectionalBand, 0.0, 1.0);
`;

const fragmentPars = /* glsl */ `
varying float vFoliageLightBand;
uniform vec3 uFoliageShadowColor;
uniform vec3 uFoliageMidColor;
uniform vec3 uFoliageHighlightColor;
uniform float uFoliageTreeCrownMode;
uniform float uForestOcclusionStrength;
`;

const fragmentBand = /* glsl */ `
float foliageForestOcclusion = 1.0 - getShadowMask();
float foliageShadowedLightBand = mix(
  vFoliageLightBand,
  min(vFoliageLightBand, 0.18),
  clamp(foliageForestOcclusion * uForestOcclusionStrength, 0.0, 1.0)
);
vec3 foliageDirectionalColor = mix(
  uFoliageShadowColor,
  uFoliageMidColor,
  step(0.34, foliageShadowedLightBand)
);
foliageDirectionalColor = mix(
  foliageDirectionalColor,
  uFoliageHighlightColor,
  step(0.67, foliageShadowedLightBand)
);
vec3 foliageTreeDiagnosticColor = mix(
  uFoliageShadowColor,
  uFoliageHighlightColor,
  step(0.5, foliageShadowedLightBand)
);
foliageDirectionalColor = mix(
  foliageDirectionalColor,
  foliageTreeDiagnosticColor,
  uFoliageTreeCrownMode
);
diffuseColor.rgb = foliageDirectionalColor;
`;

const patchVertexShader = (source: string) => source
  .replace('#include <common>', `#include <common>\n${vertexPars}`)
  .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${vertexBand}`);

const patchFragmentShader = (source: string) => source
  .replace('#include <common>', `#include <common>\n${fragmentPars}`)
  .replace(
    '#include <shadowmap_pars_fragment>',
    '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>',
  )
  .replace('#include <color_fragment>', `#include <color_fragment>\n${fragmentBand}`)
  .replace(
    'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
    `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
    outgoingLight = mix(outgoingLight, foliageDirectionalColor, uFoliageTreeCrownMode);`,
  )
  .replace(
    'vec3 outgoingLight = bouncedColor + uRimColor * rimAmount;',
    `vec3 outgoingLight = bouncedColor + uRimColor * rimAmount;
    outgoingLight = mix(outgoingLight, foliageDirectionalColor, uFoliageTreeCrownMode);`,
  );

const getMaterialColor = (material: THREE.Material) => {
  if (material instanceof THREE.ShaderMaterial) {
    const diffuse = material.uniforms.diffuse?.value;
    if (diffuse instanceof THREE.Color) return diffuse.clone();
  }
  const withColor = material as THREE.Material & { color?: THREE.Color };
  return withColor.color?.clone() ?? new THREE.Color('#587b49');
};

const colorLuminance = (color: THREE.Color) => (
  color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
);

const makePalette = (meshes: readonly THREE.InstancedMesh[]) => {
  const colors: THREE.Color[] = [];
  const sample = new THREE.Color();
  meshes.forEach((mesh) => {
    const shadowColors = mesh.geometry.getAttribute('instanceShadowColor');
    const midColors = mesh.geometry.getAttribute('instanceMidColor');
    const highlightColors = mesh.geometry.getAttribute('instanceHighlightColor');
    if (shadowColors && midColors && highlightColors) {
      sample.fromBufferAttribute(shadowColors, 0);
      colors.push(sample.clone());
      sample.fromBufferAttribute(midColors, 0);
      colors.push(sample.clone());
      sample.fromBufferAttribute(highlightColors, 0);
      colors.push(sample.clone());
      return;
    }
    if (mesh.instanceColor) {
      for (let index = 0; index < mesh.count; index += 1) {
        mesh.getColorAt(index, sample);
        colors.push(sample.clone());
      }
      return;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => colors.push(getMaterialColor(material)));
  });
  colors.sort((a, b) => colorLuminance(a) - colorLuminance(b));
  if (colors.length >= 3) {
    return [
      colors[0].clone(),
      colors[Math.floor((colors.length - 1) * 0.5)].clone(),
      colors[colors.length - 1].clone(),
    ] as const;
  }
  const mid = colors[0]?.clone() ?? new THREE.Color('#587b49');
  return [
    mid.clone().offsetHSL(0, 0.03, -0.10),
    mid,
    mid.clone().offsetHSL(-0.015, -0.02, 0.12),
  ] as const;
};

const collectInstanceCenters = (meshes: readonly THREE.InstancedMesh[]) => {
  const matrix = new THREE.Matrix4();
  const center = new THREE.Vector3();
  const centers: THREE.Vector3[] = [];
  meshes.forEach((mesh) => {
    mesh.updateWorldMatrix(true, false);
    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, matrix);
      center.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);
      centers.push(center.clone());
    }
  });
  return centers;
};

const makeUniforms = (
  meshes: readonly THREE.InstancedMesh[],
  kind: FoliagePlantKind,
  heightInfluence: number,
  lightDirection: THREE.Vector3,
): ExperimentUniforms => {
  const centers = collectInstanceCenters(meshes);
  const bounds = new THREE.Box3().setFromPoints(centers);
  const center = bounds.getCenter(new THREE.Vector3());
  const horizontalRadius = centers.reduce((radius, point) => (
    Math.max(radius, Math.hypot(point.x - center.x, point.z - center.z))
  ), 0.001);
  const [baseShadowColor, midColor, baseHighlightColor] = makePalette(meshes);
  const shadowColor = baseShadowColor.clone();
  const highlightColor = baseHighlightColor.clone();
  return {
    center: { value: center },
    heightRange: { value: new THREE.Vector2(bounds.min.y, bounds.max.y) },
    horizontalRadius: { value: horizontalRadius },
    lightDirection: { value: lightDirection },
    heightInfluence: { value: heightInfluence },
    detailStrength: { value: 0.28 },
    treeCrownMode: { value: kind === 'tree' ? 1 : 0 },
    treeColorMode: { value: treeColorModeValue['gradient-detail'] },
    treePaletteStyle: { value: treePaletteStyleValue['authored-three-color'] },
    forestOcclusionStrength: { value: 0.13 },
    shadowColor: { value: shadowColor },
    midColor: { value: midColor },
    highlightColor: { value: highlightColor },
    keyColor: { value: new THREE.Color(0xffffff) },
    keyIntensity: { value: 1 },
    fillColor: { value: new THREE.Color(0xffffff) },
    fillIntensity: { value: 0 },
    rimColor: { value: new THREE.Color(0xffffff) },
    rimIntensity: { value: 0 },
    skyColor: { value: new THREE.Color(0xffffff) },
    groundColor: { value: new THREE.Color(0xffffff) },
    hemisphereIntensity: { value: 1 },
    keyResponseStrength: { value: 1 },
    skyResponseStrength: { value: 1 },
    groundResponseStrength: { value: 1 },
    backlightStrength: { value: 1 },
  };
};

const appendUniforms = (
  target: Record<string, THREE.IUniform>,
  uniforms: ExperimentUniforms,
) => Object.assign(target, {
  uFoliagePlantCenter: uniforms.center,
  uFoliageHeightRange: uniforms.heightRange,
  uFoliageHorizontalRadius: uniforms.horizontalRadius,
  uFoliageLightDirection: uniforms.lightDirection,
  uFoliageHeightInfluence: uniforms.heightInfluence,
  uFoliageDetailStrength: uniforms.detailStrength,
  uFoliageTreeCrownMode: uniforms.treeCrownMode,
  uFoliageTreeColorMode: uniforms.treeColorMode,
  uFoliageTreePaletteStyle: uniforms.treePaletteStyle,
  uForestOcclusionStrength: uniforms.forestOcclusionStrength,
  uFoliageShadowColor: uniforms.shadowColor,
  uFoliageMidColor: uniforms.midColor,
      uFoliageHighlightColor: uniforms.highlightColor,
  uFoliageKeyResponseStrength: uniforms.keyResponseStrength,
  uFoliageSkyResponseStrength: uniforms.skyResponseStrength,
  uFoliageGroundResponseStrength: uniforms.groundResponseStrength,
  uFoliageBacklightStrength: uniforms.backlightStrength,
});

const createTreeCrownMaterial = (
  baseMaterial: THREE.Material,
  uniforms: ExperimentUniforms,
) => {
  if (!(baseMaterial instanceof THREE.ShaderMaterial)) {
    throw new Error('Tree crown direction material requires the foliage-card ShaderMaterial');
  }
  const vertexShader = baseMaterial.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\n#include <shadowmap_pars_vertex>',
    )
    .replace(
      'varying float vInstanceTone;',
      `varying float vInstanceTone;
varying vec3 vFoliageCrownWorldPosition;
varying vec3 vFoliageCrownInstanceCenter;`,
    )
    .replace(
      'vWorldY = worldPosition.y;',
      `vWorldY = worldPosition.y;
  vFoliageCrownWorldPosition = worldPosition;
  vFoliageCrownInstanceCenter = center;
  #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
    #pragma unroll_loop_start
    for (int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i += 1) {
      vec3 foliageShadowPosition = worldPosition
        + worldNormal * directionalLightShadows[i].shadowNormalBias;
      vDirectionalShadowCoord[i] = directionalShadowMatrix[i]
        * vec4(foliageShadowPosition, 1.0);
    }
    #pragma unroll_loop_end
  #endif`,
    );
  const fragmentShader = baseMaterial.fragmentShader
    .replace(
      '#include <fog_pars_fragment>',
      `#include <fog_pars_fragment>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>`,
    )
    .replace(
      'uniform vec3 uKeyDirection;',
      `uniform vec3 uKeyDirection;
uniform vec3 uFoliagePlantCenter;
uniform vec2 uFoliageHeightRange;
uniform float uFoliageHorizontalRadius;
uniform vec3 uFoliageLightDirection;
uniform float uFoliageHeightInfluence;
uniform float uFoliageDetailStrength;
uniform float uFoliageTreeColorMode;
uniform float uFoliageTreePaletteStyle;
uniform float uForestOcclusionStrength;
uniform vec3 uFoliageShadowColor;
uniform vec3 uFoliageMidColor;
uniform vec3 uFoliageHighlightColor;
uniform vec3 uFoliageKeyColor;
uniform float uFoliageKeyIntensity;
uniform vec3 uFoliageFillColor;
uniform float uFoliageFillIntensity;
uniform vec3 uFoliageRimColor;
uniform float uFoliageRimIntensity;
uniform vec3 uFoliageSkyColor;
uniform vec3 uFoliageGroundColor;
uniform float uFoliageHemisphereIntensity;
uniform float uFoliageKeyResponseStrength;
uniform float uFoliageSkyResponseStrength;
uniform float uFoliageGroundResponseStrength;
uniform float uFoliageBacklightStrength;
varying vec3 vFoliageCrownWorldPosition;
varying vec3 vFoliageCrownInstanceCenter;`,
    )
    .replace(
      /void main\(\) \{[\s\S]*\}\s*$/,
      `float foliageLuma(vec3 c) {
  return dot(max(c, vec3(0.0)), vec3(0.2126, 0.7152, 0.0722));
}
vec3 foliageLightTint(vec3 c) {
  return c / max(foliageLuma(c), 1e-4);
}
void main() {
  float coverage = foliageCoverage(vUv);
  if (coverage < 0.5) discard;
  vec3 crownSamplePosition = uFoliageTreeColorMode < 0.5
    ? vFoliageCrownInstanceCenter
    : vFoliageCrownWorldPosition;
  vec2 horizontalOffset = crownSamplePosition.xz - uFoliagePlantCenter.xz;
  float heightRadius = max((uFoliageHeightRange.y - uFoliageHeightRange.x) * 0.5, 0.001);
  vec3 crownOffset = vec3(
    horizontalOffset.x / max(uFoliageHorizontalRadius, 0.001),
    (crownSamplePosition.y - uFoliagePlantCenter.y) / heightRadius,
    horizontalOffset.y / max(uFoliageHorizontalRadius, 0.001)
  );
  vec3 horizontalLight = vec3(uFoliageLightDirection.x, 0.0, uFoliageLightDirection.z);
  vec3 horizontalCrownOffset = vec3(crownOffset.x, 0.0, crownOffset.z);
  if (length(horizontalLight) < 0.001) horizontalLight = vec3(0.0, 0.0, 1.0);
  if (length(horizontalCrownOffset) < 0.001) horizontalCrownOffset = vec3(0.0, 0.0, 1.0);
  float horizontalRamp = dot(normalize(horizontalCrownOffset), normalize(horizontalLight)) * 0.5 + 0.5;
  float lightVerticalSign = uFoliageLightDirection.y >= 0.0 ? 1.0 : -1.0;
  float verticalRamp = clamp(crownOffset.y * lightVerticalSign * 0.5 + 0.5, 0.0, 1.0);
  // Height influence strengthens the crown's own top/bottom position while
  // preserving the complete left/right/front/back key-light gradient.
  float ramp = clamp(horizontalRamp + (verticalRamp - 0.5) * clamp(uFoliageHeightInfluence, 0.0, 1.0), 0.0, 1.0);
  vec3 weightedLight = normalize(vec3(horizontalLight.x, uFoliageLightDirection.y, horizontalLight.z));
  float cardFacing = dot(normalize(vInstanceNormal), weightedLight) * 0.5 + 0.5;
  float cardVariation = fract(sin(dot(
    vFoliageCrownInstanceCenter,
    vec3(12.9898, 78.233, 37.719)
  )) * 43758.5453) - 0.5;
  if (uFoliageTreeColorMode < 0.5) {
    ramp = clamp(mix(ramp, cardFacing, 0.20) + cardVariation * 0.16, 0.0, 1.0);
  }
  float forestOcclusion = 1.0 - getShadowMask();
  ramp = mix(
    ramp,
    min(ramp, 0.18),
    clamp(forestOcclusion * uForestOcclusionStrength, 0.0, 1.0)
  );
  vec3 authoredBandColor = ramp < 0.34
    ? uFoliageShadowColor
    : ramp < 0.67
      ? uFoliageMidColor
      : uFoliageHighlightColor;
  vec3 authoredContinuousColor = ramp < 0.5
    ? mix(uFoliageShadowColor, uFoliageMidColor, ramp * 2.0)
    : mix(uFoliageMidColor, uFoliageHighlightColor, (ramp - 0.5) * 2.0);
  float originalCardTone = vInstanceTone < 0.0 ? 0.5 : vInstanceTone;
  vec3 originalCardBandColor = originalCardTone < 0.34
    ? vInstanceShadowColor
    : originalCardTone < 0.67
      ? vInstanceMidColor
      : vInstanceHighlightColor;
  originalCardBandColor *= vInstanceColorMultiplier;

  // Sakura Idle treats foliage colour as an authored value ladder. Derive five
  // compressed values from this tree's existing three colours, so this mode
  // studies that relationship without replacing the user's palette.
  vec3 sakuraDeep = mix(uFoliageMidColor, uFoliageShadowColor, 0.82);
  vec3 sakuraShadow = mix(uFoliageMidColor, uFoliageShadowColor, 0.48);
  vec3 sakuraMid = uFoliageMidColor;
  vec3 sakuraLight = mix(uFoliageMidColor, uFoliageHighlightColor, 0.42);
  vec3 sakuraHighlight = mix(uFoliageMidColor, uFoliageHighlightColor, 0.76);
  float sakuraRamp = clamp(ramp + cardVariation * 0.035, 0.0, 1.0);
  vec3 sakuraShellColor = sakuraRamp < 0.30
    ? mix(sakuraShadow, sakuraMid, smoothstep(0.0, 0.30, sakuraRamp))
    : sakuraRamp < 0.72
      ? mix(sakuraMid, sakuraLight, smoothstep(0.30, 0.72, sakuraRamp))
      : mix(sakuraLight, sakuraHighlight, smoothstep(0.72, 1.0, sakuraRamp));
  float crownInterior = 1.0 - smoothstep(0.24, 0.82, length(crownOffset));
  float deepWalk = smoothstep(0.20, 0.0, sakuraRamp) * crownInterior;
  vec3 sakuraContinuousColor = mix(sakuraShellColor, sakuraDeep, deepWalk * 0.82);
  vec3 sakuraCardBandColor = originalCardTone < 0.34
    ? sakuraShadow
    : originalCardTone < 0.67
      ? sakuraMid
      : sakuraLight;
  sakuraCardBandColor *= mix(0.96, 1.04, vInstanceColorMultiplier.r);

  float sakuraPaletteMix = step(0.5, uFoliageTreePaletteStyle);
  vec3 bandColor = mix(authoredBandColor, sakuraCardBandColor, sakuraPaletteMix);
  vec3 continuousColor = mix(
    authoredContinuousColor,
    sakuraContinuousColor,
    sakuraPaletteMix
  );
  vec3 detailBandColor = mix(
    originalCardBandColor,
    sakuraCardBandColor,
    sakuraPaletteMix
  );
  vec3 gradientDetailColor = mix(
    continuousColor,
    detailBandColor,
    clamp(uFoliageDetailStrength, 0.0, 1.0)
  );
  vec3 crownColor = uFoliageTreeColorMode > 0.5 && uFoliageTreeColorMode < 1.5
    ? continuousColor
    : uFoliageTreeColorMode > 2.5
      ? gradientDetailColor
      : bandColor;
  // Keep the authored three-colour palette as the material. The rig only
  // modulates its value and temperature, so changing the sun does not repaint
  // the tree into a second unrelated palette.
  vec3 keyTint = foliageLightTint(uFoliageKeyColor);
  vec3 fillTint = foliageLightTint(uFoliageFillColor);
  float crownUp = clamp(crownOffset.y * 0.5 + 0.5, 0.0, 1.0);
  float skyMask = smoothstep(0.15, 0.78, crownUp);
  float groundMask = smoothstep(0.15, 0.78, 1.0 - crownUp);
  vec3 skyTint = foliageLightTint(uFoliageSkyColor);
  vec3 groundTint = foliageLightTint(uFoliageGroundColor);
  float keyGate = smoothstep(0.18, 0.86, ramp);
  float keyResponse = clamp(uFoliageKeyResponseStrength, 0.0, 5.0);
  float keyLevel = clamp(mix(1.0, mix(0.82, 1.24, ramp)
                 * clamp(0.92 + uFoliageKeyIntensity * 0.06, 0.88, 1.16),
                 keyResponse), 0.18, 2.40);
  crownColor *= keyLevel;
  crownColor *= mix(vec3(1.0), keyTint,
                    clamp(0.36 * keyGate * keyResponse, 0.0, 0.90));
  crownColor *= mix(vec3(1.0), fillTint,
                    0.05 * clamp(uFoliageFillIntensity, 0.0, 1.0));
  float environmentEnergy = clamp(uFoliageHemisphereIntensity, 0.0, 2.0);
  float skyResponse = skyMask * environmentEnergy
                    * clamp(uFoliageSkyResponseStrength, 0.0, 5.0);
  float groundResponse = groundMask * environmentEnergy
                       * clamp(uFoliageGroundResponseStrength, 0.0, 5.0);
  crownColor = mix(crownColor, skyTint * foliageLuma(crownColor),
                   clamp(0.34 * skyResponse, 0.0, 0.55));
  crownColor *= 1.0 + 0.22 * skyResponse;
  crownColor = mix(crownColor, groundTint * foliageLuma(crownColor),
                   clamp(0.30 * groundResponse, 0.0, 0.50));
  crownColor *= 1.0 + 0.14 * groundResponse;
  float backlight = smoothstep(0.48, 0.92, 1.0 - ramp);
  crownColor += uFoliageKeyColor * foliageLuma(crownColor)
              * (0.16 * clamp(uFoliageKeyIntensity * 0.5, 0.0, 1.5)
                 * clamp(uFoliageBacklightStrength, 0.0, 5.0) * backlight);
  // Sakura's palette lock is luminance-preserving: lighting may change value,
  // but it cannot wash the foliage into a grey or unrelated shadow hue.
  vec3 sakuraPaletteAtValue = sakuraContinuousColor
    * (foliageLuma(crownColor) / max(foliageLuma(sakuraContinuousColor), 1e-4));
  crownColor = mix(crownColor, sakuraPaletteAtValue, sakuraPaletteMix * 0.58);
  float sakuraDeepFloor = foliageLuma(sakuraDeep) * 0.92;
  float crownValue = foliageLuma(crownColor);
  crownColor *= mix(
    1.0,
    max(1.0, sakuraDeepFloor / max(crownValue, 1e-4)),
    sakuraPaletteMix
  );
  gl_FragColor = vec4(crownColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    );
  return new THREE.ShaderMaterial({
    name: 'tree-crown-comparison-color',
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
      ...baseMaterial.uniforms,
      uFoliagePlantCenter: uniforms.center,
      uFoliageHeightRange: uniforms.heightRange,
      uFoliageHorizontalRadius: uniforms.horizontalRadius,
      uFoliageLightDirection: uniforms.lightDirection,
  uFoliageHeightInfluence: uniforms.heightInfluence,
      uFoliageDetailStrength: uniforms.detailStrength,
      uFoliageTreeColorMode: uniforms.treeColorMode,
      uFoliageTreePaletteStyle: uniforms.treePaletteStyle,
      uForestOcclusionStrength: uniforms.forestOcclusionStrength,
      uFoliageShadowColor: uniforms.shadowColor,
      uFoliageMidColor: uniforms.midColor,
      uFoliageHighlightColor: uniforms.highlightColor,
      uFoliageKeyColor: uniforms.keyColor,
      uFoliageKeyIntensity: uniforms.keyIntensity,
      uFoliageFillColor: uniforms.fillColor,
      uFoliageFillIntensity: uniforms.fillIntensity,
      uFoliageRimColor: uniforms.rimColor,
      uFoliageRimIntensity: uniforms.rimIntensity,
      uFoliageSkyColor: uniforms.skyColor,
      uFoliageGroundColor: uniforms.groundColor,
      uFoliageHemisphereIntensity: uniforms.hemisphereIntensity,
      uFoliageKeyResponseStrength: uniforms.keyResponseStrength,
      uFoliageSkyResponseStrength: uniforms.skyResponseStrength,
      uFoliageGroundResponseStrength: uniforms.groundResponseStrength,
      uFoliageBacklightStrength: uniforms.backlightStrength,
    },
    vertexShader,
    fragmentShader,
    lights: true,
    fog: baseMaterial.fog,
    side: baseMaterial.side,
    transparent: baseMaterial.transparent,
    depthTest: baseMaterial.depthTest,
    depthWrite: baseMaterial.depthWrite,
    toneMapped: true,
  });
};

const createBushFoliageMaterial = (
  baseMaterial: THREE.ShaderMaterial,
  uniforms: ExperimentUniforms,
) => {
  const shadowVertexAnchor = 'vec4 mvPosition = viewMatrix * vec4(worldPosition, 1.0);';
  const shadowFragmentAnchor = 'vec3 color = colorRamp(rampPosition) * vInstanceColorMultiplier;';
  if (!baseMaterial.vertexShader.includes(shadowVertexAnchor)
    || !baseMaterial.fragmentShader.includes(shadowFragmentAnchor)) {
    throw new Error('Bush shadow material requires the foliage-card shader anchors');
  }

  const material = baseMaterial.clone();
  material.name = `${baseMaterial.name || 'bush-foliage'}-unified-shadow-experiment`;
  material.uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
    ...baseMaterial.uniforms,
    uForestOcclusionStrength: uniforms.forestOcclusionStrength,
  };
  material.lights = true;
  material.vertexShader = baseMaterial.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\n#include <shadowmap_pars_vertex>',
    )
    .replace(
      shadowVertexAnchor,
      `#if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
    #pragma unroll_loop_start
    for (int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i += 1) {
      vec3 foliageShadowPosition = worldPosition
        + worldNormal * directionalLightShadows[i].shadowNormalBias;
      vDirectionalShadowCoord[i] = directionalShadowMatrix[i]
        * vec4(foliageShadowPosition, 1.0);
    }
    #pragma unroll_loop_end
  #endif

  ${shadowVertexAnchor}`,
    );
  material.fragmentShader = baseMaterial.fragmentShader
    .replace(
      '#include <fog_pars_fragment>',
      `#include <fog_pars_fragment>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>`,
    )
    .replace(
      'uniform vec3 uKeyDirection;',
      `uniform vec3 uKeyDirection;
uniform float uForestOcclusionStrength;`,
    )
    .replace(
      shadowFragmentAnchor,
      `${shadowFragmentAnchor}
  float unifiedOcclusion = 1.0 - getShadowMask();
  float unifiedShadowFactor = clamp(
    unifiedOcclusion * uForestOcclusionStrength,
    0.0,
    1.0
  );
  vec3 unifiedShadowTarget = vInstanceShadowColor * vInstanceColorMultiplier;
  color = mix(color, unifiedShadowTarget, unifiedShadowFactor);`,
    );
  return material;
};

const createExperimentMaterial = (
  baseMaterial: THREE.Material,
  uniforms: ExperimentUniforms,
  kind: FoliagePlantKind,
) => {
  if (kind === 'tree') return createTreeCrownMaterial(baseMaterial, uniforms);
  if (baseMaterial instanceof THREE.ShaderMaterial) {
    return createBushFoliageMaterial(baseMaterial, uniforms);
  }

  const material = baseMaterial.clone();
  material.name = `${baseMaterial.name || 'foliage'}-light-direction-experiment`;
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    appendUniforms(shader.uniforms, uniforms);
    shader.vertexShader = patchVertexShader(shader.vertexShader);
    shader.fragmentShader = patchFragmentShader(shader.fragmentShader);
  };
  const previousCacheKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${previousCacheKey()}:foliage-light-direction-v001`;
  material.needsUpdate = true;
  return material;
};

const getPlantFoliage = (plant: FoliagePlantSource) => {
  const meshes: THREE.InstancedMesh[] = [];
  plant.root.traverse((object) => {
    if (!(object instanceof THREE.InstancedMesh)) return;
    const isTreeFoliage = plant.kind === 'tree' && object.userData.treeRole === 'foliage-occluder';
    const isBushFoliage = plant.kind === 'bush' && object.userData.environmentRole === 'bush-foliage';
    if (isTreeFoliage || isBushFoliage) meshes.push(object);
  });
  return meshes;
};

export const createFoliageLightDirectionExperiment = (
  plants: readonly FoliagePlantSource[],
  initialHeightInfluence = 0.20,
): FoliageLightDirectionExperiment => {
  let active = false;
  let heightInfluence = THREE.MathUtils.clamp(initialHeightInfluence, 0, 1);
  let detailStrength = 0.28;
  let treeColorMode: FoliageTreeColorMode = 'gradient-detail';
  let treePaletteStyle: FoliageTreePaletteStyle = 'authored-three-color';
  let forestOcclusionEnabled = true;
  let forestOcclusionStrength = 0.13;
  let lightingResponse: FoliageLightingResponse = {
    keyEnabled: true, keyStrength: 1,
    skyEnabled: true, skyStrength: 1,
    groundEnabled: true, groundStrength: 1,
    backlightEnabled: true, backlightStrength: 1,
  };
  const keyDirection = new THREE.Vector3(-0.42, 0.76, 0.49).normalize();
  const entries: FoliageEntry[] = [];
  const plantUniforms: ExperimentUniforms[] = [];

  plants.forEach((plant) => {
    const meshes = getPlantFoliage(plant);
    if (meshes.length === 0) return;
    const uniforms = makeUniforms(meshes, plant.kind, heightInfluence, keyDirection);
    plantUniforms.push(uniforms);
    meshes.forEach((mesh) => {
      if (Array.isArray(mesh.material)) return;
      entries.push({
        kind: plant.kind,
        mesh,
        baseMaterial: mesh.material,
        experimentMaterial: createExperimentMaterial(mesh.material, uniforms, plant.kind),
      });
    });
  });

  return {
    setActive(nextActive) {
      active = nextActive;
      entries.forEach((entry) => {
        if (active) {
          entry.mesh.material = entry.experimentMaterial;
        } else if (entry.mesh.material === entry.experimentMaterial) {
          entry.mesh.material = entry.baseMaterial;
        }
      });
    },
    setHeightInfluence(value) {
      heightInfluence = THREE.MathUtils.clamp(value, 0, 1);
      plantUniforms.forEach((uniforms) => { uniforms.heightInfluence.value = heightInfluence; });
    },
    setDetailStrength(value) {
      detailStrength = THREE.MathUtils.clamp(value, 0, 1);
      plantUniforms.forEach((uniforms) => { uniforms.detailStrength.value = detailStrength; });
    },
    setTreeColorMode(mode) {
      treeColorMode = mode;
      plantUniforms.forEach((uniforms) => {
        uniforms.treeColorMode.value = treeColorModeValue[mode];
      });
    },
    setTreePaletteStyle(style) {
      treePaletteStyle = style;
      plantUniforms.forEach((uniforms) => {
        uniforms.treePaletteStyle.value = treePaletteStyleValue[style];
      });
    },
    setForestOcclusion(enabled, strength) {
      forestOcclusionEnabled = enabled;
      forestOcclusionStrength = THREE.MathUtils.clamp(strength, 0, 1);
      plantUniforms.forEach((uniforms) => {
        uniforms.forestOcclusionStrength.value = forestOcclusionEnabled
          ? forestOcclusionStrength
          : 0;
      });
    },
    setLightingResponse(response) {
      lightingResponse = {
        ...lightingResponse,
        ...response,
        keyStrength: THREE.MathUtils.clamp(response.keyStrength ?? lightingResponse.keyStrength, 0, 5),
        skyStrength: THREE.MathUtils.clamp(response.skyStrength ?? lightingResponse.skyStrength, 0, 5),
        groundStrength: THREE.MathUtils.clamp(response.groundStrength ?? lightingResponse.groundStrength, 0, 5),
        backlightStrength: THREE.MathUtils.clamp(response.backlightStrength ?? lightingResponse.backlightStrength, 0, 5),
      };
      plantUniforms.forEach((uniforms) => {
        uniforms.keyResponseStrength.value = lightingResponse.keyEnabled ? lightingResponse.keyStrength : 0;
        uniforms.skyResponseStrength.value = lightingResponse.skyEnabled ? lightingResponse.skyStrength : 0;
        uniforms.groundResponseStrength.value = lightingResponse.groundEnabled ? lightingResponse.groundStrength : 0;
        uniforms.backlightStrength.value = lightingResponse.backlightEnabled ? lightingResponse.backlightStrength : 0;
      });
    },
    updateKeyDirection(keyLight) {
      const lightPosition = keyLight.getWorldPosition(new THREE.Vector3());
      const targetPosition = keyLight.target.getWorldPosition(new THREE.Vector3());
      const direction = lightPosition.sub(targetPosition);
      keyDirection.copy(direction);
      if (keyDirection.lengthSq() < 0.0001) keyDirection.set(0, 1, 0);
      keyDirection.normalize();
    },
    updateLighting(keyLight, fillLight, rimLight, environmentLight) {
      const lightPosition = keyLight.getWorldPosition(new THREE.Vector3());
      const targetPosition = keyLight.target.getWorldPosition(new THREE.Vector3());
      keyDirection.copy(lightPosition.sub(targetPosition));
      if (keyDirection.lengthSq() < 0.0001) keyDirection.set(0, 1, 0);
      keyDirection.normalize();
      const key = keyLight.color.clone();
      const fill = fillLight.color.clone();
      const rim = rimLight.color.clone();
      const sky = environmentLight?.color?.clone() ?? new THREE.Color(0xffffff);
      const ground = environmentLight instanceof THREE.HemisphereLight
        ? environmentLight.groundColor.clone()
        : sky.clone();
      const keyIntensity = Math.max(0, keyLight.intensity);
      const fillIntensity = Math.max(0, fillLight.intensity);
      const rimIntensity = Math.max(0, rimLight.intensity);
      const hemiIntensity = Math.max(0, environmentLight?.intensity ?? 1);
      plantUniforms.forEach((uniforms) => {
        uniforms.keyColor.value.copy(key);
        uniforms.keyIntensity.value = keyIntensity;
        uniforms.fillColor.value.copy(fill);
        uniforms.fillIntensity.value = fillIntensity;
        uniforms.rimColor.value.copy(rim);
        uniforms.rimIntensity.value = rimIntensity;
        uniforms.skyColor.value.copy(sky);
        uniforms.groundColor.value.copy(ground);
        uniforms.hemisphereIntensity.value = hemiIntensity;
      });
    },
    update() {
      if (!active) return;
      entries.forEach((entry) => {
        if (entry.mesh.material !== entry.experimentMaterial) {
          entry.mesh.material = entry.experimentMaterial;
        }
      });
    },
    getSnapshot: () => ({
      active,
      heightInfluence,
      detailStrength,
      treeColorMode,
      treePaletteStyle,
      forestOcclusionEnabled,
      forestOcclusionStrength,
      lightingResponse,
      plantCount: plantUniforms.length,
      meshCount: entries.length,
      treeCount: plants.filter((plant) => plant.kind === 'tree').length,
      bushCount: plants.filter((plant) => plant.kind === 'bush').length,
      mountedMeshCount: entries.filter((entry) => entry.mesh.material === entry.experimentMaterial).length,
      mountedTreeMeshCount: entries.filter((entry) => (
        entry.kind === 'tree' && entry.mesh.material === entry.experimentMaterial
      )).length,
      keyDirection: keyDirection.toArray() as [number, number, number],
    }),
    dispose() {
      active = false;
      entries.forEach((entry) => {
        if (entry.mesh.material === entry.experimentMaterial) entry.mesh.material = entry.baseMaterial;
        entry.experimentMaterial.dispose();
      });
    },
  };
};
