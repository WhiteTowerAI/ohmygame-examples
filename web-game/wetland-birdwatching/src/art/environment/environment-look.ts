import type * as THREE from 'three';
import type { StylizedEnvironmentMaterialLook } from '../rendering/stylized-environment-material';

export type EnvironmentLookId = 'legacy' | 'reference-morning' | 'morning-side';

export type EnvironmentLook = Readonly<{
  id: EnvironmentLookId;
  label: string;
  background: THREE.ColorRepresentation;
  fog: Readonly<{
    color: THREE.ColorRepresentation;
    near: number;
    far: number;
  }>;
  hemisphere: Readonly<{
    skyColor: THREE.ColorRepresentation;
    groundColor: THREE.ColorRepresentation;
    intensity: number;
  }>;
  key: Readonly<{
    color: THREE.ColorRepresentation;
    intensity: number;
    position: readonly [number, number, number];
  }>;
  fill: Readonly<{
    color: THREE.ColorRepresentation;
    intensity: number;
    position: readonly [number, number, number];
  }>;
  rim: Readonly<{
    color: THREE.ColorRepresentation;
    intensity: number;
    position: readonly [number, number, number];
  }>;
  material: StylizedEnvironmentMaterialLook;
  defaultAcesEnabled: boolean;
}>;

const legacyLook: EnvironmentLook = {
  id: 'legacy',
  label: 'Legacy',
  background: '#a9dbec',
  fog: { color: '#cce4d8', near: 11, far: 24 },
  hemisphere: { skyColor: '#dff6ff', groundColor: '#6c7650', intensity: 2.35 },
  key: { color: '#fff2ce', intensity: 3.2, position: [-4, 9, 6] },
  fill: { color: '#ffffff', intensity: 0, position: [6, 5, -8] },
  rim: { color: '#ffffff', intensity: 0, position: [6, 9, -10] },
  material: {
    enabled: false,
    litTint: '#fff2ce',
    litTintAmount: 0,
    litIntensity: 1,
    shadowColor: '#000000',
    shadowBaseStrength: 0.5,
    shadowColorMix: 0,
    bounceColor: '#86a968',
    bounceStrength: 0,
    bounceDistance: 1.5,
    groundY: -0.05,
    coreShadowLow: -0.18,
    coreShadowHigh: 0.42,
  },
  defaultAcesEnabled: true,
};

// Elemental Serenity supplies the light-role split, Bruno Simon's folio
// supplies the warm-light/cool-shadow relationship, and LAAS supplies the
// restrained grade parameters and fixed-condition A/B workflow.
const referenceMorningLook: EnvironmentLook = {
  id: 'reference-morning',
  label: 'Soft morning',
  background: '#9fcbd3',
  fog: { color: '#abc9bf', near: 36, far: 72 },
  hemisphere: { skyColor: '#d3e9e8', groundColor: '#4d6147', intensity: 1.15 },
  key: { color: '#ffd7aa', intensity: 2.2, position: [-5.5, 10, 4.5] },
  fill: { color: '#8fb8c4', intensity: 0.3, position: [7, 4.5, -7] },
  rim: { color: '#d8eff1', intensity: 0.16, position: [7, 9, -10] },
  material: {
    enabled: true,
    litTint: '#ffd7aa',
    litTintAmount: 0.10,
    litIntensity: 1.28,
    shadowColor: '#66729a',
    shadowBaseStrength: 0.78,
    shadowColorMix: 0.08,
    bounceColor: '#9eb774',
    bounceStrength: 0.42,
    bounceDistance: 1.65,
    groundY: -0.05,
    coreShadowLow: -0.30,
    coreShadowHigh: 0.18,
  },
  defaultAcesEnabled: false,
};

const morningSideLook: EnvironmentLook = {
  id: 'morning-side',
  label: 'Raking morning light',
  background: '#a5cfd4',
  fog: { color: '#b2cdc1', near: 34, far: 70 },
  hemisphere: { skyColor: '#d8ecec', groundColor: '#566b50', intensity: 1.05 },
  key: { color: '#ffe0b8', intensity: 2.35, position: [-10, 9, 2] },
  fill: { color: '#91bcc8', intensity: 0.38, position: [8, 5, 7] },
  rim: { color: '#e1f3ed', intensity: 0.32, position: [7, 10, -9] },
  material: {
    enabled: true,
    litTint: '#ffe0b8',
    litTintAmount: 0.12,
    litIntensity: 1.3,
    shadowColor: '#657594',
    shadowBaseStrength: 0.8,
    shadowColorMix: 0.08,
    bounceColor: '#a1ba79',
    bounceStrength: 0.4,
    bounceDistance: 1.65,
    groundY: -0.05,
    coreShadowLow: -0.24,
    coreShadowHigh: 0.2,
  },
  defaultAcesEnabled: false,
};

const environmentLooks: Readonly<Record<EnvironmentLookId, EnvironmentLook>> = {
  legacy: legacyLook,
  'reference-morning': referenceMorningLook,
  'morning-side': morningSideLook,
};

export const getEnvironmentLook = (value: string | null): EnvironmentLook => (
  value && value in environmentLooks
    ? environmentLooks[value as EnvironmentLookId]
    : referenceMorningLook
);

export const getEnvironmentLookById = (id: EnvironmentLookId): EnvironmentLook => (
  environmentLooks[id]
);
