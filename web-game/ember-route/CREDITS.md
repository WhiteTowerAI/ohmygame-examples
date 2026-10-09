# Asset and Code Credits

Imported from the Ember Route OhMyGame workspace supplied by the project
owner. Game code is distributed under this repository's Apache License 2.0,
included in `LICENSE`. Third-party packages retain their upstream licenses.

## Artwork and audio

The forty WebP images in `public/art/` were created for the original game
workspace from generated original industrial-fairytale artwork. They include
the hero, background, enemies, card illustrations, relics and UI materials.
Runtime images are copied unchanged; no external artwork packs are included.

`assets/imported/` and `assets/marketing/` retain original source artwork,
prototypes and the historical cover. Images are compressed in place without
changing dimensions or alpha; generation nodes, prompts and history remain
in `canvas/`. Mockup numbers are illustrative; `src/data.ts` and `src/engine.ts`
define gameplay. The catalog cover is the promotional
illustration supplied by the project owner as `output1.webp`, resized to
1280×720 and compressed as WebP. It is stored outside this example in
`covers/ember-route.webp`.

`src/main.ts` synthesizes sounds with the Web Audio API. Fonts are supplied
by the user's system; no font files or recorded audio are bundled.

## Runtime dependencies

| Package | Source | License | Distributed notice |
| --- | --- | --- | --- |
| Phaser | [phaserjs/phaser](https://github.com/phaserjs/phaser) | MIT | `dist/licenses/phaser.txt` |
| EventEmitter3 (Phaser dependency) | [primus/eventemitter3](https://github.com/primus/eventemitter3) | MIT | `dist/licenses/eventemitter3.txt` |

Versions are pinned by `package-lock.json`. `vite.config.ts` publishes the
upstream license, this credits file and the project license in each build.
No third-party code ports are vendored separately.
