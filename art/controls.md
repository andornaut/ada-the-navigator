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
  desktop (Escape pauses) and while a modal card or storybook page is open. It
  stays visible and live while the conversation box shows.
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
- Pause card: Resume (primary), Map, Settings, Back to title, stacked full
  width; its groups are in [Layout screens](layout.md#cards). Every action stays
  available in danger. Map always opens the [map](map.md), which holds Return
  to Earth; in danger Travel here and Return to Earth are unavailable there.
  Settings opens over the same dim; one card or the map shows at a time.
- Ada's room page has the same pause button at the top left, also touch only
  (on desktop Escape opens the room's Paused card); its Paused card holds
  Settings and Back to title.
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

| Token          | Colour    | Use                                                                      |
| -------------- | --------- | ------------------------------------------------------------------------ |
| Card face      | `#3b3850` | Settings card and modal ground                                           |
| Card shade     | `#2f2d3d` | Card lower-right edge                                                    |
| Card rim       | `#6b6685` | Card upper-left edge                                                     |
| Ink            | `#181425` | Outlines, fringes and button labels                                      |
| Primary face   | `#bfa06f` | Muted gold main action                                                   |
| Primary lip    | `#8a7148` | Primary lower lip                                                        |
| Primary rim    | `#d2b886` | Primary top highlight                                                    |
| Secondary face | `#9690b4` | Other actions                                                            |
| Secondary lip  | `#5f5980` | Secondary lower lip                                                      |
| Secondary rim  | `#aaa4c6` | Secondary top highlight                                                  |
| Disabled face  | `#2f2d3d` | Flat unavailable control                                                 |
| Focus ring     | `#ead4aa` | Cream band with ink fringes                                              |
| Close X        | `#ead4aa` | Normal close mark; white on `#403d55` pressed                            |
| Switch on      | `#2f7d76` | Track, with `#1f5a55` edge                                               |
| Switch off     | `#57536e` | Track, with `#403d55` edge                                               |
| Switch knob    | `#ffffff` | Knob, shaded `#c9c4d8`                                                   |
| Card icons     | `#ead4aa` | Settings row and install step icons                                      |
| Modal dim      | `#101926` | At alpha 0.70 over the whole view, under every modal card (`.ada-modal`) |

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
text is 5:1 or more. Glyphs keep their `disabled` frames (`#9a96ad`, marks at
3:1 or more).

Labels meet 4.5:1 and essential marks 3:1. Card icons, the close X and the focus
ring are 7.76:1 on the card; the focus ring is 10.11:1 on the page background
`#292734`. The pressed close X is 10.41:1 on `#403d55`. The switch tick is
4.87:1 on the on track. Primary and secondary faces are 4.54:1 and 3.72:1
against the card, and 5.91:1 and 4.84:1 against the page background.

## Conversation box

The in-flight conversation box is not modal: it draws no dim and leaves the
HUD visible and live. Geometry is `CONVERSATION_BOX` in
[Layout](layout.md#conversation-box).

| Token              | Colour    | Use                                          |
| ------------------ | --------- | -------------------------------------------- |
| Conversation panel | `#181425` | Ink panel at alpha 0.65 in every galaxy      |
| Portrait edge      | `#181425` | 2 px frame edge, opaque                      |
| Portrait face      | `#262b44` | Slot face behind the portrait's clear pixels |
| Tab edge           | `#181425` | 1 px name tab edge, opaque                   |
| Ada tab            | `#70ace8` | Her ship's blue accent                       |
| Astra tab          | `#8fe0f2` | Her teal light                               |
| Penny tab          | `#feae34` | Her golden coat                              |
| Unknown voice tab  | `#b8b3c9` | General Gadget before he is named            |
| General Gadget tab | `#d68b72` | The drones' coral hull                       |
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

Tabs, labels, lines and portraits are fully opaque; only the panel is
translucent. Tab labels are `TYPE.label` in ink; lines are `TYPE.body` in
cream. The name tab overhangs the panel's top edge by 10, so its upper half
sits on open space.

| Text           | Colour    | Ground                                     | Contrast |
| -------------- | --------- | ------------------------------------------ | -------- |
| Line           | `#ead4aa` | Panel over the base field `#292734`        | 11.64:1  |
| Line           | `#ead4aa` | Panel over Sunflower `#D8C994`             | 5.20:1   |
| Line           | `#ead4aa` | Panel over Cartwheel `#39221E`             | 11.71:1  |
| Line           | `#ead4aa` | Panel over Whirlpool `#132D33`             | 11.66:1  |
| Line           | `#ead4aa` | Panel over Black Eye `#271423`             | 12.31:1  |
| Line           | `#ead4aa` | Panel over `#ffffff`, the brightest object | 3.88:1   |
| Ada label      | `#181425` | `#70ace8`                                  | 7.51:1   |
| Astra label    | `#181425` | `#8fe0f2`                                  | 12.11:1  |
| Penny label    | `#181425` | `#feae34`                                  | 9.71:1   |
| Unknown voice  | `#181425` | `#b8b3c9`                                  | 8.86:1   |
| General Gadget | `#181425` | `#d68b72`                                  | 6.69:1   |
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

The panel composites to `#1e1b2a` over the base field, `#5b534c` over
Sunflower, `#241923` over Cartwheel, `#161d2a` over Whirlpool, `#1d1424` over
Black Eye and `#696671` over pure white. Notices use the same panel and line.
The line meets 4.5:1 over every galaxy field, lowest on Sunflower (5.20:1).
Over a white object passing under the box it is 3.88:1, accepted: white
objects pass under the box rarely and briefly, and Ada's ship stays 39.2 below
it.

| Tab            | Fill      | On the field `#292734` | On Sunflower `#332712` | On the panel over `#332712` |
| -------------- | --------- | ---------------------- | ---------------------- | --------------------------- |
| Ada            | `#70ace8` | 6.11:1                 | 6.08:1                 | 7.12:1                      |
| Astra          | `#8fe0f2` | 9.84:1                 | 9.80:1                 | 11.48:1                     |
| Penny          | `#feae34` | 7.89:1                 | 7.86:1                 | 9.21:1                      |
| Unknown voice  | `#b8b3c9` | 7.20:1                 | 7.17:1                 | 8.41:1                      |
| General Gadget | `#d68b72` | 5.44:1                 | 5.41:1                 | 6.34:1                      |

Over white the fills alone fall to 1.49:1 (Astra) to 2.69:1 (General Gadget);
the 1 ink edge holds 18.02:1 there, so the tab's outline reads over every
backdrop.

## Status pill

The in-flight status pill holds the shield bar, the Stardust count and, while
Ada carries them, her ore and her job or story item or towed craft, beside the pause
button. Geometry, states and timing are `STATUS_PILL` in
[Layout](layout.md#status-pill). The panel and the bar's track are
translucent ink; every mark and the count draw fully opaque over them.

| Token           | Colour    | Use                                                     |
| --------------- | --------- | ------------------------------------------------------- |
| Status panel    | `#181425` | Ink panel at alpha 0.65, as the conversation panel      |
| Shield          | `#70ace8` | Fill and icon: Ada's ship blue, as her tab              |
| Shield delay    | `#4f7aa6` | Delay part, from a hit until regeneration starts        |
| Shield low      | `#e4574e` | Low and empty fill, icon and rim: the refusal red       |
| Shield low peak | `#ff8a80` | Low pulse peak, icon and rim                            |
| Shield flash    | `#ffffff` | Hit flash and the regeneration leading edge             |
| Shield rim      | `#9a96ad` | 1 px bar rim in the normal states                       |
| Shield track    | `#181425` | Ink at alpha 0.65 inside the rim, over the panel        |
| Divider         | `#57536e` | 1x16 rule between segments                              |
| Count           | `#ead4aa` | Cream `TYPE.label`, the Stardust and ore counts         |
| Stardust tick   | `#f4d98a` | `+N` label, Stardust body gold, with a 1 px ink outline |
| Ore tick        | `#eaa676` | `+N` label, ore's light rust, with a 1 px ink outline   |

The panel is ink at 0.65 over the field. The track is its own ink layer at
0.65 drawn over the pill panel, not a hole in it: 0.8775 combined over the
field, so it composites to `#1a1627` over the base field and
`#2f2a33` over Sunflower.

| Mark or text     | Colour    |    Base | Sunflower | Cartwheel | Whirlpool | Black Eye | `#ffffff` |
| ---------------- | --------- | ------: | --------: | --------: | --------: | --------: | --------: |
| Count            | `#ead4aa` | 11.64:1 |    5.20:1 |   11.71:1 |   11.66:1 |   12.31:1 |    3.88:1 |
| Shield icon      | `#70ace8` |  7.03:1 |    3.14:1 |    7.07:1 |    7.04:1 |    7.43:1 |    2.34:1 |
| Low icon and rim | `#e4574e` |  4.63:1 |    2.07:1 |    4.66:1 |    4.64:1 |    4.90:1 |    1.54:1 |
| Low pulse peak   | `#ff8a80` |  7.39:1 |    3.30:1 |    7.43:1 |    7.40:1 |    7.81:1 |    2.46:1 |
| Rim              | `#9a96ad` |  5.89:1 |    2.63:1 |    5.93:1 |    5.90:1 |    6.23:1 |    1.96:1 |
| Divider          | `#57536e` |  2.30:1 |    1.03:1 |    2.32:1 |    2.31:1 |    2.43:1 |    1.30:1 |
| Panel itself     | `#181425` |  1.15:1 |    4.56:1 |    1.15:1 |    1.17:1 |    1.03:1 |    5.62:1 |

Marks on the panel, against the field under it.

| Bar part        | Colour    |    Base | Sunflower | Cartwheel | Whirlpool | Black Eye | `#ffffff` |
| --------------- | --------- | ------: | --------: | --------: | --------: | --------: | --------: |
| Fill            | `#70ace8` |  7.37:1 |    5.84:1 |    7.36:1 |    7.37:1 |    7.48:1 |    5.28:1 |
| Delay part      | `#4f7aa6` |  3.93:1 |    3.11:1 |    3.92:1 |    3.93:1 |    3.99:1 |    2.81:1 |
| Low fill        | `#e4574e` |  4.86:1 |    3.85:1 |    4.85:1 |    4.86:1 |    4.93:1 |    3.48:1 |
| Flash, edge     | `#ffffff` | 17.68:1 |   14.00:1 |   17.65:1 |   17.67:1 |   17.94:1 |   12.66:1 |
| Rim, inner edge | `#9a96ad` |  6.18:1 |    4.89:1 |    6.17:1 |    6.18:1 |    6.27:1 |    4.42:1 |
| Low rim, inner  | `#e4574e` |  4.86:1 |    3.85:1 |    4.85:1 |    4.86:1 |    4.93:1 |    3.48:1 |

Bar parts on the track, against the field under the pill. The fill is 1.88:1
against the delay part and the low fill 1.24:1; the flash is 2.40:1 against
the fill.

- The count meets 4.5:1 over every galaxy field; over a white object under the
  pill it is 3.88:1, accepted as for the conversation line.
- On the dark fields every mark meets 3:1 against the panel. The divider is
  decorative.
- On a light field (Sunflower) the shield icon and the shield bar each draw
  inside a 1 px ink outline (`lightField.hudOutline`), as on the `+N` tick: the
  icon's mask grown by 1 px in ink behind it, and a 1 px ink line outside the
  bar's rim. Against that ink the low icon and rim are 4.95:1, the normal rim
  6.30:1, the shield icon 7.51:1 and the low pulse peak 7.89:1, where the
  panel alone gives 2.07:1, 2.63:1, 3.14:1 and 3.30:1. The rim's inner edge
  holds 3:1 against the track (4.89:1).
- Over a white object under the pill the delay part is 2.81:1 against the
  track; it stays told from the fill by lightness.
- The delay part is told from the fill by lightness (1.88:1) and from the low
  fill by hue; it holds 3:1 against the track over every galaxy field.
- The `+N` labels sit on the field, not the panel: Stardust gold is 10.56:1
  on `#292734` and 1.19:1 on Sunflower's `#D8C994`, ore rust 7.12:1 and
  1.24:1, where the ink outline (10.90:1 on the field) carries them; the
  outline (12.99:1 against gold, 8.76:1 against rust) keeps them legible over
  bright objects. The rust tick is 7.04:1 or more on every dark field.
- The low pulse changes colour, not brightness alone, at 1 Hz; the hit flash
  is one 100 ms flash per hit, at most three per second. Nothing flickers.

### Cargo icons

The pill's segment icons and the [Ship card](layout.md#ship-card)'s cargo rows:
20 by 20 pixel art in the UI subset, single `rest` frame, nearest-neighbour.
`icon-stardust-20` is in [Stardust](stardust.md#hud-icon); the other three
rebuild with `node art/tools/cargo-icons.ts`, each inside its own 1 px ink
edge `#181425`, so on a light field it needs no added outline.

| Key             | Shows                                   | Colours                                                                                         |
| --------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `icon-ore-20`   | A nugget and a pebble                   | Ore's palette ([ore nugget](cartwheel-props.md#ore-nugget)), rim lit `#eaa070`, shade `#d68a54` |
| `icon-cargo-20` | A strapped crate, any carried item      | The Map's job orange `#feae34`, shade `#c9781c`, strap cream `#ead4aa`                          |
| `icon-tow-20`   | The tow hook on its line, a towed craft | The tow line's core `#b8bfc9` and edge `#4f5462`                                                |

| Mark          | Colour    | Base, on the panel | Dark fields, on the panel | Sunflower, on the panel | On its ink edge |
| ------------- | --------- | -----------------: | ------------------------: | ----------------------: | --------------: |
| Stardust body | `#f4d98a` |            12.16:1 |           12.18:1 or more |                  5.43:1 |         12.99:1 |
| Ore rim shade | `#d68a54` |             6.12:1 |            6.13:1 or more |                  2.74:1 |          6.54:1 |
| Cargo orange  | `#feae34` |             9.09:1 |            9.10:1 or more |                  4.06:1 |          9.71:1 |
| Tow steel     | `#b8bfc9` |             9.10:1 |            9.12:1 or more |                  4.07:1 |          9.72:1 |

On Sunflower the ore, cargo and tow icons read against their own ink edges,
as the shield icon does against its outline.

`public/art/ui/icons/shield.svg` is the HUD shield glyph: a 20x20 single-colour
vector of the `icon-shop-shield` silhouette (a heater shield with its left
half filled), cream `#ead4aa` like the [weapon icons](weapon-icons.md), drawn
as a CSS mask with smooth sampling. `icon-shop-shield` stays the shop's pixel
glyph; at 20 px the two differ only in edge pixels.

## Item notice

A small chip under the status pill that names a gain other than Stardust or
ore (Gameplay's item notices), then flies its icon to where the gain shows
and vanishes. Geometry, motion and timing are `ITEM_NOTICE` in
[Layout](layout.md#item-notice).

The chip is opaque ink with a 1 px rim in the gain's accent colour, its icon
and Gameplay's label: "+ {item}", "+ {weapon}", "+ {weapon} ammo" or
"+ Holodisk", with "×N" after a merged label. The label is `TYPE.label`,
cream, with the "+" in the rim's accent colour.

| Gain                           | Icon                                      | Rim and "+" | Lands on                   |
| ------------------------------ | ----------------------------------------- | ----------- | -------------------------- |
| Job, story or lost item        | `icon-cargo-20`                           | `#feae34`   | The pill's cargo segment   |
| Towed craft                    | `icon-tow-20`                             | `#b8bfc9`   | The pill's cargo segment   |
| New weapon, or a weapon's ammo | `weapon-<id>.svg`, a cream `#ead4aa` mask | `#bfa06f`   | That weapon's disc         |
| Holodisk                       | `icon-holodisk-20`                        | `#e868c8`   | Nothing: it fades in place |

The accents are the job orange and tow steel of the cargo icons, the selected
weapon disc's gold and the holodisk's pink. Pixel icons draw nearest
neighbour; the weapon glyph is the HUD disc's mask with smooth sampling.

| Part         | Colour    |   Base | Sunflower | Cartwheel | Whirlpool | Black Eye | `#ffffff` |
| ------------ | --------- | -----: | --------: | --------: | --------: | --------: | --------: |
| Panel        | `#181425` | 1.23:1 |   10.90:1 |    1.22:1 |    1.24:1 |    1.04:1 |   18.02:1 |
| Cargo rim    | `#feae34` | 7.89:1 |    1.12:1 |    7.96:1 |    7.80:1 |    9.35:1 |    1.86:1 |
| Tow rim      | `#b8bfc9` | 7.90:1 |    1.12:1 |    7.97:1 |    7.81:1 |    9.36:1 |    1.85:1 |
| Weapon rim   | `#bfa06f` | 5.91:1 |    1.50:1 |    5.96:1 |    5.84:1 |    7.00:1 |    2.48:1 |
| Holodisk rim | `#e868c8` | 5.05:1 |    1.75:1 |    5.10:1 |    4.99:1 |    5.98:1 |    2.90:1 |

Parts against the field under the chip.

| Mark on the panel | Colour    | Contrast |
| ----------------- | --------- | -------: |
| Label             | `#ead4aa` |  12.44:1 |
| Cargo "+"         | `#feae34` |   9.71:1 |
| Tow "+"           | `#b8bfc9` |   9.72:1 |
| Weapon "+"        | `#bfa06f` |   7.27:1 |
| Holodisk "+"      | `#e868c8` |   6.22:1 |

- The panel is opaque, so the label reads the same on every field and over
  bright objects. On the dark fields the rim outlines the chip (4.99:1 or
  more); on Sunflower the ink panel outlines it (10.90:1) and the rim is an
  accent only.
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
the pause disc on the left. The space screen has no settings button;
Settings opens from the pause card. The start screen's Achievements and
Settings buttons draw the vector trophy `achievements.svg` and gear
`settings.svg` in the [nav disc states](achievements-icon.md#states): idle,
and white on `#3a4466` while pressed.

| Weapon state | Face                 | Edge                          | Glyph                    | Glyph contrast |
| ------------ | -------------------- | ----------------------------- | ------------------------ | -------------- |
| Idle         | Navy `#262b44`       | 1 ink `#181425`               | `#b8b3c9`                | 6.83:1         |
| Selected     | `#bfa06f`, 25 across | 4 ink annulus inside the disc | Ink `#181425`            | 7.27:1         |
| Refused      | Navy `#262b44`       | 1 ink `#181425`               | `#e4574e` during the cue | 3.82:1         |
| Empty        | Navy `#262b44`       | 1 ink `#181425`               | `#75748c`                | 3.07:1         |

- Selection is Chibi's dark annulus inside the fixed disc, with no light outer
  ring. Selection, refusal and the empty state never resize the disc or glyph.
- Brightness: the selected face is the primary button's muted gold, 5.91:1
  against the space background `#292734` (the amber face was 8.50:1, its cream
  ring 10.11:1). The idle glyph is the supporting-text lavender, softer than
  cream (9.59:1) and above 4.5:1.
- The ink edge on idle, refused and empty discs is the pause disc's edge: navy
  is 1.05:1 on the space background and ink 1.23:1, so the edge outlines the
  disc; the glyph carries the essential contrast.
- Weapons switch at any time, with a 1 s wait between switches (Gameplay).
  During the wait a tap on another weapon disc plays the
  [refusal cue](#refusal-cue) with the glyph as its label (the Refused state);
  the selected weapon keeps its selected look throughout.
- Focus-visible is the shared focus ring, `FOCUS_RING.outset` outside the disc
  and round with it, over any state.
- Empty applies to a non-Basic weapon with no ammunition left. It is never
  selected: when the selected weapon fires its last shot, Basic is selected in
  the same frame, ignoring the switch wait, and the empty disc takes the Empty
  look. A tap on an empty weapon plays the refusal cue with the glyph as its
  label until ammunition is bought. The empty glyph is the idle lavender mixed
  toward the navy face, so it reads as spent beside idle discs and holds 3:1.

### Ammunition count

Each owned non-Basic weapon shows its ammunition count in an opaque ink pill
on the disc's lower edge; Basic shows none. Geometry is `HUD_AMMO_COUNT` in
[Layout](layout.md#weapon-count-pill).

| State          | Pill          | Count text                  | Contrast |
| -------------- | ------------- | --------------------------- | -------- |
| Idle, selected | Ink `#181425` | Cream `#ead4aa`             | 12.44:1  |
| Refused        | Ink `#181425` | Cream `#ead4aa`, not tinted | 12.44:1  |
| Empty          | Ink `#181425` | "0" in red `#e4574e`        | 4.95:1   |

- The count is Gameplay's count string in at most four characters: the exact
  number up to 9999 with no separator, then whole thousands "10k" to "999k",
  then whole millions "1m" to "999m".
- The pill is opaque, so the count reads the same on every field: ink is
  1.23:1 on the dark field `#292734` and 10.90:1 on a light field such as
  Sunflower's `#D8C994`, where the pill's edge alone outlines it; the text
  carries the contrast on the pill.
- The pill is the same in every disc state. On the selected disc it overlaps
  the ink annulus, so pill and annulus join into one ink shape.
- The refusal cue tints only the glyph; the count never tints, and the pill
  shakes with the button.
- The count updates on every shot with no animation. The pill is decorative
  (`aria-hidden`); the weapon button's accessible label carries the count in
  Gameplay's strings.
- Out of ammunition: the emptied disc shows Empty and its red "0", Basic is
  selected at once, and Gameplay's `outOfAmmo` notice ("Out of ammo.") shows
  in the conversation slot as a [notice](layout.md#hud-and-overlays): no
  portrait or tab, a tap dismisses it, and an interrupted conversation line
  resumes after it.

Draw the chrome in CSS at logical units so it stays sharp at any scale
(`u` is `var(--ada-unit)`):

| Part          | CSS                                                                                                                                                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disc          | `width` and `height` `calc(u * 33)`, `border-radius: 50%`, `background` the face, `box-shadow: inset 0 0 0 calc(u * 1)` ink                                                                                                                                                                         |
| Selected disc | `box-shadow: inset 0 0 0 calc(u * 4)` ink                                                                                                                                                                                                                                                           |
| Glyph         | `calc(u * 20)` square, `background` the glyph colour, `mask: url(<glyph>.svg) center / 100% 100% no-repeat`                                                                                                                                                                                         |
| Count pill    | A child of the button: `position: absolute`, `top: calc(u * 40)`, `left: 50%`, `transform: translateX(-50%)`, `height` and `line-height` `calc(u * 14)`, `padding: 0 calc(u * 4)`, `border-radius: calc(u * 4)`, `background` ink, `TYPE.count` text, `white-space: nowrap`, `pointer-events: none` |

Weapon glyphs and the Settings gear are single-colour SVGs
(`weapon-<id>.svg`, `settings.svg`), so the mask takes each state's colour and
the refusal cue's red, and stays sharp at fractional scales such as 1.78.

## Touch sticks

Placement is `TOUCH_STICK` in [Layout](layout.md#hud-and-overlays): each ring's
drawn edge sits 40 in from the game area's side and 30 above its bottom,
clamped by the safe insets and mirrored; the Use button's bottom follows the
sticks' bottom.

Only the move stick draws a speed line, from the stick's origin to the thumb's
actual position: 2px cream `#ead4aa` with a 1px ink `#181425` fringe on each
side, at the rings' 85% opacity, under the knob. It is not clamped to the ring
and may run past it; the drawn knob stays inside the ring. The line is absent
at rest. The aim stick draws no line. See
[touch joystick sheets](touch-joystick.md).

## Landing page

`pages/index.html` and `public/site.css` apply these rules to HTML, with the
[Layout](layout.md) token numbers in CSS px: Install (secondary) on the left,
Play (primary) on the right, as one action row. The install steps dialog's
Close is secondary. Each uses the focus ring above.
