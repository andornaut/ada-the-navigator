import { SPACING } from "./tokens.ts";

// The galaxy selector card (art/layout.md "Galaxy selector"), in logical px: a content-fitted
// modal card, one galaxy per page. Groups: the header, the galaxy group (the screenshot, the name,
// the flavour line, rows a row gap apart), then one action row of Previous, Jump and Next sharing
// one width. The card keeps the largest size of all pages.
export const GALAXY_CARD = {
  actions: ["previous", "jump", "next"],
  rowGap: SPACING.rowGap,
  screenshot: { height: 90, width: 180 },
} as const;
