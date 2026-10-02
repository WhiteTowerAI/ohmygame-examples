import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { isStylizedBirdDetailOutline } from './stylized-bird-detail-outline';

type StylizedBirdPipeline = {
  registerBird: (root: THREE.Object3D) => () => void;
  setOutlineEnabled: (enabled: boolean) => void;
  isOutlineEnabled: () => boolean;
  setAcesEnabled: (enabled: boolean) => void;
  isAcesEnabled: () => boolean;
  render: () => void;
  setSize: (width: number, height: number, pixelRatio: number) => void;
  dispose: () => void;
};

type StylizedBirdPipelineOptions = {
  outlineEnabled?: boolean;
  acesEnabled?: boolean;
  acesExposure?: number;
};

const visibleEdgeAlphaSource = 'gl_FragColor = vec4(edgeColor, 1.0) * vec4(d);';
const visibleEdgeAlphaReplacement = `float visibleAlpha = 1.0 - step(0.999, visibilityFactor);
float edgeAlpha = step(0.001, d) * visibleAlpha;
gl_FragColor = vec4(edgeColor * edgeAlpha, edgeAlpha);`;
const solidDilationFragmentShader = `
#include <common>
varying vec2 vUv;
uniform sampler2D colorTexture;
uniform vec2 texSize;
uniform vec2 direction;
uniform float kernelRadius;

void main() {
  vec2 invSize = 1.0 / texSize;
  vec2 delta = direction * invSize * kernelRadius / float(MAX_RADIUS);
  vec2 uvOffset = delta;
  vec4 strongestSample = texture2D(colorTexture, vUv);
  for (int i = 1; i <= MAX_RADIUS; i++) {
    vec4 sample1 = texture2D(colorTexture, vUv + uvOffset);
    vec4 sample2 = texture2D(colorTexture, vUv - uvOffset);
    if (sample1.a > strongestSample.a) strongestSample = sample1;
    if (sample2.a > strongestSample.a) strongestSample = sample2;
    uvOffset += delta;
  }
  gl_FragColor = strongestSample;
}`;
const minimumOutlinedDiameter = 8;
const minimumDetailOutlinedDiameter = 24;
const fullOutlineDiameter = 140;
const farOutlineCssThickness = 0.5;
const nearOutlineCssThickness = 3;

