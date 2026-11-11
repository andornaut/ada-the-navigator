# Controls

Ada's buttons and selection controls use Chibi's control geometry, states and
spacing exactly, recoloured to the dark lavender palette below. Measurements are
CSS pixels at 1x. Chibi's control rules are restated here; the sprites and their
provenance are in [UI assets](ui.md).

## Buttons

| Rule            | Value                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| Standard height | 48, a 44px face over a 4px lower lip                                         |
| Pressed         | Face, label and icon drop 2px; the lip disappears                            |
| Disabled        | Flat face over the full 48px, no lip, no press displacement                  |
| Content inset   | At least 16 horizontal and 12 vertical per side                              |
| Action row gap  | 8                                                                            |
| Width           | Shared within an action group; grows to fit the widest label                 |
| Label           | Native 16px bold, centred by visible ink in each state's face                |
| Leading icon    | Centred with the label as one group, 6px gap                                 |
| Focus           | Ring 4px outside the face, independent of pressed, selected or checked state |
| Press target    | At least 48 per axis                                                         |
| Paired actions  | Secondary on the left, primary on the right                                  |
| Hover           | No hover-only styling; hover never changes size or role colour               |
| Sheets          | `ui-button` (secondary), `ui-button-primary`; tags normal, pressed, disabled |
| Nine-slice      | 16x28 frames, margins left/top/right/bottom 2/4/2/6                          |

The normal face is the drawn rectangle minus the lip, the pressed face has the
same height moved down 2px, and the disabled face is the whole rectangle. Measure
label centring against these faces, not the nine-slice margins or press target.
Never shrink a label to fit; grow the button or reword the label. Primary and
secondary share one silhouette; role sets colour and state sets geometry. A
disabled control keeps its label and layout, cannot activate and is skipped by
keyboard navigation.

The focus sheet `ui-focus` is a 16x16 nine-slice with 4px margins: a 1px ink
fringe, a 2px cream band and a 1px ink fringe. HTML pages draw the same ring with
a 2px cream outline at 1px offset over 1px and 4px ink shadows.

## Cards and modals

Every modal uses one content-fitted card layout. Settings, install steps, update
offers, cheats, the station card, the shop and confirms differ only in their
groups.

- Card padding: 16 on every side.
- Card width: `min(availableWidth, max(contentWidth + 32, viewportWidth * 0.5))`.
  `contentWidth` is the widest group (or the reserved title width); the safe
  available width is only the final cap. Height fits the content, with no
  minimum and no reserved empty space.
- Placement: the card centres horizontally and vertically in the view.
- Groups stack top to bottom with 8px between them. Each group keeps its own
  measured width and centres horizontally in the card's inner width.
- Header: the title centres across the whole card, reserving the close press
  target plus 8px (50px) on both sides. The gap from the title's ink to the
  first group equals the gap from the frame's inner top edge to the title's ink.
- Close: a 24x24 face 6px from the card's top and right edges, centred in a
  48x48 press target that may extend past the card.
- Control rows: one group, as wide as its widest row and centred, with 4px
  between rows. Each row is 48 high: a 16px icon, 8px, the label, 8px, then the
  switch or row action placed at the row's right end, both centred vertically.
  The whole row activates. A row with supporting text grows to fit it at 16px.
- Row actions (Install in Settings) sit at the right end of their row inside
  the row group, never as a separate full-width button.
- Action groups: a row of buttons sharing one width (the widest label plus 16px
  insets) with 8px gaps, or a stack with 4px gaps; the group centres in the
  card. A single action is a one-button group, centred.
- Every modal dims the background behind it and receives input exclusively.
  Outside taps never activate controls underneath.

## Pause

- Pause button: `ui-pause`, tags `rest`, `press` (once) and `held`, 35x35 frames.
  A 33px disc with an ink edge, a 2px cream ring and a navy face holds two 4x13
  bars 3px apart; press swells it to 35px for the first 60ms frame only. Its edge
  sits 8px in from the view's top and left, with a 52.5x52.5 press area. It is a
  touch control, hidden on desktop (Escape pauses) and while dialogue is open.
- Pause card: title "Paused" with the close X, then Resume (primary), Travel,
  Settings and Return home (secondary), stacked in that order. The faces are
  48px high, share the body width and sit 8px apart, with 16px from each face to
  the card's left and right edges and from the last face (or the note) to the
  bottom. While Ada is in danger, Travel and Return home use the disabled face
  and refuse with the shared cue, and the note "Unavailable while you are in
  danger." sits below the stack in supporting text. Travel opens the
  "Discovered destinations" card and Settings opens over the same dim; one card
  shows at a time.
- The space screen shows no navigation or destination panel; navigation lives in
  the pause card.

## Switch

`ui-switch` is 32x16 with tags `on` and `off`. On places the knob right with a
tick; off places it left with a cross. Off is an available value and never looks
disabled. Focus uses the shared ring.

## Refusal cue

A control that refuses an action stays in place and plays Archie's shared
refusal cue for 320ms:

- Its labels tint red `#e4574e` at 80ms, return at 160ms, tint again at 240ms
  and return at 320ms.
