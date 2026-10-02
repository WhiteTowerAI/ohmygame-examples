import * as THREE from 'three';

type StylizedObjectShadowLook = Readonly<{
  shadowColor: THREE.ColorRepresentation;
  shadowBaseStrength: number;
  shadowColorMix: number;
  bounceColor: THREE.ColorRepresentation;
  bounceStrength: number;
  bounceDistance: number;
  coreShadowLow: number;
  coreShadowHigh: number;
}>;

type StylizedObjectShadowFeatures = Readonly<{
  enabled: boolean;
  coreShadow: boolean;
  dropShadow: boolean;
  groundBounce: boolean;
  colorShadowFusion: boolean;
}>;

type SharedUniforms = {
  keyDirection: THREE.IUniform<THREE.Vector3>;
  shadowColor: THREE.IUniform<THREE.Color>;
  shadowBaseStrength: THREE.IUniform<number>;
  shadowColorMix: THREE.IUniform<number>;
  bounceColor: THREE.IUniform<THREE.Color>;
  bounceStrength: THREE.IUniform<number>;
  bounceDistance: THREE.IUniform<number>;
  coreShadowLow: THREE.IUniform<number>;
  coreShadowHigh: THREE.IUniform<number>;
  coreShadowEnabled: THREE.IUniform<number>;
  dropShadowEnabled: THREE.IUniform<number>;
  groundBounceEnabled: THREE.IUniform<number>;
  colorShadowFusionEnabled: THREE.IUniform<number>;
  barkRoundnessEnabled: THREE.IUniform<number>;
  terrainHeightMap: THREE.IUniform<THREE.Texture | null>;
  terrainWorldSize: THREE.IUniform<THREE.Vector2>;
};

type RegisteredEntry = {
  mesh: THREE.Mesh;
  original: THREE.Material | THREE.Material[];
  patched: THREE.Material | THREE.Material[];
};

const shaderDeclarations = [
  'uniform vec3 uWetlandKeyDirection;',
  'uniform vec3 uWetlandShadowColor;',
  'uniform float uWetlandShadowBaseStrength;',
  'uniform float uWetlandShadowColorMix;',
  'uniform vec3 uWetlandBounceColor;',
  'uniform float uWetlandBounceStrength;',
  'uniform float uWetlandBounceDistance;',
  'uniform float uWetlandCoreShadowLow;',
  'uniform float uWetlandCoreShadowHigh;',
  'uniform float uWetlandCoreShadowEnabled;',
  'uniform float uWetlandDropShadowEnabled;',
  'uniform float uWetlandGroundBounceEnabled;',
  'uniform float uWetlandColorShadowFusionEnabled;',
  'uniform float uWetlandBarkMaterial;',
  'uniform float uWetlandBarkShadowResponse;',
  'uniform float uWetlandBarkRoundnessEnabled;',
  'uniform sampler2D uWetlandTerrainHeightMap;',
  'uniform vec2 uWetlandTerrainWorldSize;',
  'varying vec3 vWetlandWorldPosition;',
].join('\n');

const worldPositionVertex = [
  '#include <begin_vertex>',
  'vec4 wetlandWorldPosition = vec4(transformed, 1.0);',
  '#ifdef USE_BATCHING',
  'wetlandWorldPosition = batchingMatrix * wetlandWorldPosition;',
  '#endif',
  '#ifdef USE_INSTANCING',
  'wetlandWorldPosition = instanceMatrix * wetlandWorldPosition;',
  '#endif',
  'vWetlandWorldPosition = (modelMatrix * wetlandWorldPosition).xyz;',
].join('\n');

