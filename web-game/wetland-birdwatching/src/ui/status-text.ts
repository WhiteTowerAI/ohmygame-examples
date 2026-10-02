// The one-line status under the location name, describing what the watched
// bird is doing from the player's point of view.
export type StatusContext = Readonly<{
  location: string;
  birdDistance: number;
  birdLabel: string;
  birdState: string;
  birdStateLabel: string;
  flyingToAnotherTree: boolean;
  binocularRaised: boolean;
  focusQuality: number;
}>;

export const gameplayStatusText = (context: StatusContext) => {
  const bird = context.birdLabel.toLowerCase();
  const state = context.birdState;
  if (context.location === 'wetland-shore' && context.birdDistance > 18) {
    return 'The water is calm. Keep watching along the shore';
  }
  if (state === 'alarm') return `The ${bird} calls an alarm and eyes an escape route`;
  if (state === 'alert') return `The ${bird} freezes and stares at you`;
  if (state === 'flight' || state === 'takeoff') {
    return context.flyingToAnotherTree ? `The ${bird} is flying to a safer tree` : `The ${bird} is moving to a new spot`;
  }
  if (context.binocularRaised) return context.focusQuality > 0.78 ? 'The view is sharpening' : 'Not in focus yet';
  if (state === 'sing' || state === 'contact') return `A ${bird} is calling from the trees`;
  if (context.birdDistance < 13 && (state === 'forage' || state === 'peck')) return 'Something is rustling in the leaves';
  return `${context.birdLabel} · ${context.birdStateLabel}`;
};
