import * as THREE from 'three';

export type WetlandCanopyShaftSettings = Readonly<{
  enabled: boolean;
  strength: number;
  length: number;
  width: number;
  count: number;
  forwardScatter: number;
}>;

export type WetlandCanopyShafts = Readonly<{
  root: THREE.Group;
  rebuild: (root: THREE.Object3D) => void;
  update: (
    elapsed: number,
    camera: THREE.PerspectiveCamera,
    keyLight: THREE.DirectionalLight,
    fog: THREE.Fog | THREE.FogExp2 | null,
  ) => void;
  setSettings: (settings: Partial<WetlandCanopyShaftSettings>) => void;
  getSnapshot: () => WetlandCanopyShaftSettings & Readonly<{ treeCount: number; instanceCount: number }>;
  dispose: () => void;
}>;

const shaftVertexShader = /* glsl */`
attribute vec4 aShaft;
uniform vec3 uEyePos;
uniform vec3 uSunDir;
uniform float uShaftLen;
uniform float uWindTime;
varying vec2 vSt;
varying vec3 vWorldPos;
varying float vSeed;

void main() {
  vec3 origin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 dir = -normalize(uSunDir);
  vec3 toEye = normalize(uEyePos - origin + vec3(0.0, 1e-4, 0.0));
  vec3 right = cross(dir, toEye);
  float rightLength = length(right);
  right = rightLength > 1e-4
    ? right / rightLength
    : normalize(cross(dir, vec3(0.0, 1.0, 0.001)));

  float along = uv.y;
  float across = uv.x * 2.0 - 1.0;
  float width = aShaft.z * (0.62 + 0.85 * along);
  float wobble = sin(origin.x * 0.43 + origin.z * 0.17 + uWindTime * 0.10
                 + along * 2.4) * 0.36 * along;
  vec3 worldPosition = origin + dir * (along * aShaft.y * uShaftLen)
    + right * (across * width + wobble);
  vSt = vec2(across, along);
  vSeed = aShaft.w;
  vWorldPos = worldPosition;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
}
`;