const stylizedShadowFragment = [
  'vec3 wetlandBaseColor = diffuseColor.rgb;',
  'vec3 wetlandWorldNormal = normalize(inverseTransformDirection(normal, viewMatrix));',
  'float wetlandNormalLight = dot(wetlandWorldNormal, normalize(uWetlandKeyDirection));',
  'float wetlandCoreShadow = (1.0 - smoothstep(',
  '  uWetlandCoreShadowLow,',
  '  uWetlandCoreShadowHigh,',
  '  wetlandNormalLight',
  ')) * uWetlandCoreShadowEnabled;',
  'float wetlandProjectedShadow = (1.0 - getShadowMask())',
  '  * uWetlandDropShadowEnabled',
  '  * uWetlandColorShadowFusionEnabled',
  '  * mix(1.0, uWetlandBarkShadowResponse, uWetlandBarkMaterial);',
  'float wetlandShadowColorMix = mix(',
  '  uWetlandShadowColorMix,',
  '  0.0,',
  '  uWetlandBarkMaterial',
  ');',
  'float wetlandShadowBaseStrength = mix(',
  '  uWetlandShadowBaseStrength,',
  '  0.84,',
  '  uWetlandBarkMaterial',
  ');',
  'vec3 wetlandShadowTarget = mix(',
  '  wetlandBaseColor * wetlandShadowBaseStrength,',
  '  uWetlandShadowColor,',
  '  wetlandShadowColorMix',
  ');',
  'float wetlandStyleMask = clamp(',
  '  max(wetlandCoreShadow * 0.52, wetlandProjectedShadow * 0.62),',
  '  0.0,',
  '  0.78',
  ');',
  'outgoingLight = mix(outgoingLight, wetlandShadowTarget, wetlandStyleMask);',
  'float wetlandBarkRoundness = 1.0;',
  'if (uWetlandBarkMaterial > 0.5 && uWetlandBarkRoundnessEnabled > 0.5) {',
  '  float wetlandKeyRoll = smoothstep(-0.55, 0.85, dot(wetlandWorldNormal, normalize(uWetlandKeyDirection)));',
  '  float wetlandViewRoll = 1.0 - pow(1.0 - clamp(abs(dot(wetlandWorldNormal, normalize(cameraPosition - vWetlandWorldPosition))), 0.0, 1.0), 2.2);',
  '  wetlandBarkRoundness = mix(0.84, 1.12, wetlandKeyRoll) * mix(0.92, 1.06, wetlandViewRoll);',
  '}',
  'outgoingLight *= wetlandBarkRoundness;',
  '',
  'vec2 wetlandTerrainUv = vWetlandWorldPosition.xz / uWetlandTerrainWorldSize + 0.5;',
  'vec2 wetlandInside = step(vec2(0.0), wetlandTerrainUv)',
  '  * step(wetlandTerrainUv, vec2(1.0));',
  'float wetlandGroundHeight = texture2D(uWetlandTerrainHeightMap, wetlandTerrainUv).r',
  '  * wetlandInside.x * wetlandInside.y;',
  'float wetlandDownwardFacing = smoothstep(0.08, 0.82, -wetlandWorldNormal.y);',
  'float wetlandHeightFromGround = max(vWetlandWorldPosition.y - wetlandGroundHeight, 0.0);',
  'float wetlandBounceProximity = pow(max(',
  '  1.0 - wetlandHeightFromGround / max(uWetlandBounceDistance, 0.001),',
  '  0.0',
  '), 2.0);',
  'float wetlandBounceMix = wetlandDownwardFacing * wetlandBounceProximity',
  '  * uWetlandBounceStrength * uWetlandGroundBounceEnabled * 0.32;',
  'vec3 wetlandBounceTarget = mix(wetlandBaseColor, uWetlandBounceColor, 0.22);',
  'outgoingLight = mix(',
  '  outgoingLight,',
  '  wetlandBounceTarget,',
  '  clamp(wetlandBounceMix, 0.0, 0.26)',
  ');',
  '#include <opaque_fragment>',
].join('\n');

const appendShader = (
  shader: THREE.WebGLProgramParametersWithUniforms,
  shared: SharedUniforms,
  barkMaterial: boolean,
) => {
  Object.assign(shader.uniforms, {
    uWetlandKeyDirection: shared.keyDirection,
    uWetlandShadowColor: shared.shadowColor,
    uWetlandShadowBaseStrength: shared.shadowBaseStrength,
    uWetlandShadowColorMix: shared.shadowColorMix,
    uWetlandBounceColor: shared.bounceColor,
    uWetlandBounceStrength: shared.bounceStrength,
    uWetlandBounceDistance: shared.bounceDistance,
    uWetlandCoreShadowLow: shared.coreShadowLow,
    uWetlandCoreShadowHigh: shared.coreShadowHigh,
    uWetlandCoreShadowEnabled: shared.coreShadowEnabled,
    uWetlandDropShadowEnabled: shared.dropShadowEnabled,
    uWetlandGroundBounceEnabled: shared.groundBounceEnabled,
    uWetlandColorShadowFusionEnabled: shared.colorShadowFusionEnabled,
    uWetlandBarkMaterial: { value: barkMaterial ? 1 : 0 },
    uWetlandBarkShadowResponse: { value: 0.34 },
    uWetlandBarkRoundnessEnabled: shared.barkRoundnessEnabled,
    uWetlandTerrainHeightMap: shared.terrainHeightMap,
    uWetlandTerrainWorldSize: shared.terrainWorldSize,
  });
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWetlandWorldPosition;')
    .replace('#include <begin_vertex>', worldPositionVertex);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + shaderDeclarations)
    .replace(
      '#include <shadowmap_pars_fragment>',
      '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>',
    )
    .replace('#include <opaque_fragment>', stylizedShadowFragment);
};

const cloneAndPatch = (
  original: THREE.Material,
  shared: SharedUniforms,
  barkMaterial: boolean,
) => {
  const patched = original.clone();
  const previousOnBeforeCompile = patched.onBeforeCompile.bind(patched);
  patched.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    appendShader(shader, shared, barkMaterial);
  };
  const previousCacheKey = patched.customProgramCacheKey.bind(patched);
  patched.customProgramCacheKey = () => previousCacheKey()
    + `:wetland-solid-shadow-v168:${barkMaterial ? 'bark' : 'solid'}`;
  patched.needsUpdate = true;
  return patched;
};

