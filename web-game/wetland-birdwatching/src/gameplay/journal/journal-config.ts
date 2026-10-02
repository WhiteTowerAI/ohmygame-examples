// Everything a designer is likely to tune lives here: which behaviours the
// field journal asks for, how photos are judged and when a bird counts as
// startled. The bird AI itself is configured in src/gameplay/birds/species/.

type JournalSpecies = Readonly<{
  id: string;
  name: string;
}>;

export type JournalEntryDefinition = Readonly<{
  id: string;
  speciesId: string;
  title: string;
  // Runtime bird states that count as this behaviour.
  states: readonly string[];
  // Rare behaviours earn the third star without a close-up.
  rare: boolean;
  hint: string;
}>;

export const journalSpecies: readonly JournalSpecies[] = [
  { id: 'blackbird', name: 'Blackbird' },
  { id: 'gray-magpie', name: 'Gray magpie' },
];

export const journalEntries: readonly JournalEntryDefinition[] = [
  {
    id: 'blackbird-foraging',
    speciesId: 'blackbird',
    title: 'Foraging',
    states: ['forage', 'peck'],
    rare: false,
    hint: 'Blackbirds turn over leaves on open ground.',
  },
  {
    id: 'blackbird-perched',
    speciesId: 'blackbird',
    title: 'Perched',
    states: ['perch'],
    rare: false,
    hint: 'Look up into the lower branches.',
  },
  {
    id: 'blackbird-singing',
    speciesId: 'blackbird',
    title: 'Singing',
    states: ['sing'],
    rare: true,
    hint: 'Follow the song to a perched blackbird.',
  },
  {
    id: 'blackbird-preening',
    speciesId: 'blackbird',
    title: 'Preening',
    states: ['preen'],
    rare: true,
    hint: 'A calm, undisturbed bird will tidy its feathers.',
  },
  {
    id: 'blackbird-flight',
    speciesId: 'blackbird',
    title: 'In flight',
    states: ['takeoff', 'flight', 'land'],
    rare: true,
    hint: 'Catch a bird as it moves between spots.',
  },
  {
    id: 'magpie-perched',
    speciesId: 'gray-magpie',
    title: 'Perched',
    states: ['perch'],
    rare: false,
    hint: 'Gray magpies sit high in the canopy.',
  },
  {
    id: 'magpie-hopping',
    speciesId: 'gray-magpie',
    title: 'Hopping branches',
    states: ['patrol'],
    rare: false,
    hint: 'It moves from branch to branch while patrolling.',
  },
  {
    id: 'magpie-calling',
    speciesId: 'gray-magpie',
    title: 'Calling',
    states: ['contact'],
    rare: false,
    hint: 'It calls to its flock from high perches.',
  },
  {
    id: 'magpie-watching',
    speciesId: 'gray-magpie',
    title: 'Watching you',
    states: ['inspect'],
    rare: true,
    hint: 'Curious magpies turn to look at visitors.',
  },
  {
    id: 'magpie-flight',
    speciesId: 'gray-magpie',
    title: 'In flight',
    states: ['takeoff', 'flight', 'land'],
    rare: true,
    hint: 'Catch it crossing the canopy.',
  },
];

export const photoRules = Object.freeze({
  // A photo identifies the species only when all three hold.
  identifyMaxDistance: 24,
  identifyMinFocus: 0.72,
  // Distance from the screen centre in normalised device coordinates (0-1).
  identifyMaxOffCenter: 0.42,
  // Second star: sharp and well framed.
  sharpMinFocus: 0.9,
  sharpMaxOffCenter: 0.22,
  // Third star: a close-up, or a rare behaviour.
  closeUpMaxDistance: 12,
});

export const alertnessRules = Object.freeze({
  // Observer pressure (0-1) at which the meter turns wary / about to flee.
  wary: 0.45,
  fleeing: 0.65,
  // A take-off counts as "startled by you" at or above this pressure.
  startledPressure: 0.45,
  // The meter only shows when the watched bird is this close (metres).
  visibleWithin: 26,
});

export const sessionRanks: readonly Readonly<{ minStars: number; title: string }>[] = [
  { minStars: 24, title: 'Master birder' },
  { minStars: 14, title: 'Keen observer' },
  { minStars: 6, title: 'Promising birder' },
  { minStars: 0, title: 'Novice birder' },
];
