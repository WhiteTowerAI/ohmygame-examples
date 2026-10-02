import * as THREE from 'three';
import type { WetlandDayLighting } from './wetland-shared-world';

export type WetlandSkyPreset = Readonly<{
  elevation: number;
  azimuth: number;
  zenithColor: THREE.ColorRepresentation;
  midColor: THREE.ColorRepresentation;
  horizonColor: THREE.ColorRepresentation;
  hazeColor: THREE.ColorRepresentation;
  fogColor: THREE.ColorRepresentation;
  sunColor: THREE.ColorRepresentation;
  sunGlowColor: THREE.ColorRepresentation;
  sunIntensity: number;
  sunSize: number;
  cloudCoverage: THREE.Vector4Tuple;
  cloudAmount: THREE.Vector4Tuple;
  cloudLitColor: THREE.ColorRepresentation;
  cloudDarkColor: THREE.ColorRepresentation;
  cloudAmbientColor: THREE.ColorRepresentation;
  cloudRimColor: THREE.ColorRepresentation;
}>;

export type WetlandSky = Readonly<{
  root: THREE.Group;
  sunDirection: THREE.Vector3;
  applyPreset: (preset: WetlandSkyPreset) => void;
  setDayLighting: (lighting: WetlandDayLighting) => void;
  setWind: (direction: THREE.Vector2, driftTime: number) => void;
  setCameraPosition: (position: THREE.Vector3) => void;
  dispose: () => void;
}>;

const hash = (x: number, y: number, seed: number) => {
  let value = Math.imul(x | 0, 374761393)
    ^ Math.imul(y | 0, 668265263)
    ^ Math.imul(seed | 0, 1274126177);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
};

const fade = (value: number) => value * value * value * (value * (value * 6 - 15) + 10);

const gradientNoise = (
  x: number,
  y: number,
  period: number,
  seed: number,
  offsetX: number,
  offsetY: number,
) => {
  const wrappedX = ((x % period) + period) % period;
  const wrappedY = ((y % period) + period) % period;
  const angle = hash(wrappedX, wrappedY, seed) * Math.PI * 2;
  return Math.cos(angle) * offsetX + Math.sin(angle) * offsetY;
};

const perlin = (x: number, y: number, period: number, seed: number) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fade(fx);
  const v = fade(fy);
  const n00 = gradientNoise(ix, iy, period, seed, fx, fy);
  const n10 = gradientNoise(ix + 1, iy, period, seed, fx - 1, fy);
  const n01 = gradientNoise(ix, iy + 1, period, seed, fx, fy - 1);
  const n11 = gradientNoise(ix + 1, iy + 1, period, seed, fx - 1, fy - 1);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(n00, n10, u),
    THREE.MathUtils.lerp(n01, n11, u),
    v,
  ) * 1.42;
};

const fbm = (
  u: number,
  v: number,
  base: number,
  octaves: number,
  seed: number,
  gain: number,
  billow: boolean,
) => {
  let sum = 0;
  let amplitude = 0.5;
  let norm = 0;
  let frequency = base;
  for (let octave = 0; octave < octaves; octave += 1) {
    let value = perlin(u * frequency, v * frequency, frequency, seed + octave * 71 + 3);
    if (billow) value = Math.abs(value) * 2 - 1;
    sum += value * amplitude;
    norm += amplitude;
    amplitude *= gain;
    frequency *= 2;
  }
  return sum / norm;
};

const bakeField = (
  size: number,
  base: number,
  octaves: number,
  seed: number,
  gain: number,
  billow: boolean,
) => {
  const field = new Float32Array(size * size);
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = fbm(x / size, y / size, base, octaves, seed, gain, billow);
      field[y * size + x] = value;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }
  const inverseRange = 1 / Math.max(0.000001, maximum - minimum);
  for (let index = 0; index < field.length; index += 1) {
    field[index] = (field[index] - minimum) * inverseRange;
  }
  return field;
};