export const createStylizedObjectShadowSystem = (initialLook: StylizedObjectShadowLook) => {
  const shared: SharedUniforms = {
    keyDirection: { value: new THREE.Vector3(-0.42, 0.76, 0.49).normalize() },
    shadowColor: { value: new THREE.Color(initialLook.shadowColor) },
    shadowBaseStrength: { value: initialLook.shadowBaseStrength },
    shadowColorMix: { value: initialLook.shadowColorMix },
    bounceColor: { value: new THREE.Color(initialLook.bounceColor) },
    bounceStrength: { value: initialLook.bounceStrength },
    bounceDistance: { value: initialLook.bounceDistance },
    coreShadowLow: { value: initialLook.coreShadowLow },
    coreShadowHigh: { value: initialLook.coreShadowHigh },
    coreShadowEnabled: { value: 1 },
    dropShadowEnabled: { value: 1 },
    groundBounceEnabled: { value: 1 },
    colorShadowFusionEnabled: { value: 1 },
    barkRoundnessEnabled: { value: 1 },
    terrainHeightMap: { value: null },
    terrainWorldSize: { value: new THREE.Vector2(1, 1) },
  };
  const entries = new Set<RegisteredEntry>();
  const ownedMaterials = new Set<THREE.Material>();
  let enabled = false;

  const setEnabled = (next: boolean) => {
    enabled = next;
    entries.forEach((entry) => {
      entry.mesh.material = enabled ? entry.patched : entry.original;
    });
  };

  return {
    register(root: THREE.Object3D, shouldPatch: (mesh: THREE.Mesh) => boolean) {
      const localEntries: RegisteredEntry[] = [];
      const materialClones = new Map<THREE.Material, THREE.Material>();
      const patchMaterial = (material: THREE.Material) => {
        let patched = materialClones.get(material);
        if (!patched) {
          patched = cloneAndPatch(
            material,
            shared,
            material.userData.wetlandBarkMaterial === true,
          );
          materialClones.set(material, patched);
          ownedMaterials.add(patched);
        }
        return patched;
      };
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || !shouldPatch(object)) return;
        const original = object.material;
        const patched = Array.isArray(original)
          ? original.map(patchMaterial)
          : patchMaterial(original);
        const entry = { mesh: object, original, patched };
        entries.add(entry);
        localEntries.push(entry);
        if (enabled) object.material = patched;
      });
      return () => {
        localEntries.forEach((entry) => {
          entry.mesh.material = entry.original;
          entries.delete(entry);
        });
        materialClones.forEach((material) => {
          material.dispose();
          ownedMaterials.delete(material);
        });
      };
    },
    setEnabled,
    setFeatures(features: Partial<Omit<StylizedObjectShadowFeatures, 'enabled'>>) {
      if (features.coreShadow !== undefined) {
        shared.coreShadowEnabled.value = features.coreShadow ? 1 : 0;
      }
      if (features.dropShadow !== undefined) {
        shared.dropShadowEnabled.value = features.dropShadow ? 1 : 0;
      }
      if (features.groundBounce !== undefined) {
        shared.groundBounceEnabled.value = features.groundBounce ? 1 : 0;
      }
      if (features.colorShadowFusion !== undefined) {
        shared.colorShadowFusionEnabled.value = features.colorShadowFusion ? 1 : 0;
      }
    },
    setBarkRoundness(enabled: boolean) {
      shared.barkRoundnessEnabled.value = enabled ? 1 : 0;
    },
    setLook(nextLook: StylizedObjectShadowLook) {
      shared.shadowColor.value.set(nextLook.shadowColor);
      shared.shadowBaseStrength.value = nextLook.shadowBaseStrength;
      shared.shadowColorMix.value = nextLook.shadowColorMix;
      shared.bounceColor.value.set(nextLook.bounceColor);
      shared.bounceStrength.value = nextLook.bounceStrength;
      shared.bounceDistance.value = nextLook.bounceDistance;
      shared.coreShadowLow.value = nextLook.coreShadowLow;
      shared.coreShadowHigh.value = nextLook.coreShadowHigh;
    },
    updateLighting(keyLight: THREE.DirectionalLight) {
      shared.keyDirection.value.copy(keyLight.position).sub(keyLight.target.position).normalize();
    },
    setTerrainHeightSource(heightMap: THREE.Texture, worldSize: THREE.Vector2) {
      shared.terrainHeightMap.value = heightMap;
      shared.terrainWorldSize.value.copy(worldSize);
    },
    getFeatures: (): StylizedObjectShadowFeatures => ({
      enabled,
      coreShadow: shared.coreShadowEnabled.value > 0.5,
      dropShadow: shared.dropShadowEnabled.value > 0.5,
      groundBounce: shared.groundBounceEnabled.value > 0.5,
      colorShadowFusion: shared.colorShadowFusionEnabled.value > 0.5,
    }),
    dispose() {
      entries.forEach((entry) => {
        entry.mesh.material = entry.original;
      });
      entries.clear();
      ownedMaterials.forEach((material) => material.dispose());
      ownedMaterials.clear();
    },
  };
};
