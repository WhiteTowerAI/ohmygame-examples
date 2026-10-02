import * as THREE from 'three';
import type { WetlandWindFrame } from './wetland-weather';

type WetlandFlatWater = Readonly<{
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  setColors: (colors: NonNullable<WetlandFlatWaterOptions['colors']>) => void;
  update: (elapsed: number, wind: WetlandWindFrame) => void;
}>;

type WetlandFlatWaterOptions = Readonly<{
  center: THREE.Vector2;
  radius: THREE.Vector2;
  waterLevel: number;
  geometryMargin?: number;
  colors?: Readonly<{
    deep: THREE.ColorRepresentation;
    mid: THREE.ColorRepresentation;
    shallow: THREE.ColorRepresentation;
    ripple: THREE.ColorRepresentation;
  }>;
  semanticDistanceField?: Readonly<{
    data: Float32Array;
    width: number;
    height: number;
    worldWidth: number;
    worldDepth: number;
    distanceScale: number;
  }>;
}>;

const vertexShader = /* glsl */`
  varying vec2 vLocalXZ;
  varying vec2 vUv;

  void main() {
    vLocalXZ = position.xz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;

  uniform float uTime;
  uniform float uWindSpeed;
  uniform float uWindStrength;
  uniform vec2 uWindDirection;
uniform sampler2D uSemanticDistanceMap;
uniform float uSemanticDistanceRange;
uniform float uSemanticDistanceScale;
uniform vec2 uSemanticWorldSize;
uniform vec3 uRippleColor;
  varying vec2 vLocalXZ;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 cell = floor(p);
    vec2 local = fract(p);
    local = local * local * (3.0 - 2.0 * local);
    float a = hash21(cell);
    float b = hash21(cell + vec2(1.0, 0.0));
    float c = hash21(cell + vec2(0.0, 1.0));
    float d = hash21(cell + vec2(1.0));
    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  float brokenLine(float phase, float start, float end) {
    return smoothstep(start, start + 0.035, phase)
      * (1.0 - smoothstep(end - 0.045, end, phase));
  }

  void main() {
    float encodedDistance = texture2D(
      uSemanticDistanceMap,
      clamp(
        vec2(
          vLocalXZ.x / uSemanticWorldSize.x + 0.5,
          vLocalXZ.y / uSemanticWorldSize.y + 0.5
        ),
        vec2(0.0),
        vec2(1.0)
      )
    ).r;
    float shoreDistance = (encodedDistance * 2.0 - 1.0)
      * uSemanticDistanceRange / max(uSemanticDistanceScale, 0.0001);
    float waterDepth = -shoreDistance;
    if (waterDepth <= 0.015) discard;

    vec2 windDirection = normalize(uWindDirection);
    vec2 crossWind = vec2(-windDirection.y, windDirection.x);
    float windTime = uTime * uWindSpeed;
    float broadNoise = valueNoise(vLocalXZ * 0.34 + windDirection * windTime * 0.055);
    float detailNoise = valueNoise(vLocalXZ * 1.18 - crossWind * windTime * 0.085);
    float breakup = smoothstep(0.34, 0.68, broadNoise * 0.64 + detailNoise * 0.36);

    // Elemental-style rings advance from the true curved shore and are broken
    // into short, uneven segments by world-space noise.
    float shorePhase = fract((waterDepth + windTime * 0.085 + (broadNoise - 0.5) * 0.12) * 2.45);
    float shoreRing = brokenLine(shorePhase, 0.025, 0.46);
    float shoreZone = smoothstep(0.025, 0.11, waterDepth)
      * (1.0 - smoothstep(0.74, 1.12, waterDepth));
    float shoreRipple = shoreRing * shoreZone * breakup;

    // Bruno-style interior fragments use the same distance phase but a finer
    // frequency and directional breakup, producing scattered pale strokes.
    float interiorNoise = valueNoise(
      vec2(
        dot(vLocalXZ, windDirection) * 1.9 - windTime * 0.18,
        dot(vLocalXZ, crossWind) * 4.6
      )
    );
    float interiorPhase = fract(
      waterDepth * 8.6 + windTime * 0.16 + broadNoise * 0.58
    );
    float interiorLine = smoothstep(0.02, 0.045, interiorPhase)
      * (1.0 - smoothstep(0.11, 0.155, interiorPhase));
    float interiorZone = smoothstep(0.72, 1.45, waterDepth);
    float interiorBreakup = smoothstep(0.51, 0.70, interiorNoise)
      * smoothstep(0.38, 0.59, detailNoise);
    float interiorRipple = interiorLine * interiorZone * interiorBreakup;

    float ripple = max(shoreRipple * 0.82, interiorRipple * 0.50);
    ripple *= 0.76 + uWindStrength * 0.28;
    if (ripple < 0.012) discard;
    gl_FragColor = vec4(uRippleColor, ripple * 0.72);
  }
`;

