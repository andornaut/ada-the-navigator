import { afterEach, describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition, LANCE_TELL, PHASER_AIM_SECONDS } from "../data/enemyCatalog.ts";
import { BUILT, GALAXY_NUMBERS } from "../data/galaxies.ts";
import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { endArrivalGrace } from "../testing/arrivalGrace.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { createEnemy } from "./ai/index.ts";
import { activeEnemyBeams } from "./flight/index.ts";
import { GameModel } from "./game.ts";
import { ACTIVE_CHUNK_RADIUS } from "./geography.ts";
import { validPhantomFlight, validPhantomProgress } from "./phantom/index.ts";
import type { FlightState, SpaceObject } from "./types.ts";

const productionRoster = [...BUILT];
afterEach(() => expect([...BUILT]).toEqual(productionRoster));

/** Test-only admission exercises the prepared adapter without publishing it in the roster. */
function withPhantom(check: (model: GameModel) => void, entropy = supportEntropy): void {
  const built = BUILT as Set<GalaxyNumber>;
  const admitted = built.has(6);
  built.add(6);
  try {
    const model = new GameModel(CONTENT, entropy, SAVE_RESTORE);
    model.state.started = true;
    model.state.prologueSeen = true;
    model.state.unlocked = [...GALAXY_NUMBERS];
    model.state.progress[6].opened = true;
    model.startGalaxy(6);
    expect(model.state.flight?.galaxy).toBe(6);
    check(model);
  } finally {
    if (!admitted) {
      built.delete(6);
    }
  }
}

function represented(flight: FlightState): SpaceObject[] {
  return [
    ...flight.objects,
    ...Object.values(flight.world.notables).filter(
      (object): object is SpaceObject => object !== null,
    ),
  ];
}

it.each([
  { archetype: "interceptor", kind: "phaser", tellSeconds: PHASER_AIM_SECONDS },
  {
    archetype: "capital",
    kind: "lance",
    tellSeconds: LANCE_TELL.trackSeconds + LANCE_TELL.lockSeconds,
  },
] as const)(
  "resumes an ordinary Phantom $kind at the same fire time",
  ({ archetype, kind, tellSeconds }) => {
    withPhantom(
      (model) => {
        const flight = model.state.flight!;
        const weapon = kind === "phaser" ? "phaser" : "chargedLance";
        const id = `${kind}-proof`;
        const definition = enemyDefinition(6, archetype, id);
        const point = { x: flight.player.x + 220, y: flight.player.y };
        const enemy = createEnemy(definition, { archetype, id, packId: null, phase: 0 }, point);
        if (kind === "lance") {
          const mount = definition.hardpoints.find(
            (part) => part.kind === "weapon" && part.fire.weapon === weapon,
          );
          expect(mount).toBeDefined();
          for (const part of enemy.hardpoints) {
            part.cooldown = part.id === mount!.id ? 0 : 999;
          }
        }
        // Start with an engaged opponent so regional admission does not decide this test.
        enemy.facing = { x: -1, y: 0 };
        enemy.engaged = true;
        flight.objects.push({
          ...point,
          enemy,
          hp: enemy.hp,
          id,
          kind: "enemy",
          radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
        });
        endArrivalGrace(flight);
        const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
        const frame = 1 / 60;
        model.step(frame, idle);
        const pending = activeEnemyBeams(flight).find((beam) => beam.ownerId === id);
        expect(pending).toMatchObject({ fired: false, kind });
        // Start both branches two frames before the real firing boundary. The tell was
        // committed by the enemy above; the full windup is covered by the combat tests.
        pending!.age = tellSeconds - 2 * frame;
        const shield = flight.shield;
        const document = model.saveDocument();
        const saved = model.save();
        expect(restoreSave(saved)?.flight?.enemyBeams).toEqual([pending]);
        expect(
          restoreSave({
            ...document,
            flight: {
              ...document.flight,
              enemyBeams: [{ ...document.flight!.enemyBeams![0], fired: true }],
            },
          }),
        ).toBeNull();

        const resumed = relaunch(CONTENT, saved);
        const continued = resumed.state.flight!;
        expect(continued).not.toBe(flight);
        expect(activeEnemyBeams(continued)).toEqual([pending]);

        const legacy = structuredClone(document);
        delete legacy.flight!.enemyBeams;
        expect(restoreSave(legacy)).not.toBeNull();
        expect(activeEnemyBeams(relaunch(CONTENT, legacy).state.flight!)).toEqual([]);

        model.step(frame, idle);
        resumed.step(frame, idle);
        expect(flight.shield).toBe(shield);
        expect(continued.shield).toBe(shield);

        model.step(2 * frame, idle);
        resumed.step(2 * frame, idle);
        expect(flight.shield).toBeCloseTo(shield - pending!.damage);
        expect(continued.shield).toBeCloseTo(flight.shield);
        expect(activeEnemyBeams(continued)).toEqual(activeEnemyBeams(flight));

        model.step(frame, idle);
        resumed.step(frame, idle);
        expect(flight.shield).toBeCloseTo(shield - pending!.damage);
        expect(continued.shield).toBeCloseTo(flight.shield);
        expect(resumed.saveDocument().flight).not.toHaveProperty("enemyBeams");
        expect(document.flight?.enemyBeams?.[0]?.fired).toBe(false);
      },
      () => 173,
    );
  },
);

