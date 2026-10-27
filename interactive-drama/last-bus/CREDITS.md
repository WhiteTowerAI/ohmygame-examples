# Credits

Last Bus (末班) was written, generated and assembled by the OhMyGame team in
OhMyGame. Its story, Scene code and media are licensed under the Apache License,
Version 2.0, like the rest of this repository; see
[`shared/templates/lastbus/NOTICE.txt`](shared/templates/lastbus/NOTICE.txt) for
the template artwork drawn from the same project.

## Generated media

The videos and images under `assets/` were generated with these models. The
design canvas (`canvas/`) keeps each generation's prompt, references and
settings in `canvas/jobs.json` and `canvas/assets.json`.

| Media | Model | Provider |
| --- | --- | --- |
| Video | MiniMax H3 Max, MiniMax H3 | MiniMax |
| Video | Seedance 2.0 | Volcengine Ark |
| Image | Seedream 5.0 Pro, Seedream 5.0 | Volcengine Ark |

Storyboard sketches, UI mock-ups (`assets/ui/`) and slide exports under
`assets/imported/` without a generation record were made by the team.

## Changes for this example

To keep the example small, the media were re-encoded from the original
project: videos the story plays at H.264 CRF 24, other videos at 960 pixels
wide and CRF 28, and PNG images as WebP. The design canvas's failed generations
keep their record but not their retry inputs.
