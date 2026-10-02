import * as THREE from 'three';

export type WetlandWindFrame = Readonly<{
  direction: THREE.Vector2;
  speed: number;
  strength: number;
  gustStrength: number;
  sway: number;
}>;

export type WetlandWindSystem = Readonly<{
  getStrength: () => number;
  getDriftTime: () => number;
  setStrength: (strength: number) => number;
  update: (elapsed: number) => WetlandWindFrame;
}>;

export const createWetlandWindSystem = (): WetlandWindSystem => {
  const direction = new THREE.Vector2(Math.cos(0.56), Math.sin(0.56)).normalize();
  const frame = {
    direction,
    speed: 0.74,
    strength: 0.58,
    gustStrength: 0.5,
    sway: 0,
  };
  let strength = 0.58;
  let driftTime = 0;
  let lastElapsed = 0;

  return {
    getStrength: () => strength,
    getDriftTime: () => driftTime,
    setStrength(value) {
      strength = THREE.MathUtils.clamp(value, 0, 1.5);
      return strength;
    },
    update(elapsed) {
      const delta = THREE.MathUtils.clamp(elapsed - lastElapsed, 0, 0.1);
      lastElapsed = elapsed;
      driftTime += delta * strength;

      const slowGust = Math.sin(elapsed * 0.41 + Math.sin(elapsed * 0.13) * 0.8);
      const crossGust = Math.sin(elapsed * 0.23 + 1.7) * 0.46;
      const gustEnvelope = THREE.MathUtils.clamp(
        0.58 + slowGust * 0.26 + crossGust * 0.16,
        0.18,
        1,
      );
      frame.strength = strength * (0.68 + gustEnvelope * 0.32);
      frame.gustStrength = 0.32 + gustEnvelope * 0.5;
      frame.sway = (slowGust + crossGust) * frame.strength;
      return frame;
    },
  };
};
