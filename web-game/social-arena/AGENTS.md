# Social Arena: Agent Guide

Social Arena is a compact web-game example for OhMyGame service features:
sign-in, cloud saves, leaderboards and host-mode realtime multiplayer.

## Run and check

Requires Node.js 22.19+.

```sh
npm ci
npm run dev
npm run build
```

The Vite build writes a static site to `dist/`. `public/manifest.json` is copied
to that output. Keep it as `{}` in the repository: OhMyGame's setup and
publishing flows write the service configuration for a local or published game.

## Setup in OhMyGame

1. Run `game_sdk_setup` to configure sign-in, cloud saves and leaderboards.
2. Run `multiplayer_setup` for a **host**, **realtime** room with a **200 ms**
   tick. The tick must match `src/rules.ts`.
3. Do not hand-write `account`, `cloud` or `multiplayer` settings in
   `manifest.json`.

Without setup, local browser profile saves still work. The UI explains which
cloud and multiplayer controls require configuration.

## Module map

| Area | File |
| --- | --- |
| SDK startup, profile saves, sign-in, leaderboard and room UI | `src/main.ts` |
| Authoritative realtime round rules | `src/rules.ts` |
| Responsive visual design | `src/style.css` |
| SDK manifest copied to production builds | `public/manifest.json` |

## Editing rules

- Call `init()` only once, in `src/main.ts` startup.
- Keep service configuration out of source control; setup tools own it.
- `src/rules.ts` runs in the room host's browser. It must not use DOM APIs,
  `Math.random`, `Date.now` or module-level mutable game state.
- A round awards one point per `sendAction({ type: "pulse" })` until 30 points
  are collected. Keep actions JSON-sized and validate their shape in the rules.
- The local `social-arena.profile` save contains only display name, win count,
  round count and practice score. Preserve validation before rendering saved values.
- Host-mode room rules run in a player's browser. Never submit their outcomes
  to a public leaderboard; use the separate signed-in practice score for the
  leaderboard example.
