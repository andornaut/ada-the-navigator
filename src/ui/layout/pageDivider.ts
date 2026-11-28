import { STORY_PANEL } from "../../data/layout.ts";

export const PAGE_DIVIDER_STYLE = {
  colour: Number.parseInt(STORY_PANEL.rule.colour.slice(1), 16),
  thickness: STORY_PANEL.rule.width,
};
