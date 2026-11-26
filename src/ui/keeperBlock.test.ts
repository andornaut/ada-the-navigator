import { expect, it } from "vitest";

import { ARCHIE_NAMED } from "../data/conversations.ts";
import { KEEPERS } from "../data/keepers.ts";
import { COMPACT_PORTRAITS, portraitFrame, TAB_COLOURS } from "./dialoguePortraits.ts";
import { KEEPER_STYLE, keeperName } from "./keeperBlock.ts";
import { CONVERSATION_BOX } from "./layout/conversationBox.ts";
import { units } from "./layout/css.ts";

it("uses the existing display names for keepers and named Archie", () => {
  expect(keeperName("saffron")).toBe("Saffron");
  expect(keeperName("bramble")).toBe("Bramble");
  expect(keeperName("archie")).toBe(ARCHIE_NAMED.name);
});

it("hides the portrait and name tab in the generic keeper style", () => {
  expect(KEEPER_STYLE).toContain("[data-generic] .ada-keeper-frame,");
  expect(KEEPER_STYLE).toContain("[data-generic] .ada-keeper-name{\n  display:none");
});

it("uses the existing named Archie sheet frame and tab without a cast alias", () => {
  const frame = portraitFrame(true, {
    elapsed: 0,
    mood: "neutral",
    named: true,
    speaker: "archie",
  });
  const art = CONVERSATION_BOX.portrait.art;
  expect(KEEPER_STYLE).toContain(`[data-keeper="archie"] .ada-keeper-portrait`);
  expect(KEEPER_STYLE).toContain(
    `url('${COMPACT_PORTRAITS.archie.url}') ${units(-frame * art)} 0 / ${units(
      COMPACT_PORTRAITS.archie.frames * art,
    )}`,
  );
  expect(KEEPER_STYLE).toContain(`background:${TAB_COLOURS.archieNamed}`);
});

it("styles every keeper's portrait and tab", () => {
  for (const key of Object.values(KEEPERS).flatMap(({ keepers }) => keepers)) {
    expect(KEEPER_STYLE).toContain(`[data-keeper="${key}"] .ada-keeper-portrait`);
    expect(KEEPER_STYLE).toContain(`[data-keeper="${key}"] .ada-keeper-name`);
  }
});
