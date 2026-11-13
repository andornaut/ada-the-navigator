import { CARD_CONTENT } from "./cardFrame.ts";
import { SPACING, TYPE } from "./tokens.ts";

/** Ship geometry uses the shared card and text roles, in logical px. */
export const SHIP_CARD = {
  divider: CARD_CONTENT.frameBorder,
  icon: TYPE.body.lineHeight,
  row: TYPE.body.lineHeight,
  sectionPadding: SPACING.panelPadding,
  subgroupGap: SPACING.panelPadding,
  valueGap: SPACING.gap,
} as const;
