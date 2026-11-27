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
| [Last Bus](web-game/last-bus) | Web Game | A 39-Scene interactive film in Chinese with a story map and an in-game menu, plus the design canvas, storyboard and generation history behind it |
| [Claude Code Game Studios](general/claude-code-game-studios) | General | [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) by Donchitos (MIT), as released: 49 agents, 78 skills, hooks and design docs for Claude Code. Nothing to play; remix it and run `/start` in Claude Code. See [its credits](credits/claude-code-game-studios.md) |

## How OhMyGame uses this repository

OhMyGame pins a commit of this repository in its own `config/` folder. Its build
downloads that commit, checks it, and packages the examples listed in
[`catalog.json`](catalog.json) into the desktop app. Changes here reach users only
after OhMyGame updates the pinned commit.

`catalog.json` lists one entry per example:

| Field | Meaning |
| --- | --- |
| `id` | Stable kebab-case id, used by OhMyGame to refer to the example |
| `type` | OhMyGame project type: `web-game`, or `general` for an example with nothing to play |
| `name`, `description` | Shown when choosing an example |
| `path` | Folder copied into the new project's workspace |
| `cover` | Project cover, a WebP image kept outside `path` so it is not copied |

## Adding an example

1. Put the project in `<type>/<id>/`. It must run with nothing outside its own
   folder.
   - A web game needs a `package.json` with `dev` and `build` scripts, and
     `build` must write a static site to `dist/`.
   - A web game played as it is, such as Last Bus, needs an `index.html` and
     no `package.json`. A story like it keeps its runtime in `story/` and its
     flow in `graph.json`;
     media must live in the folder (`source.kind: "workspace"`), not in a
     user's Library.
2. Add an `AGENTS.md` that maps the code for an agent, and record every
   third-party asset or code port with its license (see
   [the wetland example's credits](web-game/wetland-birdwatching/src/assets/CREDITS.md)).
3. Add a WebP cover to `covers/` and an entry to `catalog.json`.
4. Run `node scripts/check-catalog.mjs`, then `npm ci && npm run build` in the
   example folder. CI runs the same checks.

A general example, such as an agent's setup, has nothing to play: OhMyGame
shows its cover and description and offers only Remix. Its folder is copied as
it is, so it needs no `AGENTS.md` or build. Record where it comes from and its
license in `credits/<id>.md`. One taken from another repository is updated with
a script, such as `node scripts/sync-claude-code-game-studios.mjs vX.Y.Z`; read
the diff before opening a PR, hooks and scripts included, since agents run them
in projects made from it.

## License

Code in this repository is licensed under the [Apache License 2.0](LICENSE).
Assets inside each example keep their own licenses, listed in that example's
credits file.
