import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { RESOURCE_DESCRIPTIONS } from "../data/resourceDescriptions.ts";

const source = ts.createSourceFile(
  "controls.ts",
  readFileSync(new URL("./controls.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const handlers: ts.ArrowFunction[] = [];
const visit = (node: ts.Node) => {
  if (
    ts.isPropertyAssignment(node) &&
    node.name.getText(source) === "onResource" &&
    ts.isArrowFunction(node.initializer)
  ) {
    handlers.push(node.initializer);
  }
  ts.forEachChild(node, visit);
};
visit(source);
if (handlers.length !== 1) {
  throw new Error("Expected the single production status-resource caller");
}

function fixture(
  details: { kind: string; questId?: string; text: string; title: string } | null,
  accepts = true,
) {
  const icon = {
    classList: { remove: vi.fn() },
    dataset: {},
    hidden: true,
    removeAttribute: vi.fn(),
    setAttribute: vi.fn(),
  };
  const origin = { cloneNode: vi.fn(() => icon), closest: vi.fn() };
  origin.closest.mockReturnValue({ querySelector: () => origin });
  const resource = { open: vi.fn() };
  const pause = { openQuest: vi.fn(), openQuests: vi.fn() };
  const aboardResource = vi.fn(() => details);
  const handler = runInContext(
    ts.transpileModule(`(${handlers[0]!.getText(source)})`, {
      compilerOptions: { target: ts.ScriptTarget.ES2023 },
    }).outputText,
    createContext({
      CONTENT,
      RESOURCE_DESCRIPTIONS,
      options: { aboardResource, pause: { labels: { mapScreen: { quests: "Quests" } } } },
      pause,
      resource,
      state: { accepts: () => accepts },
      statusView: { ore: 0, stardust: 7 },
    }),
  ) as (kind: "aboard" | "ore" | "stardust", origin: unknown) => void;
  return { aboardResource, handler, icon, origin, pause, resource };
}
const cargo = { kind: "cargo", text: "Held aboard", title: "Cargo" };

it("opens nonquest cargo details without a generic Quests shortcut", () => {
  const f = fixture(cargo);
  f.handler("aboard", f.origin);
  expect(f.resource.open).toHaveBeenCalledWith(cargo.title, cargo.text, f.origin, { icon: f.icon });
  expect(f.pause.openQuest).not.toHaveBeenCalled();
  expect(f.pause.openQuests).not.toHaveBeenCalled();
});

it("retains the existing direct flight-origin detail route for cargo tied to a specific quest", () => {
  const f = fixture({ ...cargo, questId: "known-quest" });
  f.handler("aboard", f.origin);
  expect(f.pause.openQuest).toHaveBeenCalledExactlyOnceWith("known-quest", "flight");
  expect(f.pause.openQuests).not.toHaveBeenCalled();
  expect(f.resource.open).not.toHaveBeenCalled();
});

it.each(["ore", "stardust"] as const)(
  "keeps %s details without a Quests shortcut and retains zero counts",
  (kind) => {
    const f = fixture(null);
    f.handler(kind, f.origin);
    expect(f.resource.open).toHaveBeenCalledWith(
      CONTENT.labels[kind],
      RESOURCE_DESCRIPTIONS[kind],
      f.origin,
      { count: kind === "ore" ? 0 : 7, icon: f.icon },
    );
    expect(f.aboardResource).not.toHaveBeenCalled();
    expect(f.pause.openQuests).not.toHaveBeenCalled();
  },
);

it("retains the input-availability guard before reading cargo or opening a modal", () => {
  const f = fixture(cargo, false);
  f.handler("aboard", f.origin);
  expect(f.aboardResource).not.toHaveBeenCalled();
  expect(f.resource.open).not.toHaveBeenCalled();
  expect(f.pause.openQuest).not.toHaveBeenCalled();
});

it("does not open cargo details when the current cargo has no detail data", () => {
  const f = fixture(null);
  f.handler("aboard", f.origin);
  expect(f.resource.open).not.toHaveBeenCalled();
  expect(f.pause.openQuest).not.toHaveBeenCalled();
});
