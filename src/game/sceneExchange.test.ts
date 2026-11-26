import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import type { ImmediateExchangeOrder } from "../model/exchange.ts";
import { GameModel } from "../model/game.ts";
import { gainSnapshot } from "../model/itemGains.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { ModelFeedback } from "./feedback.ts";

const source = ts.createSourceFile(
  "sceneUi.ts",
  readFileSync(new URL("./sceneUi.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const declaration = source.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "confirmStationExchange",
)!;
const code = ts.transpileModule(`(${declaration.getText(source).replace(/^export /u, "")})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2023 },
}).outputText;

function bridge() {
  const model = new GameModel(CONTENT, supportEntropy);
  model.state.prologueSeen = true;
  model.startGalaxy(1);
  model.state.docked = "hub";
  model.state.flight!.objects = [];
  model.state.flight!.cargo = 1;
  model.state.economy.stardust = 20;
  const feedback = new ModelFeedback();
  feedback.baseline(model.state);
  const scene = {
    controls: { reset: vi.fn() },
    emergencyReturn: { active: false },
    feedback,
    model,
  };
  const flush = vi.fn();
  const refresh = vi.fn();
  const context = createContext({ flushScene: flush, gainSnapshot, refreshScene: refresh });
  const confirm = runInContext(code, context) as (
    scene: object,
    order: ImmediateExchangeOrder,
  ) => { kind: string; reason?: string };
  const exchange = vi.spyOn(model, "exchangeImmediately");
  return {
    confirm: () => confirm(scene, { amount: 10, resource: "ore" }),
    exchange,
    feedback,
    flush,
    model,
    refresh,
    scene,
  };
}

describe("station Exchange caller", () => {
  it("flushes and refreshes one applied trade without a synthetic flight pickup", () => {
    const { confirm, exchange, feedback, flush, model, refresh, scene } = bridge();
    expect(confirm().kind).toBe("exchanged");
    expect(flush).toHaveBeenCalledExactlyOnceWith(scene);
    expect(refresh).toHaveBeenCalledExactlyOnceWith(scene);
    expect(scene.controls.reset).toHaveBeenCalledTimes(1);
    expect(feedback.pulses).toEqual([]);
    expect(feedback.observe(20, model.state)).toEqual([]);
    expect(exchange).toHaveBeenCalledExactlyOnceWith({ amount: 10, resource: "ore" });
    expect(flush).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    model.state.flight!.cargo += 1;
    expect(feedback.observe(20, model.state)).toEqual(["pickup"]);
  });

  it("refuses a trade during emergency presentation before model mutation", () => {
    const { confirm, flush, model, refresh, scene } = bridge();
    scene.emergencyReturn.active = true;
    const saved = model.save();
    expect(confirm()).toMatchObject({ kind: "refused", reason: "unavailable" });
    expect(model.save()).toBe(saved);
    expect(flush).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

it("refuses against changed live balances without synchronization or mutation", () => {
  const { confirm, flush, model, refresh, scene } = bridge();
  model.state.economy.stardust = 1;
  const before = model.save();
  expect(confirm()).toMatchObject({ kind: "refused", reason: "cantAfford" });
  expect(model.save()).toBe(before);
  expect(flush).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(scene.controls.reset).not.toHaveBeenCalled();
});
