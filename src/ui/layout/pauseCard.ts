import { CARD_CONTENT, SCROLL } from "./contentCard.ts";
import { COMPACT_VIEWPORT, slice, units } from "./css.ts";
import { BUTTON_GAP, SPACING, UI_SCOPE } from "./tokens.ts";

// On a compact viewport the Pause grid's capped labels sit this far lower.
const CAP_LABEL_DROP = 1;
const PAUSE_COLUMNS = `${UI_SCOPE} [data-dialog="pause"] > .ada-card-body > .ada-stack > .ui-layout-columns`;

/** Two stable, equal-width action columns, with native reading order down each column. */
export const PAUSE_GRID_STYLE = `
${PAUSE_COLUMNS} > .ui-layout-stack{
  grid-template-columns:minmax(0,1fr)
}
${PAUSE_COLUMNS}:has([data-action="pause-map"][hidden]) [data-action="pause-resume"]{
  translate:calc(-50% - ${units(BUTTON_GAP / 2)})
}
@media ${COMPACT_VIEWPORT}{
  ${PAUSE_COLUMNS} .ada-pause-cap-label{transform:translateY(${units(CAP_LABEL_DROP)})}
}
${UI_SCOPE} .ada-ship-back{
  display:flex;
  justify-content:flex-end;
  flex:none;
  margin:${units(SPACING.gap)} 0 calc(${units(SCROLL.endPad)} - ${slice(CARD_CONTENT.frameBorder)})
}
`;
