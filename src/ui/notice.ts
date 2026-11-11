import { font, safeEdge, units, VIEW_PROPERTIES } from "./layout/css.ts";
import { NOTICE, SAFE_MARGIN } from "./layout/playView.ts";

// Notices (art/layout.md "HUD and overlays", Notice): the game's status line (#game-status) and
// the save status (#save-status), each a compact strip of body text on an ink panel, centred at
// the top of the HUD safe rect and clear of the pause and weapon press areas, stacked a gap apart.
// Shown while they have text.

// The second strip's top: one strip and a gap below the first.
const SECOND = NOTICE.height + NOTICE.gap;

// The widest a strip may be: the story panel's measure, or the HUD safe rect less the notice
// reserve on each side.
const MAX_WIDTH = `min(${units(NOTICE.maxWidth)},calc(100% - 2 * (max(var(${VIEW_PROPERTIES.safe(
  "left",
)}),var(${VIEW_PROPERTIES.safe("right")}),${units(SAFE_MARGIN.hud)}) + var(${
  VIEW_PROPERTIES.noticeReserve
}))))`;

export const NOTICE_STYLE = `
#game-status,
#save-status{
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  box-sizing:border-box;
  min-height:${units(NOTICE.height)};
  max-width:${MAX_WIDTH};
  padding:${units((NOTICE.height - NOTICE.text.lineHeight) / 2)} ${units(NOTICE.inset)};
  display:flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  font:${font(NOTICE.text)};
  color:#ead4aa;
  background:#181425;
  pointer-events:none
}

#game-status{
  z-index:3;
  top:${safeEdge("top", SAFE_MARGIN.hud)}
}

#save-status{
  z-index:21;
  top:calc(${safeEdge("top", SAFE_MARGIN.hud)} + ${units(SECOND)})
}

#game-status:empty,
#save-status:empty{
  display:none
}
`;
