import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GameModel } from "../model/game.ts";
import { shipHeading } from "../model/nose.ts";
import { relaunch } from "../testing/launch.ts";
import type { JumpPlay } from "../ui/jumpOverlay.ts";
import { EmergencyReturn, returnedOnDepletion } from "./emergencyReturn.ts";
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
    settingsOpen: false,
    storybook: { sleepSeconds: () => 1 },
  };
  const document = { hidden: false };
  const flushScene = vi.fn();
  const snapshotSource = vi.fn(() => ({ ...jumpSource, heading: null }));
  const context = createContext({
    OVERNIGHT_SLEEP: { seconds: 1 },
    coverShip: vi.fn(),
    document,
    drawPulse: vi.fn(),
    endJump: () => {
      scene.jumping = false;
    },
    flushScene,
    jumpScene: () => ({ ...jumpSource, heading: null }),
    observeFeedback: vi.fn(),
    refreshScene: vi.fn(),
    renderConversation: vi.fn(),
    returnedOnDepletion,
    screenToWorld: (v: unknown) => v,
    shipHeading,
    spaceJumpScene: snapshotSource,
    startRockBreaks: vi.fn(),
    startZips: vi.fn(),
  });
  const frame = runInContext(updateCode, context) as (time: number, ms: number) => void;
  let time = 0;
  return {
    document,
    flight,
    flushScene,
    frame: (ms = 50) => {
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
    expect(snapshotSource).not.toHaveBeenCalled();
    flight.shield = CONTENT.tuning.hazardDamage;
    flight.shots = [incoming];
    frame();
    expect(scene.emergencyReturn.pending).toBe(true);
    expect(snapshotSource).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 40; i++) {
      frame();
    }
    expect(snapshotSource).toHaveBeenCalledTimes(1);
    expect(scene.quantum!.play).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ source: jumpSource }),
    );
  });

  it("commits the real return once, freezes input, then plays the existing jump from the held heading", () => {
    const { flight, frame, model, scene } = setup();
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
    for (let i = 0; i < 18; i++) {
      frame();
    }
    expect(scene.quantum!.play).not.toHaveBeenCalled();
    expect(scene.controls.sample).toHaveBeenCalledTimes(1);
    expect(flight).toEqual(frozen);
    frame();
    expect(scene.quantum!.play).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ emergency: true, source: jumpSource }),
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
  });
  it("holds the readable line across background and clamps the first resumed frame", () => {
    const { document, frame, scene } = setup();
    frame();
    document.hidden = true;
    frame(60000);
    expect(scene.emergencyReturn.line!.elapsed).toBe(0.05);
    document.hidden = false;
    frame(60000);
    expect(scene.emergencyReturn.pending).toBe(true);
    expect(scene.quantum!.play).not.toHaveBeenCalled();
    for (let i = 0; i < 18; i++) {
      frame();
    }
    expect(scene.quantum!.play).toHaveBeenCalledTimes(1);
  });
  it("finishes without jump art and releases the input lock", () => {
    const { frame, scene } = setup(false);
    for (let i = 0; i < 20; i++) {
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
    for (let i = 0; i < 20; i++) {
      presentation.advance(true, 0.05);
    }
    expect(presentation.pending).toBe(false);
    expect(presentation.active).toBe(true);
    expect(presentation.begin(true, jumpSource)).toBe(false);
    presentation.cancel();
    expect(presentation.active).toBe(false);
  });
});
