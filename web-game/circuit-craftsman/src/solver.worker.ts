import { findHint } from './game/solver';
import { LEVELS } from './game/levels';

self.onmessage = (event: MessageEvent<{ token: number; level: number; rotations: number[] }>) => {
  try {
    const hint = findHint(LEVELS[event.data.level], event.data.rotations);
    self.postMessage({ token: event.data.token, hint });
  } catch (error) {
    self.postMessage({ token: event.data.token, error: error instanceof Error ? error.message : 'Hint failed' });
  }
};
