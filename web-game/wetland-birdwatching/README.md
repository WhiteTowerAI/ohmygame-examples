# Wetland Birdwatching

A standalone Three.js example. A stylized wetland is generated from a
hand-drawn semantic map. Walk the park, focus your binoculars, and photograph
blackbirds and a gray magpie in action to fill your field journal.

```sh
npm install
npm run dev
```

## How to play

Each journal entry is one behaviour of one species, for example a blackbird
singing or a gray magpie in flight. A photo fills an entry when the bird is
centered, in focus, and within 24 m. Photos earn up to three stars: one for
the identification, one for a sharp, well-framed shot, and one for a close-up
or a rare behaviour. Birds notice you. If you rush at them, they flee and the
journal counts them as startled. Finish the session at any time to see your
results.

| Action | Desktop | Touch |
| --- | --- | --- |
| Walk / run | WASD / Shift | Left stick |
| Look / aim | Mouse (Esc frees the cursor; click to recapture) | Drag |
| Binoculars | Right-click or B | Binoculars |
| Focus | Mouse wheel | Focus slider |
| Photo | Left-click | Photo |
| Field journal | J | Journal button |
| Switch view | V | View button |

This folder is extracted from `Prototype/visual-feasibility` (the park
birdwatching page). It contains only the code the game uses and needs nothing
outside this folder. For the module map and editing rules, see
[AGENTS.md](AGENTS.md). For asset and code licenses, see
[src/assets/CREDITS.md](src/assets/CREDITS.md).
