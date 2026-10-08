# Asset and Code Credits

Imported from the Tidal Workshop OhMyGame workspace supplied by the project
owner. Game code is distributed under this repository's Apache License 2.0,
included in `LICENSE`. Third-party packages retain their upstream licenses.

## Artwork and audio

The 29 harbor images in `public/art/`, five HUD images in `src/assets/ui/` and
design illustration in `assets/concept.webp` were created for the original
workspace. They include generated original artwork and extracted sprites;
no external artwork packs are included. Runtime images are copied unchanged.
The concept is a 1280-pixel-wide compressed copy of the original landscape
mockup; its baked lettering predates the current English interface.

`assets/manifests/` retains dimensions, anchors and historical crop provenance.
Original source sheets are not bundled. The catalog cover is the promotional
illustration supplied by the project owner as `output.webp`, resized to
1280×720 and compressed as WebP. It is stored outside this example in
`covers/tidal-workshop.webp`.

`src/audio.ts` synthesizes sounds with the Web Audio API. Fonts are supplied
by the user's system; no font files or recorded audio are bundled.

## Runtime dependencies

| Package | Source | License | Distributed notice |
| --- | --- | --- | --- |
| Phaser | [phaserjs/phaser](https://github.com/phaserjs/phaser) | MIT | `dist/licenses/phaser.txt` |
| EventEmitter3 (Phaser dependency) | [primus/eventemitter3](https://github.com/primus/eventemitter3) | MIT | `dist/licenses/eventemitter3.txt` |
| Lucide | [lucide-icons/lucide](https://github.com/lucide-icons/lucide) | ISC (MIT-compatible) | `dist/licenses/lucide.txt` |

Versions are pinned by `package-lock.json`. `vite.config.ts` publishes their
upstream license files, this credits file and the project license in each
build. No third-party code ports are vendored separately.
