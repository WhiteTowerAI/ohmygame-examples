# Tidal Workshop: Agent Guide

A standalone English incremental harbor game using Phaser 3, TypeScript and
Vite. Salvage, craft and ship cargo, then automate the harbor and progress
through expeditions, research, voyages and permanent hexes.

## Run and check

Use Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
npm test
npm run build
```

The static build is written to `dist/` with relative URLs. Runtime artwork,
sound synthesis and dependency notices are local; no external service is
required. Tests use Sharp to check image dimensions and transparency.

## Module map

| Area | Files |
| --- | --- |
| Economy, inventory, crafting, shipping and saves | `src/economy.ts` |
| Goals, upgrades, expeditions and research | `src/progression.ts` |
| Permanent voyage rewards | `src/hexes.ts` |
| Phaser harbor, sprites, input and animation | `src/harbor.ts` |
| DOM interface, management and dialogs | `src/main.ts`, `src/style.css`, `src/hud.css` |
| English presentation | `src/locale.ts` |
| Resource feedback and synthesized audio | `src/feedback.ts`, `src/audio.ts` |
| Runtime sprites and HUD materials | `public/art/`, `src/assets/ui/` |
| Dimensions, anchors and processing provenance | `assets/manifests/` |
| Original design documents, board and generation history | `canvas/` |
| Regression tests | `tests/` |

## Editing rules

- Preserve the `tidal-workshop-save-v1` save contract and deterministic online
  and offline settlement. Lock ship costs, duration and payout at departure.
- Update the sprite list, manifests and Canvas references together when
  changing artwork. Preserve opaque ivory walls and boat roofs.
- Keep covers and catalog metadata outside this folder. Do not add dependency
  folders, build output, editor caches or duplicate exports.
- Preserve every original Canvas node, type, setting, reference, generation
  record and editor coordinate/viewport when packaging or compressing media.
  Keep source sheets and portable generation provenance; they are authoring
  data. Compress images in place without resizing or changing their alpha.
- Read `canvas/AGENTS.md`, README and schemas before editing Canvas data.
  Preserve IDs and validate documents, assets and layouts.
- Record third-party sources and licenses in `CREDITS.md`. The Vite build
  publishes dependency notices alongside the game.

## Browser checks

Check salvage, crafting, shipping, goal claims, management and settings at
desktop and mobile sizes. The development-only
`window.__OHMYGAME_PLAYTEST__` bridge supports deterministic inspection;
it is excluded from production. First-voyage pacing needs human playtesting.
