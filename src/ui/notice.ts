import { CONVERSATION_BOX } from "./layout/conversationBox.ts";
import { font, fromHudEdge, units, VIEW_PROPERTIES } from "./layout/css.ts";
import { SAFE_MARGIN } from "./layout/playView.ts";

// Notices: the game's status line (#game-status) and the save status (#save-status). Each shows in
// the conversation box's slot and style (layout/conversationBox.ts) without a portrait or tab, up
// to two lines centred a gap inside each side. One box shows at a time: a conversation line (a
// warning's even over a notice, which waits under it), else the game notice, else the save status.
// The game notice's box is its press area: a tap dismisses it. The save status persists, takes no
// input and is lowest: it yields the slot to any line or notice and returns when they clear.

/** The play area attribute naming what the box slot shows. */
export const BOX_OCCUPANT = "data-box";

export type BoxOccupant = "line" | "notice" | "save";

/** What the slot shows: a line, else a game notice, else the save status, else nothing. */
export function boxOccupant(showing: {
  readonly line: boolean;
  readonly notice: boolean;
  readonly saveStatus: boolean;
}): BoxOccupant | null {
  return showing.line ? "line" : showing.notice ? "notice" : showing.saveStatus ? "save" : null;
}

const { noticeInset, panel } = CONVERSATION_BOX;
const TOP = fromHudEdge("top", CONVERSATION_BOX.top);

// The page rect's width, which a notice keeps within, as the box does.
const PAGE_WIDTH = `calc(100% - 2 * max(var(${VIEW_PROPERTIES.safe("left")}),var(${VIEW_PROPERTIES.safe(
  "right",
)}),${units(SAFE_MARGIN.page)}))`;

// The translucent ink panel, as #rrggbbaa.
export const PANEL_BACKGROUND = `${panel.ink}${Math.round(panel.alpha * 255)
  .toString(16)
  .padStart(2, "0")}`;

// The conversation box's slot and panel, shared by the box and notices.
export const CONVERSATION_SLOT = `
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  top:${TOP};
  box-sizing:border-box;
  width:min(${units(CONVERSATION_BOX.maxWidth)},${PAGE_WIDTH});
  height:${units(CONVERSATION_BOX.height)};
  display:flex;
  align-items:center;
  font:${font(CONVERSATION_BOX.text)};
  color:#ead4aa;
  background:${PANEL_BACKGROUND}`;

export const NOTICE_STYLE = `
#game-status,
#save-status{${CONVERSATION_SLOT};
  padding:0 ${units(noticeInset)};
  justify-content:center;
  text-align:center;
  overflow:hidden;
  pointer-events:none
}

#game-status{
  z-index:6;
  cursor:pointer;
  pointer-events:auto;
  touch-action:manipulation
}

#save-status{
  z-index:21
}

/* A warning line shows in the slot while the game notice waits under it. */
[${BOX_OCCUPANT}="line"] #game-status{
  visibility:hidden
}

/* The save status shows only while the slot is free of lines and notices. */
[${BOX_OCCUPANT}]:not([${BOX_OCCUPANT}="save"]) #save-status{
  display:none
}

#game-status:empty,
#save-status:empty{
  display:none
}
`;
