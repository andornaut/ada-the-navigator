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
