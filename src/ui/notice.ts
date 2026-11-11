import { CONVERSATION_BOX } from "./layout/conversationBox.ts";
import { font, fromHudEdge, units, VIEW_PROPERTIES } from "./layout/css.ts";
import { SAFE_MARGIN } from "./layout/playView.ts";
import { SPACING } from "./layout/tokens.ts";

// Notices: the game's status line (#game-status) and the save status (#save-status). Each shows in
// the conversation box's slot and style (layout/conversationBox.ts) without a portrait or tab, up
// to two lines centred a gap inside each side, while it has text; lower lines wait under a notice.
// The game notice's box is its press area: a tap dismisses it. The save status persists and takes
// no input. With both shown, the save status sits a gap below the game notice.

/** The play area attribute set while a warning line shows over the notices. */
export const NOTICE_UNDER_WARNING = "data-warning-showing";

const { noticeInset, panel } = CONVERSATION_BOX;
const TOP = fromHudEdge("top", CONVERSATION_BOX.top);
const SECOND = CONVERSATION_BOX.height + SPACING.gap;

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

#game-status:not(:empty) ~ #save-status,
[${NOTICE_UNDER_WARNING}] #save-status{
  top:calc(${TOP} + ${units(SECOND)})
}

/* A warning line shows in the slot; the game notice waits under it, and the save status, which
   stays readable, moves to the second slot. */
[${NOTICE_UNDER_WARNING}] #game-status{
  visibility:hidden
}

#game-status:empty,
#save-status:empty{
  display:none
}
`;
