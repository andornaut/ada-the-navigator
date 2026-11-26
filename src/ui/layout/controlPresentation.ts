import controlPresentationCss from "@andornaut/game-kit/runtime/web/ui/dom/controlPresentation.css?raw";
import controlsCss from "@andornaut/game-kit/runtime/web/ui/dom/controls.css?raw";

import { STORY_PANEL } from "../../data/layout.ts";
import { font, kitUnits, units } from "./css.ts";
import { SPACING, TEXT_TOKENS, TYPE } from "./tokens.ts";

export const PAGE_DIVIDER_STYLE = {
  colour: Number.parseInt(STORY_PANEL.rule.colour.slice(1), 16),
  thickness: STORY_PANEL.rule.width,
};

export const ADA_CONTROL_PRESENTATION_STYLE = `${controlsCss}\n${controlPresentationCss}
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
  width:${kitUnits("--ui-page-divider-thickness")};
  height:auto;
  align-self:stretch
}

/* Grid footer faces share one row; requirements occupy a separate row without changing face height. */
.ada-actions[data-footer-action]:not(.ada-stack):not(.ada-wrap):has(> .ada-button-presentation){
  grid-template-rows:auto auto;
  row-gap:0
}
.ada-actions[data-footer-action]:not(.ada-stack):not(.ada-wrap) > .ada-button{
  grid-row:1
}
.ada-actions[data-footer-action]:not(.ada-stack):not(.ada-wrap) > .ada-button-presentation{
  display:grid;
  grid-template-rows:subgrid;
  grid-row:span 2;
  align-self:stretch;
  gap:inherit
}
.ada-actions[data-footer-action]:not(.ada-stack):not(.ada-wrap):has(
  > .ada-button-presentation > .ada-button-reason:not([hidden])
){
  row-gap:${units(SPACING.markGap)}
}
`;
