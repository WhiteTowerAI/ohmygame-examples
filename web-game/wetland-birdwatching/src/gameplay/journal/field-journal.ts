import { journalEntries, journalSpecies, sessionRanks, type JournalEntryDefinition } from './journal-config';
import type { PhotoRating } from './photo-rating';

export type JournalPhoto = Readonly<{
  id: number;
  src: string;
  speciesId: string;
  speciesName: string;
  state: string;
  stateLabel: string;
  rating: PhotoRating;
  entryId?: string;
}>;

type JournalEntryProgress = Readonly<{
  definition: JournalEntryDefinition;
  best?: JournalPhoto;
}>;

type JournalPhotoResult = Readonly<{
  photo: JournalPhoto;
  entry?: JournalEntryDefinition;
  // The photo filled an empty entry, or beat the entry's previous best.
  newEntry: boolean;
  improvedEntry: boolean;
}>;

type JournalProgress = Readonly<{
  found: number;
  total: number;
  stars: number;
  maxStars: number;
  photos: number;
  identifiedPhotos: number;
  startled: number;
  complete: boolean;
  rank: string;
}>;

export const speciesName = (speciesId: string) =>
  journalSpecies.find((species) => species.id === speciesId)?.name ?? speciesId;

export const entryForState = (speciesId: string, state: string) =>
  journalEntries.find((entry) => entry.speciesId === speciesId && entry.states.includes(state));

export const createFieldJournal = () => {
  let photos: JournalPhoto[] = [];
  let bestByEntry = new Map<string, JournalPhoto>();
  let startled = 0;
  let nextPhotoId = 1;

  const addPhoto = (input: Omit<JournalPhoto, 'id' | 'speciesName' | 'entryId'>): JournalPhotoResult => {
    const entry = input.rating.stars > 0 ? entryForState(input.speciesId, input.state) : undefined;
    const photo: JournalPhoto = {
      ...input,
      id: nextPhotoId++,
      speciesName: speciesName(input.speciesId),
      entryId: entry?.id,
    };
    photos.push(photo);
    if (!entry) return { photo, newEntry: false, improvedEntry: false };
    const previous = bestByEntry.get(entry.id);
    const newEntry = !previous;
    const improvedEntry = !!previous && photo.rating.stars > previous.rating.stars;
    if (newEntry || improvedEntry) bestByEntry.set(entry.id, photo);
    return { photo, entry, newEntry, improvedEntry };
  };

  const getProgress = (): JournalProgress => {
    const stars = [...bestByEntry.values()].reduce((sum, photo) => sum + photo.rating.stars, 0);
    return {
      found: bestByEntry.size,
      total: journalEntries.length,
      stars,
      maxStars: journalEntries.length * 3,
      photos: photos.length,
      identifiedPhotos: photos.filter((photo) => photo.rating.stars > 0).length,
      startled,
      complete: bestByEntry.size === journalEntries.length,
      rank: sessionRanks.find((rank) => stars >= rank.minStars)?.title ?? '',
    };
  };

  return {
    addPhoto,
    recordStartled: () => { startled += 1; },
    getProgress,
    getEntries: (): JournalEntryProgress[] => journalEntries.map((definition) => ({
      definition,
      best: bestByEntry.get(definition.id),
    })),
    getPhotos: (): readonly JournalPhoto[] => photos,
    countFound: (speciesId: string) => journalEntries
      .filter((entry) => entry.speciesId === speciesId && bestByEntry.has(entry.id)).length,
    reset: () => {
      photos = [];
      bestByEntry = new Map();
      startled = 0;
    },
  };
};

export type FieldJournal = ReturnType<typeof createFieldJournal>;
