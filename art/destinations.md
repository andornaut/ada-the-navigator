# Destinations

Every place Ada visits draws larger than the ships and keeps a clear edge on
every field, and shows a Use callout while Ada can act on it. Destinations are
the stations, outposts, settlements and story places, with the project frames
drawn on them.

## Scale

A destination's display size is `frame * 0.4375 * scale`, from `DISPLAY_SCALE`
and the scales in [art/tools/solid.ts](tools/solid.ts). Frame px values
(pivots, docks, berths, moorings and project anchors) are unchanged, so they
scale with the display size like every other manifest value. SVGs that declare
their display size declare the scaled one; the trading station's and
Sunflower's outposts' declare their frame, as before.

| Scale                             | Value | Assets                                                                                                                                                                                                                                                            |
| --------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Destination (`DESTINATION_SCALE`) |   1.5 | The [trading station](station.md); Sunflower's [outposts](outposts.md) and their project frames; Andromeda's [settlers' station, courier school, settlements, guide beacons and spare beacon](andromeda.md); Needle's [Weavers' station and Loom hall](needle.md) |
| Hub (`HUB_SCALE`)                 |  1.25 | Cartwheel's [hub](cartwheel.md), repaired and with its second bay: it is already built at about 1.55 times the outposts' proportions                                                                                                                              |
| None                              |     1 | Ships, story craft, the mooring buoy, gates, channel lamps, whales and every other asset                                                                                                                                                                          |

Every guide beacon state shares the dark beacon's frame and scale, so the chain
and the story beacon stay alike and a state change swaps in place.

## Light-field keyline

On a light field (`tint.light`) a destination draws over a 2 px ink keyline
in place of the 1 px one: `lightField.destinationKeyline` in
[galaxies.json](../public/art/galaxies.json), `width` 2 for the kinds
`station`, `outpost` and `storyPlace`. The keyline is otherwise the
[light-field rule](galaxies.md#light-fields): the silhouette at alpha 0.5,
grown by `width` in all eight directions, opaque ink `#181425` (10.90:1 on
Sunflower's sand), and one silhouette with the destination's overlays. Dark
fields draw no keyline. Sunflower's growers otherwise meet the sand at their
leaf green `#9ccc5a`, 1.13:1.

## Use callout

While Use is available at a destination, a callout above it shows the action
Use performs there, with the [Use disc](controls.md#use-disc)'s symbol. Tech
draws it in code at runtime, at screen resolution, like the Use disc.

- **Shown** only while Ada is in that destination's Use range (Gameplay's 160
  world units from its centre, `safeRadius`) and Use acts on it; hidden
  otherwise. With two destinations in range, only the one Use acts on shows a
  callout.
- **Show and hide**: alpha from 0 to 1 over 150 ms with `cubicOut` on
  entering the range, and from 1 to 0 over 150 ms on leaving it. A change of
  action while shown swaps the symbol at once. Reduced motion shows and hides
  at once.
- **Layer**: in front of every play object, behind the edge markers and the
  HUD. It never flashes, pulses or scales.

Geometry in logical px from the callout's centre `O` (scaled by `s` like every
space stroke):

| Part   | Geometry                                                                                                              | Colour          |
| ------ | --------------------------------------------------------------------------------------------------------------------- | --------------- |
| Ink    | Disc of radius 13 and the tail triangle (-4, 10), (4, 10), (0, 17)                                                    | Ink `#181425`   |
| Rim    | Disc of radius 12 and the tail triangle (-2.6, 9.8), (2.6, 9.8), (0, 15.2), over the ink                              | Cream `#ead4aa` |
| Face   | Disc of radius 10.5, over the rim                                                                                     | Navy `#262b44`  |
| Symbol | The action's Use disc symbol cores, its ring centre (37.5, 37.5) on `O`, scaled by 0.39 (stroke 3 draws 1.17), no ink | Cream `#ead4aa` |

- **Placement**: `O` is on the pivot's vertical, and the tail tip (0, 17)
  sits 3 px above the destination's silhouette top: the topmost pixel at alpha
  0.5 or more over all its blink frames, at its scaled display size. Tech
  derives the top at load from the frames' drawn alpha; the table below lists
  it for checking. The callout never overlaps the destination it marks.
- **Symbols**: the Use disc's symbol for the action Use performs there: Dock
  at every station, Talk at outposts, settlements and story places, and
  Deliver, Deposit, Tow or Salvage wherever Gameplay's Use acts so.
- **Contrast**: the cream symbol is 9.59:1 on the navy face; the face is
  8.40:1 on Sunflower's sand and the ink edge 10.90:1 there; the cream rim is
  10.17:1 on Andromeda's field and above 10:1 on every dark field. The callout
  is the same on every field.
- It stays apart from the other marks: the edge markers' diamond and discs on
  the game area's border, the hunt glint's lavender rays and its ping ring, the
  weapon pickup's amber square, and the Use disc, a 75 px open ring with no
  face in the HUD.

## Collision, silhouette, dock and clearance

Destinations stay pass-through and carry no `collision`. Their silhouette and
the outposts' and settlements' decorative dock points and mouths grow with the
scale, linearly; nothing else changes. Stations have no dock: Ada enters one by
Use, the Dock action. Display px from the pivot; world units through the game's projection
`(x - y, (x + y) / 2)`. Silhouette radius is frame A and the top is over every blink frame, at the
display size, measured at 4 times; the earlier radius is the same divided by
the scale.

| Asset             | Scale | Display           | Silhouette radius (was) | Top above pivot | Dock world offset    | Mouth circle radius (was) |
| ----------------- | ----: | ----------------- | ----------------------: | --------------: | -------------------- | ------------------------: |
| Trading station   |   1.5 | 118.125 by 98.438 |             56.4 (37.6) |            42.3 | none, entered by Use |                      none |
| Growers           |   1.5 | 94.5 by 78.75     |             44.2 (29.5) |            28.5 | (28.771, 28.771)     |             7.388 (4.925) |
| Workshop          |   1.5 | 111.563 by 78.75  |             71.6 (47.7) |            50.2 | (11.137, 11.137)     |              6.82 (4.547) |
| Salvagers         |   1.5 | 110.25 by 72.188  |             52.4 (34.9) |            26.2 | (25.058, 25.058)     |             7.388 (4.925) |
| Cartwheel hub     |  1.25 | 131.25 by 131.25  |             70.5 (56.4) |            70.6 | none, entered by Use |                      none |
| Settlers' station |   1.5 | 94.5 by 105       |             50.4 (33.6) |            50.6 | none, entered by Use |                      none |
| Hamlet            |   1.5 | 52.5 by 52.5      |             21.8 (14.5) |            20.2 | (15.778, 15.778)     |              5.115 (3.41) |
| Lamp house        |   1.5 | 42 by 52.5        |             28.6 (19.1) |            28.5 | (13.921, 13.921)     |             4.547 (3.031) |
| Dark beacon       |   1.5 | 31.5 by 42        |             27.8 (18.5) |            27.2 | none                 |                      none |
| Weavers' station  |   1.5 | 210 by 84         |            105.9 (70.6) |            39.2 | none, entered by Use |                      none |

- **Use range**: 160 world units from the centre still reaches past every
  drawn edge; the closest is the Weavers' station, 54 past its silhouette.
- **Stations**: no dock point, mouth or mouth circle; the closed collars carry
  no docking contact. The story craft's mouths stay: the hub's two berths and
  its second bay, the Weavers' station's berths and the courier school's pier.
- **Clearance**: every rule stated as an object's silhouette radius plus a
  margin (large rocks keep theirs plus 160 clear of stations, destinations and
  launch points) grows by the radius increase in the table, for example 18.8 for
  the trading station and 35.3 for the Weavers' station. Centre-to-centre
  spacings are unchanged: 8000 between stations, 1200 between story
  destinations and from them to stations, 2000 from launches. The callout
  fills the 30 px from 3 to 33 px above a destination's top and is pass-through.
- **Story craft at the hub**: the hub's berths and the second bay's berth, in
  world units from the hub pivot at 1.25: left (-4.699, 49.237), right
  (49.237, -4.699), bay (30.315, 68.55). The mooring buoy stays at 1, so its moorings are unchanged. The Weavers'
  station's berths at 1.5: (-52.243, 52.243) and (29.738, -29.738), the Loom
  hall's second (45.813, -45.813).
- Black Eye's Blurb settlements, on their own branch, take the destination
  scale when they land.
