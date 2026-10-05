# OhMyGame Examples

Example projects that ship with [OhMyGame](https://github.com/WhiteTowerAI/ohmygame).
When you create a project from an example, OhMyGame copies the example's folder
into a new workspace. From there you can play it, change it, or ask the agent
to build on it.

| Example | Type | What it shows |
| --- | --- | --- |
| [Wetland Birdwatching](web-game/wetland-birdwatching) | Web Game | Procedural Three.js wetland, bird AI that reacts to the player, a photo journal with guided onboarding |
| [Last Train Home](interactive-story/night-train) | Interactive Story | A three-scene starter: nodes, signals, shared components and state |

## How OhMyGame uses this repository

OhMyGame pins a commit of this repository in its own `config/` folder. Its build
downloads that commit, checks it, and packages the examples listed in
[`catalog.json`](catalog.json) into the desktop app. Changes here reach users only
after OhMyGame updates the pinned commit.

`catalog.json` lists one entry per example:

| Field | Meaning |
| --- | --- |
| `id` | Stable kebab-case id, used by OhMyGame to refer to the example |
| `type` | OhMyGame project type: `web-game` or `interactive-story` |
| `name`, `description` | Shown when choosing an example |
| `path` | Folder copied into the new project's workspace |
| `cover` | Project cover, a WebP image kept outside `path` so it is not copied |

## Adding an example

1. Put the project in `<type>/<id>/`. It must run with nothing outside its own
   folder.
   - A web game needs a `package.json` with `dev` and `build` scripts, and
     `build` must write a static site to `dist/`.
   - An interactive story is a Playable Nodes workspace: `graph.json`,
     `editor/layout.json`, `nodes/` and `shared/`. Leave out `AGENTS.md`,
     `README.md` and `schemas/`; OhMyGame writes the versions that match the
     app. Media must live in the folder (`source.kind: "workspace"`), not in a
     user's Library.
2. Add an `AGENTS.md` that maps the code for an agent, and record every
   third-party asset or code port with its license (see
   [the wetland example's credits](web-game/wetland-birdwatching/src/assets/CREDITS.md)).
3. Add a WebP cover to `covers/` and an entry to `catalog.json`.
4. Run `node scripts/check-catalog.mjs`, then `npm ci && npm run build` in the
   example folder. CI runs the same checks.

## License

Code in this repository is licensed under the [Apache License 2.0](LICENSE).
Assets inside each example keep their own licenses, listed in that example's
credits file.
