import * as THREE from 'three';

export type StylizedEnvironmentMaterialLook = Readonly<{
  enabled: boolean;
  litTint: THREE.ColorRepresentation;
  litTintAmount: number;
  litIntensity: number;
  shadowColor: THREE.ColorRepresentation;
  shadowBaseStrength: number;
  shadowColorMix: number;
  bounceColor: THREE.ColorRepresentation;
  bounceStrength: number;
  bounceDistance: number;
  groundY: number;
  coreShadowLow: number;
  coreShadowHigh: number;
}>;

export type StylizedEnvironmentFeatures = Readonly<{
  coreShadow: boolean;
  dropShadow: boolean;
  groundBounce: boolean;
}>;

type StylizedEnvironmentMaterialSystem = {
  createMaterial: (
    color: THREE.ColorRepresentation,
    options?: Readonly<{
      vertexColors?: boolean;
      side?: THREE.Side;
      opacity?: number;
      transparent?: boolean;
      map?: THREE.Texture | null;
    }>,
  ) => THREE.ShaderMaterial;
  register: (
    root: THREE.Object3D,
    shouldConvert?: (mesh: THREE.Mesh) => boolean,
  ) => () => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: () => boolean;
  setFeatures: (features: Partial<StylizedEnvironmentFeatures>) => void;
  getFeatures: () => StylizedEnvironmentFeatures;
  applyLook: (look: StylizedEnvironmentMaterialLook) => void;
  updateLighting: (
    keyLight: THREE.DirectionalLight,
    fillLight: THREE.DirectionalLight,
    rimLight: THREE.DirectionalLight,
  ) => void;
  dispose: () => void;
};

const vertexShader = THREE.ShaderLib.lambert.vertexShader
  .replace(
    '#include <common>',
    '#include <common>\nvarying vec3 vStylizedWorldPosition;\n#ifdef USE_STYLIZED_MAP\nvarying vec2 vStylizedUv;\n#endif',
  )
  .replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
#ifdef USE_STYLIZED_MAP
vStylizedUv = uv;
#endif
vec4 stylizedWorldPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
stylizedWorldPosition = instanceMatrix * stylizedWorldPosition;
#endif
vStylizedWorldPosition = (modelMatrix * stylizedWorldPosition).xyz;`,
  );

const fragmentShader = /* glsl */ `
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D uMap;
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
varying vec3 vStylizedWorldPosition;
#ifdef USE_STYLIZED_MAP
varying vec2 vStylizedUv;
#endif

#include <common>
#include <packing>
#include <color_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