export const createStylizedBirdPipeline = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: StylizedBirdPipelineOptions = {},
): StylizedBirdPipeline => {
  let acesEnabled = options.acesEnabled ?? true;
  const acesExposure = options.acesExposure ?? 1.12;
  const applyColorManagement = () => {
    renderer.toneMapping = acesEnabled
      ? THREE.ACESFilmicToneMapping
      : THREE.NoToneMapping;
    renderer.toneMappingExposure = acesEnabled ? acesExposure : 1;
  };
  applyColorManagement();

  const renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, renderTarget);
  const renderPass = new RenderPass(scene, camera);
  const outlinePass = new OutlinePass(new THREE.Vector2(1, 1), scene, camera, []);
  const outputPass = new OutputPass();
  const fxaaPass = new FXAAPass();
  const registeredBirds = new Set<THREE.Object3D>();
  const bounds = new THREE.Box3();
  const objectBounds = new THREE.Box3();
  const sphere = new THREE.Sphere();
  const viewCenter = new THREE.Vector3();
  let viewportHeight = 1;
  let currentPixelRatio = 1;
  let outlineEnabled = options.outlineEnabled ?? true;

  const syncDetailOutlineVisibility = (root: THREE.Object3D, visible = outlineEnabled) => {
    root.traverse((object) => {
      if (isStylizedBirdDetailOutline(object)) object.visible = visible;
    });
  };

  outlinePass.visibleEdgeColor.set('#000000');
  outlinePass.hiddenEdgeColor.set('#000000');
  outlinePass.edgeGlow = 0;
  outlinePass.edgeThickness = nearOutlineCssThickness;
  outlinePass.edgeStrength = 1;
  outlinePass.pulsePeriod = 0;
  outlinePass.usePatternTexture = false;

  const edgeShader = outlinePass.edgeDetectionMaterial.fragmentShader;
  if (!edgeShader.includes(visibleEdgeAlphaSource)) {
    throw new Error('Unsupported OutlinePass edge shader');
  }
  outlinePass.edgeDetectionMaterial.fragmentShader = edgeShader.replace(
    visibleEdgeAlphaSource,
    visibleEdgeAlphaReplacement,
  );
  outlinePass.edgeDetectionMaterial.needsUpdate = true;

  // OutlinePass normally widens edges with a Gaussian blur, which makes a
  // thicker line progressively paler. A max-filter dilation keeps the whole
  // expanded line opaque, matching an inverted hull without per-mesh seams.
  outlinePass.separableBlurMaterial1.fragmentShader = solidDilationFragmentShader;
  outlinePass.separableBlurMaterial1.needsUpdate = true;

  // OutlinePass emits premultiplied edge color. This blend produces a dark outline
  // instead of the pass's default additive glow.
  outlinePass.overlayMaterial.blending = THREE.CustomBlending;
  outlinePass.overlayMaterial.blendEquation = THREE.AddEquation;
  outlinePass.overlayMaterial.blendSrc = THREE.OneFactor;
  outlinePass.overlayMaterial.blendDst = THREE.OneMinusSrcAlphaFactor;
  outlinePass.overlayMaterial.needsUpdate = true;

  composer.addPass(renderPass);
  composer.addPass(outlinePass);
  composer.addPass(outputPass);
  composer.addPass(fxaaPass);

  const projectedDiameter = (root: THREE.Object3D) => {
    bounds.makeEmpty();
    root.updateWorldMatrix(true, true);
    root.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh) || isStylizedBirdDetailOutline(object)) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      if (!object.geometry.boundingBox) return;
      objectBounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
      bounds.union(objectBounds);
    });
    if (bounds.isEmpty()) return 0;
    bounds.getBoundingSphere(sphere);
    if (!(camera instanceof THREE.PerspectiveCamera)) return Number.POSITIVE_INFINITY;
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    viewCenter.copy(sphere.center).applyMatrix4(camera.matrixWorldInverse);
    const distance = Math.max(-viewCenter.z, camera.near);
    const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
    return sphere.radius / (distance * Math.tan(halfFov)) * viewportHeight;
  };

  return {
    registerBird(root) {
      registeredBirds.add(root);
      syncDetailOutlineVisibility(root);
      return () => registeredBirds.delete(root);
    },
    setOutlineEnabled(enabled) {
      outlineEnabled = enabled;
      registeredBirds.forEach((root) => syncDetailOutlineVisibility(root));
    },
    isOutlineEnabled: () => outlineEnabled,
    setAcesEnabled(enabled) {
      acesEnabled = enabled;
      applyColorManagement();
    },
    isAcesEnabled: () => acesEnabled,
    render() {
      const visibleBirds = [...registeredBirds].filter((root) => root.visible);
      const birdDiameters = new Map(visibleBirds.map((root) => [root, projectedDiameter(root)]));
      visibleBirds.forEach((root) => {
        const detailVisible = outlineEnabled
          && (birdDiameters.get(root) ?? 0) >= minimumDetailOutlinedDiameter;
        syncDetailOutlineVisibility(root, detailVisible);
      });
      const screenOutlinedBirds = visibleBirds.filter((root) => (
        root.userData.stylizedOutlineMode !== 'parts'
      ));
      const diameters = new Map(screenOutlinedBirds.map((root) => [root, projectedDiameter(root)]));
      outlinePass.selectedObjects = outlineEnabled
        ? screenOutlinedBirds.filter((root) => (
            (diameters.get(root) ?? 0) >= minimumOutlinedDiameter
          ))
        : [];
      const largestDiameter = Math.max(0, ...diameters.values());
      const distanceScale = THREE.MathUtils.smoothstep(
        largestDiameter,
        minimumOutlinedDiameter,
        fullOutlineDiameter,
      );
      const cssThickness = THREE.MathUtils.lerp(
        farOutlineCssThickness,
        nearOutlineCssThickness,
        distanceScale,
      );
      outlinePass.edgeThickness = Math.min(
        4,
        cssThickness * currentPixelRatio / outlinePass.downSampleRatio,
      );
      outlinePass.edgeStrength = THREE.MathUtils.lerp(
        0.35,
        1,
        THREE.MathUtils.smoothstep(largestDiameter, minimumOutlinedDiameter, 30),
      );
      composer.render();
    },
    setSize(width, height, pixelRatio) {
      viewportHeight = height;
      currentPixelRatio = pixelRatio;
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    dispose() {
      outlinePass.dispose();
      outputPass.dispose();
      fxaaPass.dispose();
      composer.dispose();
      registeredBirds.clear();
    },
  };
};
