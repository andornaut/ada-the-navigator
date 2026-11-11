# Conversation portraits

Portraits for the in-flight [conversation box](layout.md#conversation-box) and
the storybook panel. Rebuild with `node art/tools/portraits.ts`: it draws the
Astra and General Gadget sheets, crops the compact Ada and Penny sheets from
their reused sheets, and replaces its own entries after the other portraits in
the root manifest. Reused sources and checksums are in [Portraits](portraits.md).

## Sizes

| Use              | Frame | Drawn                   | Sheets               |
| ---------------- | ----: | ----------------------- | -------------------- |
| Storybook panel  |    32 | 2x (64) in the 68 frame | `{name}.png`         |
| Conversation box |    22 | 2x (44) in the 48 frame | `{name}-compact.png` |

- Every frame is untrimmed and square on a clear ground; the box or panel draws
  the frame (2 ink `#181425` edge, navy `#262b44` face). Always integer scale,
  nearest neighbour.
- Compact manifest entries carry `displayWidth` and `displayHeight` 44 (per
  frame).
- Ada and Penny compact frames are exact 22x22 crops of their 32 frames, from
  the hair or crown to the chin: Ada at (5, 5), Penny at (5, 3). Astra and
  General Gadget are drawn natively at both sizes with the same parts and
  palette, so the porthole, roundel and voice line stay whole at 22.

## Sheets and frames

Manifest `frames` names every frame. `loops` lists each speaking loop as
`{ frame, name, ms }`. The sheet JSON carries the same tags and durations.

| Manifest id                                  | Frames                                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ada-portrait`, `ada-portrait-compact`       | `happy` 0, `neutral` 1                                                                                   |
| `astra-portrait`, `astra-portrait-compact`   | `idle` 0, `speaking-1` to `speaking-4` 1 to 4                                                            |
| `gadget-portrait`, `gadget-portrait-compact` | `unknown-idle` 0, `unknown-speaking-1` to `-4` 1 to 4, `named-idle` 5, `named-speaking-1` to `-4` 6 to 9 |
| `penny-portrait`, `penny-portrait-compact`   | `happy` 0, `neutral` 1, `upset` 2                                                                        |

- Speaking loops run 120 ms per frame (480 ms per loop) while the speaker's
  line shows. Reduced motion holds the loop's first frame (`speaking-1`,
  `unknown-speaking-1` or `named-speaking-1`).
- Idle frames (1000 ms) are for a speaker on screen but silent, such as the
  storybook panel. The conversation box shows only the current speaker.
- Ada and Penny have no speaking loop; Gameplay picks the mood frame per line.
- General Gadget uses the `unknown-*` frames while his tab reads "Unknown
  voice" and the `named-*` frames once it reads "General Gadget".

## Art

- Astra: the rose-gold porthole, bezel `#d9a08a` shaded `#b07a6a`, plum glass
  `#3b2a3f` inside an ink ring. Speaking frames pulse a warm core (`#ffc9a8`,
  centre `#fff1e0`, rose rim `#e8968c`), turn six rose dots by 30 degrees each
  frame, and step five voice bars below. Idle shows a dim `#9a6470` ember and a
  flat voice line.
- General Gadget: faceless. Static (navy `#3a4466` and `#1d2032` noise and a
  rolling scanline) behind an ink-edged coral octagon that holds the drones'
  claw insignia (ink claw closing on an amber disc; see
  [Sector one enemies](enemies.md#insignia)) and a hard amber `#f0bd68` zigzag
  voice trace; idle has a flat `#b98a40` line. Unknown: the plate dims to
  `#7f4b3d` with `#5e3a33` shade and the disc to `#b98a40`, two glitch bands
  tear it sideways and specks break it up. Named: coral `#d68b72` with
  `#a8654f` shade, the disc lit, less static.
- Ada and Penny are the reused 32 portraits, unchanged.
- The static is a fixed seeded sequence, so rebuilds are byte-identical.
