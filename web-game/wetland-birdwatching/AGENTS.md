# Wetland Birdwatching: Agent Guide

A stylized Three.js birdwatching game. A hand-drawn semantic map is turned into
a procedural wetland (terrain, lake, paths, grass, flowers, shrubs, modular
trees, sky and light). The player walks the park, raises binoculars, focuses,
and photographs blackbirds or a gray magpie that react to the player's presence.
Photos fill a field journal of species behaviours and earn up to three stars. A
session ends when the player presses Finish or completes the journal.

## Run

```sh
npm install
npm run dev      # Vite dev server
npm run build    # tsc + vite build -> dist/
```

There are no tests. After changes, run `npm run build` and play the game:
click Enter the park, walk with WASD, raise the binoculars with the right mouse
button or B, focus with the mouse wheel or the slider, take a photo with the
left mouse button, open the field journal with J, and switch first-person or
third-person view with V.

For scripted playtests, `window.__BIRD_GAME__` exposes `getSnapshot()`,
`getJournal()`, `setSpecies(id)`, `setObserverPosition(x, z)`,
`aimAtActiveBird()` and `setFocusIndex(i)`. The canvas `data-*` attributes
mirror live state such as bird state, focus quality and position.

## Module map

| Area | Files | Change here to... |
| --- | --- | --- |
| Game loop, HUD, photos, species switch | `src/main.ts`, `index.html`, `src/style.css` | change UI text, camera feel, HUD wiring |
| Journal entries, photo stars, alertness thresholds, ranks | `src/gameplay/journal/journal-config.ts` | add a behaviour to collect, retune scoring |
| Photo judging (shared by viewfinder and shutter) | `src/gameplay/journal/photo-rating.ts` | change what counts as identified or starred |
| Journal state and progress | `src/gameplay/journal/field-journal.ts` | change how progress is counted |
| Tutorial steps and tips | `src/ui/coach.ts` | change onboarding text or order |
| Journal drawer and session summary | `src/ui/journal-view.ts` | change how results are shown |
| Player input (keyboard, mouse, touch) | `src/gameplay/player/player-input.ts` | rebind controls |
| Bird brains | `src/gameplay/birds/` (`bird-runtime.ts`, `bird-agent.ts`, `perception.ts`) | change how birds notice the player and move |
| Per-species behaviour | `src/gameplay/birds/species/*-policy.ts` | tune states, durations, flight/alert thresholds |
| Where birds can perch/forage | `src/gameplay/habitat/registry.ts` | add habitat types or scoring |
| Bird models and poses | `src/art/birds/` | change bird shape, colours, animation |
| Player character | `src/art/characters/` | change the birdwatcher look |
| Audio | `src/gameplay/audio/` | change call scheduling, footsteps, waves |
| World assembly, walkable area | `src/world/wetland-gameplay-world.ts` | change spawn, air walls, location names |
| Generation defaults | `src/art/environment/wetland-shared-world.ts` | change palette, lighting, density budgets |
| Map presets (world size) | `src/art/environment/wetland-map-presets.ts` | change world size and generation profile |
| Semantic map decoding | `src/art/environment/wetland-layout-map.ts` | add a new terrain semantic |
| Terrain, grass, flowers, shrubs, trees | `src/art/environment/wetland-study.ts`, `wetland-region-fields.ts` | change how regions are filled |
| Tree species | `src/art/environment/wetland-tree-presets.ts`, `src/art/trees/` | add or tune procedural trees |
| Sky, weather, wind | `src/art/environment/wetland-weather.ts`, `wetland-sky.ts`, `wetland-wind.ts` | change sky and clouds |
| Post-processing | `src/rendering/`, `src/art/rendering/` | change outlines, god rays, depth of field |

## The semantic map

`src/assets/maps/park-layout-semantic.png` drives the layout. Each pixel is
matched to the nearest colour in `wetlandLayoutPalette`
(`src/art/environment/wetland-layout-map.ts`):

| Semantic | Colour |
| --- | --- |
| grass | `#6e9d47` |
| water | `#3c92c8` |
| path | `#d5ab69` |
| highland | `#d6c44a` |
| forest | `#315f38` |
| shrubland | `#7b6a8e` |

To make a new park, paint a new PNG in these colours and point
`sharedWetlandSemanticMapUrl` at it. Terrain height noise and the grass/soil
split are generated on top of the map.

If `localStorage['bird.wetland.published-scene.v1']` exists, it overrides the
map, light and appearance (`src/art/environment/wetland-published-scene.ts`).
The art workbench in the source repository writes this key. Clear it if the
scene looks different from the PNG.

## Adding a species

1. Model and poses go in `src/art/birds/`. Behaviour policy goes in
   `src/gameplay/birds/species/`. Follow the blackbird and gray magpie files.
2. Create the runtime bird in `src/main.ts` and add an option to
   `#bird-species-select` in `index.html`.
3. Add the species and its journal entries to `journal-config.ts`. Each entry's
   `states` must be states of the new policy.

## Rules

- Keep assets under `src/assets/` and load them with
  `new URL('relative/path', import.meta.url)` so builds work from any sub-path.
  Do not use absolute `/assets/...` URLs.
- Record every new third-party asset or code port in `src/assets/CREDITS.md`
  with its source and license. Use only CC0, CC BY, or MIT-compatible sources.
- `src/vendor/` holds unmodified third-party code. Wrap it instead of editing it.
- Generation is expensive. `sharedWetlandGameplayGenerationProfile` sets the
  sampling budgets; raise them only after checking frame rate.
