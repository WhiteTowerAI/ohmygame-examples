# Asset and Code Credits

This example was imported from the Circuit Craftsman OhMyGame workspace.
Game code is distributed under this repository's Apache License 2.0. Bundled
third-party code and fonts retain the licenses listed below.

## Artwork and audio

The 47 runtime WebP images in `public/art/circuit-craftsman/` and the design
illustration in `assets/concept.webp` were created for the original game
workspace. The supplied artwork includes generated images and normalized
circuit tiles. See the artwork manifest and README for file details.
The catalog cover in `../../covers/circuit-craftsman.webp` is a screenshot of
the game. No external artwork packs or recorded audio are included.

`src/audio.ts` synthesizes game sounds using the Web Audio API.

## Runtime dependencies

| Package | Source | License | Distributed notice |
| --- | --- | --- | --- |
| Phaser 3.90.0 | [phaserjs/phaser](https://github.com/phaserjs/phaser) | MIT | `dist/licenses/phaser.txt` |
| Lucide icons | [lucide-icons/lucide](https://github.com/lucide-icons/lucide) | ISC (MIT-compatible) | `dist/licenses/lucide.txt` |
| logic-solver 2.0.1 | [meteor/logic-solver](https://github.com/meteor/logic-solver) | MIT | `dist/licenses/logic-solver.txt` |

Dependencies are installed from the versions in `package-lock.json`.
`vite.config.ts` copies their upstream license files into every production
build. No third-party code ports are vendored separately.

## Fonts

Font subsets are embedded in `src/fonts.css` and need no external font service.
The SIL Open Font License permits bundling fonts with Apache-licensed software;
the font files themselves remain under OFL 1.1.

| Font | Source and author | License | Included notice |
| --- | --- | --- | --- |
| Nunito | [The Nunito Project Authors](https://github.com/googlefonts/nunito) | SIL OFL 1.1 | `src/fonts/nunito-LICENSE.txt` |
| Noto Sans SC | [Google Noto CJK](https://github.com/notofonts/noto-cjk), Google Inc. | SIL OFL 1.1 | `src/fonts/noto-sans-sc-LICENSE.txt` |

The build also publishes these font notices as `dist/licenses/nunito.txt`
and `dist/licenses/noto-sans-sc.txt`.
