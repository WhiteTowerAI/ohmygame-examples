# Agent Guide

This repository holds example projects that OhMyGame packages into its desktop
app. See README.md for the layout and `catalog.json` format.

- Each example lives in `<type>/<id>/`, must build and run with nothing outside
  its own folder, and has its own `AGENTS.md`. Read that file before changing
  an example.
- Keep covers and catalog metadata outside the example folder; the folder is
  copied verbatim into users' workspaces.
- Record every third-party asset or code port in the example's credits file.
  Use only CC0, CC BY, or MIT/Apache-compatible sources.
- Before finishing, run `node scripts/check-catalog.mjs` and
  `npm ci && npm run build` in each example you touched.

## Git

- Small PRs, one example or one concern each.
- Branches: `feat/`, `fix/`, `chore/`, `refactor/`, `docs/` + short name.
- Conventional Commit titles scoped by example id, e.g.
  `fix(wetland-birdwatching): keep focus after species switch`.
- PR descriptions say what changed, why, and how it was checked.
