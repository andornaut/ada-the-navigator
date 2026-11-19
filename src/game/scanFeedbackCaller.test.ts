import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { afterEach, expect, it, vi } from "vitest";

import { VIEW_PROPERTIES } from "../ui/layout/css.ts";
import { createCoveredPaint } from "../ui/modalScenePaint.ts";
import {
  scanFeedbackDialogue,
  scanFeedbackFootprints,
  scanFeedbackHudRow,
} from "../ui/scanFeedbackView.ts";

afterEach(() => vi.unstubAllGlobals());
it("retains production scan receipts under cover and resolves only the receipt galaxy's actual target", () => {
  const source = ts.createSourceFile(
    "sceneUi.ts",
    readFileSync(new URL("sceneUi.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "renderConversation",
  )!;
  const view = { enqueue: vi.fn(), render: vi.fn(), reset: vi.fn() };
  const state = { flight: { galaxy: 1, player: { x: 0, y: 0 } }, mode: "space", notice: "" };
  const receipt = { galaxy: 1, targetId: "actual-landmark" };
  const site = { id: "actual-landmark", x: 40, y: 80 };
  const scan = { state, time: 0, view };
  const drain = vi.fn().mockReturnValue([receipt]);
  const scene = {
    boxOccupant: null,
    controls: { layout: () => ({ insets: {}, view: {} }), navigationCovered: () => false },
    conversationBox: { render: vi.fn() },
    emergencyReturn: {},
    enabled: true,
    model: { drainScanOutcomes: drain, state, targetMarkers: () => [] },
    project: vi.fn().mockReturnValue({ x: 330, y: 220 }),
    reducedMotion: false,
    settingsOpen: true,
    time: { now: 20 },
  };
  const landmarkById = vi.fn().mockReturnValue(site);
  const scanFeedbackArea = vi.fn().mockReturnValue({ height: 336, width: 696, x: 12, y: 12 });
  const host = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const occupied = {
    closest: () => null,
    getBoundingClientRect: () => ({ height: 30, left: 0, top: 0, width: 100 }),
    getClientRects: () => [{}],
  };
  const querySelectorAll = vi.fn(() => [occupied]);
  vi.stubGlobal("getComputedStyle", () => ({
    display: "block",
    getPropertyValue: (name: string) => (name === VIEW_PROPERTIES.unit ? "1" : "0"),
    opacity: "1",
    visibility: "visible",
  }));
  const context = createContext({
    BOX_OCCUPANT: "data-box-occupant",
    VIEW_HOST_ID: "app",
    boxOccupant: () => null,
    coarsePointer: () => false,
    coveredScenePaint: new WeakMap(),
    createCoveredPaint,
    document: { getElementById: () => host, hidden: false, querySelectorAll },
    landmarkById,
    markerFootprints: () => [{ height: 30, width: 100, x: 0, y: 0 }],
    pennyLayers: { get: () => undefined },
    safeGameArea: () => ({ height: 360, width: 720, x: 0, y: 0 }),
    scanFeedbackArea,
    scanFeedbackDialogue,
    scanFeedbackFootprints,
    scanFeedbackHudRow,
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
  // The view reads the footprints when it places a receipt; the caller measures nothing itself.
  expect(querySelectorAll).not.toHaveBeenCalled();
  expect(drain).toHaveBeenCalledOnce();
  expect(view.enqueue).toHaveBeenCalledWith([receipt]);
  const first = view.render.mock.calls[0]!;
  expect(first[0].covered).toBe(true);
  expect(first[1]).toBe(20);
  expect(first[0].time).toBe(20);
  // The HUD footprint, then the same node read as a touch control.
  expect(first[0].blocked()).toEqual([
    { height: 30, width: 100, x: 0, y: 0 },
    { height: 30, width: 100, x: 0, y: 0 },
  ]);
  expect(first[0].area).toEqual({ height: 336, width: 696, x: 12, y: 12 });
  expect(scanFeedbackArea).toHaveBeenCalledWith(
    scene.controls.layout().insets,
    scene.controls.layout().view,
  );
  expect(first[0].dialogue()).toEqual([{ height: 30, width: 100, x: 0, y: 0 }]);
  expect(first[0].hudRow()).toEqual([{ height: 30, width: 100, x: 0, y: 0 }]);
  expect(querySelectorAll).toHaveBeenCalledWith(
    expect.stringContaining(":not(.ada-conversation, .ada-conversation *)"),
  );
  expect(first[0].resolveAnchor(receipt)).toEqual({ x: 330, y: 220 });
  expect(landmarkById).toHaveBeenCalledWith(1, "actual-landmark");
  expect(scene.project).toHaveBeenCalledWith(site);
  expect(first[0].resolveAnchor({ ...receipt, galaxy: 2 })).toBeUndefined();
  expect(landmarkById).toHaveBeenCalledTimes(1);
  scene.settingsOpen = false;
  scene.time.now = 40;
  render(scene);
  expect(view.render.mock.calls[1]![0].covered).toBe(false);
  expect(view.render.mock.calls[1]![0].time).toBe(40);
  expect(view.reset).not.toHaveBeenCalled();
  scene.model.state = { ...state };
  render(scene);
  expect(view.reset).toHaveBeenCalledOnce();
});
