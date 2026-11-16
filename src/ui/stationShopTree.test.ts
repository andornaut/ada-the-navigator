import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import type { StationRow } from "./station.ts";
import { stationShopRowTree, stationShopTree } from "./stationShopTree.ts";

const labels = { inUse: "In use", owned: "Owned", projectFunded: "Funded" };
const row: StationRow = {
  glyph: { key: "icon-shield", kind: "sprite" },
  group: "items",
  key: "opaque",
  level: "[2]",
  name: "Item",
  price: 17,
  state: "forSale",
};
describe("native Shop configuration", () => {
  it.each(["forSale", "unaffordable", "selectable", "owned", "inUse"] as const)(
    "preserves %s presentation without action policy",
    (state) => {
      const tree = stationShopRowTree(labels, { ...row, state });
      validateLayoutTree({ name: [], row: ["parts"], trailing: [], well: [] }, tree);
      const text =
        state === "inUse" ? "In use" : state === "owned" || state === "selectable" ? "Owned" : "17";
      expect(tree.props).toEqual({ ariaLabel: `Item, [2], ${text}`, id: "opaque", state });
      expect(tree.slots!.parts!.map((node) => node.key)).toEqual(["well", "name", "trailing"]);
      expect(tree.slots!.parts![0]).toMatchObject({ props: { glyph: row.glyph } });
      expect(tree.slots!.parts![2]).toMatchObject({
        props: { className: text === "17" ? "ada-price" : "ada-owned", text },
      });
    },
  );
  it("retains funded wording, absent levels and null prices", () => {
    expect(
      stationShopRowTree(labels, { ...row, project: true, state: "owned" }).props.ariaLabel,
    ).toBe("Item, [2], Funded");
    expect(stationShopRowTree(labels, { ...row, level: "", price: null }).props.ariaLabel).toBe(
      "Item",
    );
  });
  it.each([1, 2, 3])("keeps group order and one paint heading with %i columns", (columns) => {
    const rows = ["paint", "items", "ammo", "paint", "items", "paint"].map((group, index) => ({
      ...row,
      group: group as StationRow["group"],
      key: String(index),
    }));
    const trees = stationShopTree({ columns, paintHeading: "Paint" }, rows);
    for (const tree of trees) {
      validateLayoutTree({ group: [] }, tree);
    }
    expect(trees.flatMap((tree) => tree.props.indices)).toEqual([2, 1, 4, 0, 3, 5]);
    expect(trees.filter((tree) => tree.props.heading !== null).map((tree) => tree.props)).toEqual([
      { heading: "Paint", indices: [0, 3, 5].slice(0, columns) },
    ]);
    expect(trees.every((tree) => tree.props.indices.length <= columns)).toBe(true);
    expect(stationShopTree({ columns, paintHeading: "Paint" }, [])).toEqual([]);
  });
});

it("shows the caller requirement on a retained locked ammo row instead of a price", () => {
  const tree = stationShopRowTree(labels, {
    ...row,
    group: "ammo",
    price: null,
    reason: "Caller requirement",
    requiresWeapon: "rapidMissile",
    state: "unaffordable",
  });
  expect(tree.props).toMatchObject({
    ariaLabel: "Item, [2], Caller requirement",
    requiresWeapon: "rapidMissile",
    state: "unaffordable",
  });
  expect(tree.slots!.parts![2]).toMatchObject({
    props: { className: "", text: "" },
  });
});

it("keeps pack/level information alongside requirement text in the native name port", () => {
  const tree = stationShopRowTree(labels, {
    ...row,
    group: "ammo",
    price: null,
    reason: "Caller requirement",
    requiresWeapon: "rapidMissile",
    state: "unaffordable",
  });
  expect(tree.slots!.parts![1]).toMatchObject({
    props: { level: "[2]", reason: "Caller requirement", title: "Item" },
  });
});