- The whole control shakes 3px right and back four times, 40ms each way.
- Reduced motion: the labels hold the red tint for the full 320ms, with no
  shake.

A repeat activation during the cue does not restart it.

## Colour tokens

| Token          | Colour    | Use                                           |
| -------------- | --------- | --------------------------------------------- |
| Card face      | `#3b3850` | Settings card and modal ground                |
| Card shade     | `#2f2d3d` | Card lower-right edge                         |
| Card rim       | `#6b6685` | Card upper-left edge                          |
| Ink            | `#181425` | Outlines, fringes and button labels           |
| Primary face   | `#bfa06f` | Muted gold main action                        |
| Primary lip    | `#8a7148` | Primary lower lip                             |
| Primary rim    | `#d2b886` | Primary top highlight                         |
| Secondary face | `#9690b4` | Other actions                                 |
| Secondary lip  | `#5f5980` | Secondary lower lip                           |
| Secondary rim  | `#aaa4c6` | Secondary top highlight                       |
| Disabled face  | `#2f2d3d` | Flat unavailable control                      |
| Focus ring     | `#ead4aa` | Cream band with ink fringes                   |
| Close X        | `#ead4aa` | Normal close mark; white on `#403d55` pressed |
| Switch on      | `#2f7d76` | Track, with `#1f5a55` edge                    |
| Switch off     | `#57536e` | Track, with `#403d55` edge                    |
| Switch knob    | `#ffffff` | Knob, shaded `#c9c4d8`                        |
| Card icons     | `#ead4aa` | Settings row and install step icons           |

Runtime text is drawn by the game, never baked into sprites.

| Text            | Colour    | Size      | Ground    | Contrast |
| --------------- | --------- | --------- | --------- | -------- |
| Title           | `#ffffff` | 24px bold | `#3b3850` | 11.25:1  |
| Body, row label | `#ead4aa` | 16px      | `#3b3850` | 7.76:1   |
| Supporting text | `#b8b3c9` | 16px      | `#3b3850` | 5.53:1   |
| Primary label   | `#181425` | 16px bold | `#bfa06f` | 7.27:1   |
| Secondary label | `#181425` | 16px bold | `#9690b4` | 5.96:1   |
| Disabled label  | `#9a96ad` | 16px bold | `#2f2d3d` | 4.69:1   |

Labels meet 4.5:1 and essential marks 3:1. Card icons, the close X and the focus
ring are 7.76:1 on the card; the focus ring is 10.11:1 on the page background
`#292734`. The pressed close X is 10.41:1 on `#403d55`. The switch tick is
4.87:1 on the on track. Primary and secondary faces are 4.54:1 and 3.72:1
against the card, and 5.91:1 and 4.84:1 against the page background.

## Top-right HUD icon buttons

The weapon selector buttons in the top-right corner are 48x48 faces with a 2px
ink `#181425` border and corner radius 8, and draw a 24px `weapon-<id>-24.svg`
glyph for readability. They sit 8px apart, so a selection ring clears its
neighbours. The space screen has no settings button; Settings opens from the
pause card. `icon-settings-nav-24` serves screens outside space play, such as
the start screen.

| Weapon state | Face      | Glyph                    | Ring |
| ------------ | --------- | ------------------------ | ---- |
| Idle         | `#262b44` | `#ead4aa`                | None |
| Selected     | `#f0bd68` | `#181425`                | Yes  |
| Locked       | `#1d2032` | `#6f7891`                | None |
| Refused      | `#1d2032` | `#e4574e` during the cue | None |

- Selected follows Chibi's power-up face: amber with an ink glyph, plus a 2px
  cream `#ead4aa` ring 2px outside the face (4px outset). The ring's corner
  radius follows the face: 8 at the face, 12 at the ring's outer edge.
- Locked applies to every unselected weapon in combat and through the 5 seconds
  after it ends, until weapon changes unlock; the selected weapon keeps its
  selected look. The locked look is fully opaque, with no ring.
- A tap on a locked weapon plays the [refusal cue](#refusal-cue) with the
  glyph as its label.
- Focus-visible is a 3px cream outline at 4px offset, over any state.
- Contrast: idle glyph 9.59:1, selected glyph 10.45:1, locked glyph 3.66:1 and
  refused glyph 4.42:1 on their faces.

Weapon glyphs are single-colour SVGs; draw each state's glyph colour by using
the SVG as a CSS mask (`mask: url(...) center / 24px 24px no-repeat`) over a
background in that colour. The 20px weapon SVGs stay published for existing
references.

## Touch sticks

Both sticks draw a speed line from the ring centre to the knob centre: 2px cream
`#ead4aa` with a 1px ink `#181425` fringe on each side, at the rings' 85%
opacity, under the knob. Its length is proportional to stick deflection and it
is absent at rest. See [touch joystick sheets](touch-joystick.md).

## Landing page

`pages/index.html` and `public/site.css` apply these rules to HTML: Install
(secondary) on the left, Play (primary) on the right, 8px gap, 48px height, 16px
horizontal padding and one shared width. The install steps dialog's Close is
secondary. Each uses the focus ring above.
