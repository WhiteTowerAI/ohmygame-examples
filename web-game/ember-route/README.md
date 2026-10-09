# Ember Route

An original single-player roguelike deckbuilder built with TypeScript, Vite,
Phaser 3 and DOM UI. Play a twelve-floor first chapter with 24 card types,
Heat and Vent tactics, branching routes, events, shops, rests and a boss.
Player-facing text is English.

## Run and build

Requires Node.js 22.12+ (or 20.19+) and npm. OhMyGame manages the editor preview;
independently:

```sh
npm ci
npm run dev
npm test
npm run build
```

Publish `dist/` to a static web host. Asset URLs are relative to the deployment
base; serve it over HTTP. Artwork and dependency notices are bundled locally,
sound is synthesized, and fonts come from the user's system. No generation
service is required.

## Controls

Click or tap a card, select an enemy for targeted cards and confirm as needed.
Dragging is optional. Keyboard: 1–0 selects cards, arrow keys selects targets,
Enter confirms, Escape cancels and E ends the turn. Settings includes mute and
reduced motion. Progress saves automatically in browser local storage.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/engine.ts` | Independent game rules and seeded run state |
| `src/data.ts` | Cards, enemies, relics and events |
| `src/legacy-log.ts` | English restoration of old battle logs |
| `src/main.ts` | DOM menus, HUD, services, audio and interactions |
| `src/world.ts`, `src/motion.ts`, `src/card-input.ts` | Phaser, feedback and input |
| `public/art/` | Forty runtime WebPs |
| `assets/imported/`, `assets/marketing/` | Original source images and historical cover, compressed in place |
| `canvas/` | Original design, implementation history, generation nodes and layout |
| `.data/assets.json` | Portable media origins and generation provenance |
| `tests/` | Rules, English text and legacy-save regression checks |

See the [game design](canvas/documents/f4076920-11c4-4376-a7e5-f1caefc1d532.md),
[implementation history](canvas/documents/2d2aa858-5691-48d0-aa29-223c7880b935.md),
[agent guide](AGENTS.md) and [credits](CREDITS.md).

## Example cleanup

The original Canvas contains eighteen nodes and fourteen generation records.
Node IDs, types, prompts, models, reference relationships, generation status,
coordinates and viewport are preserved. Source sheets and document previews
remain local at their original paths. Mockup numbers illustrate layout; source
code defines the game rules.

Source media uses high-quality WebP with unchanged dimensions and a lossless
alpha channel. Encoding is selected only when visible-pixel RGB RMSE is at
most 3 on the 0–255 scale; already smaller WebPs remain unchanged.
Runtime images are copied unchanged. Portable `.data/assets.json` metadata
preserves generated-media origins and prompts.

Dependencies, build output, editor caches, OS files, duplicate concept and
marketing copies, ZIP exports and duplicate implementation logs are excluded.
The catalog cover stays outside the project; historical cover-generation
nodes and source media remain part of the editable Canvas.

## Verification and scope

Tests cover combat rules, seeded routes, service actions, English content and
legacy battle-log restoration. Development-only scenarios and a snapshot
bridge support isolated checks and are excluded from production. Earlier
playtest results remain in the implementation history. Only chapter one is
implemented; full music, permanent progression and chapters two/three are
absent. Long-term balance and exhaustive device testing remain future work.

Code uses Apache License 2.0; Phaser retains its MIT license. See
[LICENSE](LICENSE) and [CREDITS.md](CREDITS.md).
