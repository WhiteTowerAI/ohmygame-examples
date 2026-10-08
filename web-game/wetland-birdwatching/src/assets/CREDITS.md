# Asset and Code Credits

Everything in this example is either original to this repository or used under
the license listed here.

## Audio

### Blackbird calls (`audio/birds/`)

Clips were cut, high-passed at 700 Hz, faded and loudness-normalised from these
iNaturalist recordings. Licenses were checked against the iNaturalist API
(`sounds[].license_code`).

| Files | Recording | Author | License |
| --- | --- | --- | --- |
| `blackbird-song-01..06.mp3` | [Observation 44608124](https://www.inaturalist.org/observations/44608124), sound 81712 | no rights reserved | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `blackbird-contact-01..05.mp3` | [Observation 44700221](https://www.inaturalist.org/observations/44700221), sound 82176 | Jon Sullivan | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `blackbird-alarm-01..03.mp3` | [Observation 77243586](https://www.inaturalist.org/observations/77243586), sound 210243 | Stuart Fraser | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

### Environment (`audio/environment/`)

| Files | Source | Author | License |
| --- | --- | --- | --- |
| `footstep-grass-*.mp3`, `footstep-stone-*.mp3` | [Fantozzi's Footsteps](https://opengameart.org/content/fantozzis-footsteps-grasssand-stone) | Fantozzi (submitted by qubodup) | CC0 1.0 |
| `wave-*.mp3` | [Beach Ocean Waves](https://opengameart.org/content/beach-ocean-waves) | jasinski (submitted by qubodup) | CC0 1.0 |

Environment files were re-encoded from FLAC to MP3 (VBR ~165 kbps) and renamed; the audio is otherwise unmodified.

## Textures

- `textures/leaf-alpha-256.png`: from
  [SahilK-027/Elemental-Serenity](https://github.com/SahilK-027/Elemental-Serenity),
  MIT License, Copyright (c) 2026 Sahil K.
- `maps/park-layout-semantic.png`: hand-drawn semantic layout, original to this
  repository.

## Code

- `src/vendor/sakura-idle/`: copied from
  [danmana/sakura-idle](https://github.com/danmana/sakura-idle), MIT. See the
  `LICENSE.md` file in that folder.
- God rays (`src/art/rendering/wetland-god-rays.ts`) and canopy light shafts
  are ported from Sakura Idle (MIT, as above).
- Grass shading (`src/art/environment/wetland-boona-grass-renderer.ts`) adapts
  techniques from
  [boona13/threejs-grass-water-shaders](https://github.com/boona13/threejs-grass-water-shaders) (MIT).
- The light-role split for foliage and grass follows Elemental Serenity (MIT, as
  above).
- Shoreline water bands and the warm-light/cool-shadow grade are modelled on
  [brunosimon/folio-2025](https://github.com/brunosimon/folio-2025) (MIT).

## Catalog cover

The catalog cover in `../../../../covers/wetland-birdwatching.webp` is a
promotional illustration supplied by the project owner as `birdwatching.jpg`,
resized to 1280×720 and compressed as WebP. It is not part of this folder.
