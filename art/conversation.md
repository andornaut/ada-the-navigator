# Conversation portraits

Portraits for the in-flight [conversation box](layout.md#conversation-box) and
the storybook panel. Rebuild with `node art/tools/portraits.ts`: it draws the
Astra and General Gadget sheets, crops the compact Ada and Penny sheets from
their reused sheets, and replaces its own entries after the other portraits in
the root manifest. Reused sources and checksums are in [Portraits](portraits.md).

## Sizes

| Use              | Frame | Drawn                                     | Sheets               |
| ---------------- | ----: | ----------------------------------------- | -------------------- |
| Storybook panel  |    32 | 2x (64) in the 68 frame                   | `{name}.png`         |
| Conversation box |    22 | 2x (44) centred in the 48 slot (52 frame) | `{name}-compact.png` |

- Every frame is untrimmed and square on a clear ground; the box or panel draws
  the frame (2 ink `#181425` edge, navy `#262b44` face). Always integer scale,
  nearest neighbour.
- Compact manifest entries carry `displayWidth` and `displayHeight` 44 (per
  frame).
- Ada and Penny compact frames are exact 22x22 crops of their 32 frames, from
  the hair or crown to the chin: Ada at (5, 5), Penny at (5, 3). Astra and
  General Gadget are drawn natively at both sizes with the same parts and
  palette, so the face, roundel and voice lines stay whole at 22.

## Sheets and frames

Manifest `frames` names every frame. `loops` lists each speaking loop as
`{ frame, name, ms }`. The sheet JSON carries the same tags and durations.

| Manifest id                                  | Frames                                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ada-portrait`, `ada-portrait-compact`       | `happy` 0, `neutral` 1                                                                                   |
| `astra-portrait`, `astra-portrait-compact`   | `idle` 0, `speaking-1` to `speaking-4` 1 to 4                                                            |
| `gadget-portrait`, `gadget-portrait-compact` | `unknown-idle` 0, `unknown-speaking-1` to `-4` 1 to 4, `named-idle` 5, `named-speaking-1` to `-4` 6 to 9 |
| `penny-portrait`, `penny-portrait-compact`   | `happy` 0, `neutral` 1, `upset` 2                                                                        |

- Speaking loops run 120 ms per frame (480 ms per loop) while that speaker's
  line shows; when the line ends the portrait shows its idle frame. Reduced
  motion holds the loop's first frame (`speaking-1`, `unknown-speaking-1` or
  `named-speaking-1`).
- Idle frames (1000 ms) are for a speaker on screen but silent. The
  conversation box and the storybook panel show only the current speaker,
  whose loop plays while the line or page shows.
- Ada and Penny have no speaking loop. Each line takes the mood Gameplay marks
  after it in [player-copy.md](../gameplay/player-copy.md): a line
  marked `(happy)` shows `happy`, an unmarked line `neutral`. Penny's `upset`
  frame is unused for now.
- General Gadget uses the `unknown-*` frames while his tab reads "Unknown
  voice" and the `named-*` frames once it reads "General Gadget".

## Art

- Astra: a geometric line-art face in teal, anchored on the in-between shimmer
  `#8fe0f2`. Concentric pointy-top hexagons: an ink edge, a ring lit `#47b2cc`
  on the upper left and shaded `#2a7b96` on the lower right, a `#1f1a38` face
  (the in-between's darkest value) and a 1 px `#1d4a63` inner hexagon line. Two
  2x2 eye lights with plus-shaped halos sit above a 1 px voice-line mouth.
- Astra speaking: white eyes with `#47b2cc` halos, a white mouth with
  `#8fe0f2` ends stepping through widths 4, 8, 2 and 6 (2, 6, 4 and 6 at 22),
  a `#d6f7fc` catch-light on the ring's upper-left edge and a dithered glow on
  the clear pixels round the ink edge. The glow steps 1, 2, 3, 2 over the loop:
  a checker of `#1d4a63`, then `#2a7b96`, then both, with a sparser second
  ring of `#1d4a63` on the 32 sheet only.
- Astra idle: `#8fe0f2` eyes with `#2a7b96` halos, a flat `#2a7b96` mouth
  (4 wide, 2 at 22), the ring one step darker (`#2a7b96` and `#1d4a63`), no
  catch-light and no glow.
- Every Astra pixel sits on the navy slot face: white is 13.89:1 against it,
  `#8fe0f2` 9.34:1 and the ring 5.63:1; the glow (1.46:1 and 2.89:1) stays
  soft. Galaxy fields never touch the portrait, so it reads the same on the
  dark galaxies and on Sunflower.
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