const makeCloudNoiseTexture = (size = 256) => {
  type CloudLobe = Readonly<{ x: number; y: number; width: number; height: number }>;
  const lobes: readonly CloudLobe[] = [
    { x: 0.14, y: 0.16, width: 0.062, height: 0.052 },
    { x: 0.21, y: 0.11, width: 0.045, height: 0.073 },
    { x: 0.29, y: 0.19, width: 0.072, height: 0.048 },
    { x: 0.38, y: 0.25, width: 0.12, height: 0.105 },
    { x: 0.47, y: 0.17, width: 0.072, height: 0.14 },
    { x: 0.57, y: 0.27, width: 0.10, height: 0.082 },
    { x: 0.54, y: 0.27, width: 0.073, height: 0.062 },
    { x: 0.62, y: 0.21, width: 0.048, height: 0.086 },
    { x: 0.71, y: 0.30, width: 0.067, height: 0.052 },
    { x: 0.86, y: 0.12, width: 0.041, height: 0.063 },
    { x: 0.92, y: 0.19, width: 0.073, height: 0.047 },
    { x: 0.98, y: 0.14, width: 0.045, height: 0.056 },
  ];
  const shapeNoise = bakeField(size, 18, 4, 9137, 0.58, true);
  const contourNoise = bakeField(size, 36, 3, 4421, 0.56, false);
  const highlightNoise = bakeField(size, 4, 2, 1201, 0.52, false);
  const warp = bakeField(size, 2, 2, 3313, 0.54, false);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const index = y * size + x;
      const puffNoise = shapeNoise[index];
      let silhouette = 0;
      let lowerMass = 0;
      let upperMass = 0;
      for (const lobe of lobes) {
        const wrappedDx = ((u - lobe.x + 0.5) % 1 + 1) % 1 - 0.5;
        const dx = Math.abs(wrappedDx / lobe.width);
        const dy = (v - lobe.y) / lobe.height;
        const baseLobe = Math.exp(-(dx * dx + dy * dy) * 1.85);
        const billowDensity = baseLobe * (0.46 + puffNoise * 0.78);
        const lobeShape = THREE.MathUtils.clamp(
          billowDensity + (contourNoise[index] - 0.5) * baseLobe * 0.24,
          0,
          1,
        );
        silhouette = Math.max(silhouette, lobeShape);
        lowerMass = Math.max(lowerMass, lobeShape * THREE.MathUtils.smoothstep(dy, -0.15, 0.86));
        upperMass = Math.max(upperMass, lobeShape * THREE.MathUtils.smoothstep(-dy, -0.12, 0.82));
      }
      const shape = THREE.MathUtils.clamp(0.08 + silhouette * 0.9, 0, 1);
      const shadow = THREE.MathUtils.clamp(0.32 + lowerMass * 0.54, 0, 1);
      const highlight = THREE.MathUtils.clamp(0.24 + upperMass * (0.54 + highlightNoise[index] * 0.16), 0, 1);
      data[index * 4] = Math.round(shape * 255);
      data[index * 4 + 1] = Math.round(shadow * 255);
      data[index * 4 + 2] = Math.round(highlight * 255);
      data[index * 4 + 3] = Math.round(warp[index] * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'wetland-painted-cloud-field';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
};

const skyVertexShader = /* glsl */`
  varying vec3 vWorldPosition;
  uniform vec3 uCameraWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

// A local, tileable painted cloud field is sampled by longitude and elevation, so the
// sky keeps its silhouette placement independently of the scene and camera distance.
const skyFragmentShader = /* glsl */`
  precision highp float;

  varying vec3 vWorldPosition;
  uniform vec3 uCameraWorldPosition;
  uniform sampler2D uCloudNoise;
  uniform vec3 uZenithColor;
  uniform vec3 uMidColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uHazeColor;
  uniform vec3 uFogColor;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform vec3 uSunGlowColor;
  uniform float uSunIntensity;
  uniform float uSunSize;
  uniform vec2 uWindDirection;
  uniform float uWindTime;
  uniform vec4 uCloudCoverage;
  uniform vec4 uCloudAmount;
  uniform vec3 uCloudLitColor;
  uniform vec3 uCloudDarkColor;
  uniform vec3 uCloudAmbientColor;
  uniform vec3 uCloudRimColor;

  #define SAT(value) clamp(value, 0.0, 1.0)

  vec3 skyGradient(vec3 direction) {
    float elevation = max(direction.y, 0.0);
    float vertical = pow(elevation, 0.62);
    vec3 color = mix(uHorizonColor, uZenithColor, vertical);
    color = mix(color, uMidColor, (1.0 - abs(vertical * 2.0 - 1.0)) * 0.34);
    float haze = exp(-max(direction.y, -0.04) / 0.085);
    color = mix(color, uHazeColor, SAT(haze * 0.72));
    color *= mix(0.92, 1.0, smoothstep(0.0, 0.07, direction.y));
    return color;
  }

  vec4 cloudLayer(
    vec3 direction,
    float floorOffset,
    float scale,
    float speed,
    float coverage,
    float powerCompression,
    float warpAmount,
    float amount,
    float aerial
  ) {
    float highSky = smoothstep(0.38, 0.72, direction.y);
    coverage += highSky * 0.06;
    // Concentrate clear-weather clouds in the lower half of the dome.
    float highSkyFade = smoothstep(0.12, 0.30, direction.y);
    amount *= mix(1.08, 0.02, highSkyFade);
    if (direction.y < 0.004 || amount < 0.003) return vec4(0.0);

    float altitude = asin(clamp(direction.y, 0.0, 1.0)) / 1.57079632679;
    float longitude = atan(direction.z, direction.x) / 6.28318530718 + 0.5;
    // Linear elevation keeps the painted lobes in a readable low cloud bank.
    // The former power curve compressed them into roughly 2-8 degrees, where
    // the park terrain and tree line hid nearly the entire field.
    vec2 projected = vec2(longitude, altitude);
    float distanceRatio = 1.0 - altitude;
    float horizonFade = smoothstep(0.004, 0.045, direction.y);

    vec2 windSpace = projected * vec2(1.0, 0.56) * scale;
    windSpace.y += floorOffset * 0.34;
    vec2 uv = windSpace - uWindDirection * uWindTime * speed;
    vec2 warp = vec2(
      texture2D(uCloudNoise, uv * 0.19 + 0.13).a,
      texture2D(uCloudNoise, uv * 0.23 + 0.61).r
    ) - 0.5;
    uv += warp * warpAmount;

    vec4 cloudField = texture2D(uCloudNoise, uv);
    float detailNoise = texture2D(uCloudNoise, uv * 3.4 + vec2(0.17, 0.43)).r;
    float detailMask = smoothstep(0.12, 0.88, cloudField.r);
    float height = cloudField.r + (detailNoise - 0.5) * 0.18 * detailMask;
    float density = (height - coverage) / max(1.0 - coverage, 0.001);
    float edgeWidth = clamp(fwidth(density) * 1.25, 0.026, 0.09);
    float alpha = smoothstep(-edgeWidth * 0.34, edgeWidth * 0.9, density);
    float core = smoothstep(-edgeWidth * 0.2, edgeWidth * 3.4, density);
    float edge = alpha * (1.0 - core);
    float sunFacing = max(dot(direction, uSunDirection), 0.0);
    float sunWash = pow(sunFacing, 7.0);
    float lowerShadow = smoothstep(0.46, 0.82, cloudField.g);
    float innerShadow = smoothstep(0.42, 0.68, 1.0 - detailNoise) * core;
    float paintedShadow = (1.0 - core) * 0.34 + lowerShadow * 0.72
      + innerShadow * 0.26;
    float paintedHighlight = smoothstep(0.48, 0.78, cloudField.b) * core;
    vec3 color = mix(uCloudAmbientColor, uCloudLitColor, 0.52 + core * 0.37);
    color = mix(color, uCloudDarkColor, SAT(paintedShadow));
    float forwardScatter = pow(max(dot(direction, uSunDirection), 0.0), 12.0);
    color += uCloudRimColor * (paintedHighlight * 0.22 + edge * (0.018 + sunWash * 0.07));
    color += uCloudRimColor * forwardScatter * 0.06;

    float distanceHaze = (1.0 - exp(-distanceRatio * 2.4)) * aerial * 0.11;
    distanceHaze = max(distanceHaze, smoothstep(0.035, 0.0, direction.y) * 0.12);
    color = mix(color, skyGradient(direction) * 1.02, SAT(distanceHaze));
    alpha *= horizonFade * amount;
    float sunTransmission = pow(max(dot(direction, uSunDirection), 0.0), 24.0);
    alpha *= mix(1.0, 0.28, sunTransmission);
    return vec4(max(color, vec3(0.0)), SAT(alpha));
  }

  void main() {
    vec3 direction = normalize(vWorldPosition - uCameraWorldPosition);
    vec3 color = skyGradient(direction);
    vec3 sunDirection = normalize(uSunDirection);
    float cosine = dot(direction, sunDirection);
    float angle = acos(clamp(cosine, -1.0, 1.0));
    float radius = max(uSunSize, 0.0001);
    float sunCore = 1.0 - smoothstep(radius * 0.76, radius * 1.18, angle);
    float aureole = exp(-angle / (radius * 2.7)) * 0.085;
    float veil = exp(-angle / (radius * 10.0)) * 0.016;

    vec3 cloudColor = vec3(0.0);
    float cloudAlpha = 0.0;
    vec4 layer;
    #define ADD_LAYER(index, floorOffset, scale, speed, powerCompression, warpAmount, aerial) \
      layer = cloudLayer(direction, floorOffset, scale, speed, uCloudCoverage.index, \
        powerCompression, warpAmount, uCloudAmount.index, aerial); \
      cloudColor += (1.0 - cloudAlpha) * layer.rgb * layer.a; \
      cloudAlpha += (1.0 - cloudAlpha) * layer.a;

    ADD_LAYER(x, 0.30, 2.15, 0.0105, 0.58, 0.028, 0.46)
    ADD_LAYER(y, 0.22, 4.25, 0.0088, 0.62, 0.022, 0.42)
    ADD_LAYER(z, 0.15, 2.80, 0.0065, 0.68, 0.025, 0.36)
    ADD_LAYER(w, 0.09, 4.10, 0.0048, 0.74, 0.018, 0.31)

    float highSkyCap = mix(1.0, 0.82, smoothstep(0.44, 0.72, direction.y));
    if (cloudAlpha > highSkyCap) {
      cloudColor *= highSkyCap / max(cloudAlpha, 0.0001);
      cloudAlpha = highSkyCap;
    }
    color = cloudColor + color * (1.0 - cloudAlpha);
    color += mix(uSunColor, vec3(1.0), 0.28) * sunCore * uSunIntensity * 0.62;
    color += uSunGlowColor * (aureole + veil) * uSunIntensity;
    color = mix(color, uFogColor * 0.94, smoothstep(0.0, -0.16, direction.y));

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const tupleToVector4 = (value: THREE.Vector4Tuple) => new THREE.Vector4(...value);

export const createWetlandSky = (): WetlandSky => {
  const cloudNoise = makeCloudNoiseTexture();
  const sunDirection = new THREE.Vector3();
  const cameraWorldPosition = new THREE.Vector3();
  const material = new THREE.ShaderMaterial({
    name: 'wetland-sakura-painted-sky',
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uCloudNoise: { value: cloudNoise },
      uCameraWorldPosition: { value: cameraWorldPosition },
      uZenithColor: { value: new THREE.Color() },
      uMidColor: { value: new THREE.Color() },
      uHorizonColor: { value: new THREE.Color() },
      uHazeColor: { value: new THREE.Color() },
      uFogColor: { value: new THREE.Color() },
      uSunDirection: { value: sunDirection },
      uSunColor: { value: new THREE.Color() },
      uSunGlowColor: { value: new THREE.Color() },
      uSunIntensity: { value: 1 },
      uSunSize: { value: 0.025 },
      uWindDirection: { value: new THREE.Vector2(1, 0) },
      uWindTime: { value: 0 },
      uCloudCoverage: { value: new THREE.Vector4() },
      uCloudAmount: { value: new THREE.Vector4() },
      uCloudLitColor: { value: new THREE.Color() },
      uCloudDarkColor: { value: new THREE.Color() },
      uCloudAmbientColor: { value: new THREE.Color() },
      uCloudRimColor: { value: new THREE.Color() },
    },
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
  });
  const geometry = new THREE.SphereGeometry(92, 192, 96);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'wetland-sakura-painted-sky';
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  const root = new THREE.Group();
  root.name = 'wetland-weather-system';
  root.add(mesh);
  let dayLighting: WetlandDayLighting | null = null;
  const applyDayLighting = () => {
    if (!dayLighting) return;
    material.uniforms.uCloudLitColor.value.set(dayLighting.cloudLitColor);
    material.uniforms.uCloudDarkColor.value.set(dayLighting.cloudDarkColor);
    material.uniforms.uCloudAmbientColor.value.set(dayLighting.cloudAmbientColor);
    material.uniforms.uCloudRimColor.value.set(dayLighting.cloudRimColor);
  };

  return {
    root,
    sunDirection,
    applyPreset(preset) {
      const elevation = THREE.MathUtils.degToRad(preset.elevation);
      const azimuth = THREE.MathUtils.degToRad(preset.azimuth);
      sunDirection.setFromSphericalCoords(1, Math.PI / 2 - elevation, azimuth);
      material.uniforms.uZenithColor.value.set(preset.zenithColor);
      material.uniforms.uMidColor.value.set(preset.midColor);
      material.uniforms.uHorizonColor.value.set(preset.horizonColor);
      material.uniforms.uHazeColor.value.set(preset.hazeColor);
      material.uniforms.uFogColor.value.set(preset.fogColor);
      material.uniforms.uSunColor.value.set(preset.sunColor);
      material.uniforms.uSunGlowColor.value.set(preset.sunGlowColor);
      material.uniforms.uSunIntensity.value = preset.sunIntensity;
      material.uniforms.uSunSize.value = preset.sunSize;
      material.uniforms.uCloudCoverage.value.copy(tupleToVector4(preset.cloudCoverage));
      material.uniforms.uCloudAmount.value.copy(tupleToVector4(preset.cloudAmount));
      material.uniforms.uCloudLitColor.value.set(preset.cloudLitColor);
      material.uniforms.uCloudDarkColor.value.set(preset.cloudDarkColor);
      material.uniforms.uCloudAmbientColor.value.set(preset.cloudAmbientColor);
      material.uniforms.uCloudRimColor.value.set(preset.cloudRimColor);
      applyDayLighting();
    },
    setDayLighting(lighting) {
      dayLighting = lighting;
      applyDayLighting();
    },
    setWind(direction, driftTime) {
      material.uniforms.uWindDirection.value.copy(direction);
      material.uniforms.uWindTime.value = driftTime;
    },
    setCameraPosition(position) {
      mesh.position.copy(position);
      cameraWorldPosition.copy(position);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      cloudNoise.dispose();
    },
  };
};
