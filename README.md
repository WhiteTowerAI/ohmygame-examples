# OhMyGame Examples

Example projects that ship with [OhMyGame](https://github.com/WhiteTowerAI/ohmygame).
When you create a project from an example, OhMyGame copies the example's folder
into a new workspace. From there you can play it, change it, or ask the agent
to build on it.

| Example | Type | What it shows |
| --- | --- | --- |
| [Circuit Craftsman](web-game/circuit-craftsman) | Web Game | 40 circuit puzzles, Phaser boards, worker-based hints, local progress and English/Chinese UI |
| [Tidal Workshop](web-game/tidal-workshop) | Web Game | Incremental harbor economy, cargo shipping, automation, island expeditions and permanent voyage rewards |
| [Ember Route](web-game/ember-route) | Web Game | Roguelike deckbuilding, Heat and Vent combat, a branching twelve-floor route and seeded saves |
| [Wetland Birdwatching](web-game/wetland-birdwatching) | Web Game | Procedural Three.js wetland, bird AI that reacts to the player, a photo journal with guided onboarding |

## How OhMyGame uses this repository

OhMyGame pins a commit of this repository in its own `config/` folder. Its build
downloads that commit, checks it, and packages the examples listed in
[`catalog.json`](catalog.json) into the desktop app. Changes here reach users only
after OhMyGame updates the pinned commit.

`catalog.json` lists one entry per example:

| Field | Meaning |
| --- | --- |
| `id` | Stable kebab-case id, used by OhMyGame to refer to the example |
| `type` | OhMyGame project type: `web-game` or `interactive-drama` |
| `name`, `description` | Shown when choosing an example |
| `path` | Folder copied into the new project's workspace |
| `cover` | Project cover, a WebP image kept outside `path` so it is not copied |

## Adding an example

1. Put the project in `<type>/<id>/`. It must run with nothing outside its own
   folder.
   - A web game needs a `package.json` with `dev` and `build` scripts, and
     `build` must write a static site to `dist/`.
   - An interactive drama is a Playable Nodes workspace: `graph.json`,
     `editor/layout.json`, `nodes/` and `shared/`. Leave out `AGENTS.md`,
     `README.md` and `schemas/`; OhMyGame writes the versions that match the
     app. Media must live in the folder (`source.kind: "workspace"`), not in a
     user's Library.
2. Add an `AGENTS.md` that maps the code for an agent, and record every
   third-party asset or code port with its license (see
   [the wetland example's credits](web-game/wetland-birdwatching/src/assets/CREDITS.md)).
3. Add a WebP cover to `covers/` and an entry to `catalog.json`.
4. Run `node --test scripts/*.test.mjs` and `node scripts/check-catalog.mjs`, then
   `npm ci && npm test --if-present && npm run build` in the example folder.
   CI runs available tests and builds for every example.

## Preserving the original Canvas

An example includes the editable project, including its design and generation
process. Import the original boards, documents, assets, generation records and
editor layouts. Preserve node IDs and types, prompts, model settings, media
dependencies, generation status, coordinates and viewport. Keep generation
nodes editable; replacing them with finished asset nodes changes the project.
Source sheets, prototypes and generation history remain useful even when the
game does not load them at runtime.

Compress source images at their existing paths, retaining dimensions and alpha.
Check visual quality and compare node state and layouts before and after the
change. High-quality WebP reduces the source payload without changing the
Canvas. Preserve `canvas/assets.json`, `canvas/jobs.json` and portable
`.data/assets.json` provenance. Dependencies, build output, caches, OS files
and duplicate exports can be excluded. Keep the catalog cover outside the
project; a historical cover-generation node is still part of its Canvas.

`canvas-baselines.json` stores fingerprints of imported authoring state outside
the copied projects. The catalog check verifies those fingerprints and local
asset paths. Add a baseline for each new import after comparing its Canvas with
the original project. Update a baseline only for an intended Canvas edit, such
as a requested translation or layout change, with a review of the corresponding
diff. Media compression alone does not require a baseline update.

## License

Code in this repository is licensed under the [Apache License 2.0](LICENSE).
Assets inside each example keep their own licenses, listed in that example's
credits file.
