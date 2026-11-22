# Exit navigation icon

The installed-app Exit uses the same 35 × 35 frame and centred pivot
`(17.5, 17.5)` as Pause and Menu. Each pose uses the matching Pause rim,
ring, face and glyph colours.

| Pose  | SVG under `public/art/ui/icons/` |
| ----- | -------------------------------- |
| Rest  | `exit-disc.svg`                  |
| Press | `exit-disc-press.svg`            |
| Held  | `exit-disc-held.svg`             |

The glyph is the open door and outward arrow from Archie's Exit icon,
using the same path as the legacy 20 × 20 `exit.svg` mask. The path stays
at native size, at `translate(8.6 7.5)` in every pose. It covers 104 square
units, the same as Pause, with its centre of area at about `(17.485, 17.5)`.
The pose change comes from the disc chrome.

Rebuild with `node art/tools/settings-icons.ts`. The three SVGs are
standalone CSS images, like Pause and Menu.
