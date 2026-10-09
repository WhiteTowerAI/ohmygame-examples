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
| `assets/imported/`, `assets/previews/` | Original source sheets and design references, compressed in place |
| `canvas/` | Original design documents, generation nodes, history and layout |
| `.data/assets.json` | Portable media origins and generation provenance |
| `tests/` | Logic, localization and asset regression checks |

See the [game design](canvas/documents/tidal-workshop-design.md),
[visual guidelines](canvas/documents/tidal-workshop-art.md),
[agent guide](AGENTS.md) and [credits](CREDITS.md).

## Example cleanup

The original Canvas contains eleven nodes and fourteen generation records.
Node IDs, types, prompts, models, reference relationships, generation status,
coordinates and viewport are preserved. Source sheets and document previews
remain local at their original paths. The missing historical cover output is
materialized locally from its original Library asset. Crop manifests identify
the bundled source sheets.

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

Tests cover deterministic economy and offline settlement, progression, hexes,
English text, feedback and local asset references. A development-only playtest
bridge supports accelerated inspection and is excluded from production.
Historical playtest results in the design document describe earlier iterations.
First-voyage and multi-voyage pacing still need human balance calibration;
accelerated checks do not establish completion times.

Code uses Apache License 2.0; bundled dependencies retain their upstream terms.
See [LICENSE](LICENSE) and [CREDITS.md](CREDITS.md).
