# Conversation portraits

Portraits for the in-flight [conversation box](layout.md#conversation-box) and
the storybook panel. Rebuild with `node art/tools/portraits.ts`: it draws the
Astra, General Gadget and Grandma sheets, crops the compact Ada and Penny
sheets from their reused sheets, and replaces its own entries after the other
portraits in the root manifest. The [cast portraits](#cast-portraits) come
from one generator per galaxy. Reused sources and checksums are in
[Portraits](portraits.md).

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
  the hair or crown to the chin: Ada at (5, 5), Penny at (5, 3). Astra is drawn
  natively at both sizes with the same parts and palette, so the face and voice
  lines stay whole at 22.
- General Gadget, Grandma and the cast portraits are drawn at 32; each compact
  frame is the 22x22 crop at the origin its table gives. The whales' compact
  frames crop a whale drawn natively smaller, so the whole face fits.

## Sheets and frames

Manifest `frames` names every frame. `loops` lists each speaking loop as
`{ frame, name, ms }`. The sheet JSON carries the same tags and durations.

| Manifest id                                                                                                | Frames                                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ada-portrait`, `ada-portrait-compact`                                                                     | `happy` 0, `neutral` 1                                                                                   |
| `astra-portrait`, `astra-portrait-compact`                                                                 | `idle` 0, `speaking-1` to `speaking-4` 1 to 4                                                            |
| `gadget-portrait`, `gadget-portrait-compact`                                                               | `unknown-idle` 0, `unknown-speaking-1` to `-4` 1 to 4, `named-idle` 5, `named-speaking-1` to `-4` 6 to 9 |
| `grandma-portrait`, `grandma-portrait-compact`                                                             | `neutral` 0                                                                                              |
| `penny-portrait`, `penny-portrait-compact`                                                                 | `happy` 0, `neutral` 1, `upset` 2                                                                        |
| `pip-portrait`, `pip-portrait-compact`                                                                     | `happy` 0, `neutral` 1, `worried` 2                                                                      |
| `settler-portrait`, `settler-portrait-compact`                                                             | `happy` 0, `neutral` 1, `worried` 2                                                                      |
| Needle's cast: `{key}-portrait`, `{key}-portrait-compact` for `reed`, `sedge`, `willow`, `marsh`           | `neutral` 0                                                                                              |
| Andromeda's cast: `{key}-portrait`, `{key}-portrait-compact` for `settler-greeter`, `lumen`, `dial`, `cog` | `neutral` 0                                                                                              |
| Black Eye's Blurbs: `dollop-portrait`, `blurb-settler-portrait` and their `-compact` sheets                | `neutral` 0                                                                                              |

- Speaking loops run 120 ms per frame (480 ms per loop) while that speaker's
  line shows; when the line ends the portrait shows its idle frame. Reduced
  motion holds the loop's first frame (`speaking-1`, `unknown-speaking-1` or
  `named-speaking-1`).
- Idle frames (1000 ms) are for a speaker on screen but silent. The
  conversation box and the storybook panel show only the current speaker,
  whose loop plays while the line or page shows.
- Andromeda's sheets are in its manifest, drawn as Munix by
  `node art/tools/andromeda-portraits.ts` ([Andromeda](andromeda.md#portraits)):
  Pip, Wick on the `settler` sheet, every other settlement greeter on
  `settler-greeter`, and the keepers Lumen, Dial and Cog. They have no speaking
  loop; every speaker but Ada and Penny shows `neutral` (Gameplay's rule).
- Elder Loom's and Needle's cast sheets are in Needle's manifest, drawn as Avi
  herons by `node art/tools/needle-portraits.ts`
  ([Elder Loom's portrait](needle.md#elder-looms-portrait),
  [Avi portraits](needle.md#avi-portraits)). Every speaker but Ada and Penny
  shows `neutral` (Gameplay's rule).
- Ada and Penny have no speaking loop. Each line takes the mood Gameplay marks
  after it in [player-copy.md](../gameplay/player-copy.md): a line
  marked `(happy)` shows `happy`, an unmarked line `neutral`. Penny's `upset`
  frame is unused for now.
- General Gadget uses the `unknown-*` frames while his tab reads "Unknown
  voice" and the `named-*` frames once it reads "General Gadget", also as
  Black Eye's station keeper. His
  compact crop is at (5, 1); Grandma's at (5, 2).
- Dollop and the Blurb settler are in Black Eye's manifest
  ([Black Eye](black-eye.md#portraits)).
- Every speaker but Ada and Penny has one `neutral` frame (Gameplay's rule).

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
- General Gadget named (`named-*`): a black-furred cat `#2e2940` (shade
  `#221e31`) with a humanoid bust, rim-lit `#8b9bb4` on the upper left and
  `#5a6988` down the right so the fur reads on the navy slot. Yellow `#fee761`
  slit eyes, a pink nose, `#8b9bb4` whiskers, pink inner ears, a coral coat
  `#d68b72` with a stand collar, amber buttons and the drones' claw insignia as
  a medal ([Sector one enemies](enemies.md#insignia)). A red officer's cap
  `#e43b44` (shade `#a22633`, light `#f6757a`) with an amber band, a black
  visor and a small claw badge sits between his ears, which stay whole beside
  it. The red is 3.32:1 on the fur and 3.31:1 on the slot, inside its 1 px ink
  edge. Idle is half-lidded and smug; speaking opens his eyes and steps the
  mouth open, half, open, closed.
- General Gadget unnamed (`unknown-*`): the same bust and cap as a faceless
  `#100e1a` silhouette rim-lit `#6b7aa0` and `#68386c`, over static (navy
  `#3a4466` and `#1d2032` noise and a rolling scanline) and torn by two glitch
  bands. An amber voice trace runs below: flat `#b98a40` when idle, a hard
  `#f0bd68` zigzag speaking.
- Grandma: Ada's skin, a curly grey bun with a flower, round gold glasses, a
  rose cardigan and a green garden apron.
- Ada and Penny are the reused 32 portraits, unchanged.
- The static is a fixed seeded sequence, so rebuilds are byte-identical.

## Cast portraits

Every galaxy's speakers are its people, drawn as chibi busts with the shared
parts in `art/tools/bust.ts` and written by `art/tools/bust-sheets.ts`: a 32
sheet `{key}.png` and a 22 compact sheet `{key}-compact.png` (displayed at 44) in `public/art/{galaxy}/portraits/`, frame `neutral` 0, 1000 ms. The
manifest ids are `{key}-portrait` and `{key}-portrait-compact`, last in the
galaxy's manifest. Station keepers wear the same headset with a mic; keepers
of one people differ in silhouette, colour and accessory. Tab colours are in
[Controls](controls.md#conversation-box).

| Speaker      | Galaxy, generator                   | Key       | Crop   | Look                                                                 |
| ------------ | ----------------------------------- | --------- | ------ | -------------------------------------------------------------------- |
| Clover       | Sunflower, `sunflower-portraits.ts` | `clover`  | (5, 1) | Bumble grower: a leaf cap with a clover, green overalls              |
| Rivet        | Sunflower                           | `rivet`   | (5, 3) | Bumble workshop: goggles up, a riveted orange apron, a wrench        |
| Patch        | Sunflower                           | `patch`   | (5, 3) | Bumble salvager: a patched red bandana, a scrap backpack             |
| Saffron      | Sunflower                           | `saffron` | (5, 2) | Bumble keeper: saffron fur, a wide head, a crocus, a green vest      |
| Bramble      | Sunflower                           | `bramble` | (5, 2) | Bumble keeper: a tall head, curled antennae, a berry beret           |
| Nectar       | Sunflower                           | `nectar`  | (5, 2) | Bumble keeper: a small lemon head, heart antennae, a pink bow        |
| Marlo        | Whirlpool, `whirlpool-portraits.ts` | `marlo`   | (5, 5) | The trapped whale: a broad face, a grooved throat, crown glow spots  |
| Whale family | Whirlpool                           | `family`  | (5, 5) | An adult of the family: paler and rounder than Marlo, blushing       |
| Ripple       | Whirlpool                           | `ripple`  | (5, 2) | Voron keeper: seafoam, a round mantle, a sailor collar, ripple rings |
| Coral        | Whirlpool                           | `coral`   | (5, 2) | Voron keeper: pink, a wide mantle, low fins, a shell clip, pearls    |
| Brine        | Whirlpool                           | `brine`   | (5, 2) | Voron keeper: deep blue, a pointed mantle, a captain's cap           |
| Quartz       | Cartwheel, `cartwheel-portraits.ts` | `quartz`  | (5, 2) | Cobble keeper and the hub's voice: pale tall stone, a quartz crown   |
| Slate        | Cartwheel                           | `slate`   | (5, 4) | Cobble keeper: a wide flat slab with layered seams                   |
| Garnet       | Cartwheel                           | `garnet`  | (5, 3) | Cobble keeper: red-brown stone with garnet crystals                  |
| Mica         | Cartwheel                           | `mica`    | (5, 3) | Cobble miner: a hard hat with its lamp, silver mica flakes           |
| Opal         | Cartwheel                           | `opal`    | (5, 4) | Cobble visitor: pale tall stone, opal shimmer, a rose scarf          |
| Jasper       | Cartwheel                           | `jasper`  | (5, 3) | Cobble visitor: ochre-banded stone, a green bucket hat, a bag strap  |

- Bumbles: fuzzy yellow heads `#fee761`, ink antennae, glassy wings and a
  striped body (`#4a2e2a`).
- Voron: squid with a mantle, fins, five arms and two waving outer arms, and
  freckles of glowing ink `#2ce8f5`.
- Whales: the hull, throat and glow of the [Whirlpool whales](whales.md); the
  family is `#c9c4f2` with a pale throat `#eeeafb`.
- Cobbles: speckled warm stone with pebble hands, the right one waving, set
  apart from the grey resource rocks by their faces, hands and warm tint.