describe("Phantom GameModel initialization under test-only chapter admission", () => {
  it("accepts the immediate first save without advancing physics or relaxing the active window", () => {
    withPhantom((model) => {
      const flight = model.state.flight!;
      expect(flight.time).toBe(0);
      expect(flight.phantom?.phase).toBe("blockades");
      expect(validPhantomFlight(flight.phantom)).toBe(true);
      expect(validPhantomProgress(model.state.progress[6].phantom)).toBe(true);
      const before = JSON.stringify(flight);
      const firstSave = model.save();
      expect(
        restoreSave(firstSave),
        "startGalaxy must produce a valid first save before any step",
      ).not.toBeNull();
      expect((ACTIVE_CHUNK_RADIUS * 2 + 1) ** 2).toBe(49);
      expect(flight.chunks.length).toBeLessThanOrEqual(49);
      expect(new Set(flight.chunks).size).toBe(flight.chunks.length);
      expect(JSON.stringify(flight)).toBe(before);
      expect(flight.time).toBe(0);
    });
  });

  it("preserves every actual blockade member and any retained notables across first-save Continue", () => {
    withPhantom((model) => {
      const flight = model.state.flight!;
      expect(Object.keys(flight.phantom!.blockades).sort()).toEqual(
        [...PHANTOM_DESTINATIONS].sort(),
      );
      const members = Object.values(flight.phantom!.blockades).flat();
      expect(members.length).toBeGreaterThan(PHANTOM_DESTINATIONS.length);
      expect(new Set(members).size).toBe(members.length);
      const objects = represented(flight);
      for (const [route, ids] of Object.entries(flight.phantom!.blockades)) {
        for (const id of ids) {
          const matches = objects.filter((object) => object.id === id);
          expect(matches, id).toHaveLength(1);
          expect(matches[0]!.routeId).toBe(route);
          expect(matches[0]!.hp).toBeGreaterThan(0);
        }
      }
      const saved = model.save();
      expect(restoreSave(saved)).not.toBeNull();
      const loaded = relaunch(CONTENT, saved);
      expect(loaded.state.flight).toEqual(flight);
      expect(loaded.state.progress[6]).toEqual(model.state.progress[6]);
      expect(loaded.state.flight!.world.notables).toEqual(flight.world.notables);
      expect(loaded.state.flight!.combat).toEqual(flight.combat);
      expect(loaded.state.flight!.phantom!.blockades).toEqual(flight.phantom!.blockades);
      expect(
        represented(loaded.state.flight!)
          .map((object) => object.id)
          .sort(),
      ).toEqual(objects.map((object) => object.id).sort());
      expect(loaded.state.flight!.time).toBe(0);
    });
  });

  it("still rejects over-capacity and duplicate active chunk identities", () => {
    withPhantom((model) => {
      const saved = model.save();
      expect(restoreSave(saved)).not.toBeNull();
      const oversized = JSON.parse(saved);
      oversized.flight.chunks = Array.from({ length: 50 }, (_, index) => `${index},0`);
      expect(restoreSave(oversized)).toBeNull();
      const duplicate = JSON.parse(saved);
      duplicate.flight.chunks = [duplicate.flight.chunks[0], duplicate.flight.chunks[0]];
      expect(restoreSave(duplicate)).toBeNull();
    });
  });
});
