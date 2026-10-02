import * as THREE from 'three';
import type { EnvironmentLightingRig } from './environment-lighting';
import type { EnvironmentLook } from './environment-look';
import { createWetlandSky, type WetlandSkyPreset } from './wetland-sky';
import { createWetlandSakuraIdleSky } from './wetland-sakura-idle-sky';
import { createWetlandWindSystem, type WetlandWindFrame } from './wetland-wind';
import type { WetlandDayLighting } from './wetland-shared-world';

export type { WetlandWindFrame } from './wetland-wind';

export type WetlandWeatherId = 'clear' | 'overcast';
export type WetlandSkyVersion = 'wetland' | 'sakura-idle';

type WetlandWeatherPreset = Readonly<{
  id: WetlandWeatherId;
  look: EnvironmentLook;
  sky: WetlandSkyPreset;
}>;

type WetlandWeatherSystem = Readonly<{
  root: THREE.Group;
  getWeatherId: () => WetlandWeatherId;
  getLook: () => EnvironmentLook;
  getWindStrength: () => number;
  getSkyVersion: () => WetlandSkyVersion;
  applyWeather: (id: WetlandWeatherId) => EnvironmentLook;
  setSkyVersion: (version: WetlandSkyVersion) => void;
  setSunDirection: (direction: THREE.Vector3) => void;
  setDayLighting: (lighting: WetlandDayLighting) => void;
  setWindStrength: (strength: number) => number;
  update: (elapsed: number, cameraPosition: THREE.Vector3, camera?: THREE.Camera) => WetlandWindFrame;
  dispose: () => void;
}>;

const makePreset = (
  id: WetlandWeatherId,
  baseLook: EnvironmentLook,
  changes: Readonly<{ look: Partial<EnvironmentLook>; sky: WetlandSkyPreset }>,
): WetlandWeatherPreset => ({
  id,
  sky: changes.sky,
  look: {
    ...baseLook,
    ...changes.look,
    id: baseLook.id,
    material: { ...baseLook.material, ...(changes.look.material ?? {}) },
  },
});

export const createWetlandWeatherSystem = (
  scene: THREE.Scene,
  lighting: EnvironmentLightingRig,
  baseLook: EnvironmentLook,
  options: Readonly<{ syncKeyToSky?: boolean; applyLighting?: boolean }> = {},
): WetlandWeatherSystem => {
  const presets: Readonly<Record<WetlandWeatherId, WetlandWeatherPreset>> = {
    clear: makePreset('clear', baseLook, {
      look: {},
      sky: {
        elevation: 10,
        azimuth: 222,
        zenithColor: '#2f83cd',
        midColor: '#58a9de',
        horizonColor: '#7bc0e8',
        hazeColor: '#85c5e7',
        fogColor: '#70b9e3',
        sunColor: '#f2d55c',
        sunGlowColor: '#ffa200',
        sunIntensity: 1.0,
        sunSize: 0.026,
        cloudCoverage: [0.46, 0.58, 0.76, 0.85],
        cloudAmount: [0.42, 0.14, 0, 0],
        cloudLitColor: '#c6d3ce',
        cloudDarkColor: '#2f5575',
        cloudAmbientColor: '#6285a0',
        cloudRimColor: '#ddbb7d',
      },
    }),
    overcast: makePreset('overcast', baseLook, {
      look: {
        background: '#404c66',
        fog: { color: '#22394e', near: 88, far: 172 },
        hemisphere: { skyColor: '#668099', groundColor: '#485842', intensity: 1.28 },
        key: { color: '#b3b3cc', intensity: 0.72, position: [-3, 12, 2] },
        fill: { color: '#668099', intensity: 0.82, position: [7, 5, -7] },
        rim: { color: '#9999b3', intensity: 0.1, position: [7, 9, -10] },
      },
      sky: {
        elevation: 16,
        azimuth: 220,
        zenithColor: '#404c66',
        midColor: '#54677c',
        horizonColor: '#668099',
        hazeColor: '#788b9e',
        fogColor: '#22394e',
        sunColor: '#b3b3cc',
        sunGlowColor: '#9999b3',
        sunIntensity: 0.08,
        sunSize: 0.032,
        cloudCoverage: [0.34, 0.5, 0.66, 0.76],
        cloudAmount: [1, 0.14, 0, 0],
        cloudLitColor: '#aab8c4',
        cloudDarkColor: '#364554',
        cloudAmbientColor: '#6f8292',
        cloudRimColor: '#c4ccd2',
      },
    }),
  };

  const sky = createWetlandSky();
  const sakuraIdleSky = createWetlandSakuraIdleSky();
  const root = new THREE.Group();
  root.name = 'wetland-weather-skies';
  root.add(sky.root, sakuraIdleSky.root);
  const wind = createWetlandWindSystem();
  scene.add(root);
  let weatherId: WetlandWeatherId = 'clear';
  let skyVersion: WetlandSkyVersion = 'sakura-idle';

  const applySkyVersion = () => {
    sky.root.visible = skyVersion === 'wetland';
    sakuraIdleSky.root.visible = skyVersion === 'sakura-idle';
    scene.userData.wetlandSkyVersion = skyVersion;
  };

  const applyWeather = (id: WetlandWeatherId) => {
    const preset = presets[id];
    weatherId = id;
    if (options.applyLighting !== false) {
      lighting.applyLook(preset.look);
    } else {
      lighting.background.set(preset.look.background);
      lighting.fog.color.set(preset.look.fog.color);
      lighting.fog.near = preset.look.fog.near;
      lighting.fog.far = preset.look.fog.far;
      scene.userData.environmentLook = preset.look.id;
    }
    sky.applyPreset(preset.sky);
    sakuraIdleSky.applyPreset(preset.sky);
    if (options.syncKeyToSky !== false) {
      lighting.keyLight.position.copy(sky.sunDirection).multiplyScalar(12);
    }
    scene.userData.wetlandWeather = id;
    return preset.look;
  };
  applyWeather(weatherId);
  applySkyVersion();

  return {
    root,
    getWeatherId: () => weatherId,
    getLook: () => presets[weatherId].look,
    getWindStrength: wind.getStrength,
    getSkyVersion: () => skyVersion,
    applyWeather,
    setSkyVersion(version) {
      skyVersion = version;
      applySkyVersion();
    },
    setSunDirection(direction) {
      sky.sunDirection.copy(direction).normalize();
      // Both the light marker and SakuraIdle use a surface-to-sun vector in
      // world space. Keep the same vector so moving the key left moves the
      // visible disc left as well; the sky adapter only handles camera framing.
      sakuraIdleSky.sunDirection.copy(direction).normalize();
    },
    setDayLighting(dayLighting) {
      sky.setDayLighting(dayLighting);
      sakuraIdleSky.setDayLighting(dayLighting);
      scene.userData.wetlandDayProgress = dayLighting.progress;
      scene.userData.wetlandDayPhase = dayLighting.phase;
    },
    setWindStrength: wind.setStrength,
    update(elapsed, cameraPosition, camera) {
      const frame = wind.update(elapsed);
      sky.setWind(frame.direction, wind.getDriftTime());
      sky.setCameraPosition(cameraPosition);
      sakuraIdleSky.setWind(frame.direction, wind.getDriftTime());
      sakuraIdleSky.setCameraPosition(cameraPosition, camera?.quaternion);
      return frame;
    },
    dispose() {
      scene.remove(root);
      sky.dispose();
      sakuraIdleSky.dispose();
    },
  };
};
