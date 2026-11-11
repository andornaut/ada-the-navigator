import { SPACING } from "./tokens.ts";

// The galaxy selector card (art/layout.md "Galaxy selector"), in logical px: a content-fitted
// modal card, one galaxy per page. Groups: the header, the galaxy group (the screenshot, the name,
// the flavour line, rows a row gap apart), then one action row, left to right, sharing one width:
// Previous, Home (back to Ada's room without a jump), Jump (the primary) and Next. The card keeps
// the largest size of all pages.
export const GALAXY_CARD = {
  actions: [
    { id: "previous", role: "secondary" },
    { id: "home", role: "secondary" },
    { id: "jump", role: "primary" },
    { id: "next", role: "secondary" },
  ],
  rowGap: SPACING.rowGap,
  screenshot: { height: 90, width: 180 },
} as const;

export type GalaxyAction = (typeof GALAXY_CARD.actions)[number]["id"];
