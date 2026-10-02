import * as THREE from 'three';

// Focus distances (metres) the binocular wheel and slider step through.
export const focusStops = [1.5, 2, 2.6, 3.3, 4.1, 5, 6, 7.2, 8.6, 10.2, 12, 14.2, 16.8, 20, 24, 28, 32, 38, 46, 56] as const;

export const closestFocusIndex = (distance: number) => focusStops.reduce(
  (closest, stop, index) => Math.abs(stop - distance) < Math.abs(focusStops[closest] - distance)
    ? index
    : closest,
  0,
);

// Each stop owns a clear band half as deep as its focal distance. The soft
// shoulder keeps wheel/slider changes gradual without making mid and far
// targets share one effectively infinite depth of field.
export const focusDepthRange = (focusDistance: number) => ({
  clearHalfWidth: Math.max(0.55, focusDistance * 0.25),
  featherWidth: Math.max(0.45, focusDistance * 0.14),
});

// 1 when the target sits inside the clear band, falling to 0 outside it.
export const focusQualityAt = (focusDistance: number, targetDistance: number) => {
  const { clearHalfWidth, featherWidth } = focusDepthRange(focusDistance);
  const outsideClearBand = Math.max(0, Math.abs(targetDistance - focusDistance) - clearHalfWidth);
  return 1 - THREE.MathUtils.smoothstep(outsideClearBand, 0, featherWidth);
};
