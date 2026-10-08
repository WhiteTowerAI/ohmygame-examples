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
| `assets/concept.webp` | Compressed desktop combat concept |
| `canvas/` | Design, implementation history and compact local asset board |
| `tests/` | Rules, English text and legacy-save regression checks |

See the [game design](canvas/documents/f4076920-11c4-4376-a7e5-f1caefc1d532.md),
[implementation history](canvas/documents/2d2aa858-5691-48d0-aa29-223c7880b935.md),
[agent guide](AGENTS.md) and [credits](CREDITS.md).

## Example cleanup

Runtime artwork is copied unchanged. One original combat concept is resized
and compressed; its card/enemy numbers illustrate layout, while source code
defines the rules. Historical generation sheets and jobs, duplicate marketing
covers, cover PNG, source ZIP, duplicate implementation log, asset/cover
preparation scripts and their Sharp dependency are omitted. The catalog cover
is kept outside this example folder.

Dependencies, build output, editor caches and OS files are excluded from the
source. The original OhMyGame workspace retains the full historical material.

## Verification and scope

Tests cover combat rules, seeded routes, service actions, English content and
legacy battle-log restoration. Development-only scenarios and a snapshot
bridge support isolated checks and are excluded from production. Earlier
playtest results remain in the implementation history. Only chapter one is
implemented; full music, permanent progression and chapters two/three are
absent. Long-term balance and exhaustive device testing remain future work.

Code uses Apache License 2.0; Phaser retains its MIT license. See
[LICENSE](LICENSE) and [CREDITS.md](CREDITS.md).
