# Controls

Ada's buttons and selection controls use Chibi's control states, recoloured to
the dark lavender palette below. Every distance and size comes from
[Layout](layout.md); this page owns states, colours and the refusal cue. The
sprites and their provenance are in [UI assets](ui.md).

## Buttons

| Rule           | Value                                                                        |
| -------------- | ---------------------------------------------------------------------------- |
| Geometry       | `TEXT_BUTTON` and `FOCUS_RING` in [Layout](layout.md#controls-and-targets)   |
| Pressed        | Face, label and icon sink by `TEXT_BUTTON.pressedSink`; the lip disappears   |
| Disabled       | Flat face over the full height, no lip, no press displacement                |
| Unavailable    | The disabled face, but focusable; activation plays the refusal cue           |
| Width          | Shared within an action group; grows to fit the widest label                 |
| Label          | `TYPE.label`, centred by visible ink in each state's face                    |
| Leading icon   | Centred with the label as one group, `SPACING.markGap` apart                 |
| Focus          | `ui-focus` outside the face, independent of pressed, selected or checked     |
| Paired actions | Secondary on the left, primary on the right                                  |
| Hover          | No hover-only styling; hover never changes size or role colour               |
| Sheets         | `ui-button` (secondary), `ui-button-primary`; tags normal, pressed, disabled |
| Nine-slice     | 16x28 frames, margins left/top/right/bottom 2/4/2/6                          |

The normal face is the drawn rectangle minus the lip, the pressed face has the
same height moved down by the sink, and the disabled face is the whole
rectangle. Measure label centring against these faces, not the nine-slice
margins or press target. Never shrink a label to fit; grow the button or reword
the label. Primary and secondary share one silhouette; role sets colour and
state sets geometry. A disabled control keeps its label and layout, cannot
activate and is skipped by keyboard navigation.

The focus sheet `ui-focus` is a 16x16 nine-slice with 4px margins: a 1px ink
fringe, a 2px cream band and a 1px ink fringe. HTML pages draw the same ring with
a 2px cream outline at 1px offset over 1px and 4px ink shadows.

## Cards and modals

Every modal uses the content-fitted card in
[Layout](layout.md#modals); each screen's groups are listed in
[Layout screens](layout.md#cards). Every modal dims the background behind it
and receives input exclusively. Outside taps never activate controls
underneath.

## Pause

- Pause button: vector art, 35x35 logical, drawn with smooth sampling (never
  `image-rendering: pixelated`), so it stays sharp at every view scale. Its
  placement and press area are `PAUSE_BUTTON` in
  [Layout](layout.md#hud-and-overlays). It is a touch control, hidden on
  desktop (Escape pauses) and while dialogue is open.
- Geometry is Chibi's `pauseChromeLayers` (`chibis-way-home`
  `src/ui/chrome/pauseChrome.ts`): circles centred at 17.5,17.5 and two 4x13
  bars at 12,11 and 19,11 (3 apart), in the ring colour.

| File                                  | Pose                   | Ink edge | Ring                | Face                 |
| ------------------------------------- | ---------------------- | -------- | ------------------- | -------------------- |
| `public/art/ui/icons/pause.svg`       | Rest                   | r 16.5   | Cream, r 15.5, 2 px | Navy `#262b44`, 13.5 |
| `public/art/ui/icons/pause-press.svg` | Press frame 0 (swell)  | r 17.5   | White, r 16.5, 3 px | `#3a4466`, 13.5      |
| `public/art/ui/icons/pause-held.svg`  | Press frame 1 and held | r 16.5   | White, r 15.5, 3 px | `#3a4466`, 12.5      |

- Timing stays in the `ui-pause` sheet's JSON, as in Chibi: tags `rest`
  (frame 0, 100ms), `press` (frames 1 and 2, 60ms each, once) and `held`
  (frame 3, 100ms). Frame 0 shows `pause.svg`, frame 1 `pause-press.svg`,
  frames 2 and 3 `pause-held.svg`. The sheet's PNG is no longer drawn.
- Contrast: cream bars and ring 9.59:1 on the navy face and 10.11:1 on the
  space background `#292734`; pressed white bars 9.55:1 on `#3a4466`.
- Pause card: its groups are in [Layout screens](layout.md#cards). While Ada
  is in danger, Travel and Return home are unavailable and the note
  "Unavailable while you are in danger." shows below the stack in supporting
  text. Travel opens the "Discovered destinations" card and Settings opens over
  the same dim; one card shows at a time.
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

| Text            | Colour    | Role           | Ground    | Contrast |
| --------------- | --------- | -------------- | --------- | -------- |
| Title           | `#ffffff` | `TYPE.heading` | `#3b3850` | 11.25:1  |
| Body, row label | `#ead4aa` | `TYPE.body`    | `#3b3850` | 7.76:1   |
| Supporting text | `#b8b3c9` | `TYPE.body`    | `#3b3850` | 5.53:1   |
| Primary label   | `#181425` | `TYPE.label`   | `#bfa06f` | 7.27:1   |
| Secondary label | `#181425` | `TYPE.label`   | `#9690b4` | 5.96:1   |
| Disabled label  | `#9a96ad` | `TYPE.label`   | `#2f2d3d` | 4.69:1   |

Labels meet 4.5:1 and essential marks 3:1. Card icons, the close X and the focus
ring are 7.76:1 on the card; the focus ring is 10.11:1 on the page background
`#292734`. The pressed close X is 10.41:1 on `#403d55`. The switch tick is
4.87:1 on the on track. Primary and secondary faces are 4.54:1 and 3.72:1
against the card, and 5.91:1 and 4.84:1 against the page background.

## Top-right HUD icon buttons

The weapon selector buttons follow Chibi's skill buttons (`chibis-way-home`
`art/style-guide.md` "Skills and room rewards", `src/scenes/skillButton.ts`):
a smooth 33px disc centred in the 48 target, with the 20px `weapon-<id>.svg`
glyph centred on it. Sizes and placement are `HUD_BUTTON` in
[Layout](layout.md#hud-and-overlays). The space screen has no settings button;
Settings opens from the pause card. The start screen's Settings button uses
the idle state with `icon-settings-nav`.

| Weapon state | Face                 | Edge                          | Glyph                    | Glyph contrast |
| ------------ | -------------------- | ----------------------------- | ------------------------ | -------------- |
| Idle         | Navy `#262b44`       | 1 ink `#181425`               | `#b8b3c9`                | 6.83:1         |
| Selected     | `#bfa06f`, 25 across | 4 ink annulus inside the disc | Ink `#181425`            | 7.27:1         |
| Locked       | Navy `#262b44`       | 1 ink `#181425`               | `#6f7891`                | 3.16:1         |
| Refused      | Navy `#262b44`       | 1 ink `#181425`               | `#e4574e` during the cue | 3.82:1         |

- Selection is Chibi's dark annulus inside the fixed disc, with no light outer
  ring. Selection, lock and refusal never resize the disc or glyph.
- Brightness: the selected face is the primary button's muted gold, 5.91:1
  against the space background `#292734` (the amber face was 8.50:1, its cream
  ring 10.11:1). The idle glyph is the supporting-text lavender, softer than
  cream (9.59:1) and above 4.5:1. The locked glyph is dimmer still and holds
  3:1.
- The ink edge on idle and locked discs is the pause disc's edge: navy is
  1.05:1 on the space background and ink 1.23:1, so the edge outlines the
  disc; the glyph carries the essential contrast.
- Locked applies to every unselected weapon in combat and through the 5 seconds
  after it ends, until weapon changes unlock; the selected weapon keeps its
  selected look. The locked look is fully opaque, with no ring.
- A tap on a locked weapon plays the [refusal cue](#refusal-cue) with the
  glyph as its label.
- Focus-visible is the shared focus ring, `FOCUS_RING.outset` outside the disc
  and round with it, over any state.

Draw the chrome in CSS at logical units so it stays sharp at any scale
(`u` is `var(--ada-unit)`):

| Part          | CSS                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Disc          | `width` and `height` `calc(u * 33)`, `border-radius: 50%`, `background` the face, `box-shadow: inset 0 0 0 calc(u * 1)` ink |
| Selected disc | `box-shadow: inset 0 0 0 calc(u * 4)` ink                                                                                   |
| Glyph         | `calc(u * 20)` square, `background` the glyph colour, `mask: url(weapon-<id>.svg) center / 100% 100% no-repeat`             |

Weapon glyphs are single-colour SVGs, so the mask takes each state's colour and
the refusal cue's red. The 24px weapon SVGs stay published for existing
references.

## Touch sticks

Both sticks draw a speed line from the ring centre to the knob centre: 2px cream
`#ead4aa` with a 1px ink `#181425` fringe on each side, at the rings' 85%
opacity, under the knob. Its length is proportional to stick deflection and it
is absent at rest. See [touch joystick sheets](touch-joystick.md).

## Landing page

`pages/index.html` and `public/site.css` apply these rules to HTML, with the
[Layout](layout.md) token numbers in CSS px: Install (secondary) on the left,
Play (primary) on the right, as one action row. The install steps dialog's
Close is secondary. Each uses the focus ring above.
