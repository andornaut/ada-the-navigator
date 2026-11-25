# Destinations

Every place Ada visits draws larger than the ships and keeps a clear edge on
every field, and shows a Use callout while Ada can act on it. Destinations are
the stations, outposts, settlements and story places, with the project frames
drawn on them.

## Scale

Destination sources use `DISPLAY_SCALE` (0.4375) with the destination
multiplier (1.5) or Cartwheel hub multiplier (1.25). Each family's producer
sets its final display dimensions. Sunflower outposts and their project
frames grow by 1.4, Andromeda and Phantom settlements by 1.45, and Andromeda
guide beacons by 1.5. The scale of a sprite converts its frame-px measurements
to display px. Placement uses its authored pivot at the current world position.

Every guide beacon state shares the dark beacon's frame and pivot, so a state
change swaps in place. The spare has its own frame and world anchor.

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
  world units from its centre, `talkRange`) and Use acts on it; hidden
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

Destinations stay pass-through and carry no `collision`. Ada enters stations
by Use. The body's silhouette and decorative mouth offsets use the dimensions
in its manifest, measured relative to the pivot. The Use callout sits 3 px
above the current silhouette. Gameplay keeps its 160-world-unit Use range
centred on the destination.

- **Stations**: Ada enters by Use. Story craft use the hub and Weavers' station
  berths and the courier school's pier.
- **Clearance**: every rule stated as an object's silhouette radius plus a
  margin keeps large rocks clear of stations, destinations and launch points.
  Centre-to-centre spacings are 8000 between stations, 1200 between story
  destinations and from them to stations, 2000 from launches. The callout
  fills the 30 px from 3 to 33 px above a destination's top and is pass-through.
- **Story craft at the hub**: the hub's berth points in world units from the
  pivot at 1.25 are left (-4.699, 49.237), right (49.237, -4.699), and the
  funded forward attachment (29.297, 35.859). The mooring buoy stays at 1. The Weavers'
  station's berths at 1.5: (-52.243, 52.243) and (29.738, -29.738), the Loom
  hall's second (45.813, -45.813).
