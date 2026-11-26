import { CARD_CONTENT, SCROLL } from "./contentCard.ts";
import { COMPACT_VIEWPORT, slice, units } from "./css.ts";
import { BUTTON_GAP, SPACING, STACK_BUTTON_GAP, UI_SCOPE } from "./tokens.ts";

// On a compact viewport the Pause grid's capped labels sit this far lower.
const CAP_LABEL_DROP = 1;

/** Two stable, equal-width action columns, with native reading order down each column. */
export const PAUSE_GRID_STYLE = `
${UI_SCOPE} .ada-actions.ada-pause-grid{
  align-items:start;
  grid-auto-flow:row;
  grid-template-columns:repeat(2,minmax(0,1fr));
  column-gap:${units(BUTTON_GAP)};
  width:auto
}
${UI_SCOPE} .ada-pause-column{
  min-width:0;
  display:grid;
  gap:${units(STACK_BUTTON_GAP)}
}
${UI_SCOPE} .ada-pause-column > .ada-button{width:100%}
${UI_SCOPE} .ada-pause-grid:has([data-action="pause-map"][hidden]) [data-action="pause-resume"]{
  translate:calc(-50% - ${units(BUTTON_GAP / 2)})
}
@media ${COMPACT_VIEWPORT}{
  ${UI_SCOPE} .ada-pause-grid .ada-pause-cap-label{transform:translateY(${units(CAP_LABEL_DROP)})}
}
${UI_SCOPE} .ada-ship-back{
  display:flex;
  justify-content:flex-end;
  flex:none;
  margin:${units(SPACING.gap)} 0 calc(${units(SCROLL.endPad)} - ${slice(CARD_CONTENT.frameBorder)})
}
`;
