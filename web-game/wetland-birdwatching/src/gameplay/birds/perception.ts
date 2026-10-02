import type { BirdPerception, ObserverPressureRules } from './contracts';

export type BirdPerceptionInput = Readonly<{
  observerDistance: number;
  observerApproachSpeed: number;
  observerFacingDot: number;
  visualTransmission: number;
  directAttention: boolean;
}>;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const smooth01 = (value: number) => {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
};

export const calculateBirdPerception = (
  input: BirdPerceptionInput,
  rules: ObserverPressureRules,
): BirdPerception => {
  const rearConeVisibility = smooth01(clamp01((input.observerFacingDot + 1) / 0.75));
  const directionalAwareness = rules.rearVisualFloor
    + (1 - rules.rearVisualFloor) * rearConeVisibility;
  const visualTransmission = clamp01(input.visualTransmission);
  const visualAwareness = directionalAwareness * visualTransmission;
  const proximity = clamp01(
    (rules.pressureRadius - input.observerDistance) / rules.pressureFalloff,
  );
  const distancePressureWeight = rules.distancePressureBase
    + visualAwareness * rules.distancePressureVisualWeight;
  const approachPressure = clamp01(
    input.observerApproachSpeed / rules.approachSpeedReference,
  ) * rules.approachPressureWeight;
  const attentionPressure = input.directAttention
    ? rules.raisedAttentionPressure
    : rules.ambientAttentionPressure;

  return {
    ...input,
    visualTransmission,
    visualAwareness,
    observerPressure: clamp01(
      proximity * distancePressureWeight + approachPressure + attentionPressure,
    ),
  };
};
