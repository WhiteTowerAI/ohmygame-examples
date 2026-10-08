# Tidal Workshop

A cozy incremental harbor game built with TypeScript, Vite, Phaser 3 and a DOM
interface. Salvage scrap, craft parts, ship cargo, automate production, explore
islands and return from voyages with permanent knowledge and hexes. The
interface is English; sound is synthesized in the browser.

## Run and build

Use Node.js 22.12+ and npm. OhMyGame manages the editor preview; independently:

```sh
npm ci
npm run dev
npm test
npm run build
```

The static output is `dist/`. Relative asset URLs support subdirectory hosting.
Serve it over HTTP. All required artwork and third-party license notices are
bundled; no API key, generation service or system art tool is required.

## Controls and progression

- Click or hold **Salvage** to gather scrap. Space or Enter works when focused.
- Use **Craft** to make parts and **Ship** to send cargo.
- Open **Build**, **Fleet** or **Voyage** to manage production and progression.
- Claim goals for supplies, purchase machines and hire a captain to automate.
- Upgrade machine families, specialize, explore islands, research and sail.
- Settings provides audio, reduced motion, save export/import and reset.

Management tabs support arrow keys; Escape dismisses menus, and focused
scrolling regions support Home, End, PageUp and PageDown. Saves use browser
local storage under `tidal-workshop-save-v1`; no personal save is included.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/` | Economy, progression, Phaser scene, audio and responsive DOM UI |
| `public/art/` | 29 runtime harbor WebPs |
| `src/assets/ui/` | Five runtime HUD WebPs bundled by Vite |
| `assets/manifests/` | Dimensions, anchors and historical crop provenance |
| `assets/concept.webp` | Compressed landscape design reference |
| `canvas/` | Design documents and compact board with local artwork references |
| `tests/` | Logic, localization and asset regression checks |

See the [game design](canvas/documents/tidal-workshop-design.md),
[visual guidelines](canvas/documents/tidal-workshop-art.md),
[agent guide](AGENTS.md) and [credits](CREDITS.md).

## Example cleanup

This folder contains the finished example and its design references. Historical
source sheets, contact sheets, generation jobs, asset-preparation scripts and
ZIP packaging are omitted. Original crop paths in the manifests are provenance,
marked `includedInExample: false`. Runtime images are copied unchanged; only the
retained design concept is resized and compressed. The catalog cover is kept
outside the example folder.

Dependencies, build output, editor caches and OS files are excluded from the
source. The original OhMyGame workspace retains the complete generation and
asset-processing history.

## Verification and scope

Tests cover deterministic economy and offline settlement, progression, hexes,
English text, feedback and local asset references. A development-only playtest
bridge supports accelerated inspection and is excluded from production.
Historical playtest results in the design document describe earlier iterations.
First-voyage and multi-voyage pacing still need human balance calibration;
accelerated checks do not establish completion times.

Code uses Apache License 2.0; bundled dependencies retain their upstream terms.
See [LICENSE](LICENSE) and [CREDITS.md](CREDITS.md).