void main() {
  vec4 diffuseColor = vec4(diffuse, opacity);
  #ifdef USE_STYLIZED_MAP
    diffuseColor *= texture2D(uMap, vStylizedUv);
  #endif
  #include <color_fragment>
  #include <normal_fragment_begin>
  #include <normal_fragment_maps>

  vec3 baseColor = diffuseColor.rgb;
  vec3 worldNormal = normalize(inverseTransformDirection(normal, viewMatrix));

  float downwardFacing = smoothstep(0.08, 0.82, -worldNormal.y);
  float heightFromGround = max(vStylizedWorldPosition.y - uGroundY, 0.0);
  float bounceProximity = pow(max(1.0 - heightFromGround / max(uBounceDistance, 0.001), 0.0), 2.0);
  float bounceMix = downwardFacing * bounceProximity * uBounceStrength * uGroundBounceEnabled;
  vec3 litTint = mix(vec3(1.0), uLitTint, uLitTintAmount);
  vec3 litColor = baseColor * litTint * uLitIntensity;

  float normalLight = dot(worldNormal, normalize(uKeyDirection));
  float coreShadow = (1.0 - smoothstep(uCoreShadowLow, uCoreShadowHigh, normalLight))
    * uCoreShadowEnabled;
  float dropShadow = (1.0 - getShadowMask()) * uDropShadowEnabled;
  float combinedShadow = clamp(max(coreShadow, dropShadow), 0.0, 1.0);

  vec3 shadowColor = mix(
    baseColor * uShadowBaseStrength,
    uShadowColor,
    uShadowColorMix
  );
  vec3 shadedColor = mix(litColor, shadowColor, combinedShadow);
  float fillFacing = max(dot(worldNormal, normalize(uFillDirection)), 0.0);
  float fillAmount = fillFacing * uFillIntensity * 0.14 * combinedShadow;
  vec3 filledColor = shadedColor + baseColor * uFillColor * fillAmount;
  vec3 viewDirection = normalize(cameraPosition - vStylizedWorldPosition);
  float viewEdge = pow(1.0 - clamp(dot(worldNormal, viewDirection), 0.0, 1.0), 2.5);
  float rimFacing = smoothstep(-0.15, 0.65, dot(worldNormal, normalize(uRimDirection)));
  float rimAmount = viewEdge * rimFacing * uRimIntensity * 0.22;
  vec3 bouncedColor = mix(filledColor, uBounceColor, clamp(bounceMix, 0.0, 1.0));
  vec3 outgoingLight = bouncedColor + uRimColor * rimAmount;

  #include <opaque_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

type SharedUniforms = {
  keyDirection: THREE.IUniform<THREE.Vector3>;
  fillDirection: THREE.IUniform<THREE.Vector3>;
  fillColor: THREE.IUniform<THREE.Color>;
  fillIntensity: THREE.IUniform<number>;
  rimDirection: THREE.IUniform<THREE.Vector3>;
  rimColor: THREE.IUniform<THREE.Color>;
  rimIntensity: THREE.IUniform<number>;
  litTint: THREE.IUniform<THREE.Color>;
  litTintAmount: THREE.IUniform<number>;
  litIntensity: THREE.IUniform<number>;
  shadowColor: THREE.IUniform<THREE.Color>;
  shadowBaseStrength: THREE.IUniform<number>;
  shadowColorMix: THREE.IUniform<number>;
  bounceColor: THREE.IUniform<THREE.Color>;
  bounceStrength: THREE.IUniform<number>;
  bounceDistance: THREE.IUniform<number>;
  groundY: THREE.IUniform<number>;
  coreShadowLow: THREE.IUniform<number>;
  coreShadowHigh: THREE.IUniform<number>;
  coreShadowEnabled: THREE.IUniform<number>;
  dropShadowEnabled: THREE.IUniform<number>;
  groundBounceEnabled: THREE.IUniform<number>;
};

type RegisteredMesh = {
  mesh: THREE.Mesh;
  original: THREE.Material | THREE.Material[];
  stylized: THREE.Material | THREE.Material[];
};

const materialColor = (material: THREE.Material) => {
  const candidate = material as THREE.Material & { color?: THREE.Color };
  return candidate.color?.clone() ?? new THREE.Color('#ffffff');
};

export const createStylizedEnvironmentMaterialSystem = (
  initialLook: StylizedEnvironmentMaterialLook,
): StylizedEnvironmentMaterialSystem => {
  const shared: SharedUniforms = {
    keyDirection: { value: new THREE.Vector3(-0.42, 0.76, 0.49).normalize() },
    fillDirection: { value: new THREE.Vector3(0.62, 0.42, -0.66).normalize() },
    fillColor: { value: new THREE.Color('#8fb8c4') },
    fillIntensity: { value: 0 },
    rimDirection: { value: new THREE.Vector3(0.48, 0.64, -0.60).normalize() },
    rimColor: { value: new THREE.Color('#d8eff1') },
    rimIntensity: { value: 0 },
    litTint: { value: new THREE.Color(initialLook.litTint) },
    litTintAmount: { value: initialLook.litTintAmount },
    litIntensity: { value: initialLook.litIntensity },
    shadowColor: { value: new THREE.Color(initialLook.shadowColor) },
    shadowBaseStrength: { value: initialLook.shadowBaseStrength },
    shadowColorMix: { value: initialLook.shadowColorMix },
    bounceColor: { value: new THREE.Color(initialLook.bounceColor) },
    bounceStrength: { value: initialLook.bounceStrength },
    bounceDistance: { value: initialLook.bounceDistance },
    groundY: { value: initialLook.groundY },
    coreShadowLow: { value: initialLook.coreShadowLow },
    coreShadowHigh: { value: initialLook.coreShadowHigh },
    coreShadowEnabled: { value: 1 },
    dropShadowEnabled: { value: 1 },
    groundBounceEnabled: { value: 1 },
  };
  const registered = new Set<RegisteredMesh>();
  const ownedMaterials = new Set<THREE.ShaderMaterial>();
  let enabled = initialLook.enabled;

  const createMaterial: StylizedEnvironmentMaterialSystem['createMaterial'] = (color, options = {}) => {
    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      THREE.UniformsLib.fog,
    ]);
    Object.assign(uniforms, {
      diffuse: { value: new THREE.Color(color) },
      opacity: { value: options.opacity ?? 1 },
      uMap: { value: options.map ?? null },
      uKeyDirection: shared.keyDirection,
      uFillDirection: shared.fillDirection,
      uFillColor: shared.fillColor,
      uFillIntensity: shared.fillIntensity,
      uRimDirection: shared.rimDirection,
      uRimColor: shared.rimColor,
      uRimIntensity: shared.rimIntensity,
      uLitTint: shared.litTint,
      uLitTintAmount: shared.litTintAmount,
      uLitIntensity: shared.litIntensity,
      uShadowColor: shared.shadowColor,
      uShadowBaseStrength: shared.shadowBaseStrength,
      uShadowColorMix: shared.shadowColorMix,
      uBounceColor: shared.bounceColor,
      uBounceStrength: shared.bounceStrength,
      uBounceDistance: shared.bounceDistance,
      uGroundY: shared.groundY,
      uCoreShadowLow: shared.coreShadowLow,
      uCoreShadowHigh: shared.coreShadowHigh,
      uCoreShadowEnabled: shared.coreShadowEnabled,
      uDropShadowEnabled: shared.dropShadowEnabled,
      uGroundBounceEnabled: shared.groundBounceEnabled,
    });
    const material = new THREE.ShaderMaterial({
      name: 'stylized-environment-material',
      uniforms,
      vertexShader,
      fragmentShader,
      lights: true,
      fog: true,
      vertexColors: options.vertexColors ?? false,
      side: options.side ?? THREE.FrontSide,
      transparent: options.transparent ?? false,
      toneMapped: true,
      defines: options.map ? { USE_STYLIZED_MAP: '' } : {},
    });
    ownedMaterials.add(material);
    return material;
  };

  const convertMaterial = (original: THREE.Material, mesh: THREE.Mesh) => {
    const stylized = createMaterial(materialColor(original), {
      vertexColors: mesh.geometry.hasAttribute('color'),
      side: original.side,
      opacity: original.opacity,
      transparent: original.transparent,
      map: 'map' in original && original.map instanceof THREE.Texture
        ? original.map
        : null,
    });
    stylized.visible = original.visible;
    stylized.depthTest = original.depthTest;
    stylized.depthWrite = original.depthWrite;
    stylized.colorWrite = original.colorWrite;
    stylized.alphaToCoverage = original.alphaToCoverage;
    stylized.polygonOffset = original.polygonOffset;
    stylized.polygonOffsetFactor = original.polygonOffsetFactor;
    stylized.polygonOffsetUnits = original.polygonOffsetUnits;
    return stylized;
  };

  const register = (
    root: THREE.Object3D,
    shouldConvert: (mesh: THREE.Mesh) => boolean = () => true,
  ) => {
    const entries: RegisteredMesh[] = [];
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.userData.preserveStylizedMaterial === true) return;
      if (!shouldConvert(object)) return;
      const original = object.material;
      const stylized = Array.isArray(original)
        ? original.map((material) => convertMaterial(material, object))
        : convertMaterial(original, object);
      const entry = { mesh: object, original, stylized };
      entries.push(entry);
      registered.add(entry);
      if (enabled) object.material = stylized;
    });
    return () => {
      entries.forEach((entry) => {
        entry.mesh.material = entry.original;
        registered.delete(entry);
        const materials = Array.isArray(entry.stylized) ? entry.stylized : [entry.stylized];
        materials.forEach((material) => {
          material.dispose();
          ownedMaterials.delete(material as THREE.ShaderMaterial);
        });
      });
    };
  };

  const setEnabled = (nextEnabled: boolean) => {
    enabled = nextEnabled;
    registered.forEach((entry) => {
      entry.mesh.material = enabled ? entry.stylized : entry.original;
    });
  };

  const applyLook = (look: StylizedEnvironmentMaterialLook) => {
    shared.litTint.value.set(look.litTint);
    shared.litTintAmount.value = look.litTintAmount;
    shared.litIntensity.value = look.litIntensity;
    shared.shadowColor.value.set(look.shadowColor);
    shared.shadowBaseStrength.value = look.shadowBaseStrength;
    shared.shadowColorMix.value = look.shadowColorMix;
    shared.bounceColor.value.set(look.bounceColor);
    shared.bounceStrength.value = look.bounceStrength;
    shared.bounceDistance.value = look.bounceDistance;
    shared.groundY.value = look.groundY;
    shared.coreShadowLow.value = look.coreShadowLow;
    shared.coreShadowHigh.value = look.coreShadowHigh;
    setEnabled(look.enabled);
  };

  return {
    createMaterial,
    register,
    setEnabled,
    isEnabled: () => enabled,
    setFeatures(features) {
      if (features.coreShadow !== undefined) shared.coreShadowEnabled.value = features.coreShadow ? 1 : 0;
      if (features.dropShadow !== undefined) shared.dropShadowEnabled.value = features.dropShadow ? 1 : 0;
      if (features.groundBounce !== undefined) shared.groundBounceEnabled.value = features.groundBounce ? 1 : 0;
    },
    getFeatures: () => ({
      coreShadow: shared.coreShadowEnabled.value > 0.5,
      dropShadow: shared.dropShadowEnabled.value > 0.5,
      groundBounce: shared.groundBounceEnabled.value > 0.5,
    }),
    applyLook,
    updateLighting(keyLight, fillLight, rimLight) {
      shared.keyDirection.value.copy(keyLight.position).sub(keyLight.target.position).normalize();
      shared.fillDirection.value.copy(fillLight.position).sub(fillLight.target.position).normalize();
      shared.fillColor.value.copy(fillLight.color);
      shared.fillIntensity.value = fillLight.intensity;
      shared.rimDirection.value.copy(rimLight.position).sub(rimLight.target.position).normalize();
      shared.rimColor.value.copy(rimLight.color);
      shared.rimIntensity.value = rimLight.intensity;
    },
    dispose() {
      registered.forEach((entry) => { entry.mesh.material = entry.original; });
      registered.clear();
      ownedMaterials.forEach((material) => material.dispose());
      ownedMaterials.clear();
    },
  };
};
