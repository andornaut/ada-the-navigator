import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import ts from "typescript";
import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { fill, type ShopRow, weaponName } from "../model/shop.ts";
import { stationRow } from "../ui/index.ts";

const source = ts.createSourceFile(
  "sceneUi.ts",
  readFileSync(new URL("./sceneUi.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
let call: ts.CallExpression | undefined;
const visit = (node: ts.Node): void => {
  if (ts.isCallExpression(node) && node.expression.getText(source) === "stationRow") {
    call = node;
  }
  ts.forEachChild(node, visit);
};
visit(source);
if (!call?.arguments[4]) {
  throw new Error("Station requirement callback is not wired");
}
const code = ts.transpileModule(`(${call.arguments[4].getText(source)})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2023 },
}).outputText;
const labels = CONTENT.labels;
const requirement = runInNewContext(code, {
  fill,
  label: (key: string) => labels[key],
  labels,
  weaponName,
}) as (weapon: NonNullable<ShopRow["requiresWeapon"]>) => string;
const ammo: ShopRow = {
  inUse: false,
  item: { kind: "ammo", weapon: "rapidMissile" },
  level: null,
  owned: false,
  price: null,
  requiresWeapon: "heavyMissile",
};

it("uses the exact approved canonical phrase through the actual scene callback", () => {
  expect(CONTENT.labels.requiresWeapon).toBe("Requires {weapon}");
  expect(stationRow(ECONOMY, labels, 10000, ammo, requirement)).toMatchObject({
    reason: "Requires Heavy Missile",
    requiresWeapon: "heavyMissile",
    state: "unaffordable",
  });
});
it("formats the current canonical name rather than inferring it from the ammo item", () => {
  const current = { ...labels, weaponHeavyMissile: "Current canonical name" };
  const callback = runInNewContext(code, {
    fill,
    label: (key: string) => current[key as keyof typeof current],
    labels: current,
    weaponName,
  }) as typeof requirement;
  expect(stationRow(ECONOMY, current, 10000, ammo, callback).reason).toBe(
    "Requires Current canonical name",
  );
});
it("does not supply a requirement when the model row has no lock field", () => {
  const row = { ...ammo };
  delete row.requiresWeapon;
  const callback = vi.fn(requirement);
  expect(stationRow(ECONOMY, labels, 10000, row, callback).reason).toBeUndefined();
  expect(callback).not.toHaveBeenCalled();
});
