import { describe, expect, it } from "vitest";

import type { MapPlace } from "../model/map.ts";
import type { QuestEntry } from "../model/questDetails.ts";
import { questRoute } from "./questsScreen.ts";

const entry: QuestEntry = {
  galaxy: 1,
  id: "story:1:1",
  line: {
    destination: "workshop",
    kind: "story",
    source: "growers",
    target: "growers",
    text: "Food",
  },
  locations: [
    { id: "growers", label: "Growers", symbol: "growers" },
    { id: "workshop", label: "Workshop", symbol: "workshop" },
  ],
};
const place = (id: string) => ({ id }) as MapPlace;
describe("quest detail routes", () => {
  it("keeps the final destination distinct from the pickup target before collection", () => {
    expect(
      questRoute(entry, [place("growers"), place("workshop")]).map(({ kind, location, place }) => [
        kind,
        location?.id,
        place?.id,
      ]),
    ).toEqual([
      ["source", "growers", "growers"],
      ["target", "workshop", "workshop"],
    ]);
  });
  it("does not reveal an explicit unknown destination or fall back to its pickup target", () => {
    const route = questRoute({ ...entry, line: { ...entry.line, destination: null } }, [
      place("growers"),
    ]);
    expect(route[1]).toEqual({ kind: "target", location: null, place: null });
  });
  it("shows known location labels from another galaxy without enabling current-map locating", () => {
    const route = questRoute(entry, []);
    expect(route.map(({ location }) => location?.label)).toEqual(["Growers", "Workshop"]);
    expect(route.every(({ place }) => place === null)).toBe(true);
  });
  it("uses the legacy target only when the destination is omitted and never guesses hidden labels", () => {
    const line = { kind: "job" as const, target: "unknown", text: "Survey" };
    expect(questRoute({ ...entry, line }, [])).toEqual([
      { kind: "target", location: null, place: null },
    ]);
    expect(
      questRoute({ ...entry, line: { ...line, target: "workshop" } }, [place("workshop")])[0]
        ?.location?.label,
    ).toBe("Workshop");
  });
});

describe("quest objective presentation", () => {
  it("keeps the current revealed action for every legacy quest without generating future steps", async () => {
    const { questChecklist } = await import("./questsScreen.ts");
    for (const kind of ["story", "job"] as const) {
      const current = { ...entry, line: { kind, target: null, text: "Find the known signal" } };
      expect(questChecklist(current)).toEqual([{ checked: false, label: "Find the known signal" }]);
    }
  });

  it("retains supplied completion and quantities and uses the same canonical identity icons", async () => {
    const { questChecklist, questObjectiveIcon } = await import("./questsScreen.ts");
    const { CARGO_ICONS } = await import("./statusPill.ts");
    const objectives = [
      { checked: true, itemKind: "ore" as const, label: "Collect Ore" },
      { checked: false, count: "35 / 100", itemKind: "ore" as const, label: "Deliver Ore" },
    ];
    const current = { ...entry, line: { ...entry.line, objectives } };
    expect(questChecklist(current)).toBe(objectives);
    expect(questObjectiveIcon(current, objectives[0]!)).toBe(CARGO_ICONS.ore);
    expect(
      questObjectiveIcon(current, { checked: false, label: "Visit", location: "growers" }),
    ).toBe("/art/ui/icons/map-growers.svg");
    expect(
      questObjectiveIcon(current, { checked: false, label: "Visit", location: "unrevealed" }),
    ).toBeNull();
  });
});

it("uses the canonical holodisk notice icon only for the revealed current item", async () => {
  const { questChecklist, questObjectiveIcon } = await import("./questsScreen.ts");
  const { gainNotice } = await import("./itemNotice.ts");
  const current = {
    ...entry,
    line: {
      currentItemKind: "holodisk" as const,
      kind: "story" as const,
      target: null,
      text: "Find the holodisk",
    },
  };
  const row = questChecklist(current)[0]!;
  const { icon } = gainNotice({}, { kind: "holodisk" });
  expect(questObjectiveIcon(current, row)).toBe(
    "sprite" in icon ? `/art/ui/sprites/${icon.sprite}.png` : icon.mask,
  );
  expect(
    questObjectiveIcon(
      { ...current, line: { kind: "story", target: null, text: "Explore" } },
      { checked: false, label: "Explore" },
    ),
  ).toBeNull();
});

it("presents only canonical supplied quest identities and never uses a label dictionary as links", async () => {
  const { questContextIcon } = await import("./questsScreen.ts");
  expect(questContextIcon(null)).toBeNull();
  expect(questContextIcon({ quests: [] })).toBeNull();
  expect(questContextIcon({ quests: [{ ...entry, jobType: "survey" }] })).toBe(
    "/art/ui/icons/map-job-survey.svg",
  );
  expect(questContextIcon({ quests: [entry, { ...entry, id: "other" }] })).toBe(
    "/art/ui/icons/map-destination.svg",
  );
  const unknown = { ...entry, line: { kind: "story" as const, target: null, text: "Explore" } };
  expect(questContextIcon({ quests: [unknown] })).toBe("/art/ui/icons/map-destination.svg");
});
