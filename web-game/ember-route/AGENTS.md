# Ember Route: Agent Guide

A standalone English roguelike deckbuilder using Phaser 3, TypeScript, Vite
and DOM UI. Chapter I has twelve floors, 24 card types, Heat and Vent tactics,
branching routes, rewards, events, shops, rests and a boss.

## Run and check

Use Node.js 22.12+ (or 20.19+) and npm.

```sh
npm ci
npm run dev
npm test
npm run build
```

The build writes a static game to `dist/` with relative URLs and bundled
dependency notices. Artwork, system fonts and synthesized audio need no
external service or asset-generation step.

## Module map

| Area | Files |
| --- | --- |
| Seeded run state, combat, routes and saves | `src/engine.ts` |
| Cards, enemies, relics and events | `src/data.ts` |
| English compatibility for old battle logs | `src/legacy-log.ts` |
| DOM screens, actions, menus and synthesized audio | `src/main.ts` |
| Phaser battlefield and characters | `src/world.ts` |
| Combat feedback and card input | `src/motion.ts`, `src/card-input.ts` |
| Responsive styles | `src/style.css`, `src/hud.css`, `src/experience.css`, `src/english.css` |
| Forty runtime WebP images | `public/art/` |
| Design, implementation history and compact board | `canvas/` |
| Rules, localization and legacy-save checks | `tests/` |

## Editing rules

- Keep the engine independent of rendering. Use the saved seeded generator for
  randomness and persist complete actions rather than animation states.
- Preserve Heat, Vent, Overheat, target selection, enemy intents and save
  compatibility. Design mockup numbers are illustrative; use game data.
- Keep artwork local and synchronize Canvas references when replacing files.
  Source sheets and asset-regeneration scripts are omitted from this example.
- Keep covers and catalog metadata outside this folder. Do not add exports,
  duplicate cover files, dependency folders, build output or editor caches.
- Read `canvas/AGENTS.md`, README and schemas before editing Canvas data;
  preserve retained IDs and validate documents, assets and layouts.
- Record third-party sources and licenses in `CREDITS.md`; keep the build's
  license packaging intact.

## Browser checks

Check New Journey, map selection, targeted attacks, Block, Vent, End Turn,
rewards and settings at desktop and mobile sizes. Development scenarios and
`window.__OHMYGAME_PLAYTEST__.snapshot()` support isolated checks and are
excluded from production. Chapter II/III and permanent progression are absent.