export const createWetlandFlatWater = (
  options: WetlandFlatWaterOptions,
): WetlandFlatWater => {
  const semanticField = options.semanticDistanceField;
  const geometryMargin = options.geometryMargin ?? 0.48;
  const geometry = new THREE.PlaneGeometry(
    semanticField
      ? semanticField.worldWidth + geometryMargin * 2
      : options.radius.x * 2 * (1 + geometryMargin),
    semanticField
      ? semanticField.worldDepth + geometryMargin * 2
      : options.radius.y * 2 * (1 + geometryMargin),
    1,
    1,
  );
  geometry.rotateX(-Math.PI / 2);

  const semanticDistanceRange = 6;
  const width = semanticField?.width ?? 1;
  const height = semanticField?.height ?? 1;
  const pixels = new Uint8Array(width * height * 4);
  if (semanticField) {
    for (let index = 0; index < semanticField.data.length; index += 1) {
      const encoded = THREE.MathUtils.clamp(
        semanticField.data[index] / semanticDistanceRange * 0.5 + 0.5,
        0,
        1,
      );
      pixels[index * 4] = Math.round(encoded * 255);
      pixels[index * 4 + 1] = pixels[index * 4];
      pixels[index * 4 + 2] = pixels[index * 4];
      pixels[index * 4 + 3] = 255;
    }
  } else {
    pixels.fill(255);
  }
  const semanticTexture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  semanticTexture.name = 'wetland-ripple-distance-field';
  semanticTexture.magFilter = THREE.LinearFilter;
  semanticTexture.minFilter = THREE.LinearFilter;
  semanticTexture.wrapS = THREE.ClampToEdgeWrapping;
  semanticTexture.wrapT = THREE.ClampToEdgeWrapping;
  semanticTexture.generateMipmaps = false;
  semanticTexture.needsUpdate = true;

  const uniforms = {
    uTime: { value: 0 },
    uWindSpeed: { value: 0.74 },
    uWindStrength: { value: 0.58 },
    uWindDirection: { value: new THREE.Vector2(Math.cos(0.56), Math.sin(0.56)) },
    uSemanticDistanceMap: { value: semanticTexture },
    uSemanticDistanceRange: { value: semanticDistanceRange },
    uSemanticDistanceScale: { value: semanticField?.distanceScale ?? 1 },
    uSemanticWorldSize: {
      value: new THREE.Vector2(
        semanticField?.worldWidth ?? options.radius.x * 2,
        semanticField?.worldDepth ?? options.radius.y * 2,
      ),
    },
    uRippleColor: { value: new THREE.Color(options.colors?.ripple ?? '#eef7dc') },
  };
  const material = new THREE.ShaderMaterial({
    name: 'wetland-transparent-hybrid-ripples',
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'wetland-flat-water-surface';
  mesh.position.set(
    semanticField ? 0 : options.center.x,
    options.waterLevel + 0.018,
    semanticField ? 0 : options.center.y,
  );
  mesh.renderOrder = 3;

  return {
    mesh,
    setColors(colors) {
      uniforms.uRippleColor.value.set(colors.ripple);
    },
    update(elapsed, wind) {
      uniforms.uTime.value = elapsed;
      uniforms.uWindSpeed.value = wind.speed;
      uniforms.uWindStrength.value = wind.strength;
      uniforms.uWindDirection.value.copy(wind.direction);
    },
  };
};
