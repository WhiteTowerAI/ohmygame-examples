import { photoRules } from './journal-config';

export type ShotMetrics = Readonly<{
  // The bird projects inside the view frustum.
  inFrame: boolean;
  // Distance of the bird from the screen centre, 0 (centre) to ~1.4 (corner).
  offCenter: number;
  distance: number;
  focusQuality: number;
}>;

export type ShotCheck = Readonly<{
  centered: boolean;
  inFocus: boolean;
  inRange: boolean;
  identified: boolean;
  // The first unmet condition, phrased as advice; undefined when identified.
  problem?: 'not-in-frame' | 'off-center' | 'too-far' | 'out-of-focus';
}>;

export type PhotoRating = Readonly<{
  stars: 0 | 1 | 2 | 3;
  check: ShotCheck;
  sharp: boolean;
  closeUp: boolean;
}>;

// Shared by the live viewfinder and the shutter so the player always sees the
// same rule that judges the photo.
export const checkShot = (metrics: ShotMetrics): ShotCheck => {
  const centered = metrics.inFrame && metrics.offCenter < photoRules.identifyMaxOffCenter;
  const inRange = metrics.distance < photoRules.identifyMaxDistance;
  const inFocus = metrics.focusQuality > photoRules.identifyMinFocus;
  const identified = centered && inRange && inFocus;
  const problem = identified
    ? undefined
    : !metrics.inFrame
      ? 'not-in-frame'
      : !centered
        ? 'off-center'
        : !inRange
          ? 'too-far'
          : 'out-of-focus';
  return { centered, inFocus, inRange, identified, problem };
};

export const ratePhoto = (metrics: ShotMetrics, rareBehaviour: boolean): PhotoRating => {
  const check = checkShot(metrics);
  const sharp = metrics.focusQuality >= photoRules.sharpMinFocus
    && metrics.offCenter <= photoRules.sharpMaxOffCenter;
  const closeUp = metrics.distance <= photoRules.closeUpMaxDistance;
  if (!check.identified) return { stars: 0, check, sharp: false, closeUp: false };
  const stars = (1 + (sharp ? 1 : 0) + (closeUp || rareBehaviour ? 1 : 0)) as 1 | 2 | 3;
  return { stars, check, sharp, closeUp };
};

export const shotProblemText: Readonly<Record<NonNullable<ShotCheck['problem']>, string>> = {
  'not-in-frame': 'No bird in view',
  'off-center': 'Center the bird',
  'too-far': `Too far — get within ${photoRules.identifyMaxDistance} m`,
  'out-of-focus': 'Out of focus',
};
