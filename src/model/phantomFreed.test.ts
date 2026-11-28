import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { INTERACTION_COPY } from "../data/conversations.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { GALAXY_NUMBERS, ROUTE_POSITION } from "../data/galaxies.ts";
import { PHANTOM_COPY, PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { readStory, relaunch, supportEntropy } from "../testing/launch.ts";
import { clearPhantomTraffic } from "../testing/phantomTraffic.ts";
import { enemyIntegrity, hardpointOffset } from "./ai/index.ts";
import { interactionCopy } from "./conversations.ts";
import { worldParts } from "./convex.ts";
import { enemyPartOutline } from "./enemyBody.ts";
import { ensureDestination } from "./flight.ts";
import { GameModel, newGameState } from "./game.ts";
import { activateFlightRegion } from "./geography.ts";
import type { SpaceObject, Vec } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function travel(model: GameModel, point: Vec): void {
  const flight = model.state.flight!;
  flight.player = { x: point.x, y: point.y };
  activateFlightRegion(CONTENT, flight.player, flight);
  model.step(0.000001, idle);
}

function represented(model: GameModel, id: string): SpaceObject | null | undefined {
  const flight = model.state.flight!;
  return flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
}

/** Deterministic impact fixtures exercise collision and damage, without measuring combat balance. */
function defeat(model: GameModel, id: string): void {
  for (let impact = 0; impact < 32; impact++) {
    const object = represented(model, id);
    if (!object || object.hp <= 0 || object.enemy?.disabled) {
      return;
    }
    travel(model, { x: object.x + 600, y: object.y });
    // The synthetic shot excludes other targets by ID. Each impact keeps the chapter actors and
    // landmarks without simulating the surrounding traffic and debris that travel generated.
    clearPhantomTraffic(model.state.flight!);
    const target = represented(model, id)!;
    const enemy = target.enemy!;
    const before = enemyIntegrity(enemy);
    const definition = enemyDefinition(6, enemy.archetype, id);
    const part = definition.hardpoints.find((part) =>
      enemy.hardpoints.some((state) => state.id === part.id && state.hp > 0),
    );
    const outline = part && enemyPartOutline(ROUTE_POSITION[6], enemy, part.id);
    const polygon = outline && worldParts(outline)[0];
    const offset = polygon
      ? polygon.reduce(
          (sum, point) => ({
            x: sum.x + point.x / polygon.length,
            y: sum.y + point.y / polygon.length,
          }),
          { x: 0, y: 0 },
        )
      : part
        ? hardpointOffset(definition, CONTENT.tuning.flight.shipRadius * 2, enemy.facing, part)
        : { x: 0, y: 0 };
    const flight = model.state.flight!;
    flight.shots.push({
      damage: before,
      enemy: false,
      hitIds: [...flight.objects, ...flight.mines]
        .filter((entry) => entry.id !== id)
        .map((entry) => entry.id),
      id: `route-impact:${id}:${impact}`,
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
      x: target.x + offset.x,
      y: target.y + offset.y,
    });
    model.step(0.000001, idle);
    const after = represented(model, id);
    expect(
      !after || after.hp <= 0 || enemyIntegrity(after.enemy!) < before,
      `projectile must damage ${id}`,
    ).toBe(true);
  }
  throw new Error(`Impact fixture did not resolve ${id}`);
}

function reload(model: GameModel): GameModel {
  const saved = model.save();
  expect(restoreSave(saved), "route checkpoint must pass strict restoration").not.toBeNull();
  return relaunch(CONTENT, saved);
}

// Initial prior-five completion is a strict-valid precondition, not proof of those chapters.
function launch(): GameModel {
  const initial = newGameState();
  initial.started = initial.prologueSeen = true;
  initial.unlocked = [...GALAXY_NUMBERS];
  for (const id of GALAXY_NUMBERS.filter((id) => id !== 6)) {
    Object.assign(initial.progress[id], {
      holodisk: true,
      introduced: true,
      opened: true,
      questComplete: true,
      resolved: true,
    });
  }
  expect(restoreSave(initial)).not.toBeNull();
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, initial);
  model.continueGame();
  readStory(model);
  model.startGalaxy(6);
  return model;
}

