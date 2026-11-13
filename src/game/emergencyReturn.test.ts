import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { SCREEN } from "../data/screen.ts";
import { GameModel } from "../model/game.ts";
import { shipHeading } from "../model/nose.ts";
import { direction } from "../model/shipPhysics.ts";
import { relaunch } from "../testing/launch.ts";
import type { JumpPlay } from "../ui/jumpOverlay.ts";
import { EmergencyReturn, returnedOnDepletion } from "./emergencyReturn.ts";
import { sceneFit, viewShift } from "./playCamera.ts";
// Execute the actual scene frame loop against the real model without booting Phaser's renderer.
const source = ts.createSourceFile(
  "scene.ts",
  readFileSync(new URL("./scene.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const sceneClass = source.statements.find(ts.isClassDeclaration)!;
const method = sceneClass.members.find(
  (node) => ts.isMethodDeclaration(node) && node.name.getText(source) === "update",
) as ts.MethodDeclaration;
const updateCode = ts.transpileModule(
  `(function(time, milliseconds) ${method.body!.getText(source)})`,
  { compilerOptions: { target: ts.ScriptTarget.ES2023 } },
).outputText;
const projectionCode = (name: string) => {
  const method = sceneClass.members.find(
    (node) => ts.isMethodDeclaration(node) && node.name.getText(source) === name,
  ) as ts.MethodDeclaration;
  const parameters = method.parameters.map((parameter) => parameter.getText(source)).join(",");
  return ts.transpileModule(`(function(${parameters}) ${method.body!.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023 },
  }).outputText;
};
const jumpSource = {
  center: { x: 360, y: 180 },
  heading: shipHeading({ x: 1, y: 0 }),
  specks: [{ x: 11, y: 22 }],
};
function setup(quantum = true) {
  const model = new GameModel(CONTENT);
  model.state.prologueSeen = true;
  model.startGalaxy(1);
  const flight = model.state.flight!;
  flight.objects = [];
  flight.facing = { x: 1, y: 0 };
  flight.player = { x: 10000, y: 10000 };
  flight.cargo = 9;
  flight.shield = CONTENT.tuning.hazardDamage;
  flight.shots = [
    {
      ...flight.player,
      damage: 1,
      enemy: true,
      hitIds: [],
      id: "deplete",
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
    },
  ];
  const sample = vi.fn(() => ({ aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false }));
  const scene = {
    cameras: { main: { width: 720, zoom: 1 } },
    controls: { overlay: { inert: false }, reset: vi.fn(), sample, setEnabled: vi.fn() },
    draw: vi.fn(),
    emergencyReturn: new EmergencyReturn(),
    feedback: { advance: vi.fn() },
    feedbackSound: { play: vi.fn() },
    flightClock: 0,
    holdSource: false,
    jumping: false,
    model,
    overlay: { clear: vi.fn() },
    quantum: quantum ? { play: vi.fn<(play: JumpPlay) => void>() } : undefined,
    reducedMotion: false,
    savedAt: 0,
    scale: { gameSize: { height: SCREEN.height, width: SCREEN.width }, zoom: 1 },
    settingsOpen: false,
    storybook: { sleepSeconds: () => 1 },
  };
  const document = { hidden: false };
  const flushScene = vi.fn();
  const snapshotSource = vi.fn(() => ({ ...jumpSource, heading: null }));
  const compromisedShield = vi.fn();
  const context = createContext({
    OVERNIGHT_SLEEP: { seconds: 1 },
    SCREEN,
    coverShip: vi.fn(),
    direction,
    document,
    drawCompromisedShield: compromisedShield,
    endJump: () => {
      scene.jumping = false;
    },
    flushScene,
    jumpScene: () => ({ ...jumpSource, heading: null }),
    observeFeedback: vi.fn(),
    refreshScene: vi.fn(),
    renderConversation: vi.fn(),
    returnedOnDepletion,
    sceneFit,
    screenToWorld: (v: unknown) => v,
    shipHeading,
    spaceJumpScene: snapshotSource,
    startRockBreaks: vi.fn(),
    startZips: vi.fn(),
    viewShift,
  });
  Object.assign(scene, {
    project: runInContext(projectionCode("project"), context),
    projectLayer: runInContext(projectionCode("projectLayer"), context),
  });
  const frame = runInContext(updateCode, context) as (time: number, ms: number) => void;
  let time = 0;
  return {
    compromisedShield,
    document,
    flight,
    flushScene,
    frame: (ms = 31.25) => {
      time += ms;
      frame.call(scene, time, ms);
    },
    model,
    scene,
    snapshotSource,
  };
}
describe("emergency return presentation", () => {
  it("snapshots specks only for the confirmed return, never during ordinary flight or its held presentation", () => {
    const { flight, frame, scene, snapshotSource } = setup();
    const incoming = flight.shots[0]!;
    flight.shots = [];
    flight.shield = scene.model.shieldMax;
    for (let i = 0; i < 80; i++) {
      frame();
    }
    expect(scene.model.state.mode).toBe("space");
    expect(scene.controls.sample).toHaveBeenCalledWith({
      facing: direction({ x: 1, y: 0.5 }),
      ship: { x: SCREEN.width / 2, y: SCREEN.height / 2 },
    });
    expect(snapshotSource).not.toHaveBeenCalled();
    flight.shield = CONTENT.tuning.hazardDamage;
    flight.shots = [incoming];
    frame();
    expect(scene.emergencyReturn.pending).toBe(true);
    expect(snapshotSource).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 100; i++) {
      frame();
    }
    expect(snapshotSource).toHaveBeenCalledTimes(1);
    expect(scene.quantum!.play).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ source: jumpSource }),
    );
  });

  it.each([false, true])(
    "holds three visible seconds before the jump, preserving the return once (reduced motion: %s)",
    (reducedMotion) => {
      const { flight, frame, model, scene } = setup();
      scene.reducedMotion = reducedMotion;
      frame();
      expect(scene.emergencyReturn.line).toMatchObject({
        name: "Astra",
        speaker: "astra",
        text: "Shields are down. We need to jump to safety!",
      });
      expect(model.state).toMatchObject({ flight: null, mode: "home" });
      expect(scene.controls.overlay.inert).toBe(true);
      expect(scene.controls.setEnabled).toHaveBeenCalledWith(false);
      const saved = model.save();
      const cargo = model.state.economy.cargo;
      const frozen = structuredClone(flight);
      for (let i = 0; i < 94; i++) {
        frame();
      }
      expect(scene.quantum!.play).not.toHaveBeenCalled();
      expect(scene.controls.sample).toHaveBeenCalledTimes(1);
      expect(flight).toEqual(frozen);
      frame();
      expect(scene.quantum!.play).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ emergency: true, reducedMotion, source: jumpSource }),
      );
      const play = scene.quantum!.play.mock.calls[0]![0];
      play.onSwitch();
      expect(scene.holdSource).toBe(false);
      play.onDone();
      expect(scene.jumping).toBe(false);
      expect(scene.controls.overlay.inert).toBe(false);
      frame();
      expect(scene.quantum!.play).toHaveBeenCalledTimes(1);
      expect(model.state.economy.cargo).toBe(cargo);
      expect(model.save()).toBe(saved);
      const loaded = relaunch(CONTENT, saved);
      expect(loaded.state.mode).toBe("home");
      expect(loaded.state.flight).toBeNull();
      expect(loaded.state.economy).toEqual(model.state.economy);
      expect(new EmergencyReturn().pending).toBe(false);
    },
  );
  it("holds the readable line across background and clamps the first resumed frame", () => {
    const { document, frame, scene } = setup();
    frame();
    document.hidden = true;
    frame(60000);
    expect(scene.emergencyReturn.line!.elapsed).toBe(0.03125);
    document.hidden = false;
    frame(60000);
    expect(scene.emergencyReturn.pending).toBe(true);
    expect(scene.quantum!.play).not.toHaveBeenCalled();
    for (let i = 0; i < 93; i++) {
      frame();
    }
    expect(scene.quantum!.play).not.toHaveBeenCalled();
    frame();
    expect(scene.quantum!.play).toHaveBeenCalledTimes(1);
  });
  it("finishes without jump art and releases the input lock", () => {
    const { frame, scene } = setup(false);
    for (let i = 0; i < 96; i++) {
      frame();
    }
    expect(scene.emergencyReturn.pending).toBe(false);
    expect(scene.holdSource).toBe(false);
    expect(scene.jumping).toBe(false);
    expect(scene.controls.overlay.inert).toBe(false);
  });
  it("does not start for protected damage, depletion remaining in flight, or unrelated home transitions", () => {
    const { frame, model, scene } = setup();
    model.state.flight!.shield = model.shieldMax;
    frame();
    expect(scene.emergencyReturn.pending).toBe(false);
    expect(returnedOnDepletion(true, model.state, [{ type: "depleted" }])).toBe(false);
    expect(returnedOnDepletion(false, { flight: null, mode: "home" }, [{ type: "depleted" }])).toBe(
      false,
    );
    expect(returnedOnDepletion(true, { flight: null, mode: "home" }, [])).toBe(false);
    expect(scene.quantum!.play).not.toHaveBeenCalled();
  });
  it("rejects duplicate starts and releases pending presentation on disposal", () => {
    const presentation = new EmergencyReturn();
    expect(presentation.begin(true, jumpSource)).toBe(true);
    presentation.advance(true, 0.05);
    expect(presentation.begin(true, { ...jumpSource, heading: 0 })).toBe(false);
    expect(presentation.line!.elapsed).toBe(0.05);
    presentation.cancel();
    expect(presentation.advance(true, 10)).toBeNull();
    expect(presentation.line).toBeNull();
  });
  it("keeps input guarded after the warning until the jump completes", () => {
    const presentation = new EmergencyReturn();
    presentation.begin(true, jumpSource);
    for (let i = 0; i < 96; i++) {
      presentation.advance(true, 0.03125);
    }
    expect(presentation.pending).toBe(false);
    expect(presentation.active).toBe(true);
    expect(presentation.begin(true, jumpSource)).toBe(false);
    presentation.cancel();
    expect(presentation.active).toBe(false);
  });
});

describe("compromised shield return sequence", () => {
  it.each([false, true])(
    "holds the shield, clears it before warp and keeps Astra through transition (reduced: %s)",
    (reduced) => {
      const { compromisedShield, frame, scene } = setup();
      scene.reducedMotion = reduced;
      frame();
      expect(compromisedShield).toHaveBeenCalledWith(scene);
      expect(scene.emergencyReturn.line?.text).toBe("Shields are down. We need to jump to safety!");
      for (let i = 0; i < 94; i++) {
        frame();
      }
      expect(scene.quantum!.play).not.toHaveBeenCalled();
      frame();
      const play = scene.quantum!.play.mock.calls[0]![0];
      expect(scene.emergencyReturn.pending).toBe(false);
      expect(scene.emergencyReturn.line).not.toBeNull();
      const clear = scene.overlay.clear.mock.invocationCallOrder.at(-1)!;
      expect(compromisedShield.mock.invocationCallOrder.at(-1)!).toBeLessThan(clear);
      expect(clear).toBeLessThan(scene.quantum!.play.mock.invocationCallOrder[0]!);
      const held = compromisedShield.mock.calls.length;
      play.onCover();
      play.onSwitch();
      frame();
      expect(compromisedShield).toHaveBeenCalledTimes(held);
      expect(scene.emergencyReturn.line).not.toBeNull();
      play.onDone();
      expect(scene.emergencyReturn.line).toBeNull();
      expect(scene.controls.overlay.inert).toBe(false);
    },
  );
});
