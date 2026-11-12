import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SUPPLY_ITEMS } from "./activities.ts";
import { CARRIED_ITEM_NAMES, carriedItemName, STORY_ITEM_NAMES } from "./item-names.ts";
import { JOB_POOL } from "./jobs.ts";

// The display names Gameplay lists in player-copy.md "Carried item names".
const COPY = readFileSync(new URL("../../gameplay/player-copy.md", import.meta.url), "utf8");
const section = COPY.slice(COPY.indexOf("### Carried item names"));
const LISTED = new Set(
  section
    .slice(0, section.indexOf("\n#", 1) > 0 ? section.indexOf("\n#", 1) : undefined)
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| Source"))
    .flatMap((line) => line.split("|")[2]!.split(","))
    .map((name) => name.replace(/\(.*\)/u, "").trim())
    .filter(Boolean),
);

describe("carried item names", () => {
  it("name every job item, hunt item, towed craft, supply item and story item from the table", () => {
    const kinds = [
      ...Object.values(JOB_POOL).flatMap((pool) => [...pool.craft, ...pool.delivery, ...pool.lost]),
      ...Object.values(SUPPLY_ITEMS),
    ];
    for (const item of kinds) {
      expect(CARRIED_ITEM_NAMES[item], item).toBeDefined();
      expect(LISTED.has(carriedItemName(item)), item).toBe(true);
    }
    for (const id of ["food", "toolkit", "parts"]) {
      expect(LISTED.has(STORY_ITEM_NAMES[id]!), id).toBe(true);
    }
    expect(STORY_ITEM_NAMES).toEqual({ food: "Food", parts: "Spare parts", toolkit: "Tool kit" });
  });

  it("drop the article and start with a capital", () => {
    expect(carriedItemName("a message")).toBe("Message");
    expect(carriedItemName("an ore pod")).toBe("Ore pod");
    expect(carriedItemName("spare parts")).toBe("Spare parts");
    for (const name of [...Object.values(CARRIED_ITEM_NAMES), ...Object.values(STORY_ITEM_NAMES)]) {
      expect(name).toMatch(/^[A-Z]/u);
      expect(name).not.toMatch(/^(?:A|An|The) /u);
      expect(LISTED.has(name), name).toBe(true);
    }
  });
});
