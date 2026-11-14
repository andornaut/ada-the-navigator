import { STORY_PANEL } from "../../data/layout.ts";
import { TEXT_TOKENS } from "../modal.ts";
import { CONTROL_ROW, FRAME_LINE } from "./controls.ts";
import { font, units } from "./css.ts";
import { SPACING, TYPE } from "./tokens.ts";

export const PAGE_DIVIDER_STYLE = {
  colour: Number.parseInt(STORY_PANEL.rule.colour.slice(1), 16),
  thickness: STORY_PANEL.rule.width,
};

export const DETAILS_DISCLOSURE_STYLE = {
  colour: Number.parseInt(TEXT_TOKENS.supporting.slice(1), 16),
  height: CONTROL_ROW.icon,
  strokeWidth: FRAME_LINE,
  width: CONTROL_ROW.icon,
};

export const ADA_CONTROL_PRESENTATION_STYLE = `
.ada-button-presentation{
  flex-direction:column;
  align-items:stretch;
  align-self:start;
  min-width:0;
  max-width:100%;
  gap:${units(SPACING.markGap)}
}
.ada-button-presentation[data-ui-placement="center"]{
  align-self:center;
  align-items:stretch
}
.ada-button-presentation > .ada-button-reason{
  margin:0;
  font:${font(TYPE.body)};
  color:${TEXT_TOKENS.supporting};
  overflow-wrap:anywhere
}
.ada-page-divider[data-axis="vertical"]{
  width:calc(var(--ui-page-divider-thickness) * var(--ui-unit,1) * 1px);
  height:auto;
  align-self:stretch
}
`;
