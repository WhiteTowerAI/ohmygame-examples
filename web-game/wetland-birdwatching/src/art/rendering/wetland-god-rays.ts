import * as THREE from 'three';

type WetlandGodRaySettings = Readonly<{
  enabled: boolean;
  strength: number;
  threshold: number;
  density: number;
  decay: number;
  shape: number;
  contrast: number;
  antiSolarEnabled: boolean;
  antiScale: number;
}>;

type WetlandGodRaySnapshot = WetlandGodRaySettings & Readonly<{
  sunUv: readonly [number, number];
  antiAmount: number;
  frameGate: number;
}>;

type WetlandGodRays = Readonly<{
  render: (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    keyLight: THREE.DirectionalLight,
  ) => void;
  resize: (width: number, height: number, pixelRatio: number) => void;
  setSettings: (settings: Partial<WetlandGodRaySettings>) => void;
  getSnapshot: () => WetlandGodRaySnapshot;
  dispose: () => void;
}>;

const fullScreenVertex = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Ported from Sakura Idle's RAY_MASK_SHADER. The current scene colour and its
// matching depth texture are sampled together, so moving foliage occludes the
// same pixels that supplied the bright-sky seed.
const rayMaskFragment = /* glsl */`
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uTexelFull;
uniform vec2 uSunUV;
uniform vec2 uSunReach;
uniform float uThreshold;
uniform float uFloor;
uniform float uAspect;

#define SKY_DEPTH 0.999995

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec2 o = uTexelFull;
  float sky = 0.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 d = vec2(i == 0 || i == 2 ? -0.5 : 0.5, i < 2 ? -0.5 : 0.5) * o * 2.0;
    sky += step(SKY_DEPTH, texture2D(tDepth, vUv + d).x);
    col += texture2D(tDiffuse, vUv + d).rgb;
  }
  sky *= 0.25;
  col *= 0.25;

  float lightLevel = luma(col);
  float mask = sky * (uFloor + (1.0 - uFloor)
             * smoothstep(uThreshold, uThreshold * 2.6, lightLevel))
             + (1.0 - sky) * 0.16 * smoothstep(1.2, 3.4, lightLevel);
  float dSun = length((vUv - uSunUV) * vec2(uAspect, 1.0));
  mask *= 1.0 - smoothstep(uSunReach.x, uSunReach.y, dSun);
  gl_FragColor = vec4(mask, mask, mask, 1.0);
}
`;

// Sakura Idle's 64-tap, jittered radial march. Decay stays close to one so the
// result describes clearance along the whole path, rather than a local glow.
const rayBlurFragment = /* glsl */`
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 uSunUV;
uniform float uDensity;
uniform float uDecay;
uniform float uJitter;
uniform float uShape;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 delta = (uSunUV - vUv) * uDensity / 64.0;
  vec2 uv = vUv + delta * (hash12(gl_FragCoord.xy + uJitter * 11.7) - 0.5);
  float weight = 1.0;
  float accumulated = 0.0;
  float sampledWeight = 0.0;
  float totalWeight = 0.0;
  for (int i = 0; i < 64; i++) {
    uv += delta;
    float inside = step(0.0, uv.x) * step(uv.x, 1.0)
                 * step(0.0, uv.y) * step(uv.y, 1.0);
    accumulated += texture2D(tDiffuse, uv).r * weight * inside;
    sampledWeight += weight * inside;
    totalWeight += weight;
    weight *= uDecay;
  }
  float ray = accumulated / max(sampledWeight, 0.30 * totalWeight);
  ray = pow(max(ray, 0.0), uShape);
  gl_FragColor = vec4(ray, ray, ray, 1.0);
}
`;

