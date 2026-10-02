// Contextual tutorial: one short instruction at a time, shown when it is
// relevant and retired as soon as the player has done it.

type CoachContext = Readonly<{
  touchMode: boolean;
  secondsMoved: number;
  birdNearby: boolean;
  binocularRaised: boolean;
  inFocus: boolean;
  shotReady: boolean;
  photosTaken: number;
  identifiedPhotos: number;
  journalOpened: boolean;
}>;

type CoachStep = Readonly<{
  id: string;
  // Shown only while this holds; the step waits (silently) otherwise.
  when: (context: CoachContext) => boolean;
  done: (context: CoachContext) => boolean;
  text: (context: CoachContext) => string;
}>;

const steps: readonly CoachStep[] = [
  {
    id: 'explore',
    when: () => true,
    done: (context) => context.secondsMoved > 2 || context.birdNearby,
    text: (context) => context.touchMode
      ? 'Use the left stick to walk. Listen for birdsong and follow it.'
      : 'Walk with WASD and move the mouse to look around. Listen for birdsong and follow it.',
  },
  {
    id: 'raise',
    when: (context) => context.birdNearby && !context.binocularRaised,
    done: (context) => context.binocularRaised,
    text: (context) => context.touchMode
      ? 'A bird is nearby. Tap Binoculars to watch it.'
      : 'A bird is nearby. Right-click or press B to raise your binoculars.',
  },
  {
    id: 'focus',
    when: (context) => context.binocularRaised && !context.inFocus,
    done: (context) => context.binocularRaised && context.inFocus,
    text: (context) => context.touchMode
      ? 'Drag the focus slider until the bird looks sharp.'
      : 'Keep the bird in the ring and scroll the mouse wheel until it looks sharp.',
  },
  {
    id: 'shoot',
    when: (context) => context.binocularRaised && context.shotReady,
    done: (context) => context.photosTaken > 0,
    text: (context) => context.touchMode
      ? 'The ring is green. Tap Photo!'
      : 'The ring is green. Click to take a photo!',
  },
  {
    id: 'journal',
    when: (context) => context.identifiedPhotos > 0,
    done: (context) => context.journalOpened,
    text: (context) => context.touchMode
      ? 'Your photo filled a journal entry. Tap the journal button to see what is left to find.'
      : 'Your photo filled a journal entry. Press J to see what is left to find.',
  },
];

export const createCoach = (element: HTMLElement) => {
  let stepIndex = 0;
  // Tips wait while a tutorial step is showing; their timer starts on display.
  const pendingTips: { text: string; seconds: number }[] = [];
  let tip: { text: string; until: number } | undefined;
  const shownTips = new Set<string>();
  let rendered = '';

  const render = (text: string) => {
    if (text === rendered) return;
    rendered = text;
    element.textContent = text;
    element.classList.toggle('visible', text.length > 0);
  };

  return {
    update: (context: CoachContext, now: number) => {
      while (stepIndex < steps.length && steps[stepIndex].done(context)) stepIndex += 1;
      const step = steps[stepIndex];
      if (step && step.when(context)) {
        render(step.text(context));
        return;
      }
      if (tip && now > tip.until) tip = undefined;
      if (!tip && pendingTips.length > 0) {
        const next = pendingTips.shift()!;
        tip = { text: next.text, until: now + next.seconds };
      }
      render(tip?.text ?? '');
    },
    // A one-off tip, shown at most once per session for each id.
    showTip: (id: string, text: string, seconds = 6) => {
      if (shownTips.has(id)) return;
      shownTips.add(id);
      pendingTips.push({ text, seconds });
    },
  };
};
