import { SCREEN } from "../../data/screen.ts";
import { UI_SCOPE } from "../modal.ts";
import { CARD_CONTENT, SCROLL } from "./contentCard.ts";
import { slice, units } from "./css.ts";
import { BUTTON_GAP, SPACING, STACK_BUTTON_GAP } from "./tokens.ts";

/**
 * The Paused card's grid: Map, Quests, Settings and Ship in two equal columns, then Back to title
 * and the primary Resume, each across both columns, Resume at the bottom.
 */
export const PAUSE_GRID_STYLE = `
${UI_SCOPE} .ada-actions.ada-pause-grid{
  grid-auto-flow:row;
  grid-template-columns:1fr 1fr;
  column-gap:${units(BUTTON_GAP)};
  row-gap:${units(STACK_BUTTON_GAP)};
  width:auto
}
${UI_SCOPE} .ada-actions.ada-pause-grid > .ada-pause-full{grid-column:1 / -1}
@media (max-width: ${SCREEN.width}px), (max-height: ${SCREEN.height}px){
  ${UI_SCOPE} .ada-pause-grid .ada-pause-cap-label{transform:translateY(${units(1)})}
}
${UI_SCOPE} .ada-ship-back{
  display:flex;
  justify-content:flex-end;
  flex:none;
  margin:${units(SPACING.gap)} 0 calc(${units(SCROLL.endPad)} - ${slice(CARD_CONTENT.frameBorder)})
}
`;