const shaftFragmentShader = /* glsl */`
uniform float uStrength;
uniform float uForwardPower;
uniform vec3 uShaftColor;
uniform vec3 uSunColor;
uniform float uWindTime;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uFogColor;
uniform vec3 uSunDir;
varying vec2 vSt;
varying vec3 vWorldPos;
varying float vSeed;

void main() {
  if (uStrength <= 0.002) discard;
  vec3 toCamera = cameraPosition - vWorldPos;
  float distanceToCamera = length(toCamera);
  vec3 viewDirection = toCamera / max(distanceToCamera, 1e-4);
  float forward = pow(
    clamp(dot(-viewDirection, normalize(uSunDir)), 0.0, 1.0),
    uForwardPower
  );
  float across = pow(max(0.0, 1.0 - vSt.x * vSt.x), 1.7);
  float along = smoothstep(0.0, 0.11, vSt.y)
              * (1.0 - smoothstep(0.40, 1.0, vSt.y));
  float flicker = 0.62 + 0.38 * (sin(vSt.y * 19.47 + vSeed * 41.0
                                  + uWindTime * 0.22) * 0.5 + 0.5);
  float alpha = across * along * flicker * forward * uStrength;
  vec3 color = uShaftColor * uSunColor * alpha;
  float aerial = smoothstep(uFogNear, uFogFar, distanceToCamera);
  color = mix(color, color * mix(vec3(1.0), uFogColor, 0.45), aerial);
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const hash = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

export const createWetlandCanopyShafts = (): WetlandCanopyShafts => {
  let settings: WetlandCanopyShaftSettings = {
    enabled: false,
    strength: 0.75,
    length: 2.4,
    width: 0.52,
    count: 2,
    forwardScatter: 2.2,
  };
  const root = new THREE.Group();
  root.name = 'wetland-sakura-object-space-canopy-shafts';
  root.renderOrder = 4;
  let mesh: THREE.InstancedMesh | null = null;
  let geometry: THREE.PlaneGeometry | null = null;
  let material: THREE.ShaderMaterial | null = null;
  let treeCount = 0;
  let instanceCount = 0;
  let lastStudyRoot: THREE.Object3D | null = null;
  const origins: THREE.Vector3[] = [];
  const bounds = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const lightPosition = new THREE.Vector3();
  const targetPosition = new THREE.Vector3();
  const sunDirection = new THREE.Vector3();

  const disposeMesh = (clearOrigins = true) => {
    if (mesh) root.remove(mesh);
    geometry?.dispose();
    material?.dispose();
    mesh = null;
    geometry = null;
    material = null;
    if (clearOrigins) origins.length = 0;
    instanceCount = 0;
  };

  const buildMesh = () => {
    disposeMesh(false);
    if (origins.length === 0) return;
    geometry = new THREE.PlaneGeometry(1, 1, 1, 7);
    const attributes = new Float32Array(origins.length * 4);
    const transforms = new THREE.Matrix4();
    const shaftPosition = new THREE.Vector3();
    for (let index = 0; index < origins.length; index += 1) {
      const seed = index + 1;
      shaftPosition.copy(origins[index]);
      transforms.makeTranslation(shaftPosition.x, shaftPosition.y, shaftPosition.z);
      attributes[index * 4] = hash(seed * 2.17);
      attributes[index * 4 + 1] = 0.60 + hash(seed * 4.31) * 0.75;
      attributes[index * 4 + 2] = settings.width * (0.52 + hash(seed * 7.13) * 0.48);
      attributes[index * 4 + 3] = hash(seed * 11.29);
    }
    geometry.setAttribute('aShaft', new THREE.InstancedBufferAttribute(attributes, 4));
    material = new THREE.ShaderMaterial({
      name: 'wetland-sakura-object-space-shaft-material',
      uniforms: {
        uEyePos: { value: new THREE.Vector3() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uShaftLen: { value: settings.length },
        uStrength: { value: settings.strength },
        uForwardPower: { value: settings.forwardScatter },
        uShaftColor: { value: new THREE.Color('#ffe9cf') },
        uSunColor: { value: new THREE.Color('#fff4df') },
        uWindTime: { value: 0 },
        uFogNear: { value: 30 },
        uFogFar: { value: 150 },
        uFogColor: { value: new THREE.Color('#bfd1c2') },
      },
      vertexShader: shaftVertexShader,
      fragmentShader: shaftFragmentShader,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      toneMapped: true,
    });
    mesh = new THREE.InstancedMesh(geometry, material, origins.length);
    mesh.name = 'wetland-sakura-object-space-shafts';
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    for (let index = 0; index < origins.length; index += 1) {
      transforms.makeTranslation(origins[index].x, origins[index].y, origins[index].z);
      mesh.setMatrixAt(index, transforms);
    }
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
    instanceCount = origins.length;
    mesh.visible = settings.enabled;
  };

  const rebuild = (studyRoot: THREE.Object3D) => {
      disposeMesh();
      lastStudyRoot = studyRoot;
      treeCount = 0;
      studyRoot.updateWorldMatrix(true, true);
      const treeRoots: THREE.Object3D[] = [];
      studyRoot.traverse((object) => {
        if (object.name.startsWith('wetland-') && object.name.includes('-tree-')) treeRoots.push(object);
      });
      treeRoots.forEach((treeRoot, treeIndex) => {
        bounds.makeEmpty();
        let foliageFound = false;
        treeRoot.traverse((object) => {
          if (!(object instanceof THREE.InstancedMesh)
            || object.userData.treeRole !== 'foliage-occluder') return;
          if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
          if (!object.geometry.boundingBox) return;
          bounds.expandByObject(object);
          foliageFound = true;
        });
        if (!foliageFound || bounds.isEmpty()) return;
        treeCount += 1;
        bounds.getCenter(center);
        bounds.getSize(size);
        const count = Math.max(1, Math.min(6, Math.round(settings.count)));
        for (let index = 0; index < count; index += 1) {
          const seed = treeIndex * 37 + index * 17 + 11;
          const x = center.x + (hash(seed) - 0.5) * size.x * 0.72;
          const z = center.z + (hash(seed + 1.3) - 0.5) * size.z * 0.72;
          const y = center.y + (hash(seed + 4.7) - 0.5) * size.y * 0.38;
          origins.push(new THREE.Vector3(x, y, z));
        }
      });
      buildMesh();
  };

  return {
    root,
    rebuild,
    update(elapsed, camera, keyLight, fog) {
      if (!material || !mesh) return;
      keyLight.getWorldPosition(lightPosition);
      keyLight.target.getWorldPosition(targetPosition);
      sunDirection.copy(lightPosition).sub(targetPosition).normalize();
      const uniforms = material.uniforms;
      uniforms.uEyePos.value.copy(camera.position);
      uniforms.uSunDir.value.copy(sunDirection);
      uniforms.uSunColor.value.copy(keyLight.color);
      uniforms.uWindTime.value = elapsed;
      uniforms.uShaftLen.value = settings.length;
      uniforms.uStrength.value = settings.enabled ? settings.strength : 0;
      uniforms.uForwardPower.value = settings.forwardScatter;
      if (fog instanceof THREE.Fog) {
        uniforms.uFogNear.value = fog.near;
        uniforms.uFogFar.value = fog.far;
        uniforms.uFogColor.value.copy(fog.color);
      } else {
        uniforms.uFogNear.value = 30;
        uniforms.uFogFar.value = 150;
      }
      mesh.visible = settings.enabled;
    },
    setSettings(nextSettings) {
      settings = {
        ...settings,
        ...nextSettings,
        strength: THREE.MathUtils.clamp(nextSettings.strength ?? settings.strength, 0, 3),
        length: THREE.MathUtils.clamp(nextSettings.length ?? settings.length, 0.4, 5),
        width: THREE.MathUtils.clamp(nextSettings.width ?? settings.width, 0.15, 1.5),
        count: THREE.MathUtils.clamp(Math.round(nextSettings.count ?? settings.count), 1, 6),
        forwardScatter: THREE.MathUtils.clamp(nextSettings.forwardScatter ?? settings.forwardScatter, 0.8, 5),
      };
      if (mesh) {
        mesh.visible = settings.enabled;
        if (material) {
          material.uniforms.uStrength.value = settings.strength;
          material.uniforms.uShaftLen.value = settings.length;
          material.uniforms.uForwardPower.value = settings.forwardScatter;
        }
      }
      if (nextSettings.count !== undefined && lastStudyRoot) {
        rebuild(lastStudyRoot);
      } else if (nextSettings.width !== undefined) {
        buildMesh();
      }
    },
    getSnapshot: () => ({ ...settings, treeCount, instanceCount }),
    dispose() {
      disposeMesh();
      treeCount = 0;
      lastStudyRoot = null;
    },
  };
};
