# Agent Guide

This repository holds example projects that OhMyGame packages into its desktop
app. See README.md for the layout and `catalog.json` format.

- Each example lives in `<type>/<id>/`, must build and run with nothing outside
  its own folder, and has its own `AGENTS.md`. Read that file before changing
  an example.
- Keep catalog covers and metadata outside the example folder; the folder is
  copied verbatim into users' workspaces. Retain original historical cover
  nodes and their source images inside the project.
- Preserve the original Canvas when importing or optimizing an example: all
  boards, nodes, IDs, node types, prompts, model settings, media references,
  documents, generation records and editor layouts (coordinates and viewport).
  Generated-image nodes must remain generation nodes. Source sheets, design
  prototypes and failed generation records are authoring data, not redundant
  runtime files. Change Canvas content only as part of requested Canvas edits.
- Compress source images in place while preserving their paths, dimensions and
  alpha channel. Verify image quality and compare Canvas state and layouts with
  the original project. Preserve portable generation provenance, including
  `canvas/assets.json`, `canvas/jobs.json` and `.data/assets.json`; these files
  are not disposable caches. Exclude dependencies, builds, Git/OS/editor caches
  and duplicate exports instead.
- `canvas-baselines.json` protects the imported node state, layouts, asset
  metadata and history. Add a baseline for a new import after comparing it with
  the original project. Update it only for an intended Canvas change, never to
  make a size optimization or node deletion pass validation.
- Record every third-party asset or code port in the example's credits file.
  Use only CC0, CC BY, or MIT/Apache-compatible sources.
- Before finishing, run `node --test scripts/*.test.mjs` and
  `node scripts/check-catalog.mjs` (including Canvas
  preservation checks) and `npm ci && npm test --if-present && npm run build`
  in each example you touched.

## Git

- Small PRs, one example or one concern each.
- Branches: `feat/`, `fix/`, `chore/`, `refactor/`, `docs/` + short name.
- Conventional Commit titles scoped by example id, e.g.
  `fix(wetland-birdwatching): keep focus after species switch`.
- PR descriptions say what changed, why, and how it was checked.