// This keeps Sakura Idle's cross-ray local-extremum high pass. It suppresses the
// smooth radial lobe and keeps only rays that are clearer than both neighbours.
const rayCompositeFragment = /* glsl */`
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform sampler2D tRays;
uniform vec2 uSunUV;
uniform vec3 uRayColor;
uniform vec4 uRayFalloff;
uniform vec2 uRayDamp;
uniform vec3 uRayShaft;
uniform vec2 uRayContrast;
uniform float uAspect;

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec2 rayStructure(vec2 uv, float rayHere) {
  vec2 d = uv - uSunUV;
  float len = max(length(d * vec2(uAspect, 1.0)), 1e-4);
  vec2 perp = normalize(vec2(-d.y * uAspect, d.x)) * vec2(1.0 / uAspect, 1.0);
  float shaft = 0.0;
  float gap = 0.0;
  for (int i = 0; i < 4; i++) {
    float scale = (i == 0 ? 0.008 : i == 1 ? 0.018 : i == 2 ? 0.038 : 0.072)
                * uRayContrast.y * min(len * 3.0, 1.0);
    float a = texture2D(tRays, uv + perp * scale).r;
    float b = texture2D(tRays, uv - perp * scale).r;
    shaft = max(shaft, min(rayHere - a, rayHere - b));
    gap = max(gap, min(a - rayHere, b - rayHere));
  }
  return vec2(shaft - gap, max(shaft, gap));
}

void main() {
  vec3 color = texture2D(tDiffuse, vUv).rgb;
  float ray = texture2D(tRays, vUv).r;
  float dist = length((vUv - uSunUV) * vec2(uAspect, 1.0));
  float window = smoothstep(uRayFalloff.x, uRayFalloff.y, dist)
               * (1.0 - smoothstep(uRayFalloff.z, uRayFalloff.w, dist));
  vec2 structure = rayStructure(vUv, ray);
  float damp = smoothstep(uRayDamp.x, uRayDamp.x + 0.9, luma(color));
  float shaft = max(structure.x - uRayShaft.z, 0.0);
  shaft = shaft / (1.0 + 2.2 * shaft);
  vec3 add = uRayColor * (uRayShaft.x * shaft + uRayShaft.y * ray * ray)
           * window * (1.0 - uRayDamp.y * damp);
  vec3 tint = mix(
    vec3(1.0),
    normalize(max(uRayColor, vec3(1e-3))) * 1.732,
    0.55
  );
  float signedStructure = clamp(
    sign(structure.x) * max(abs(structure.x) - uRayShaft.z, 0.0),
    -0.5,
    0.5
  );
  float contrastWeight = mix(0.55, 1.0, damp);
  vec3 multiply = vec3(1.0)
    + uRayContrast.x * signedStructure * window * contrastWeight * tint;
  gl_FragColor = vec4(max(color * multiply + add, vec3(0.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const createTarget = (depth = false) => {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  if (depth) {
    target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    target.depthTexture.format = THREE.DepthFormat;
  }
  return target;
};

const createPass = (
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
) => new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    uniforms,
    vertexShader: fullScreenVertex,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  }),
);

const smoothstep = (value: number, minimum: number, maximum: number) => (
  THREE.MathUtils.smoothstep(value, minimum, maximum)
);

export const createWetlandGodRays = (): WetlandGodRays => {
  let settings: WetlandGodRaySettings = {
    enabled: false,
    strength: 0.72,
    threshold: 0.62,
    density: 0.78,
    decay: 0.985,
    shape: 1.5,
    contrast: 1.5,
    antiSolarEnabled: true,
    antiScale: 0.75,
  };
  let frame = 0;
  let width = 1;
  let height = 1;
  let antiAmount = 0;
  let frameGate = 0;

  const sceneTarget = createTarget(true);
  const maskTarget = createTarget();
  const rayTarget = createTarget();
  sceneTarget.texture.name = 'wetland-sakura-scene-color';
  maskTarget.texture.name = 'wetland-sakura-ray-mask';
  rayTarget.texture.name = 'wetland-sakura-ray-field';

  const sunUv = new THREE.Vector2(0.5, 0.5);
  const rayColor = new THREE.Color();
  const maskPass = createPass(rayMaskFragment, {
    tDiffuse: { value: sceneTarget.texture },
    tDepth: { value: sceneTarget.depthTexture },
    uTexelFull: { value: new THREE.Vector2(1, 1) },
    uSunUV: { value: sunUv },
    uSunReach: { value: new THREE.Vector2(2.10, 4.40) },
    uThreshold: { value: settings.threshold },
    uFloor: { value: 0.10 },
    uAspect: { value: 1 },
  });
  const blurPass = createPass(rayBlurFragment, {
    tDiffuse: { value: maskTarget.texture },
    uSunUV: { value: sunUv },
    uDensity: { value: settings.density },
    uDecay: { value: settings.decay },
    uJitter: { value: 0 },
    uShape: { value: settings.shape },
  });
  const compositePass = createPass(rayCompositeFragment, {
    tDiffuse: { value: sceneTarget.texture },
    tRays: { value: rayTarget.texture },
    uSunUV: { value: sunUv },
    uRayColor: { value: rayColor },
    uRayFalloff: { value: new THREE.Vector4(0.06, 0.24, 1.50, 3.20) },
    uRayDamp: { value: new THREE.Vector2(0.38, 0.82) },
    uRayShaft: { value: new THREE.Vector3(11.0, 0.05, 0.018) },
    uRayContrast: { value: new THREE.Vector2(settings.contrast, 1.05) },
    uAspect: { value: 1 },
  });
  (compositePass.material as THREE.ShaderMaterial).toneMapped = true;

  const passScene = new THREE.Scene();
  const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const renderPass = (
    renderer: THREE.WebGLRenderer,
    mesh: THREE.Mesh,
    target: THREE.WebGLRenderTarget | null,
  ) => {
    passScene.add(mesh);
    renderer.setRenderTarget(target);
    renderer.render(passScene, passCamera);
    passScene.remove(mesh);
  };

  const cameraForward = new THREE.Vector3();
  const sunDirection = new THREE.Vector3();
  const rayDirection = new THREE.Vector3();
  const viewDirection = new THREE.Vector3();
  const lightPosition = new THREE.Vector3();
  const targetPosition = new THREE.Vector3();
  const updateSun = (
    camera: THREE.PerspectiveCamera,
    keyLight: THREE.DirectionalLight,
  ) => {
    keyLight.getWorldPosition(lightPosition);
    keyLight.target.getWorldPosition(targetPosition);
    sunDirection.copy(lightPosition).sub(targetPosition);
    if (sunDirection.lengthSq() < 1e-6) sunDirection.set(0, 1, 0);
    sunDirection.normalize();
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    camera.getWorldDirection(cameraForward);
    const sunFacing = cameraForward.dot(sunDirection);

    antiAmount = settings.antiSolarEnabled
      ? smoothstep(-sunFacing, 0.02, 0.22)
      : 0;
    rayDirection.copy(sunDirection).multiplyScalar(antiAmount > 0.5 ? -1 : 1);
    const facing = antiAmount > 0.5 ? -sunFacing : sunFacing;
    viewDirection.copy(rayDirection).transformDirection(camera.matrixWorldInverse);

    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
    const tanX = tanY * camera.aspect;
    const viewZ = -viewDirection.z;
    let ndcX: number;
    let ndcY: number;
    if (viewZ > 1e-3) {
      ndcX = (viewDirection.x / viewZ) / tanX;
      ndcY = (viewDirection.y / viewZ) / tanY;
    } else {
      const lateral = Math.hypot(viewDirection.x / tanX, viewDirection.y / tanY) || 1;
      ndcX = (viewDirection.x / tanX) / lateral * 9;
      ndcY = (viewDirection.y / tanY) / lateral * 9;
    }
    const ndcRadius = Math.hypot(ndcX, ndcY);
    const rawRadius = ndcRadius / Math.SQRT2;
    const radiusLimit = 2.6;
    const radiusScale = ndcRadius > radiusLimit ? radiusLimit / ndcRadius : 1;
    sunUv.set(
      THREE.MathUtils.clamp(ndcX * radiusScale * 0.5 + 0.5, -0.8, 1.8),
      THREE.MathUtils.clamp(ndcY * radiusScale * 0.5 + 0.5, -0.8, 1.8),
    );

    const offFrame = 1 - smoothstep(rawRadius, 1.2, 5.0);
    const visibleFacing = smoothstep(facing, -0.30, 0.12);
    const lowSun = smoothstep(-sunDirection.y, -0.62, -0.03);
    frameGate = visibleFacing * offFrame
      * (1 + 0.15 * lowSun)
      * (0.34 + 0.66 * lowSun)
      * (1 + (settings.antiScale - 1) * antiAmount);

    rayColor.copy(keyLight.color);
    const maximum = Math.max(rayColor.r, rayColor.g, rayColor.b, 1e-4);
    rayColor.multiplyScalar(settings.strength * frameGate / maximum);
  };

  const applySettings = () => {
    (maskPass.material as THREE.ShaderMaterial).uniforms.uThreshold.value = settings.threshold;
    const blurUniforms = (blurPass.material as THREE.ShaderMaterial).uniforms;
    blurUniforms.uDensity.value = settings.density;
    blurUniforms.uDecay.value = settings.decay;
    blurUniforms.uShape.value = settings.shape;
    const compositeUniforms = (compositePass.material as THREE.ShaderMaterial).uniforms;
    compositeUniforms.uRayContrast.value.x = settings.contrast * frameGate;
  };

  return {
    render(renderer, scene, camera, keyLight) {
      if (!settings.enabled) {
        renderer.render(scene, camera);
        return;
      }
      updateSun(camera, keyLight);
      applySettings();
      (blurPass.material as THREE.ShaderMaterial).uniforms.uJitter.value = frame % 64;
      frame += 1;

      const previousTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(sceneTarget);
      renderer.clear();
      renderer.render(scene, camera);
      renderPass(renderer, maskPass, maskTarget);
      renderPass(renderer, blurPass, rayTarget);
      renderPass(renderer, compositePass, previousTarget);
    },
    resize(nextWidth, nextHeight, pixelRatio) {
      width = Math.max(1, Math.floor(nextWidth * pixelRatio));
      height = Math.max(1, Math.floor(nextHeight * pixelRatio));
      sceneTarget.setSize(width, height);
      maskTarget.setSize(Math.max(1, Math.floor(width / 4)), Math.max(1, Math.floor(height / 4)));
      rayTarget.setSize(Math.max(1, Math.floor(width / 4)), Math.max(1, Math.floor(height / 4)));
      (maskPass.material as THREE.ShaderMaterial).uniforms.uTexelFull.value.set(1 / width, 1 / height);
      (maskPass.material as THREE.ShaderMaterial).uniforms.uAspect.value = width / height;
      (compositePass.material as THREE.ShaderMaterial).uniforms.uAspect.value = width / height;
    },
    setSettings(nextSettings) {
      settings = {
        ...settings,
        ...nextSettings,
        strength: THREE.MathUtils.clamp(nextSettings.strength ?? settings.strength, 0, 4),
        threshold: THREE.MathUtils.clamp(nextSettings.threshold ?? settings.threshold, 0.05, 1.2),
        density: THREE.MathUtils.clamp(nextSettings.density ?? settings.density, 0.1, 1.4),
        decay: THREE.MathUtils.clamp(nextSettings.decay ?? settings.decay, 0.90, 0.999),
        shape: THREE.MathUtils.clamp(nextSettings.shape ?? settings.shape, 0.5, 3),
        contrast: THREE.MathUtils.clamp(nextSettings.contrast ?? settings.contrast, 0, 4),
        antiScale: THREE.MathUtils.clamp(nextSettings.antiScale ?? settings.antiScale, 0, 1.5),
      };
    },
    getSnapshot: () => ({
      ...settings,
      sunUv: sunUv.toArray() as [number, number],
      antiAmount,
      frameGate,
    }),
    dispose() {
      sceneTarget.dispose();
      maskTarget.dispose();
      rayTarget.dispose();
      [maskPass, blurPass, compositePass].forEach((pass) => {
        pass.geometry.dispose();
        (pass.material as THREE.Material).dispose();
      });
    },
  };
};
