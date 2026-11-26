import { CAST, castPortrait } from "../data/cast.ts";
import { ARCHIE_NAMED } from "../data/conversations.ts";
import { KEEPERS } from "../data/keepers.ts";
import type { KeeperKey } from "../model/keepers.ts";
import {
  COMPACT_PORTRAITS,
  portraitBackground,
  portraitFrame,
  TAB_COLOURS,
} from "./dialoguePortraits.ts";
import { CONVERSATION_BOX } from "./layout/conversationBox.ts";
import { font, units } from "./layout/css.ts";
import { KEEPER_BLOCK } from "./layout/stationCard.ts";
import { FOCUS_STYLE, TEXT_TOKENS } from "./modal.ts";
import { PANEL_BACKGROUND } from "./notice.ts";

// The station card's keeper block (art/layout.md "Station card"): the conversation box's panel in
// the card, with the keeper's compact portrait on the right, the name tab over its top-left and
// the docking's line. While a first docking has lines to come, the panel and its tab are one
// button that shows the next line and three static pips mark the lines; on the last line, and on
// a later docking, the block is a status. A station without an attributed greeting shows the
// generic welcome centred, with no portrait or tab.

const { name: label, padding, panel, portrait, tab, text } = CONVERSATION_BOX;
const { pips } = KEEPER_BLOCK;

/** A keeper's existing display name, including the named Archie. */
export function keeperName(key: KeeperKey): string {
  return key === "archie" ? ARCHIE_NAMED.name : CAST[key].name;
}

// Each keeper's portrait sheet and tab fill; data-keeper names the keeper on the block.
const KEEPER_PORTRAITS = new Map(
  Object.values(KEEPERS)
    .flatMap(({ keepers }) => keepers)
    .map((key) => [key, castPortrait(key, true)] as const),
);
const KEEPER_RULES = [...KEEPER_PORTRAITS]
  .map(
    ([key, sheet]) => `
.ada-controls .ada-keeper[data-keeper="${key}"] .ada-keeper-portrait{
  background:${portraitBackground(sheet, portrait.art)}
}
.ada-controls .ada-keeper[data-keeper="${key}"] .ada-keeper-name{
  background:${CAST[key].tab}
}`,
  )
  .join("");

const ARCHIE_FRAME = portraitFrame(true, {
  elapsed: 0,
  mood: "neutral",
  named: true,
  speaker: "archie",
});
const ARCHIE_RULES = `
.ada-controls .ada-keeper[data-keeper="archie"] .ada-keeper-portrait{
  background:url('${COMPACT_PORTRAITS.archie.url}') ${units(-ARCHIE_FRAME * portrait.art)} 0 / ${units(
    COMPACT_PORTRAITS.archie.frames * portrait.art,
  )} ${units(portrait.art)} no-repeat
}
.ada-controls .ada-keeper[data-keeper="archie"] .ada-keeper-name{
  background:${TAB_COLOURS.archieNamed}
}`;

export const KEEPER_STYLE = `
/* The panel: the conversation box's, in the card's flow below the name tab's overhang. The card
   never scrolls, so its body lets the focus ring show past the block's sides. */
.ada-controls [data-dialog="station"] .ada-card-body{
  overflow:visible
}
.ada-controls .ada-keeper{
  position:relative;
  flex:none;
  box-sizing:border-box;
  width:${units(KEEPER_BLOCK.width)};
  height:${units(KEEPER_BLOCK.height)};
  min-height:0;
  min-width:0;
  margin:${units(tab.overhang)} 0 0;
  padding:0;
  border:0;
  border-radius:0;
  background:${PANEL_BACKGROUND};
  font:${font(text)};
  color:${TEXT_TOKENS.label};
  text-align:left
}
.ada-controls button.ada-keeper{
  cursor:pointer;
  pointer-events:auto;
  touch-action:manipulation
}
.ada-controls .ada-keeper:focus-visible{${FOCUS_STYLE}
}

.ada-controls .ada-keeper-frame{
  position:absolute;
  top:${units(padding)};
  right:${units(padding)};
  box-sizing:border-box;
  width:${units(portrait.frame)};
  height:${units(portrait.frame)};
  display:flex;
  align-items:center;
  justify-content:center;
  border:${units(portrait.edge)} solid ${panel.ink};
  background:${portrait.face}
}
.ada-controls .ada-keeper-portrait{
  width:${units(portrait.art)};
  height:${units(portrait.art)};
  image-rendering:pixelated
}

/* The text column beside the frame: its lines centred on the panel, the pips after the last. */
.ada-controls .ada-keeper-body{
  position:absolute;
  top:${units(KEEPER_BLOCK.text.y)};
  left:${units(KEEPER_BLOCK.text.x)};
  width:${units(KEEPER_BLOCK.text.width)};
  height:${units(KEEPER_BLOCK.text.height)};
  display:flex;
  align-items:center
}
.ada-controls .ada-keeper-lines{
  display:flex;
  align-items:flex-end;
  gap:${units(pips.offset)}
}
.ada-controls .ada-keeper-line{
  width:${units(KEEPER_BLOCK.text.width)};
  overflow-wrap:break-word;
  overflow:hidden;
  max-height:${units(CONVERSATION_BOX.lines * text.lineHeight)}
}
.ada-controls .ada-keeper[data-pips] .ada-keeper-line{
  width:${units(KEEPER_BLOCK.textWithPips)}
}
.ada-controls .ada-keeper-pips{
  flex:none;
  height:${units(text.lineHeight)};
  display:flex;
  align-items:center;
  gap:${units(pips.gap)}
}
.ada-controls .ada-keeper:not([data-pips]) .ada-keeper-pips{
  display:none
}
.ada-controls .ada-keeper-pip{
  box-sizing:border-box;
  width:${units(pips.disc)};
  height:${units(pips.disc)};
  border:${units(pips.ring)} solid ${TEXT_TOKENS.supporting};
  border-radius:50%
}
.ada-controls .ada-keeper-pip[data-shown]{
  border-color:${TEXT_TOKENS.label};
  background:${TEXT_TOKENS.label}
}

.ada-controls .ada-keeper-name{
  position:absolute;
  top:${units(-tab.overhang)};
  left:${units(tab.inset)};
  box-sizing:border-box;
  height:${units(tab.height)};
  padding:0 ${units(tab.labelInset - tab.edge)};
  border:${units(tab.edge)} solid ${panel.ink};
  border-radius:${units(tab.radius)};
  font:${font(label)};
  line-height:${units(tab.height - 2 * tab.edge)};
  white-space:nowrap;
  color:${panel.ink}
}

/* Phantom: the generic welcome alone, centred a gap inside each side. */
.ada-controls .ada-keeper[data-generic] .ada-keeper-frame,
.ada-controls .ada-keeper[data-generic] .ada-keeper-name{
  display:none
}
.ada-controls .ada-keeper[data-generic] .ada-keeper-body{
  left:${units(KEEPER_BLOCK.genericInset)};
  width:${units(KEEPER_BLOCK.width - 2 * KEEPER_BLOCK.genericInset)};
  justify-content:center;
  text-align:center
}
.ada-controls .ada-keeper[data-generic] .ada-keeper-line{
  width:auto
}
${KEEPER_RULES}
${ARCHIE_RULES}
`;
