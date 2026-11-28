import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import { SCREEN } from "../data/screen.ts";
import { damageEnemy } from "../model/ai/index.ts";
import { enemyEquipmentDefinition } from "../model/enemyEquipment.ts";
import { GameModel } from "../model/game.ts";
import { worldSyncFlightRegion } from "../model/geography.ts";
import { stationPopulationObjects } from "../model/hostileStations/index.ts";
import { phantomBlockadeAdmits, phantomBlockadeSignal } from "../model/phantom.ts";
import type { FlightInput, Vec } from "../model/types.ts";
import { flightWorldContext, worldPoint } from "../model/world/index.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { clearPhantomTraffic } from "../testing/phantomTraffic.ts";
import { drawPhantomBlockades } from "./scenePhantomBlockade.ts";

const settlement = PHANTOM_DESTINATIONS[0];
const line = "Pull back and recharge if you need to. The frigate waits ahead.";
const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function launchBlockade() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [...GALAXY_NUMBERS] });
  const progress = model.state.progress[6];
  progress.opened = true;
  model.startGalaxy(6);
  const flight = model.state.flight!;
  const world = flightWorldContext(flight);
  const site = stationPopulationObjects(flight).find(({ id }) => id === settlement)!;
  const context = { content: CONTENT, flight, progress };
  const place = (offset: number, velocity = 0) => {
    flight.player = { x: site.x + offset, y: site.y };
    flight.velocity = { x: velocity, y: 0 };
    worldSyncFlightRegion(world, CONTENT, flight);
    clearPhantomTraffic(flight);
  };
  const inbound = (offset: number) => {
    place(offset + 1, -90);
    model.step(0.05, { ...idle, move: { x: -1, y: 0 } });
  };
  const actors = () => {
    const ids = flight.phantom!.blockades[settlement]!;
    const members = stationPopulationObjects(flight).filter(({ id }) => ids.includes(id));
    return {
      fighters: members.filter(({ enemy }) => enemy?.archetype === "fighter"),
      leader: members.find(({ enemy }) => enemy?.archetype === "frigate")!,
    };
  };
  return { actors, context, flight, inbound, model, place, site, world };
}

it("draws a non-colour warning and retraces the retained recovery lane until admission", () => {
  const f = launchBlockade();
  const { overlay, palette } = {
    overlay: { lineBetween: vi.fn(), lineStyle: vi.fn() },
    palette: { active: 0xffffff, threat: 0xaaaaaa },
  };
  const project = (point: Vec) => ({
    x: SCREEN.width / 2 + (point.x - f.flight.player.x) / 2,
    y: SCREEN.height / 2 + (point.y - f.flight.player.y) / 2,
  });
  const scene = {
    overlay,
    palette: palette as Parameters<typeof drawPhantomBlockades>[0]["palette"],
    project,
  };
  const paint = () => drawPhantomBlockades(scene, f.context);
  const { actors } = f;

  f.inbound(1_000);
  paint();
  expect(overlay.lineBetween).toHaveBeenCalledTimes(10);
  expect(overlay.lineBetween.mock.calls.every((points) => points.every(Number.isFinite))).toBe(
    true,
  );
  const warning = overlay.lineBetween.mock.calls[0]!;
  expect(warning[0]).not.toBe(warning[2]);
  expect(warning[1]).not.toBe(warning[3]);
  expect(phantomBlockadeAdmits(f.flight, actors().leader)).toBe(false);

  f.model.step(2.5, idle);
  const { fighters, leader } = actors();
  for (const fighter of fighters) {
    const definition = enemyEquipmentDefinition(6, fighter.enemy!);
    fighter.enemy = damageEnemy(
      definition,
      { amount: definition.hp, hardpointId: null },
      fighter.enemy!,
    );
    fighter.hp = fighter.enemy.hp;
  }
  f.model.step(0.03, idle);
  const recovery = phantomBlockadeSignal(f.context, settlement);
  expect(recovery?.phase).toBe("recovery");
  if (recovery?.phase !== "recovery") {
    throw new Error("Missing recovery");
  }
  f.place(520);
  overlay.lineBetween.mockClear();
  paint();
  const site = worldPoint(f.world, f.flight.player, recovery.site);
  const exit = project(worldPoint(f.world, site, recovery.withdrawal));
  expect(
    overlay.lineBetween.mock.calls.filter(([, , x, y]) => x === exit.x && y === exit.y),
  ).toHaveLength(4);

  // Requesting the line does not acknowledge the persisted cue.
  void f.model.conversation;
  expect(phantomBlockadeSignal(f.context, settlement)).toMatchObject({ cuePending: true });
  for (let step = 0; step < 20 && f.model.conversation?.text !== line; step++) {
    if (f.model.conversation) {
      f.model.dismissConversation();
    }
    f.model.step(0.03, idle);
  }
  expect(f.model.conversation).toMatchObject({ speaker: "astra", text: line });
  expect(f.model.state.dialogue).toBeNull();
  expect(phantomBlockadeSignal(f.context, settlement)).toMatchObject({ cuePending: false });
  const saved = f.model.save();
  expect(restoreSave(saved)?.flight?.phantom?.blockadePhases?.[settlement]).not.toHaveProperty(
    "cuePending",
  );
  const resumed = relaunch(CONTENT, saved);
  expect(resumed.state.flight?.phantom?.blockadePhases?.[settlement]).not.toHaveProperty(
    "cuePending",
  );
  expect(resumed.conversation?.text).not.toBe(line);

  // The path persists after acknowledgement, then disappears on actual reserve admission.
  overlay.lineBetween.mockClear();
  paint();
  expect(overlay.lineBetween).toHaveBeenCalled();
  f.model.step(4, idle);
  f.inbound(500);
  expect(phantomBlockadeAdmits(f.flight, leader)).toBe(true);
  overlay.lineBetween.mockClear();
  paint();
  expect(overlay.lineBetween).not.toHaveBeenCalled();
});
