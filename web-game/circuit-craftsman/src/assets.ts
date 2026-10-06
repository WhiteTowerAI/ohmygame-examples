import { ART_FILES } from './art-files';

// CSS custom-property URLs otherwise resolve relative to the built stylesheet.
const ROOT = new URL(`${import.meta.env.BASE_URL}art/circuit-craftsman/`, document.baseURI).href;
export type ArtKey = keyof typeof ART_FILES;
export const ART: Record<ArtKey, string> = Object.fromEntries(Object.entries(ART_FILES).map(([key, file]) => [key, ROOT + file])) as Record<ArtKey, string>;

export const BOARD_ART: ArtKey[] = [
  'tile-power', 'tile-straight', 'tile-elbow', 'tile-tee', 'tile-cross', 'tile-bulb-off', 'tile-bulb-on',
  'tile-obstacle', 'tile-empty', 'fx-rotation', 'fx-bulb-ignition', 'fx-hint-ring', 'fx-current-particle',
];
