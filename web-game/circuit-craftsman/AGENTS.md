# Circuit Craftsman: Agent Guide

A standalone Phaser 3 circuit puzzle game with 40 authored levels in four
regions. Rotate tiles clockwise to connect the power source to every bulb.
The interface defaults to English and can switch to Chinese in Settings.

## Run and check

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
npm test
npm run build
```

The build writes a static site to `dist/` with relative asset URLs. Fonts are
embedded in CSS; artwork and licenses are bundled locally. Nothing outside
this folder is needed. Pixel tests additionally use `ffmpeg` when available;
they report skips when it is absent.

## Module map

| Area | Files |
| --- | --- |
| Level definitions and reference solutions | `src/game/levels.ts` |
| Ports, connectivity and star scoring | `src/game/rules.ts` |
| Rotations, undo, hints and screen state | `src/game/session.ts` |
| Progress, settings and unlocked skins | `src/game/save.ts` |
| SAT-based hint search | `src/game/solver.ts`, `src/solver.worker.ts` |
| Phaser board, input and animation | `src/board.ts` |
| DOM interface, dialogs and responsive layout | `src/main.ts`, `src/style.css` |
| English and Chinese text | `src/i18n.ts` |
| Synthesized sound effects | `src/audio.ts` |
| Runtime artwork keys and URLs | `src/art-files.ts`, `src/assets.ts` |
| Tile geometry contract | `src/circuit-art-geometry.json` |
| Embedded font subsets and licenses | `src/fonts.css`, `src/fonts/` |
| Artwork, dimensions, hashes and validation notes | `public/art/circuit-craftsman/` |
| Design document, boards and asset references | `canvas/` |
| Regression tests | `tests/` |
| Static artwork and license packaging | `vite.config.ts` |

## Editing rules

- Preserve reciprocal-port connectivity, alternate solutions and the scoring
  rules. Hint use caps the current attempt at two stars; undo does not refund
  moves; restart resets the attempt.
- Keep runtime artwork in `public/art/circuit-craftsman/`. Update
  `src/art-files.ts`, `manifest.json` and affected Canvas references together
  when changing assets. The build publishes only files in the runtime list.
- Record third-party assets and code in `CREDITS.md`, retain their licenses,
  and use sources compatible with the repository's license requirements.
- Read `canvas/AGENTS.md`, its README and schemas before editing Canvas data.
  Keep board, node, document and asset IDs stable and run `npm test` to check
  references and layouts.
- Keep project covers and catalog metadata outside this folder. Do not copy
  editor caches, `node_modules/` or `dist/` into the example source.
- Preserve every original Canvas node, type, setting, reference, generation
  record and editor coordinate/viewport when packaging or compressing media.
  Keep source images and portable generation provenance; they are authoring
  data. Compress images in place without resizing or changing their alpha.

## Browser checks

Check rotations, undo, restart, hints, victory, level selection, language and
settings at desktop and mobile sizes. In development,
`?playtest=1&level=11` loads a transient attempt without persisting changes;
`window.__OHMYGAME_PLAYTEST__.snapshot()` exposes state and layout, and
`reset()` restarts the current level. These hooks are excluded from production.

Tests cover all 40 reference solutions, hints, scoring, save validation,
translations, asset hashes, geometry and Canvas references.
