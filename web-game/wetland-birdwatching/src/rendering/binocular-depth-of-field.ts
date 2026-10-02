import * as THREE from 'three';

export type BinocularDepthOfFieldSettings = Readonly<{
  enabled: boolean;
  focusDistance: number;
  clearHalfWidth: number;
  featherWidth: number;
  maxBlurPixels: number;
}>;

export type BinocularDepthOfFieldSnapshot = BinocularDepthOfFieldSettings & Readonly<{
  width: number;
  height: number;
  depthWidth: number;
  depthHeight: number;
}>;

const fullscreenVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const depthOfFieldFragmentShader = `
#include <packing>

varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uCameraNear;
uniform float uCameraFar;
uniform float uFocusDistance;
uniform float uClearHalfWidth;
uniform float uFeatherWidth;
uniform float uMaxBlurPixels;

float viewDistanceAt(vec2 uv) {
  float depth = unpackRGBAToDepth(texture2D(tDepth, uv));
  return -perspectiveDepthToViewZ(depth, uCameraNear, uCameraFar);
}

float blurAmountAt(vec2 uv) {
  float distance = viewDistanceAt(uv);
  float outsideClearBand = max(abs(distance - uFocusDistance) - uClearHalfWidth, 0.0);
  return smoothstep(0.0, uFeatherWidth, outsideClearBand);
}

void main() {
  vec4 center = texture2D(tColor, vUv);
  float blurAmount = blurAmountAt(vUv);
  if (blurAmount < 0.002) {
    gl_FragColor = center;
    return;
  }

  vec2 radius = vec2(uMaxBlurPixels * blurAmount) / uResolution;
  vec4 color = center * 0.18;
  color += texture2D(tColor, vUv + vec2( 0.000,  1.000) * radius) * 0.082;
  color += texture2D(tColor, vUv + vec2( 0.707,  0.707) * radius) * 0.082;
  color += texture2D(tColor, vUv + vec2( 1.000,  0.000) * radius) * 0.082;
  color += texture2D(tColor, vUv + vec2( 0.707, -0.707) * radius) * 0.082;
  color += texture2D(tColor, vUv + vec2( 0.000, -1.000) * radius) * 0.082;
  color += texture2D(tColor, vUv + vec2(-0.707, -0.707) * radius) * 0.082;
  color += texture2D(tColor, vUv + vec2(-1.000,  0.000) * radius) * 0.082;
  color += texture2D(tColor, vUv + vec2(-0.707,  0.707) * radius) * 0.082;
  color += texture2D(tColor, vUv + vec2( 0.383,  0.924) * radius * 1.8) * 0.041;
  color += texture2D(tColor, vUv + vec2( 0.924, -0.383) * radius * 1.8) * 0.041;
  color += texture2D(tColor, vUv + vec2(-0.383, -0.924) * radius * 1.8) * 0.041;
  color += texture2D(tColor, vUv + vec2(-0.924,  0.383) * radius * 1.8) * 0.041;
  gl_FragColor = color;
}
`;

const depthScale = 0.5;

export const createBinocularDepthOfField = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
) => {
  let settings: BinocularDepthOfFieldSettings = {
    enabled: false,
    focusDistance: 12,
    clearHalfWidth: 3,
    featherWidth: 1.68,
    maxBlurPixels: 5.2,
  };
  let width = 1;
  let height = 1;
  let colorTexture = new THREE.FramebufferTexture(1, 1);
  colorTexture.minFilter = THREE.LinearFilter;
  colorTexture.magFilter = THREE.LinearFilter;
  colorTexture.colorSpace = THREE.NoColorSpace;

  const depthTarget = new THREE.WebGLRenderTarget(1, 1, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  depthTarget.texture.colorSpace = THREE.NoColorSpace;
  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    side: THREE.DoubleSide,
  });

  const uniforms = {
    tColor: { value: colorTexture },
    tDepth: { value: depthTarget.texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCameraNear: { value: camera.near },
    uCameraFar: { value: camera.far },
    uFocusDistance: { value: settings.focusDistance },
    uClearHalfWidth: { value: settings.clearHalfWidth },
    uFeatherWidth: { value: settings.featherWidth },
    uMaxBlurPixels: { value: settings.maxBlurPixels },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: fullscreenVertexShader,
    fragmentShader: depthOfFieldFragmentShader,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const passScene = new THREE.Scene();
  const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  passScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  const setSize = (nextWidth: number, nextHeight: number, pixelRatio: number) => {
    width = Math.max(1, Math.floor(nextWidth * pixelRatio));
    height = Math.max(1, Math.floor(nextHeight * pixelRatio));
    colorTexture.dispose();
    colorTexture = new THREE.FramebufferTexture(width, height);
    colorTexture.minFilter = THREE.LinearFilter;
    colorTexture.magFilter = THREE.LinearFilter;
    colorTexture.colorSpace = THREE.NoColorSpace;
    uniforms.tColor.value = colorTexture;
    uniforms.uResolution.value.set(width, height);
    depthTarget.setSize(
      Math.max(1, Math.floor(width * depthScale)),
      Math.max(1, Math.floor(height * depthScale)),
    );
  };

  return {
    setSettings(nextSettings: Partial<BinocularDepthOfFieldSettings>) {
      settings = {
        enabled: nextSettings.enabled ?? settings.enabled,
        focusDistance: Math.max(0.1, nextSettings.focusDistance ?? settings.focusDistance),
        clearHalfWidth: Math.max(0.05, nextSettings.clearHalfWidth ?? settings.clearHalfWidth),
        featherWidth: Math.max(0.05, nextSettings.featherWidth ?? settings.featherWidth),
        maxBlurPixels: THREE.MathUtils.clamp(
          nextSettings.maxBlurPixels ?? settings.maxBlurPixels,
          0,
          12,
        ),
      };
      uniforms.uFocusDistance.value = settings.focusDistance;
      uniforms.uClearHalfWidth.value = settings.clearHalfWidth;
      uniforms.uFeatherWidth.value = settings.featherWidth;
      uniforms.uMaxBlurPixels.value = settings.maxBlurPixels;
    },
    render(renderScene: () => void) {
      if (!settings.enabled) {
        renderScene();
        return;
      }
      const previousTarget = renderer.getRenderTarget();
      renderScene();
      renderer.copyFramebufferToTexture(colorTexture);

      renderer.setRenderTarget(depthTarget);
      renderer.clear();
      const previousOverrideMaterial = scene.overrideMaterial;
      try {
        scene.overrideMaterial = depthMaterial;
        renderer.render(scene, camera);
      } finally {
        scene.overrideMaterial = previousOverrideMaterial;
      }

      uniforms.uCameraNear.value = camera.near;
      uniforms.uCameraFar.value = camera.far;
      renderer.setRenderTarget(previousTarget);
      renderer.render(passScene, passCamera);
    },
    setSize,
    getSnapshot(): BinocularDepthOfFieldSnapshot {
      return {
        ...settings,
        width,
        height,
        depthWidth: depthTarget.width,
        depthHeight: depthTarget.height,
      };
    },
    dispose() {
      colorTexture.dispose();
      depthTarget.dispose();
      depthMaterial.dispose();
      material.dispose();
      (passScene.children[0] as THREE.Mesh).geometry.dispose();
    },
  };
};
