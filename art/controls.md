# Controls

Ada's buttons and selection controls use Chibi's control states, recoloured to
the dark lavender palette below. Every distance and size comes from
[Layout](layout.md); this page owns states, colours and the refusal cue. The
sprites and their provenance are in [UI assets](ui.md).

## Buttons

Game buttons in HTML, canvas and mocks show focus, press and selection with
a clearly visible change to the face fill, label or icon colour. Keep that cue
visible in forced-colors mode, including when focus coincides with a press,
selection or an unavailable action. Keep ordinary borders present in every
state. Added state outlines, border rings and ring-shaped shadows are
excluded. Existing pressed movement can supplement the colour cue. Preserve
native focus, tab order, keyboard activation, focus restoration and a
distinct disabled state.

Padding and margins are measured to drawn pixels, counting icon side bearings
([Spacing tokens](layout.md#spacing-tokens)).

| Rule         | Value                                                                                                                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geometry     | `TEXT_BUTTON` uses the standard 48 px height and 16 px horizontal and 12 px vertical text insets. Authored compact and round controls keep their specified geometry. See [Layout](layout.md#controls-and-targets).                                   |
| Pressed      | Face, label and icon sink by `TEXT_BUTTON.pressedSink`; the lip disappears                                                                                                                                                                           |
| Disabled     | Flat face over the full height, no lip, no press displacement                                                                                                                                                                                        |
| Unavailable  | The disabled face, but focusable; activation plays the refusal cue                                                                                                                                                                                   |
| Width        | In a horizontal row or a row that wraps, each button fits its own content plus the standard insets. A sole visible action centres in its row, independent of hidden controls and wrappers. A vertical stack stretches its buttons to a shared width. |
| Label        | `TYPE.label`, centred by visible ink in each state's face                                                                                                                                                                                            |
| Leading icon | Centred with the label as one group, `SPACING.markGap` apart                                                                                                                                                                                         |
| Focus        | Use a visible face, label or icon cue for keyboard focus in each focusable state                                                                                                                                                                     |
| Primary      | Keep the existing primary last in its own group, rightmost in a horizontal layout and at the bottom of a vertical layout. Preserve secondary order, safety roles and separate command groups.                                                        |
| Hover        | No hover-only styling; hover never changes size or role colour                                                                                                                                                                                       |
| Sheets       | `ui-button` (secondary), `ui-button-primary`; tags normal, pressed, disabled                                                                                                                                                                         |
| Nine-slice   | 16x28 frames, margins left/top/right/bottom 2/4/2/6                                                                                                                                                                                                  |

The normal face is the drawn rectangle minus the lip, the pressed face has the
same height moved down by the sink, and the disabled face is the whole
rectangle. Measure label centring against these faces, not the nine-slice
margins or press target. Never shrink a label to fit; grow the button or reword
the label. Primary and secondary share one silhouette; role sets colour and
the pressed pose keeps its geometry. A disabled control keeps its label
and layout at full opacity, cannot activate and is skipped by keyboard
navigation. Its colours are in [Disabled states](#disabled-states).

Current Ada row widths still depend on the shared grid and wrapping styles,
and Start still uses its fixed title width. See the
[sizing implementation notes](layout.md#groups) for the current behavior
and the remaining migration.

Focusable reading regions keep their authored visible focus treatment. The
`ui-focus` sheet is a 16x16 nine-slice with 4px margins (1px ink, 2px cream,
1px ink). The HTML equivalent uses a 2 px cream outline at 1 px offset
with 1 px and 4 px ink shadows. Some button paths still use the fallback
outline and remain pending migration.

Enabled legacy text buttons with keyboard focus tint the centre cream with
ink text and keep their existing sprite slices. Forced colors use
`Highlight` and `HighlightText`. Focusable unavailable actions keep the flat
disabled face and underline the label on focus. The primary, secondary and
tile sprites keep their centre fill in the pressed frame (`#bfa06f`,
`#9690b4` and `#46425e` respectively). A distinct press colour cue remains
pending where the only change is the sprite's pressed geometry.

Game Kit owns shared button rendering and states. Tech owns Ada's skin and
local overrides. Verify the shared defaults and Ada's buttons in source
and rendered states, including forced colors and keyboard navigation.

## Compact row action

A tile row's action at its right end, drawn inside the row: the row stays one
control, so no button gap applies between the action and the row (the Install
row's compact action is the same part). Job rows use it for Accept and Drop.

| Rule      | Value                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| Geometry  | `TEXT_BUTTON.compactHeight` 28: a 24 face over the 4 lip; 72 wide, or the label plus 8 px insets when wider |
| Sheets    | `ui-button-primary` for the row's one action, `ui-button` for Drop; nine-slice 2/4/2/6                      |
| Label     | `TYPE.label`, ink `#181425`, its 20 line box centred on the 24 face (2 above)                               |
| Pressed   | Follows the row: the row's press sinks the whole row, the action included; it has no press of its own       |
| Disabled  | In a busy row: the disabled frame, flat over the full 28, the label in row disabled `#a6a2b8`, centred at 4 |
| Placement | `SPACING.gap` right of the reward pill, at the row's right inset, centred on the row's face                 |

Accept ink is 7.26:1 on the primary face and Drop ink 5.95:1 on the secondary
face; the faces are 3.84:1 and 3.15:1 against the `#46425e` tile.

## Cards and modals

Every modal uses its width family's card in
[Layout](layout.md#modals); each screen's groups are listed in
[Layout screens](layout.md#cards). Every modal dims the background behind it
and receives input exclusively. Outside taps never activate controls
underneath.

## Pause

The rim is part of each authored pose. The press changes the face and glyph
colour and keeps the existing swell and held geometry.

- Pause button: vector art, 35x35 logical, drawn with smooth sampling (never
  `image-rendering: pixelated`), so it stays sharp at every view scale. Its
  placement and press area are `PAUSE_BUTTON` in
  [Layout](layout.md#hud-and-overlays). It is a touch control, hidden on
  desktop (Escape pauses) and while a modal card or storybook page is open. It
  stays visible and live while the conversation box shows.
- Geometry is Chibi's `pauseChromeLayers` (`chibis-way-home`
  `src/ui/chrome/pauseChrome.ts`): circles centred at 17.5,17.5 and two 4x13
  bars at 12,11 and 19,11 (3 apart), in the ring colour.

| File                                     | Pose                   | Ink edge | Ring                    | Face                 |
| ---------------------------------------- | ---------------------- | -------- | ----------------------- | -------------------- |
| `public/art/ui/icons/pause.svg`          | Rest                   | r 16.5   | Cream, r 15.5, 2 px     | Navy `#262b44`, 13.5 |
| `public/art/ui/icons/pause-press.svg`    | Press frame 0 (swell)  | r 17.5   | White, r 16.5, 3 px     | `#3a4466`, 13.5      |
| `public/art/ui/icons/pause-held.svg`     | Press frame 1 and held | r 16.5   | White, r 15.5, 3 px     | `#3a4466`, 12.5      |
| `public/art/ui/icons/pause-disabled.svg` | Disabled               | r 16.5   | `#75748c`, r 15.5, 2 px | `#262b44`, 13.5      |

- Menu button: the same frame, poses, timing and press area, with three 11x3
  bars at x 12, y 11, 16 and 21 (2 apart) in place of the pause bars:
  `menu.svg`, `menu-press.svg`, `menu-held.svg` and `menu-disabled.svg` beside
  the pause files; the disabled frames are the rest pose with the ring and
  bars in `#75748c`. It
  shows on the Start screen and in Ada's room, where it opens the Menu card.

- Timing stays in the `ui-pause` sheet's JSON, as in Chibi: tags `rest`
  (frame 0, 100ms), `press` (frames 1 and 2, 60ms each, once) and `held`
  (frame 3, 100ms). Frame 0 shows `pause.svg`, frame 1 `pause-press.svg`,
  frames 2 and 3 `pause-held.svg`. The sheet's PNG is no longer drawn.
- Contrast: cream bars and ring 9.59:1 on the navy face and 10.11:1 on the
  space background `#292734`; pressed white bars 9.55:1 on `#3a4466`.
- Pause opens the [Paused card](layout.md#cards), where Cheats is a direct
  action. Back to title and primary Resume are full-width, with Resume at
  the bottom.
  Every action stays available in danger. Map always opens the
  [map](map.md), which holds Galaxies; in danger Travel here and Galaxies are
  unavailable there. Settings opens over the same dim; one card or the map
  shows at a time.
- Ada's room page shows the Menu button at the top left, also touch only (on
  desktop Escape opens the Menu card): Achievements, Cheats, Settings, Back to title,
  then Close (primary).
- The space screen shows no navigation or destination panel; navigation lives in
  the pause card.

## Switch

`ui-switch` is 32x16 with tags `on` and `off`. On places the knob right with a
tick; off places it left with a cross. Off is an available value and never looks
disabled. Settings exposes the row as a switch (`role="switch"`) on a
native button. Keyboard focus and press give the enabled row a cream face
(`#ead4aa`) with dark text and a dark leading icon. The switch track and knob
keep their on or off art. In forced colors, the row uses `Highlight` with
`HighlightText` and retains the authored icon colours.

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

| Token                | Colour    | Use                                                                      |
| -------------------- | --------- | ------------------------------------------------------------------------ |
| Card face            | `#3b3850` | Settings card and modal ground                                           |
| Card shade           | `#2f2d3d` | Card lower-right edge                                                    |
| Card rim             | `#6b6685` | Card upper-left edge                                                     |
| Ink                  | `#181425` | Outlines, fringes and button labels                                      |
| Primary face         | `#bfa06f` | Muted gold main action                                                   |
| Primary lip          | `#8a7148` | Primary lower lip                                                        |
| Primary rim          | `#d2b886` | Primary top highlight                                                    |
| Secondary face       | `#9690b4` | Other actions                                                            |
| Secondary lip        | `#5f5980` | Secondary lower lip                                                      |
| Secondary rim        | `#aaa4c6` | Secondary top highlight                                                  |
| Disabled face        | `#2f2d3d` | Flat disabled or unavailable control                                     |
| Disabled mark        | `#9a96ad` | Icons, glyphs and marks of a disabled control, the Disabled label colour |
| Disc disabled        | `#75748c` | Ring, bars and glyph of a disabled or empty HUD disc                     |
| Quantity unavailable | `#514b68` | Flat face of an unavailable Exchange quantity                            |
| Focus ring           | `#ead4aa` | Cream band with ink fringes                                              |
| Close X              | `#ead4aa` | Normal close mark; white on `#403d55` pressed                            |
| Switch on            | `#2f7d76` | Track, with `#1f5a55` edge                                               |
| Switch off           | `#57536e` | Track, with `#403d55` edge                                               |
| Switch knob          | `#ffffff` | Knob, shaded `#c9c4d8`                                                   |
| Card icons           | `#ead4aa` | Settings row and install step icons                                      |
| Modal dim            | `#101926` | At alpha 0.70 over the whole view, under every modal card (`.ada-modal`) |

Runtime text is drawn by the game, never baked into sprites.

| Text            | Colour    | Role           | Ground    | Contrast |
| --------------- | --------- | -------------- | --------- | -------- |
| Title           | `#ffffff` | `TYPE.heading` | `#3b3850` | 11.25:1  |
| Body, row label | `#ead4aa` | `TYPE.body`    | `#3b3850` | 7.76:1   |
| Supporting text | `#b8b3c9` | `TYPE.body`    | `#3b3850` | 5.53:1   |
| Primary label   | `#181425` | `TYPE.label`   | `#bfa06f` | 7.27:1   |
| Secondary label | `#181425` | `TYPE.label`   | `#9690b4` | 5.96:1   |
| Disabled label  | `#9a96ad` | `TYPE.label`   | `#2f2d3d` | 4.69:1   |
| Row supporting  | `#c0bbd0` | `TYPE.body`    | `#46425e` | 5.11:1   |
| Row disabled    | `#a6a2b8` | Any            | `#2f2d3d` | 5.42:1   |

Tile rows (shop items, ammunition, projects and jobs) draw their second line
and Owned in row supporting, on the `#46425e` tile face, and every text of an
unaffordable or busy row in row disabled, on the flat `#2f2d3d` face, so row
text is 5:1 or more. Glyphs keep their `disabled` frames (`#9a96ad`, 4.69:1
on that face).

Enabled labels meet 4.5:1 and essential marks 3:1; disabled labels and marks
meet 3:1 ([Disabled states](#disabled-states)). Card icons, the close X and the focus
ring are 7.76:1 on the card; the focus ring is 10.11:1 on the page background
`#292734`. The pressed close X is 10.41:1 on `#403d55`. The switch tick is
4.87:1 on the on track. Primary and secondary faces are 4.54:1 and 3.72:1
against the card, and 5.91:1 and 4.84:1 against the page background.

## Disabled states

A disabled or unavailable control reads as present but unavailable through its
own colours. No control, label or icon is dimmed with element opacity, in any
state. Every figure below is measured between opaque colours.

One rule sets every family:

- A control that owns a rectangular button face replaces it with the flat
  Disabled face `#2f2d3d`, using its sheet's `disabled` frame: no lip, no rim
  and no press displacement.
- A control with a round face, or with no face of its own, keeps that face or
  ground.
- Text takes Disabled label `#9a96ad`, or Row disabled `#a6a2b8` inside a tile
  row. Icons, glyphs, rings and marks take Disabled mark `#9a96ad`, or Disc
  disabled `#75748c` on a HUD disc.
- Text and marks are 3:1 or more against their face and lower than the enabled
  state's contrast. The Disabled face is 1.19:1 against the card `#3b3850`,
  1.41:1 against a tile `#46425e` and 1.09:1 against the page background
  `#292734`: the label and mark carry the control's presence, not the face.

A disabled control is skipped by keyboard navigation; an unavailable one stays
focusable and underlines its label on focus. Both keep the look below at rest,
and an attempted activation plays the [refusal cue](#refusal-cue), which tints
the label and glyph red `#e4574e` for its 320ms and then returns them to the
disabled colours.

| Family                                                                | Face                                                             | Frame or border                                                                                                                 | Text                                                                    | Icon or mark                                                          | Text and icon on face                                   | Enabled, for comparison      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------- |
| Standard text button, primary                                         | Disabled face `#2f2d3d`                                          | `ui-button-primary` frame 2 (`disabled`), flat over the full 48                                                                 | Disabled label `#9a96ad`                                                | Disabled mark `#9a96ad`                                               | 4.69:1                                                  | Ink on `#bfa06f`, 7.27:1     |
| Standard text button, secondary                                       | Disabled face `#2f2d3d`                                          | `ui-button` frame 2 (`disabled`), flat over the full 48                                                                         | Disabled label `#9a96ad`                                                | Disabled mark `#9a96ad`                                               | 4.69:1                                                  | Ink on `#9690b4`, 5.96:1     |
| Compact or small button                                               | Disabled face `#2f2d3d`                                          | The same sheets' frame 2, flat over the full 28                                                                                 | Disabled label `#9a96ad`; Row disabled `#a6a2b8` inside a busy tile row | Disabled mark `#9a96ad`                                               | 4.69:1; 5.42:1 in a row                                 | Ink, 7.27:1 or 5.96:1        |
| Shop, ammunition, job and project rows (unaffordable, busy or locked) | Disabled face `#2f2d3d`, the well included                       | `ui-button-tile` frame 2 (`disabled`), flat over the full height                                                                | Row disabled `#a6a2b8`, every line and the price                        | Disabled mark `#9a96ad`: mask ink, or the glyph's `-disabled.svg`     | Text 5.42:1, glyph 4.69:1, price 7.27:1 on its ink pill | Cream on `#46425e`, 6.58:1   |
| Exchange quantity                                                     | Quantity unavailable `#514b68`, 1.60:1 against its row `#302e42` | None: a flat face with no frame                                                                                                 | Cream `#ead4aa`                                                         | The resource icon, unchanged                                          | 5.67:1                                                  | Ink on `#9690b4`, 5.96:1     |
| Ship card row                                                         | None: the card `#3b3850`                                         | None                                                                                                                            | Disabled label `#9a96ad`                                                | Disabled mark `#9a96ad`: mask ink, or the icon's disabled counterpart | 3.93:1                                                  | Cream, 7.76:1                |
| Station page buttons (tabs)                                           | Disabled face `#2f2d3d`                                          | `ui-button` frame 2 (`disabled`)                                                                                                | Disabled label `#9a96ad`, no underline                                  | Disabled mark `#9a96ad`                                               | 4.69:1                                                  | Ink on `#9690b4`, 5.96:1     |
| Switch row                                                            | None: the card `#3b3850`                                         | The switch's `on-disabled` or `off-disabled` frame: Disabled face track, Disabled mark knob with its tick or cross in `#2f2d3d` | Disabled label `#9a96ad`                                                | Disabled mark `#9a96ad`, the leading icon                             | Label and icon 3.93:1; knob 4.69:1 on its track         | Cream, 7.76:1                |
| Close X                                                               | None: the card `#3b3850`                                         | `ui-close` `disabled` frame: the X alone, no face                                                                               | None                                                                    | Disabled mark `#9a96ad`                                               | 3.93:1                                                  | Cream, 7.76:1                |
| Pause and Menu discs                                                  | Navy `#262b44`, as at rest                                       | The rest pose's ink edge; ring in Disc disabled `#75748c`                                                                       | None                                                                    | Disc disabled `#75748c`, the bars                                     | 3.07:1; ring 3.23:1 on the page background              | Cream, 9.59:1                |
| Weapon disc                                                           | The weapon's solid face, navy `#262b44` when selected            | The annulus with both ink fringes; band in Disc disabled `#75748c`                                                              | Count pill unchanged                                                    | Disc disabled `#75748c`, the glyph                                    | 3.07:1 or more on every weapon face                     | Idle 6.83:1, selected 9.59:1 |

- The current Station page button is a selection, not a disabled state: it
  shares the flat `#2f2d3d` face but keeps a cream label (9.27:1) and the
  primary underline ([Station pages](shop.md#station-pages)).
- The Exchange quantity is the one exception to the Disabled face: its row
  ground `#302e42` is 1.02:1 against `#2f2d3d`, so the flat face would not
  show there.
- Owned and Funded rows that cannot activate are status rows. They keep the
  enabled tile face and text, without press displacement.
- A disabled weapon disc draws its band and glyph in the Empty glyph colour at
  every level and selection. Disc disabled is 3.07:1 on navy, 3.23:1 on the base field,
  3.75:1 on dark plum, 3.22:1 on sunflower, 3.19:1 on dark teal and 3.97:1 on
  ink.
- Map place chips and quest markers are never disabled. A quest route endpoint
  that refuses follows the faceless rule: Disabled label on the card, 3.93:1.

Sprite coverage:

| Sprite                                             | Disabled frame                                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ui-button`, `ui-button-primary`, `ui-button-tile` | Frame 2 (`disabled`) covers it                                                                       |
| Shop, job and project glyphs                       | The `-disabled.svg` counterparts cover them                                                          |
| Weapon discs                                       | Drawn from colour tokens; no sprite                                                                  |
| `ui-close`                                         | Art adds a `disabled` frame: the X in `#9a96ad`                                                      |
| `ui-switch`                                        | Art adds `on-disabled` and `off-disabled` frames                                                     |
| Pause and Menu                                     | Art adds `pause-disabled.svg` and `menu-disabled.svg`: the rest pose with ring and bars in `#75748c` |
| Ship card colour icons                             | Art adds disabled counterparts of `icon-cargo-20` and `icon-tow-20` in `#9a96ad`                     |

## Conversation box

The in-flight conversation box is not modal: it draws no dim and leaves the
HUD visible and live. Geometry is `CONVERSATION_BOX` in
[Layout](layout.md#conversation-box).

| Token              | Colour    | Use                                          |
| ------------------ | --------- | -------------------------------------------- |
| Conversation panel | `#181425` | Ink panel at alpha 0.55 in every galaxy      |
| Portrait edge      | `#181425` | 2 px frame edge, opaque                      |
| Portrait face      | `#262b44` | Slot face behind the portrait's clear pixels |
| Tab edge           | `#181425` | 1 px name tab edge, opaque                   |
| Ada tab            | `#70ace8` | Her ship's blue accent                       |
| Astra tab          | `#8fe0f2` | Her teal light                               |
| Penny tab          | `#feae34` | Her golden coat                              |
| Unknown voice tab  | `#b8b3c9` | Admiral Archie before he is named            |
| Admiral Archie tab | `#d68b72` | The drones' coral hull                       |
| Mom tab            | `#9fd98a` | Her green cardigan                           |
| Dad tab            | `#c4a6ec` | His purple T-shirt                           |
| Pip tab            | `#9fb0ff` | The courier cap                              |
| Wick tab           | `#e0b48e` | The settler's brown coat                     |
| Settler tab        | `#f0c0e0` | The greeter's rose hat                       |
| Lumen tab          | `#fde58a` | The lantern's light                          |
| Dial tab           | `#d0d8ff` | The periwinkle shell                         |
| Cog tab            | `#a8f0c0` | The green LEDs                               |
| Clover tab         | `#8fd16a` | The clover leaf cap                          |
| Rivet tab          | `#ff9f6b` | The workshop apron                           |
| Patch tab          | `#d0c0a0` | The scrap backpack                           |
| Saffron tab        | `#ffcf8f` | The saffron fur                              |
| Bramble tab        | `#d6e88a` | The berry beret's leaves                     |
| Nectar tab         | `#ffc2d6` | The pink bow                                 |
| Marlo tab          | `#a59ff0` | The lavender hull                            |
| Whale family tab   | `#eadcff` | The family's pale hull                       |
| Ripple tab         | `#a8f0c8` | The seafoam mantle                           |
| Coral tab          | `#f7b0c4` | The pink mantle                              |
| Brine tab          | `#7fc0f0` | The deep blue mantle                         |
| Quartz tab         | `#d8ccf4` | The quartz crown                             |
| Slate tab          | `#a8c8b8` | The slate seams                              |
| Garnet tab         | `#ec8f9e` | The garnet crystals                          |
| Mica tab           | `#ffd36b` | The hard hat                                 |
| Opal tab           | `#f5a8d8` | The rose scarf                               |
| Jasper tab         | `#f0b080` | The ochre bands                              |
| Grandma tab        | `#f0b4d0` | The rose cardigan                            |
| Elder Loom tab     | `#e9e3da` | The pearl collar                             |
| Reed tab           | `#e3c6e8` | The rose thread scarf                        |
| Sedge tab          | `#9fcf9f` | The sedge tunic                              |
| Willow tab         | `#d0a8e8` | The lavender shawl                           |
| Marsh tab          | `#e0c79a` | The tan feathers                             |
| Dollop tab         | `#f2a6e6` | The orchid goo                               |
| Blurb settler tab  | `#b0c4ff` | The Blurb greeter's violet-blue goo          |

Tabs, labels, lines and portraits are fully opaque; only the panel is
translucent. Tab labels are `TYPE.label` in ink; lines are `TYPE.body` in
cream. The name tab overhangs the panel's top edge by 10, so its upper half
sits on open space.

The contrast below is calculated from the named flat colours. Blend the ink
panel with the backdrop in sRGB using the encoded alpha byte (`0x8c` for
0.55), round to 8-bit channels, then compare relative luminance.

| Text           | Colour    | Ground                                     | Contrast |
| -------------- | --------- | ------------------------------------------ | -------- |
| Line           | `#ead4aa` | Panel over the base field `#292734`        | 11.38:1  |
| Line           | `#ead4aa` | Panel over Sunflower `#D8C994`             | 3.90:1   |
| Line           | `#ead4aa` | Panel over Cartwheel `#BC9D90`             | 5.07:1   |
| Line           | `#ead4aa` | Panel over Whirlpool `#B8CEC4`             | 3.92:1   |
| Line           | `#ead4aa` | Panel over Needle `#C6BBA6`                | 4.31:1   |
| Line           | `#ead4aa` | Panel over Andromeda `#9298B5`             | 5.43:1   |
| Line           | `#ead4aa` | Panel over Phantom `#514955`               | 9.30:1   |
| Line           | `#ead4aa` | Panel over `#ffffff`, a solid white sample | 2.76:1   |
| Ada label      | `#181425` | `#70ace8`                                  | 7.51:1   |
| Astra label    | `#181425` | `#8fe0f2`                                  | 12.11:1  |
| Penny label    | `#181425` | `#feae34`                                  | 9.71:1   |
| Unknown voice  | `#181425` | `#b8b3c9`                                  | 8.86:1   |
| Admiral Archie | `#181425` | `#d68b72`                                  | 6.69:1   |
| Pip            | `#181425` | `#9fb0ff`                                  | 8.69:1   |
| Wick           | `#181425` | `#e0b48e`                                  | 9.51:1   |
| Settler        | `#181425` | `#f0c0e0`                                  | 11.43:1  |
| Lumen          | `#181425` | `#fde58a`                                  | 14.37:1  |
| Dial           | `#181425` | `#d0d8ff`                                  | 12.82:1  |
| Cog            | `#181425` | `#a8f0c0`                                  | 13.63:1  |
| Clover         | `#181425` | `#8fd16a`                                  | 9.86:1   |
| Rivet          | `#181425` | `#ff9f6b`                                  | 8.94:1   |
| Patch          | `#181425` | `#d0c0a0`                                  | 10.06:1  |
| Saffron        | `#181425` | `#ffcf8f`                                  | 12.50:1  |
| Bramble        | `#181425` | `#d6e88a`                                  | 13.53:1  |
| Nectar         | `#181425` | `#ffc2d6`                                  | 11.96:1  |
| Marlo          | `#181425` | `#a59ff0`                                  | 7.56:1   |
| Whale family   | `#181425` | `#eadcff`                                  | 13.88:1  |
| Ripple         | `#181425` | `#a8f0c8`                                  | 13.69:1  |
| Coral          | `#181425` | `#f7b0c4`                                  | 10.26:1  |
| Brine          | `#181425` | `#7fc0f0`                                  | 9.18:1   |
| Quartz         | `#181425` | `#d8ccf4`                                  | 11.89:1  |
| Slate          | `#181425` | `#a8c8b8`                                  | 9.97:1   |
| Garnet         | `#181425` | `#ec8f9e`                                  | 7.71:1   |
| Mica           | `#181425` | `#ffd36b`                                  | 12.68:1  |
| Opal           | `#181425` | `#f5a8d8`                                  | 9.84:1   |
| Jasper         | `#181425` | `#f0b080`                                  | 9.63:1   |
| Grandma        | `#181425` | `#f0b4d0`                                  | 10.42:1  |
| Elder Loom     | `#181425` | `#e9e3da`                                  | 14.13:1  |
| Reed           | `#181425` | `#e3c6e8`                                  | 11.59:1  |
| Sedge          | `#181425` | `#9fcf9f`                                  | 10.21:1  |
| Willow         | `#181425` | `#d0a8e8`                                  | 8.96:1   |
| Marsh          | `#181425` | `#e0c79a`                                  | 10.99:1  |
| Dollop         | `#181425` | `#f2a6e6`                                  | 9.76:1   |
| Blurb settler  | `#181425` | `#b0c4ff`                                  | 10.45:1  |

The calculated panel composites are `#201d2c` over the base field, `#6f6657`
over Sunflower, `#625255` over Cartwheel, `#60686d` over Whirlpool, `#665f5f`
over Needle, `#4f5066` over Andromeda, `#322c3b` over Phantom and `#807e87`
over white. Top notices use the same panel and line colours. The
flat-field estimates for Sunflower, Whirlpool and Needle fall below 4.5:1.
Rendered contrast varies with the painted field and passing objects.

| Tab            | Fill      | On the field `#292734` | On dark-gold `#332712` | On the panel over `#332712` |
| -------------- | --------- | ---------------------- | ---------------------- | --------------------------- |
| Ada            | `#70ace8` | 6.11:1                 | 6.08:1                 | 6.91:1                      |
| Astra          | `#8fe0f2` | 9.84:1                 | 9.80:1                 | 11.13:1                     |
| Penny          | `#feae34` | 7.89:1                 | 7.86:1                 | 8.93:1                      |
| Unknown voice  | `#b8b3c9` | 7.20:1                 | 7.17:1                 | 8.15:1                      |
| Admiral Archie | `#d68b72` | 5.44:1                 | 5.41:1                 | 6.15:1                      |

Over white the fills alone fall to 1.49:1 (Astra) to 2.69:1 (Admiral Archie);
the 1 ink edge holds 18.02:1 there, so the tab's outline reads over every
backdrop.

## Status pill

The in-flight status pill holds the Stardust count and, while Ada carries
them, her ore and her job or story item or towed craft, beside the pause
button; the shield pill at the bottom centre holds the shield icon and bar.
Geometry, states and timing are `STATUS_PILL` and `SHIELD_PILL` in
[Layout](layout.md#status-pill). The normal panels and the bar's track use
translucent ink. Low and depleted shields use the dark muted
burgundy outer panel `STATUS_COLOURS.lowPanel` (`#532e35`); the remaining
fill, icon and rim retain refusal red `#e4574e` (the existing low pulse and
reduced-motion behavior remain). At zero the fill is empty, with the red
icon and rim visible. The inner track retains its current dark gray
appearance: exclude the bar from the burgundy layer and composite the
original track and normal-panel ink layers over the field, using the
canonical colours rather than a copied flattened colour. Every mark and
the count draw fully opaque. The contrast tables describe the normal ink
panel. The light-field outline applies to the shield pill wherever it sits.

| Token           | Colour    | Use                                                                                                                           |
| --------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Status panel    | `#181425` | Ink panel at alpha 0.65                                                                                                       |
| Shield          | `#70ace8` | Fill and icon: Ada's ship blue, as her tab                                                                                    |
| Shield delay    | `#4f7aa6` | Delay overlay palette, clipped to the remaining filled shield                                                                 |
| Shield low      | `#e4574e` | Low and empty fill, icon and rim: the refusal red                                                                             |
| Shield low peak | `#ff8a80` | Low pulse peak, icon and rim                                                                                                  |
| Shield flash    | `#ffffff` | Hit flash clipped to remaining fill, and the regeneration leading edge                                                        |
| Delay strip     | `#ead4aa` | `STATUS_COLOURS.recharge`: the separate cream timer fill below the shield bar, inside a complete 1 px ink `#181425` rectangle |
| Shield rim      | `#9a96ad` | 1 px bar rim in the normal states                                                                                             |
| Shield track    | `#181425` | Ink at alpha 0.65 inside the rim, over the panel                                                                              |
| Divider         | `#57536e` | 1x16 rule between segments                                                                                                    |
| Count           | `#ead4aa` | Cream `TYPE.label`, the Stardust and ore counts                                                                               |
| Stardust tick   | `#f4d98a` | `+N` label, Stardust body gold, with a 1 px ink outline                                                                       |
| Ore tick        | `#e798cd` | `+N` label, ore's light purple, with a 1 px ink outline                                                                       |

The normal panel is ink at 0.65 over the field. The track is its own ink layer at
0.65 drawn over the pill panel, not a hole in it: 0.8775 combined over the
field, so it composites to `#1a1627` over the base field and
`#2f2a33` over Sunflower.

| Mark or text     | Colour    |    Base | Sunflower | Cartwheel | Whirlpool | Andromeda | Needle | Phantom | `#ffffff` |
| ---------------- | --------- | ------: | --------: | --------: | --------: | --------: | -----: | ------: | --------: |
| Count            | `#ead4aa` | 11.64:1 |    5.20:1 |    6.37:1 |    5.18:1 |    6.73:1 | 5.58:1 |  9.99:1 |    3.88:1 |
| Shield icon      | `#70ace8` |  7.03:1 |    3.14:1 |    3.85:1 |    3.13:1 |    4.06:1 | 3.37:1 |  6.04:1 |    2.34:1 |
| Low icon and rim | `#e4574e` |  4.63:1 |    2.07:1 |    2.54:1 |    2.06:1 |    2.68:1 | 2.22:1 |  3.98:1 |    1.54:1 |
| Low pulse peak   | `#ff8a80` |  7.39:1 |    3.30:1 |    4.04:1 |    3.29:1 |    4.27:1 | 3.54:1 |  6.34:1 |    2.46:1 |
| Rim              | `#9a96ad` |  5.89:1 |    2.63:1 |    3.23:1 |    2.62:1 |    3.41:1 | 2.83:1 |  5.06:1 |    1.96:1 |
| Divider          | `#57536e` |  2.30:1 |    1.03:1 |    1.26:1 |    1.02:1 |    1.33:1 | 1.10:1 |  1.98:1 |    1.30:1 |
| Panel itself     | `#181425` |  1.15:1 |    4.56:1 |    3.68:1 |    4.53:1 |    3.42:1 | 4.26:1 |  1.68:1 |    5.62:1 |

Marks on the panel, against the field under it.

| Bar part        | Colour    |    Base | Sunflower | Cartwheel | Whirlpool | Andromeda |  Needle | Phantom | `#ffffff` |
| --------------- | --------- | ------: | --------: | --------: | --------: | --------: | ------: | ------: | --------: |
| Fill            | `#70ace8` |  7.37:1 |    5.84:1 |    6.18:1 |    5.79:1 |    6.29:1 |  5.97:1 |  7.00:1 |    5.28:1 |
| Delay part      | `#4f7aa6` |  3.93:1 |    3.11:1 |    3.29:1 |    3.09:1 |    3.35:1 |  3.18:1 |  3.73:1 |    2.81:1 |
| Low fill        | `#e4574e` |  4.86:1 |    3.85:1 |    4.07:1 |    3.82:1 |    4.15:1 |  3.94:1 |  4.62:1 |    3.48:1 |
| Flash, edge     | `#ffffff` | 17.68:1 |   14.00:1 |   14.81:1 |   13.89:1 |   15.09:1 | 14.32:1 | 16.80:1 |   12.66:1 |
| Rim, inner edge | `#9a96ad` |  6.18:1 |    4.89:1 |    5.18:1 |    4.86:1 |    5.27:1 |  5.01:1 |  5.87:1 |    4.42:1 |
| Low rim, inner  | `#e4574e` |  4.86:1 |    3.85:1 |    4.07:1 |    3.82:1 |    4.15:1 |  3.94:1 |  4.62:1 |    3.48:1 |

Bar palette colours against the track and field. Delay and hit-flash ranges
are clipped to the remaining fill: the emptied portion always exposes the
usual dark gray track, including while low health pulses. Blue is restricted
to filled shield; the low fill remains red. The icon and rim retain their
existing pulse. The flash is 2.40:1 against the filled shield.

- The count meets 4.5:1 over every galaxy field; over a white object under the
  pill it is 3.88:1, accepted as for the conversation line.
- On the base field and Phantom every mark meets 3:1 against the panel. The
  divider is decorative.
- On a light field (Sunflower, Cartwheel, Whirlpool, Andromeda and Needle) the
  shield icon and the shield bar each draw
  inside a 1 px ink outline (`lightField.hudOutline`), as on the `+N` tick: the
  icon's mask grown by 1 px in ink behind it, and a 1 px ink line outside the
  bar's rim. Against that ink the low icon and rim are 4.95:1, the normal rim
  6.30:1, the shield icon 7.51:1 and the low pulse peak 7.89:1, where the
  panel alone gives 2.06:1, 2.62:1, 3.13:1 and 3.29:1 on Whirlpool, the
  lightest composite. The rim's inner edge holds 3:1 against the track (4.86:1
  or more).
- The delay and hit-flash layers never paint the emptied portion of the
  track. Their state and timing remain independent of their clipped bounds.
- The `+N` labels sit on the field, not the panel: Stardust gold is 10.56:1
  on `#292734` and 1.19:1 on Sunflower's `#D8C994`, ore rust 7.12:1 and
  1.24:1, where the ink outline (10.90:1 on Sunflower, 6.33:1 or more on every
  light field) carries them; the outline (12.99:1 against gold, 8.76:1 against
  rust) keeps them legible over bright objects. On Phantom the gold tick is
  6.22:1 and the rust tick 4.20:1.
- The recharge timer sits inside the existing pill, separate from the main
  shield bar: a 1 px cream fill inside a complete 1 px ink rectangle, including
  both end caps, with a 1 px gap below the main bar. Its dark empty track
  remains visible at zero progress, with no cream fill. The cream and ink
  colours do not change with low or empty shield states. The main bar retains
  its existing low-shield red and empty grey appearance. The main fill is
  centred with equal inner track padding above, below and at the fill
  origin. The timer occupies the existing space below it.
- The low pulse changes colour, not brightness alone, at 1 Hz; the hit flash
  is one 100 ms flash per hit, at most three per second. Nothing flickers.

### Cargo icons

The pill's segment icons and the [Ship card](layout.md#ship-card)'s cargo rows:
20 by 20 pixel art in the UI subset, single `rest` frame, nearest-neighbour.
`icon-stardust-20` is in [Stardust](stardust.md#hud-icon); the other three
rebuild with `node art/tools/cargo-icons.ts`, each inside its own 1 px ink
edge `#181425`, so on a light field it needs no added outline.

The tow hook, including its ink edge, spans columns 4 through 14 and rows 1
through 18 of its 20 px frame, zero-indexed. Its left and right bearings are
4 and 5 px.

| Key                                              | Shows                                   | Colours                                                                                                |
| ------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `icon-ore-20`                                    | A nugget and a pebble                   | Ore's palette ([ore nugget](cartwheel-props.md#ore-nugget)), rim lit `#e798cd`, shade `#d481b9`        |
| `icon-cargo-20`                                  | A strapped crate, any carried item      | The Map's job orange `#feae34`, shade `#c9781c`, strap cream `#ead4aa`                                 |
| `icon-tow-20`                                    | The tow hook on its line, a towed craft | The tow line's core `#b8bfc9` and edge `#4f5462`                                                       |
| `icon-cargo-20-disabled`, `icon-tow-20-disabled` | The same icons, unavailable             | The crate and the hook core in the disabled mark `#9a96ad`, the straps in `#2f2d3d`, the ink edge kept |

| Mark          | Colour    | Base, on the panel | Phantom, on the panel | Sunflower, on the panel | On its ink edge |
| ------------- | --------- | -----------------: | --------------------: | ----------------------: | --------------: |
| Stardust body | `#f4d98a` |            12.16:1 |               10.44:1 |                  5.43:1 |         12.99:1 |
| Ore rim shade | `#d481b9` |             6.15:1 |                5.27:1 |                  2.73:1 |          6.55:1 |
| Cargo orange  | `#feae34` |             9.09:1 |                7.80:1 |                  4.06:1 |          9.71:1 |
| Tow steel     | `#b8bfc9` |             9.10:1 |                7.81:1 |                  4.07:1 |          9.72:1 |

On the light fields the ore, cargo and tow icons read against their own ink edges,
as the shield icon does against its outline.

`public/art/ui/icons/shield.svg` is the HUD shield glyph: a 20x20 single-colour
heater shield with its left half filled, drawn as a smooth CSS mask like the
[weapon icons](weapon-icons.md). Shop uses its own smooth shield SVG pair,
`icon-shop-shield.svg` and `icon-shop-shield-disabled.svg`.

## Item notice

A small chip under the status pill that names a gain other than Stardust or
ore (Gameplay's item notices), then flies its icon to where the gain shows
and vanishes. Geometry, motion and timing are `ITEM_NOTICE` in
[Layout](layout.md#item-notice).

The chip is opaque ink with a 1 px rim in the gain's accent colour, its icon
and Gameplay's label: "+ {item}", "+ {weapon}", "+ {weapon} ammo",
"+ {weapon} level {n}", "+ Shield level {n}", "+ Engine level {n}",
"+ Tractor beam level {n}", "+ {paint} paint" or "+ Holodisk", with "×N"
after a merged label. The label is `TYPE.label`,
cream, with the "+" in the rim's accent colour.

| Gain                           | Icon                                      | Rim and "+"                                      | Lands on                      |
| ------------------------------ | ----------------------------------------- | ------------------------------------------------ | ----------------------------- |
| Job, story or lost item        | `icon-cargo-20`                           | `#feae34`                                        | The pill's cargo segment      |
| Towed craft                    | `icon-tow-20`                             | `#b8bfc9`                                        | The pill's cargo segment      |
| New weapon, or a weapon's ammo | `weapon-<id>.svg`, a cream `#ead4aa` mask | `#bfa06f`                                        | That weapon's disc            |
| Holodisk                       | `icon-holodisk-20`                        | `#e868c8`                                        | Nothing: it fades in place    |
| Weapon level                   | `weapon-<id>.svg`, a cream `#ead4aa` mask | The level's tier: `#ff8f1f` at 2, `#a66bff` at 3 | That weapon's disc            |
| Shield level                   | `icon-shop-shield.svg`                    | The level's tier                                 | The shield pill's shield icon |
| Engine level                   | `icon-shop-engine-tuning.svg`             | The level's tier                                 | Nothing: it fades in place    |
| Tractor beam level             | `icon-shop-tractor-beam.svg`              | The level's tier                                 | Nothing: it fades in place    |
| Paint scheme                   | The scheme's shop ship swatch at 20 by 20 | The scheme's `top` (`ship-paint.json`)           | Nothing: it fades in place    |

The accents are the job orange and tow steel of the cargo icons, the selected
weapon disc's gold and the holodisk's pink. A level reached by an upgrade drop
takes its upgrade tier's colour, the one the weapon disc's edge and Ada's jets
show at that level: orange `#ff8f1f` at level 2 and
purple `#a66bff` at level 3, for a weapon, the Shield, the Engine or the
Tractor beam alike, so a level always reads in one colour. A newly gained
weapon keeps the gold; its ammunition is unchanged. A paint scheme takes its
own top colour, and its icon is the ship in that scheme, the same heading-48
swatch the shop row shows, so the wing-tip accent appears on the ship itself. Equipment notices draw their normal 20 by 20 SVGs with
smooth sampling. A weapon level uses the plain 20 by 20 HUD mask, and the
rim shows the tier. Shop rows use the 24 by 24 badge composite.

| Part         | Colour    |    Base | Sunflower | Cartwheel | Whirlpool | Andromeda | Needle | Phantom | `#ffffff` |
| ------------ | --------- | ------: | --------: | --------: | --------: | --------: | -----: | ------: | --------: |
| Panel        | `#181425` |  1.23:1 |   10.90:1 |    7.18:1 |   10.86:1 |    6.33:1 | 9.49:1 |  2.09:1 |   18.02:1 |
| Cargo rim    | `#feae34` |  7.89:1 |    1.12:1 |    1.35:1 |    1.12:1 |    1.53:1 | 1.02:1 |  4.65:1 |    1.86:1 |
| Tow rim      | `#b8bfc9` |  7.90:1 |    1.12:1 |    1.36:1 |    1.12:1 |    1.54:1 | 1.02:1 |  4.66:1 |    1.85:1 |
| Weapon rim   | `#bfa06f` |  5.91:1 |    1.50:1 |    1.01:1 |    1.49:1 |    1.15:1 | 1.31:1 |  3.48:1 |    2.48:1 |
| Holodisk rim | `#e868c8` |  5.05:1 |    1.75:1 |    1.15:1 |    1.75:1 |    1.02:1 | 1.53:1 |  2.98:1 |    2.90:1 |
| Level 2 rim  | `#ff8f1f` |  6.42:1 |    1.38:1 |    1.10:1 |    1.38:1 |    1.25:1 | 1.20:1 |  3.78:1 |    2.28:1 |
| Level 3 rim  | `#a66bff` |  4.30:1 |    2.06:1 |    1.36:1 |    2.05:1 |    1.20:1 | 1.79:1 |  2.53:1 |    3.40:1 |
| Cobalt rim   | `#6f9ff0` |  5.50:1 |    1.61:1 |    1.06:1 |    1.60:1 |    1.07:1 | 1.40:1 |  3.24:1 |    2.66:1 |
| Seafoam rim  | `#d4f6ea` | 12.67:1 |    1.43:1 |    2.17:1 |    1.43:1 |    2.46:1 | 1.64:1 |  7.46:1 |    1.16:1 |
| Graphite rim | `#aab2c4` |  6.89:1 |    1.29:1 |    1.18:1 |    1.28:1 |    1.34:1 | 1.12:1 |  4.06:1 |    2.13:1 |
| Iris rim     | `#d9ccff` |  9.78:1 |    1.10:1 |    1.68:1 |    1.11:1 |    1.90:1 | 1.27:1 |  5.76:1 |    1.50:1 |
| Classic rim  | `#ffffff` | 14.64:1 |    1.65:1 |    2.51:1 |    1.66:1 |    2.85:1 | 1.90:1 |  8.63:1 |    1.00:1 |

Parts against the field under the chip.

| Mark on the panel | Colour    | Contrast |
| ----------------- | --------- | -------: |
| Label             | `#ead4aa` |  12.44:1 |
| Cargo "+"         | `#feae34` |   9.71:1 |
| Tow "+"           | `#b8bfc9` |   9.72:1 |
| Weapon "+"        | `#bfa06f` |   7.27:1 |
| Holodisk "+"      | `#e868c8` |   6.22:1 |
| Level 2 "+"       | `#ff8f1f` |   7.89:1 |
| Level 3 "+"       | `#a66bff` |   5.29:1 |
| Cobalt "+"        | `#6f9ff0` |   6.77:1 |
| Seafoam "+"       | `#d4f6ea` |  15.59:1 |
| Graphite "+"      | `#aab2c4` |   8.47:1 |
| Iris "+"          | `#d9ccff` |  12.04:1 |
| Classic "+"       | `#ffffff` |  18.02:1 |

- The panel is opaque, so the label reads the same on every field and over
  bright objects. On the base field the rim outlines the chip (4.30:1 or more,
  the level 3 purple, above the 3:1 a graphic needs; every "+" holds 4.5:1 on
  the ink). On Phantom the rim outlines it at 3.24:1 or more, except the
  holodisk rim (2.98:1) and the level 3 purple (2.53:1). On the light fields
  the ink panel outlines it (6.33:1 or more, Andromeda; 10.90:1 on Sunflower)
  and the rim is an accent only.
- The "+" colour repeats the rim's; the label and icon carry the meaning, so
  the accent never stands alone.
- The chip takes no input (`pointer-events: none`) and draws under the HUD
  controls, so it never covers or blocks the pause button, the pill or a
  weapon disc, even in flight. The label is announced through a polite live
  region (`aria-live="polite"`); the chip itself is `aria-hidden`.

## Top-right HUD icon buttons

The weapon selector buttons follow Chibi's skill buttons (`chibis-way-home`
`art/style-guide.md` "Skills and room rewards", `src/scenes/skillButton.ts`):
a smooth 33px disc centred in the 48 target, with the 20px `weapon-<id>.svg`
glyph centred on it. Sizes and placement are `HUD_BUTTON` and `HUD_ROW` in
[Layout](layout.md#hud-and-overlays): the rightmost disc's drawn edge and
every disc's drawn top sit `HUD_EDGE` (12) in from the game area, mirroring
the pause disc on the left. Settings opens from the Pause or Menu card.
The retained trophy and gear nav-disc art is documented in [Achievements](achievements-icon.md#states).

Every selected weapon has an opaque navy `#262b44` face on every field.
Inactive weapons use these distinct opaque dark faces. Selection changes
the glyph to cream and the face to navy (Laser already has a navy face).
Keep the common annulus and tier pips as ordinary disc art. The glyph
provides the selection cue on every weapon.

| Weapon        | Face                 |
| ------------- | -------------------- |
| Laser         | Navy `#262b44`       |
| Rapid Missile | Base field `#292734` |
| Multi-Laser   | Dark plum `#241827`  |
| Heavy Missile | Sunflower `#332712`  |
| Scattershot   | Dark teal `#132d33`  |
| Phaser        | Ink `#181425`        |

| Weapon state | Ring inside the 33 disc             | Glyph, all fields                  | Minimum glyph contrast on its face |
| ------------ | ----------------------------------- | ---------------------------------- | ---------------------------------- |
| Idle         | Muted lavender, or the level's tier | `#b8b3c9`, full opacity            | 6.83:1                             |
| Selected     | Cream `#ead4aa`                     | Cream `#ead4aa`, full opacity      | 9.59:1                             |
| Refused      | The current state's ring            | `#e4574e`, full opacity during cue | 3.82:1                             |
| Empty        | Muted lavender, or the level's tier | `#75748c`, full opacity            | 3.07:1                             |
| Disabled     | `#75748c`                           | `#75748c`, full opacity            | 3.07:1                             |

- Every state and level has the same visible outer diameter, 33 logical px
  including ink. The 4 px annulus contains an outer 1 px ink fringe, a 2 px
  coloured band and an inner 1 px ink fringe. Its centre has the weapon's
  solid face when inactive and navy `#262b44` when selected.
- The current selected band is cream. Idle and empty glyphs are muted by their
  palette colours, without extra opacity that would reduce contrast on the
  solid faces. The same colours apply on dark and light fields. Every glyph
  and ring band has at least 3:1 contrast against its face.
- Weapons switch at any time, with a 1 s wait between switches (Gameplay).
  During the wait a tap on another weapon disc plays the
  [refusal cue](#refusal-cue) with the glyph as its label (the Refused state);
  the selected weapon keeps its selected look throughout.
- Current focus-visible draws the shared round ring outside the disc, over
  any state. Apply the [button focus cue](#buttons) to the face or glyph in
  the migration. The weapon buttons also lack a separate press colour cue.
- Empty applies to a non-Laser weapon with no ammunition left. It is never
  selected: when the selected weapon fires its last shot, Laser is selected in
  the same frame, ignoring the switch wait, and the empty disc takes the Empty
  look. A tap on an empty weapon plays the refusal cue with the glyph as its
  label until ammunition is bought. The empty glyph stays more muted than
  an idle glyph.

### Weapon level

Each disc shows its weapon's level with the upgrade tier colours, orange at
level 2 and purple at level 3 as on the [speed jets](ship.md#speed-jets), and
no pip at level 1, two at level 2 and three at level 3.

| Level | Inactive ring band       | Pips                    |
| ----: | ------------------------ | ----------------------- |
|     1 | Muted lavender `#75748c` | None                    |
|     2 | Orange `#ff8f1f`         | Two, orange `#ff8f1f`   |
|     3 | Purple `#a66bff`         | Three, purple `#a66bff` |

- The coloured band stays inside the common 33 px outer diameter: radii
  13.5 to 15.5, with ink at 12.5 to 13.5 and 15.5 to 16.5. The current
  selected band takes cream at every level. Level dots retain their tier.
- There is no exterior level halo or light-field outline.
- Pips: discs of radius 2 in the level's pip colour, each inside a 1 px ink
  outline (6 across), centres 7 apart. At levels 2 and 3 their horizontal row
  is centred under the icon, with centres on the bottom ring stroke's centre
  line: `(HUD_BUTTON.disc - HUD_BUTTON.annulus) / 2`, 14.5 below the disc
  centre. Level 1 has no dot; its containing ring remains visible.
- The dots' ink bounds end 17.5 below the disc centre, leaving 0.5 logical px
  above the ammo pill at target y 42. Dot colours and dimensions do not vary
  by selected, idle or empty state.
- Reduced motion: nothing animates.

| Mark | Against                           | Orange | Purple | Lavender pip |
| ---- | --------------------------------- | -----: | -----: | -----------: |
| Edge | Phantom `#514955`, the dark field | 3.78:1 | 2.53:1 |            - |
| Pip  | Its ink outline                   | 7.89:1 | 5.29:1 |       8.86:1 |

The lavender pip uses the idle glyph colour at full opacity.

### Ammunition count

Each owned non-Laser weapon shows its ammunition count in an opaque navy pill
on the disc's lower edge; Laser shows none. Geometry is `HUD_AMMO_COUNT` in
[Layout](layout.md#weapon-count-pill).

| State       | Pill                          | Count text                       | Contrast        |
| ----------- | ----------------------------- | -------------------------------- | --------------- |
| Selected    | Navy `#262b44`, inset ink rim | Cream `#ead4aa`                  | 10.11:1         |
| Idle, empty | Navy `#262b44`, inset ink rim | Grey `#b8b8b8`, including "0"    | 7.00:1          |
| Refused     | Navy `#262b44`, inset ink rim | Unchanged from the current state | At least 7.00:1 |

- The count is Gameplay's count string in at most four characters: the exact
  number up to 9999 with no separator, then whole thousands "10k" to "999k",
  then whole millions "1m" to "999m".
- The pill is opaque navy with a 1 px inset ink rim, so its text reads against
  the same fill on dark and light fields. It keeps the existing 14 px height,
  4 px radius and 4 px side padding without changing the count's geometry.
- The pill geometry and fill are the same in every disc state. Only the number
  follows selection: cream when active, grey otherwise.
- The refusal cue tints only the glyph; the count never tints, and the pill
  shakes with the button.
- The count updates on every shot with no animation. The pill is decorative
  (`aria-hidden`); the weapon button's accessible label carries the count in
  Gameplay's strings.
- Out of ammunition: the emptied disc shows Empty and its grey "0", Laser is
  selected at once, and Gameplay's `outOfAmmo` notice ("Out of ammo.") shows
  in the conversation slot as a [notice](layout.md#hud-and-overlays): no
  portrait or tab, a tap dismisses it, and an interrupted conversation line
  resumes after it.

Draw the chrome in CSS at logical units so it stays sharp at any scale
(`u` is `var(--ada-unit)`):

| Part        | CSS                                                                                                                                                                                                                                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disc        | `width` and `height` `calc(u * 33)`, `border-radius: 50%`, the weapon's solid face; weapon-only normal disc shadow is none                                                                                                                                                                                                              |
| Weapon ring | A pseudo-element inset `calc(u * 1)`, a 2 px coloured border, a 1 px outer ink shadow and a 1 px inset ink shadow; selected border cream, inactive centres filled with their weapon face, selected centre navy                                                                                                                          |
| Level band  | Levels 2 and 3 set the contained border colour to the tier; no exterior halo or outline                                                                                                                                                                                                                                                 |
| Pips        | A child of the button: `position: absolute`, centred at `top: calc(u * 38.5)` (14.5 below the disc centre at 24), `left: 50%`; each pip `calc(u * 4)` round in the pip colour with `box-shadow: 0 0 0 calc(u * 1)` ink, `gap: calc(u * 3)`, `pointer-events: none`                                                                      |
| Glyph       | `calc(u * 20)` square, `background` the glyph colour, `mask: url(<glyph>.svg) center / 100% 100% no-repeat`                                                                                                                                                                                                                             |
| Count pill  | A child of the button: `position: absolute`, `top: calc(u * 42)`, `left: 50%`, `transform: translateX(-50%)`, `height` and `line-height` `calc(u * 14)`, `padding: 0 calc(u * 4)`, `border-radius: calc(u * 4)`, `background` navy `#262b44`, a 1 px inset ink shadow, `TYPE.count` text, `white-space: nowrap`, `pointer-events: none` |

Weapon glyphs and the Settings gear are single-colour SVGs
(`weapon-<id>.svg`, `settings.svg`), so the mask takes each state's colour and
the refusal cue's red, and stays sharp at fractional scales such as 1.78.

## Touch sticks

Placement is `TOUCH_STICK` in [Layout](layout.md#hud-and-overlays): each ring's
outer painted edge sits 80 logical px from its screen side and 50 above
the screen bottom. The resolver ignores safe insets and clamps each ring
at least `STICK_AREA_MARGIN` (8) inside the game area. The sticks and the
[Use disc](#use-disc) show only on a touch screen (a coarse primary pointer)
and outside modals, as in Chibi; desktop hides them.

Only the move stick draws a speed line, from the stick's origin toward the
thumb: 2px cream `#ead4aa` with a 1px ink `#181425` fringe on each side, at the
rings' 85% opacity, under the knob. It stops at the move input reach,
`TOUCH_STICK.moveReach` 40 logical, so a line that stops growing shows full
speed; the drawn knob stays inside the ring. The line is absent
at rest. The aim stick draws no line. See
[touch joystick sheets](touch-joystick.md).

At icon size and inline in text the sticks draw as `icon-move-controls` and
`icon-aim-controls`, whole-pixel 16x16 versions of the ring, knob and move
chevrons; see [inline controls](settings-icons.md#inline-controls). The live
sticks are unchanged.

## Use disc

The context action is Chibi's touch Use button (`chibis-way-home`
`src/ui/chrome/touchChrome.ts`, `art/style-guide.md` "Touch controls"): an
ring with an open centre at rest and one symbol per action, drawn at screen
resolution, at the sticks' 85% opacity in every state. Placement and press
shape are `USE_DISC` in [Layout](layout.md#hud-and-overlays). It shows only
while an interaction is available, on a touch screen, outside modals; desktop
hides it with no hint, and Space activates the action. Its accessible name is
the action's Gameplay string. A native button provides assistive activation
over the canvas art. Keyboard focus fills the centre navy on the canvas in
both normal and forced colors. The authored ring, action symbol and press
geometry stay in place.

Geometry is in the 75x75 frame's px, centre (37.5, 37.5), in Chibi's layer
model: each disc, ring or stroke draws over an ink layer 1 px wider each side
(a stroke's ink is 2 wider than its core), all ink before the cores where
shapes touch, and coverage changes only within a texel of each edge.

| Part        | Geometry                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| Ring        | Ink from radius 36.5 to 31.5, the band from 35.5 to 32.5                                                    |
| Symbol      | The action's layers below, cream `#ead4aa` cores at rest and on keyboard focus                              |
| Focus       | Navy `#262b44` centre fill to radius 32.5, with cream band and symbol                                       |
| Press frame | The band and symbol white `#ffffff` and the ring's radii 1 larger, for 60 ms                                |
| Held        | The band and symbol white at the rest radii until release, then return to the applicable rest or focus pose |

Every symbol's drawn bounds, ink included, are centred on the ring centre: each
is authored, measured, and moved by a whole-px shift, leaving at most 0.5 px.
The coordinates below already include the shift, which the ring's 1 px growth
on press never moves.

| Action  | Layers (cores; frame px)                                                                                                                                                                                                                                                        | Shift  | Bounds after the shift   | Offset       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------ | ------------ |
| Talk    | Chibi's three dots: discs of radius 4 at (28.5, 37.5), (37.5, 37.5) and (46.5, 37.5)                                                                                                                                                                                            | 0, 0   | 23.5, 32.5 to 51.5, 42.5 | 0, 0         |
| Deliver | Strokes 3: the parcel (22, 30), (39, 30), (39, 45), (22, 45), (22, 30); its strap (30.5, 30) to (30.5, 45); the arrow (43, 37.5) to (52, 37.5) and its head (48, 33), (52.5, 37.5), (48, 42)                                                                                    | -1, -1 | 19.5, 27.5 to 55, 47.5   | -0.25, 0     |
| Deposit | Strokes 3: the arrow (37.5, 23) to (37.5, 42) and its head (32.5, 37), (37.5, 42), (42.5, 37); the hopper (25, 41), (25, 53), (50, 53), (50, 41)                                                                                                                                | 0, +2  | 22.5, 20.5 to 52.5, 55.5 | 0, +0.5      |
| Tow     | The eye: a ring from radius 2.5 to 4 at (42.5, 24). Stroke 3: the shank (42.5, 28.5) to (42.5, 48), the hook's arc about (36.5, 48), radius 6, from 0 to 180 degrees through (36.5, 54), then up to (30.5, 43)                                                                  | +5, +7 | 28, 19 to 47.5, 56.5     | +0.25, +0.25 |
| Salvage | Stroke 4: the magnet (29, 27) to (29, 40), the arc about (37.5, 40), radius 8.5, from 180 to 0 degrees through (37.5, 48.5), then up to (46, 27); the pole gaps: ink rects 25 to 33 and 42 to 50 across, 31.5 to 33 down                                                        | 0, +4  | 25, 24 to 50, 51.5       | 0, +0.25     |
| Use     | A ring from radius 6 to 10 and a disc of radius 3, both at (37.5, 37.5)                                                                                                                                                                                                         | 0, 0   | 26.5, 26.5 to 48.5, 48.5 | 0, 0         |
| Dock    | Stroke 3: the hangar arch (24, 53) up to (24, 36), the arc about (37.5, 36), radius 13.5, from 180 to 360 degrees through (37.5, 22.5), then down to (51, 53). The ship: a filled polygon (37.5, 31), (45, 49), (37.5, 44.5), (30, 49), its ink the polygon's outline stroked 2 | 0, -2  | 21.5, 20 to 53.5, 55.5   | 0, +0.25     |

Arcs are 24 segments, angles clockwise from the +x axis with y down. Every
symbol fits inside the ring's 31.5 inner edge with room to spare (the farthest
bounds corner, at Dock's, is 24.08 from the centre). Dock, the station's
action, reads as flying into a hangar: a filled ship under a round arch, apart
from Deposit's line arrow into a square hopper. The ink edges carry each mark on any
field, Sunflower's light one included, as Chibi's do: no light-field outline is
added.

Inline in text, Use draws as `icon-use-control`: the ring and the generic Use
symbol on whole pixels at 16x16; see
[inline controls](settings-icons.md#inline-controls).

## Landing page

`pages/index.html` and `public/site.css` apply these rules to HTML, with the
[Layout](layout.md) token numbers in CSS px: Install (secondary) on the left,
Play (primary) on the right, as one action row. The install steps dialog's
Close is secondary. These site controls use the site's visible focus ring.
