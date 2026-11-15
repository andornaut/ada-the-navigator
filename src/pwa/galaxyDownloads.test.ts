import { describe, expect, it } from "vitest";

import { galaxyDownloadGroups } from "./galaxyDownloads.ts";

describe("progressive galaxy download policy", () => {
  it("starts with Sunflower and Whirlpool before any progression", () => {
    expect(galaxyDownloadGroups([])).toEqual(["sunflower", "whirlpool"]);
    expect(galaxyDownloadGroups([1])).toEqual(["sunflower", "whirlpool"]);
  });

  it("stages one route position ahead of actual unlocks, using route order rather than ids", () => {
    expect(galaxyDownloadGroups([1, 3])).toEqual(["sunflower", "whirlpool", "needle"]);
    expect(galaxyDownloadGroups([1, 3, 4])).toEqual([
      "sunflower",
      "whirlpool",
      "needle",
      "andromeda",
    ]);
    expect(galaxyDownloadGroups([1, 3, 4, 5])).toEqual([
      "sunflower",
      "whirlpool",
      "needle",
      "andromeda",
      "cartwheel",
    ]);
  });

  it("restores the download backlog from durable progress without changing unlocks", () => {
    const unlocked = [5, 1, 3, 4] as const;
    expect(galaxyDownloadGroups(unlocked)).toEqual([
      "sunflower",
      "whirlpool",
      "needle",
      "andromeda",
      "cartwheel",
    ]);
    expect(unlocked).toEqual([5, 1, 3, 4]);
  });

  it("clamps the final position and fills a sparse restored or cheat-granted route", () => {
    const all = ["sunflower", "whirlpool", "needle", "andromeda", "cartwheel", "phantom"];
    expect(galaxyDownloadGroups([2])).toEqual(all);
    expect(galaxyDownloadGroups([6, 6])).toEqual(all);
  });
});
