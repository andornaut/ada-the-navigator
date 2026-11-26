import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { afterEach, expect, it, vi } from "vitest";

import { createCoveredPaint } from "../ui/modalScenePaint.ts";

afterEach(() => vi.unstubAllGlobals());
it("retains production scan receipts under cover without screen or target measurements", () => {
  const source = ts.createSourceFile(
    "sceneUi.ts",
    readFileSync(new URL("sceneUi.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "renderConversation",
  )!;
  const view = {
    clearEquip: vi.fn(),
    enqueue: vi.fn(),
    render: vi.fn(),
    renderEquip: vi.fn(),
    reset: vi.fn(),
  };
  const state = { flight: { galaxy: 1, player: { x: 0, y: 0 } }, mode: "space", notice: "" };
  const receipt = { galaxy: 1, targetId: "actual-landmark" };
  const scan = { equipFlight: state.flight, state, time: 0, view };
  const drain = vi.fn().mockReturnValue([receipt]);
  const scene = {
    boxOccupant: null,
    controls: { layout: () => ({ insets: {}, view: {} }), navigationCovered: () => false },
    conversationBox: { render: vi.fn() },
    emergencyReturn: {},
    enabled: true,
    model: { drainScanOutcomes: drain, state, targetMarkers: () => [] },
    reducedMotion: false,
    settingsOpen: true,
    time: { now: 20 },
  };
  const querySelectorAll = vi.fn();
  const context = createContext({
    BOX_OCCUPANT: "data-box-occupant",
    VIEW_HOST_ID: "app",
    boxOccupant: () => null,
    coarsePointer: () => false,
    coveredScenePaint: new WeakMap(),
    createCoveredPaint,
    document: { getElementById: () => null, hidden: false, querySelectorAll },
    markerFootprints: () => [{ height: 30, width: 100, x: 0, y: 0 }],
    pennyLayers: { get: () => undefined },
    safeGameArea: () => ({ height: 360, width: 720, x: 0, y: 0 }),
    scanViews: { get: () => scan },
    showNetworkPlay: () => false,
    window: {},
  });
  runInContext(
    ts.transpileModule(declaration.getText(source).replace("export ", ""), {
      compilerOptions: { target: ts.ScriptTarget.ESNext },
    }).outputText,
    context,
  );
  const render = context.renderConversation as (scene: unknown) => void;
  render(scene);
  // The fixed slot needs no world projection or DOM footprint reads per frame.
  expect(querySelectorAll).not.toHaveBeenCalled();
  expect(drain).toHaveBeenCalledOnce();
  expect(view.enqueue).toHaveBeenCalledWith([receipt]);
  const first = view.render.mock.calls[0]!;
  expect(first[0].covered).toBe(true);
  expect(view.renderEquip).toHaveBeenLastCalledWith(true, 20, undefined);
  expect(first[1]).toBe(0);
  expect(first[0].time).toBe(20);
  expect(first[0]).toEqual({ covered: true, time: 20 });
  scene.settingsOpen = false;
  scene.time.now = 40;
  render(scene);
  expect(view.render.mock.calls[1]![0].covered).toBe(false);
  expect(view.renderEquip).toHaveBeenLastCalledWith(false, 40, undefined);
  expect(view.render.mock.calls[1]![0].time).toBe(40);
  expect(view.render.mock.calls[1]![1]).toBe(0);
  scene.time.now = 140;
  render(scene);
  expect(view.render.mock.calls[2]![1]).toBe(100);
  expect(view.reset).not.toHaveBeenCalled();
  scene.model.state = { ...state };
  render(scene);
  expect(view.reset).toHaveBeenCalledOnce();
  expect(scan.equipFlight).toBeUndefined();
});
