# Circuit Craftsman

A complete browser puzzle game built with Phaser 3, TypeScript and Vite.
The interface defaults to English and supports Chinese in Settings.

## Game content

- Forty handcrafted levels across four regions, with boards from 4×4 to 7×7.
- Mouse, touch and keyboard rotation; reciprocal ports, branches and loops.
- Undo, Restart, worker-based hints, star ratings and unlockable bulb appearances.
- Local saves for progress, best results, unfinished attempts and preferences.
- Cartoon artwork, flowing power feedback, responsive layouts and bilingual logos.

Completing a level earns one star; at most `ceil(1.5S)` moves earns two, and
at most the reference move count `S` earns three. Hints only highlight a move
and cap the current attempt at two stars. Undo does not refund moves;
Restart resets the attempt.

## Run and build

Requires Node.js 20.19+ or 22.12+. OhMyGame manages the editor preview;
independently, use `npm run dev`.

```sh
npm ci
npm test
npm run build
```

Builds require no system artwork tools. Tests additionally decode WebP pixels
when `ffmpeg` is available; those pixel checks explicitly skip otherwise.
The static build is `dist/`, with relative URLs, embedded fonts and bundled
third-party notices. Serve it over HTTP, including from a subdirectory.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/game/` | Levels, circuit rules, hints, state and saves |
| `src/board.ts` | Phaser board, input and visual feedback |
| `src/main.ts`, `src/style.css`, `src/i18n.ts` | Responsive interface and English/Chinese text |
| `src/art-files.ts` | Runtime artwork list |
| `public/art/circuit-craftsman/` | Forty-seven runtime WebP images shared with Canvas |
| `assets/concept.webp`, `assets/imported/output.webp` | Original concept and historical cover |
| `canvas/` | English design document, original boards, generation history and layout |
| `.data/assets.json` | Portable media origins and provenance |
| `tests/` | Rules, saves, translations, artwork and Canvas regression checks |

See the [game design](canvas/documents/970b066d-a80e-49c4-910e-a6f60f7d9526.md),
[artwork guide](public/art/circuit-craftsman/README.md),
[agent guide](AGENTS.md), [credits](CREDITS.md),
[artwork manifest](public/art/circuit-craftsman/manifest.json) and
[validation record](public/art/circuit-craftsman/validation.json).

## Packaging and Canvas preservation

The original two boards contain seventeen nodes and one generation record.
Canvas text is English. Node IDs, types, model settings, media references,
generation status, coordinates and viewport are preserved. Prompts and labels
are translated without replacing generation nodes with static asset nodes.

Runtime images remain unchanged. The historical cover's original PNG bytes
are encoded as actual lossless WebP without changing decoded pixels, dimensions
or alpha; the already compact concept remains unchanged. The catalog cover
stays outside the project, while its historical generation node remains
part of the editable Canvas.

Dependencies, build output, editor caches, OS files, unused processing trees
and duplicate exports are excluded. Original Canvas sources and generation
provenance are retained. Packaging or media compression must not delete nodes,
reset history, rearrange the layout or discard prompt/reference relationships.

## Verification and scope

Tests cover all forty reference solutions, hints, scoring, save recovery,
translations, artwork hashes and dimensions, geometry and Canvas references.
Development-only playtest hooks are excluded from production. Earlier browser
checks and artwork review are recorded in the validation file; those records
are not a claim of exhaustive device testing or manual completion of every
level.

Code is licensed under Apache License 2.0. Assets and dependencies retain
the licenses documented in [CREDITS.md](CREDITS.md).