function assertExchange(model: GameModel, destination: string, ordinal: number): void {
  const panel = model.state.dialogue!;
  const expected = PHANTOM_DESTINATIONS[ordinal]!;
  expect(panel.context).toBe(`phantom.${destination}`);
  expect(panel.choices.map(({ id }) => id)).toEqual(["continue"]);
  expect(panel.text).toBe(PHANTOM_COPY[expected]!.lines.map(({ text }) => text).join("\n\n"));
  expect(interactionCopy({ galaxy: 6, progress: model.state.progress[6] }, panel)).toEqual(
    INTERACTION_COPY[`6.phantom.${expected}`],
  );
}

// The three rotations free every settlement at every ordinal and each settlement before each other.
const orders = [
  [0, 1, 2],
  [1, 2, 0],
  [2, 0, 1],
].map((order) => order.map((index) => PHANTOM_DESTINATIONS[index]!));

describe("Phantom settlement liberation order through actual interactions", () => {
  it("keeps a known settlement's protected route out of Use until the blockade is cleared", () => {
    const model = launch();
    const flight = model.state.flight!;
    const id = PHANTOM_DESTINATIONS[0];
    travel(model, ensureDestination(CONTENT, id, flight));
    // Seeing the settlement on the map is not the same as clearing its approach.
    const progress = model.state.progress[6];
    if (!progress.known.includes(id)) {
      progress.known.push(id);
    }
    model.dismissNotice();
    const locked = structuredClone(progress);
    expect(model.useTarget?.id).not.toBe(id);
    expect(model.contextQuestDetails?.targetId).not.toBe(id);
    model.interact();
    expect(model.state.dialogue).toBeNull();
    expect(model.state.notice).toBe("");
    expect(progress).toEqual(locked);

    for (const guard of [...flight.phantom!.blockades[id]!]) {
      defeat(model, guard);
    }
    travel(model, ensureDestination(CONTENT, id, flight));
    expect(model.useTarget).toEqual({ action: "talk", id });
    model.interact();
    assertExchange(model, id, 0);
    expect(progress.phantom!.freed).toEqual([]);
  });

  it.each(orders.map((order) => [order]))("keeps ordinal copy and commits once for %j", (order) => {
    let model = launch();
    for (const [ordinal, id] of order.entries()) {
      for (const guard of [...model.state.flight!.phantom!.blockades[id]!]) {
        defeat(model, guard);
      }
      expect(model.state.progress[6].phantom!.broken).toContain(id);
      travel(model, ensureDestination(CONTENT, id, model.state.flight!));
      model.interact();
      assertExchange(model, id, ordinal);
      const before = structuredClone(model.state.progress[6]);
      expect(before.phantom!.freed).toEqual(order.slice(0, ordinal));
      expect(before.phantom!.flagshipKnown).toBe(false);
      model.closeInteraction();
      expect(model.state.progress[6]).toEqual(before);
      model = reload(model);
      expect(model.state.progress[6]).toEqual(before);
      model.interact();
      assertExchange(model, id, ordinal);
      model.choose("unoffered");
      expect(model.state.progress[6]).toEqual(before);
      model.choose("continue");
      expect(model.state.progress[6].phantom!.freed).toEqual(order.slice(0, ordinal + 1));
      expect(model.state.progress[6].phantom!.flagshipKnown).toBe(ordinal === 2);
      const committed = structuredClone(model.state.progress[6]);
      model.choose("continue");
      expect(model.state.progress[6]).toEqual(committed);
      model = reload(model);
      for (const [earlierOrdinal, earlier] of order.slice(0, ordinal + 1).entries()) {
        travel(model, ensureDestination(CONTENT, earlier, model.state.flight!));
        const revisiting = structuredClone(model.state.progress[6]);
        model.interact();
        assertExchange(model, earlier, earlierOrdinal);
        model.choose("continue");
        expect(model.state.progress[6]).toEqual(revisiting);
        expect(model.state.progress[6].phantom!.freed).toEqual(committed.phantom!.freed);
      }
    }
    expect(model.state.flight!.phantom!.phase).toBe("approach");
    expect(model.state.progress[6].holodisk).toBe(false);
    expect(model.state.progress[6].questComplete).toBe(false);
  });
});
