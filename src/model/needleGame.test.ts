import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ACTIVITIES } from "../data/activities.ts";
import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { PHASER_AIM_SECONDS } from "../data/enemyCatalog.ts";
import { BUILT, GALAXY_NUMBERS, ROUTE_POSITION } from "../data/galaxies.ts";
import { NEEDLE } from "../data/needle.ts";
import { NEEDLE_LEARNING } from "../data/needleCopy.ts";
import { SCREEN } from "../data/screen.ts";
import { SIMULATION_STEP_SECONDS } from "../data/simulation.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { BEAM } from "../data/weaponCatalog.ts";
import { ControlState } from "../input/state.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { endArrivalGrace } from "../testing/arrivalGrace.ts";
import { readStory, relaunch, supportEntropy } from "../testing/launch.ts";
import { worldSceneryBlocksSegment, worldSceneryBodyContact } from "./asteroids.ts";
import { capitalBossActor } from "./capitalBossEncounter.ts";
import { interactionCopy } from "./conversations.ts";
import { partsReach, worldParts } from "./convex.ts";
import { crossbowContainsAttack } from "./earlyEncounterPatterns.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import { enemyFireLine } from "./enemyAi.ts";
import { enemyPhysicalBody } from "./enemyBody.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { enemyBeamReach } from "./enemyProjectiles.ts";
import {
  activeCrossbowSector,
  activeEnemyBeams,
  ensureStation,
  questGuardPlacementContext,
} from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { worldSyncFlightRegion } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import { inNeedleChannel, needleCourses, type NeedleGate } from "./needle.ts";
import { NEEDLE_ACTIVITY_TARGET } from "./needleActivity.ts";
import { isNeedleRim, needleRimContact } from "./needleFlight.ts";
import { NEEDLE_CADENCE, needleTrackedObjective } from "./needleRuntime.ts";
import { shipBody } from "./shipBody.ts";
import { stationsNear } from "./stations.ts";
import { worldDelta, worldDistance, worldPoint } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

const built = BUILT as Set<GalaxyNumber>;
const present = built.has(4);
beforeAll(() => built.add(4));
afterAll(() => {
  if (!present) {
    built.delete(4);
  }
});
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function launch(seed?: number): GameModel {
  const model = new GameModel(
    CONTENT,
    seed === undefined ? supportEntropy : () => seed,
    SAVE_RESTORE,
  );
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [...GALAXY_NUMBERS] });
  for (const progress of Object.values(model.state.progress)) {
    progress.opened = true;
  }
  model.state.seenConversations.push(
    ...CONVERSATIONS.filter(({ trigger }) => trigger.kind === "lesson").map(({ id }) => id),
  );
  model.startGalaxy(4);
  return model;
}
function visit(model: GameModel, id: string): void {
  const flight = model.state.flight!;
  const point = flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
  expect(point, id).toBeDefined();
  flight.player = { x: point!.x, y: point!.y };
  flight.velocity = { x: 0, y: 0 };
  model.step(0.001, idle);
}
function learn(model: GameModel): void {
  visit(model, "elderLoom");
  model.dismissNotice();
  model.interact();
  const budget = CONVERSATIONS.reduce((sum, conversation) => sum + conversation.lines.length, 0);
  for (let line = 0; !model.state.dialogue && line < budget; line++) {
    expect(model.conversation).not.toBeNull();
    model.dismissConversation();
  }
  expect(model.state.dialogue?.context).toBe("needle.arrival");
  expect(interactionCopy(4, model.state.dialogue!).party).toBe("Elder Loom");
  model.choose("continue");
  expect(model.state.dialogue?.context).toBe("needle.practice");
  model.choose("continue");
  expect(model.state.dialogue?.context).toBe("needle.learning");
}

function completeEye(seed: number): GameModel {
  const model = launch(seed);
  const progress = model.state.progress[4];
  const flight = model.state.flight!;
  for (const galaxy of [1, 3] as const) {
    Object.assign(model.state.progress[galaxy], {
      holodisk: true,
      questComplete: true,
      resolved: true,
    });
  }
  Object.assign(progress.needle!, {
    approach: "independent",
    briefed: true,
    eyeLit: NEEDLE.eyeGates - 1,
    met: true,
    practiceLit: NEEDLE.practiceGates,
    practiceThanked: true,
  });
  const last = needleCourses(flight)!.eye.gates.at(-1)!;
  model.step(0.001, idle);
  expect(model.map?.places.some(({ id }) => id === NEEDLE_CADENCE.id)).toBe(false);
  expect(progress.capitalBoss).toBeUndefined();
  flight.player = {
    x: last.point.x - last.tangent.x * 0.1,
    y: last.point.y - last.tangent.y * 0.1,
  };
  flight.velocity = { x: last.tangent.x * 20, y: last.tangent.y * 20 };
  model.step(0.05, { ...idle, move: { x: last.tangent.x * 0.25, y: last.tangent.y * 0.25 } });
  expect(progress.needle?.eyeLit).toBe(NEEDLE.eyeGates);
  expect(progress.capitalBoss?.phase).toBe("active");
  expect(progress.holodisk).toBe(false);
  expect(model.flightLog).toEqual([]);
  expect(model.map?.places.find(({ id }) => id === NEEDLE_CADENCE.id)).toMatchObject({
    ...progress.capitalBoss!.site,
    label: "Crossbow",
    objective: false,
    optionalEncounter: true,
    travel: true,
  });
  endArrivalGrace(flight);
  return model;
}

function nearCrossbow(model: GameModel, distance: number) {
  const flight = model.state.flight!;
  const boss = capitalBossActor(flight, NEEDLE_CADENCE.id)!;
  const { x, y } = boss;
  flight.player = { x: x - distance, y };
  flight.velocity = { x: 0, y: 0 };
  worldSyncFlightRegion(flightWorldContext(flight), CONTENT, flight);
  expect(flight.objects).toContain(boss);
  return boss;
}

describe("Needle contextual Use and automatic guidance", () => {
  it("keeps the unavailable holodisk's refusal before the last Eye gate", () => {
    const model = launch(173);
    const progress = model.state.progress[4];
    Object.assign(progress.needle!, {
      approach: "independent",
      briefed: true,
      eyeLit: NEEDLE.eyeGates - 1,
      met: true,
      practiceLit: NEEDLE.practiceGates,
    });
    visit(model, "holodisk");
    model.dismissNotice();
    expect(model.useTarget).toEqual({ action: "use", id: "holodisk" });
    const before = model.useRefusals;
    const controls = new ControlState();
    controls.setUseAvailable(true);
    controls.requestUse();
    model.step(0.001, controls.sample());
    expect(model.useRefusals).toBe(before + 1);
    expect(model.state.notice).toBe("Start at the Eye’s green flag and clear its ten rings.");
    expect(model.state.dialogue).toBeNull();
    expect(progress).toMatchObject({
      holodisk: false,
      needle: { eyeLit: NEEDLE.eyeGates - 1, practiceLit: NEEDLE.practiceGates },
      questComplete: false,
    });
    model.step(0.001, controls.sample());
    expect(model.useRefusals).toBe(before + 1);
  });

  it.each([
    ["needlePractice", "practice", 0, 0, 0],
    ["needlePractice", "practice", 1, 0, 1],
    ["needleEye", "eye", NEEDLE.practiceGates, 0, 0],
    ["needleEye", "eye", NEEDLE.practiceGates, 2, 2],
  ] as const)(
    "approaches %s without offering Use, preserving its cleared rings across Continue (%s %s %s)",
    (id, course, practiceLit, eyeLit, ringIndex) => {
      const model = launch(173);
      const progress = model.state.progress[4];
      Object.assign(progress.needle!, {
        approach: "independent",
        briefed: true,
        eyeLit,
        met: true,
        practiceLit,
        practiceThanked: course === "eye",
      });
      const flight = model.state.flight!;
      const layout = needleCourses(flight)![course];
      const indicator = () => model.indicatorTargets.filter((target) => target.id === id);
      if (ringIndex === 0) {
        expect(indicator()).toEqual([{ ...layout.path[0]!, id, kind: "objective" }]);
      }
      visit(model, id);
      model.dismissNotice();
      expect(progress.known).toContain(id);
      expect(model.useTarget).toBeUndefined();
      expect(model.contextAction).toBeUndefined();
      expect(model.contextQuestDetails).toBeNull();
      expect(indicator()).toEqual([{ ...layout.gates[ringIndex]!.point, id, kind: "objective" }]);
      const before = structuredClone(progress);
      const at = { ...flight.player };
      const refusals = model.useRefusals;
      const controls = new ControlState();
      controls.setUseAvailable(true);
      controls.requestUse();
      model.step(0.001, controls.sample());
      expect(progress).toEqual(before);
      expect(flight.player).toEqual(at);
      expect(model.state.dialogue).toBeNull();
      expect(model.useRefusals).toBe(refusals);
      expect(controls.sample().use).toBe(false);
      const restored = relaunch(CONTENT, model.save());
      expect(
        needleTrackedObjective({
          content: CONTENT,
          flight: restored.state.flight!,
          progress: restored.state.progress[4],
        }),
      ).toEqual({ id, point: layout.gates[ringIndex]!.point, ringIndex, step: "ring" });
    },
  );

  it("opens collection once the last Eye gate is lit and awards the disk only on Continue", () => {
    const model = completeEye(173);
    const progress = model.state.progress[4];
    visit(model, "holodisk");
    expect(model.useTarget).toEqual({ action: "use", id: "holodisk" });
    const before = model.useRefusals;
    model.step(0.001, { ...idle, use: true });
    expect(model.state.dialogue?.context).toBe("needle.collect");
    expect(progress.holodisk).toBe(false);
    expect(model.useRefusals).toBe(before);
    model.choose("continue");
    expect(progress.holodisk).toBe(true);
    expect(model.useTarget?.id).not.toBe("holodisk");
  });
});

describe("Captain Cadence admission and outcome", () => {
  it("fires from the actual Crossbow and retains its clocks through Continue and a new flight", () => {
    let model = completeEye(173);
    let flight = model.state.flight!;
    const { id } = NEEDLE_CADENCE;
    // Admit Crossbow from outside firing view so the first mount opportunity survives the warning.
    const boss = nearCrossbow(model, 410);
    const definition = enemyEquipmentDefinition(4, boss.enemy!);
    const world = flightWorldContext(flight);
    const into = (angle: number) => ({ x: Math.cos(angle), y: Math.sin(angle) });
    const place = (heading: number, radius: number) => {
      const direction = into(heading);
      flight.player = { x: boss.x + direction.x * radius, y: boss.y + direction.y * radius };
      flight.velocity = { x: 0, y: 0 };
    };
    const phaser = definition.hardpoints.find(
      (part) => part.kind === "weapon" && part.fire.weapon === "phaser",
    );
    if (!phaser || phaser.kind !== "weapon") {
      throw new Error("Crossbow must have a Phaser hardpoint");
    }
    const tells = new Map<
      number,
      {
        beam: ReturnType<typeof activeEnemyBeams>[number];
        side: number;
      }
    >();
    const fired = new Set<number>();
    const warned = new Set<number>();
    const placement = questGuardPlacementContext(CONTENT, flight);
    const berthBlocked = (requireSight: boolean) => {
      const body = shipBody(flight.facing);
      const target = worldPoint(world, boss, flight.player);
      return flight.objects.some((object) => {
        if (object.hp <= 0 || (object.kind !== "rock" && object.kind !== "debris")) {
          return false;
        }
        const frame = placement.frameOf(object);
        const drawn = placement.drawnOf(object);
        if (
          requireSight &&
          worldSceneryBlocksSegment(world, object, boss, target, 0, frame, drawn)
        ) {
          return true;
        }
        return isNeedleRim(object)
          ? needleRimContact({ body, position: flight.player, world }, object) !== null
          : worldSceneryBodyContact(world, object, flight.player, body, frame, 0, drawn) !== null;
      });
    };
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(activeCrossbowSector(flight)?.phase).toBe("warning");
    expect(model.conversation).toMatchObject({
      speaker: "astra",
      text: "Crossbow fires to one side at a time. Look for the marked lane.",
    });
    for (let frame = 0; frame < 9 / SIMULATION_STEP_SECONDS && fired.size < 2; frame++) {
      const sector = activeCrossbowSector(flight)!;
      const side = Math.sign(sector.sector[0]);
      if (sector.phase === "warning") {
        warned.add(side);
      }
      const pending = activeEnemyBeams(flight).find(
        (beam) => beam.ownerId === id && beam.kind === "phaser" && !beam.fired,
      );
      const heading = pending
        ? sector.bearing
        : sector.bearing + (sector.sector[0] + sector.sector[1]) / 2;
      // Acquisition needs both a clear berth and sight through the live scenery.
      // Once a tell locks, move into the safe lane and check only the berth.
      const active = pending !== undefined || sector.phase === "active";
      let clear = false;
      if (active) {
        const radius = side > 0 ? 245 : 185;
        const berths = [0, -10, 10, -20, 20, -30, 30, -40, 40].map((offset) => radius + offset);
        const headings = pending
          ? [heading, heading - sector.laneHalfAngle / 2, heading + sector.laneHalfAngle / 2]
          : [heading];
        clear = headings.some((candidate) =>
          [...berths, 165, 145, 125, ...(pending ? [310, 350, 390] : [])].some((distance) => {
            place(candidate, distance);
            return !berthBlocked(!pending);
          }),
        );
      } else {
        place(heading, 540);
      }
      if (!pending) {
        const enemy = boss.enemy!;
        const mount = enemy.hardpoints.find(({ id }) => id === phaser.id)!;
        mount.aim = into(heading);
        const volley = Math.floor((enemy.age + mount.cooldown) / phaser.fire.interval);
        // Set up a legal drawn muzzle with enough room for the entire Phaser beam.
        for (let slot = 0; slot < 24; slot++) {
          const facing = into(heading + (slot * Math.PI) / 12);
          const line = enemyFireLine(
            definition,
            CONTENT.tuning.flight.shipRadius * 2,
            mount.id,
            volley,
            { ...enemy, facing },
          );
          if (!line) {
            continue;
          }
          const range = enemyBeamReach(
            { centre: sector.vertex, viewportHeight: SCREEN.height, viewportWidth: SCREEN.width },
            line,
          );
          if (
            range > 0 &&
            crossbowContainsAttack(world, sector, {
              from: line.origin,
              screenRadius: BEAM.halfWidth,
              travel: { x: line.aim.x * range, y: line.aim.y * range },
            })
          ) {
            enemy.facing = facing;
            break;
          }
        }
      }
      flight.shield = model.shieldMax;
      const centre = sector.vertex;
      model.step(SIMULATION_STEP_SECONDS, idle);
      for (const beam of activeEnemyBeams(flight)) {
        if (beam.kind !== "phaser" || beam.ownerId !== id) {
          continue;
        }
        const tell = tells.get(beam.volley);
        if (!tell) {
          expect(clear).toBe(true);
          expect(beam.fired).toBe(false);
          expect(beam.age).toBeLessThan(PHASER_AIM_SECONDS);
          expect(sector.phase).toBe("active");
          expect(sector.fireRemaining).toBeGreaterThan(PHASER_AIM_SECONDS);
          expect(beam.range).toBeCloseTo(
            enemyBeamReach(
              { centre, viewportHeight: SCREEN.height, viewportWidth: SCREEN.width },
              { aim: beam.direction, origin: beam.muzzle },
            ),
          );
          expect(
            crossbowContainsAttack(world, sector, {
              from: beam.muzzle,
              screenRadius: BEAM.halfWidth,
              travel: { x: beam.direction.x * beam.range, y: beam.direction.y * beam.range },
            }),
          ).toBe(true);
          tells.set(beam.volley, { beam: structuredClone(beam), side });
          continue;
        }
        const { direction, end, muzzle, range } = tell.beam;
        expect(beam).toMatchObject({ direction, end, muzzle, range });
        if (beam.fired && pending?.volley === beam.volley) {
          expect(clear).toBe(true);
          expect(side).toBe(tell.side);
          expect(sector.phase).toBe("active");
          expect(beam.age).toBeGreaterThanOrEqual(PHASER_AIM_SECONDS);
          const currentSector = activeCrossbowSector(flight)!;
          const offset = worldDelta(world, currentSector.vertex, flight.player);
          const lane = into(currentSector.bearing);
          expect(offset.x * lane.x + offset.y * lane.y).toBeGreaterThan(
            Math.hypot(offset.x, offset.y) * Math.cos(currentSector.laneHalfAngle),
          );
          expect(beam.impact).toBeUndefined();
          fired.add(side);
        }
      }
    }
    expect(warned).toEqual(new Set([1, -1]));
    expect(fired).toEqual(warned);
    expect(model.bossHud()).toMatchObject({
      captain: "Captain Cadence",
      hull: definition.hp,
      id,
      maxHull: definition.hp,
      ship: "Crossbow",
    });
    const clocks = structuredClone(boss.enemy!.hardpoints);
    expect(clocks.find(({ id }) => id === phaser.id)!.cooldown).toBeGreaterThan(0);
    model = relaunch(CONTENT, model.save());
    flight = model.state.flight!;
    expect(capitalBossActor(flight, id)?.enemy?.hardpoints).toEqual(clocks);
    visit(model, "holodisk");
    model.interact();
    expect(model.state.dialogue?.context).toBe("needle.collect");
    model.choose("continue");
    expect(model.state.progress[4].holodisk).toBe(true);
    expect(model.state.progress[4].capitalBoss?.phase).toBe("active");
    readStory(model);
    flight.dangerFor = 0;
    model.returnHome();
    expect(model.state.progress[4].capitalBoss?.phase).toBe("away");
    const parked = model.state.progress[4].capitalBoss;
    model = new GameModel(CONTENT, () => 301, SAVE_RESTORE, model.save());
    expect(model.state.progress[4].capitalBoss).toEqual(parked);
    model.startGalaxy(4);
    expect(model.state.progress[4].capitalBoss?.phase).toBe("active");
    expect(capitalBossActor(model.state.flight!, id)?.enemy?.hardpoints).toEqual(clocks);
    expect(model.flightLog).toEqual([]);
  });

  it.each(["salvaged", "defeated"] as const)(
    "records one %s transmission and names Archie only after the third memory",
    (outcome) => {
      let model = completeEye(1);
      const { id } = NEEDLE_CADENCE;
      const boss = nearCrossbow(model, 300);
      const flight = model.state.flight!;
      if (outcome === "salvaged") {
        const saved = model.saveDocument();
        const claim = saved.progress[4].capitalBoss!;
        if (claim.phase !== "active") {
          throw new Error("The legacy fixture must start at the admitted Crossbow encounter");
        }
        const savedBoss = saved.flight!.objects.find((object) => object.id === id)!;
        savedBoss.enemy!.disabled = true;
        savedBoss.enemy!.salvaged = true;
        savedBoss.enemy!.engaged = false;
        saved.progress[4].capitalBoss = { ...claim, outcome, phase: "resolved" };
        model = relaunch(CONTENT, saved);
        const paid = model.state.economy.stardust;
        model.step(0.001, idle);
        expect(model.state.economy.stardust).toBe(paid);
        expect(model.flightEvents).not.toContainEqual({ id, type: "enemyDestroyed" });
      } else {
        const shot = {
          damage: 1000,
          enemy: false,
          hitIds: flight.objects.filter((object) => object !== boss).map(({ id }) => id),
          id: "cadence-hull-hit",
          life: 1,
          piercing: false,
          velocity: { x: 0, y: 0 },
          x: boss.x,
          y: boss.y,
        };
        flight.shots.push(shot, { ...shot, id: "cadence-second-hit" });
        model.step(0.01, idle);
        expect(model.flightEvents.filter((event) => event.type === "enemyDestroyed")).toEqual([
          { id, type: "enemyDestroyed" },
        ]);
      }
      expect(model.state.progress[4].capitalBoss).toMatchObject({ outcome, phase: "resolved" });
      expect(model.bossHud()).toBeNull();
      expect(model.map?.places.some((place) => place.id === id)).toBe(false);
      const anonymous = [
        {
          id: `${id}:transmission`,
          text: "Orders from fleet command: Hold the exits. Recover every disk.",
        },
      ];
      expect(model.flightLog).toEqual(anonymous);
      model = relaunch(CONTENT, model.save());
      expect(model.flightLog).toEqual(anonymous);
      visit(model, "holodisk");
      model.interact();
      expect(model.state.dialogue?.context).toBe("needle.collect");
      model.choose("continue");
      expect(model.state.progress[4].holodisk).toBe(true);
      expect(model.flightLog).toEqual(anonymous);
      const legacyPendingMemory = JSON.parse(model.save()) as ReturnType<GameModel["saveDocument"]>;
      delete legacyPendingMemory.progress[4].needleMemoryRead;
      expect(relaunch(CONTENT, legacyPendingMemory).flightLog).toEqual(anonymous);
      model = relaunch(CONTENT, model.save());
      expect(model.flightLog).toEqual(anonymous);
      for (let page = 0; page < 8 && model.storyView?.page.id !== "holodisk:memory"; page++) {
        model.storyNext();
      }
      expect(model.storyView?.page.text).toBe(CONTENT.premise.holodisk.memories[2]);
      expect(model.flightLog).toEqual(anonymous);
      model.storyNext();
      expect(model.state.progress[4].needleMemoryRead).toBe(true);
      const revealed = [
        { ...anonymous[0]!, text: "Admiral Archie's orders: Hold the exits. Recover every disk." },
      ];
      expect(model.flightLog).toEqual(revealed);
      model = relaunch(CONTENT, model.save());
      expect(model.flightLog).toEqual(revealed);
      model.state.flight!.dangerFor = 0;
      model.returnHome();
      expect(model.state.flight).toBeNull();
      expect(model.state.progress[4].capitalBoss).toMatchObject({ outcome, phase: "resolved" });
      model.startGalaxy(4);
      expect(capitalBossActor(model.state.flight!, id)).toBeUndefined();
      expect(model.flightLog).toEqual(revealed);
    },
  );
});

describe("mounted Needle interactions", () => {
  it("restores completed shorter Needle courses and an already accepted task at the new payout", () => {
    const model = launch(173);
    learn(model);
    model.choose("independent");
    const flight = model.state.flight!;
    const disk = flight.objects.find(({ id }) => id === "holodisk")!;
    Object.assign(disk, {
      x: flight.needle!.anchor.x + NEEDLE.eyeOffset.x + NEEDLE.eye.holodisk[0]!,
      y: flight.needle!.anchor.y + NEEDLE.eyeOffset.y + NEEDLE.eye.holodisk[1]!,
    });
    Object.assign(model.state.progress[4].needle!, {
      eyeLit: 8,
      practiceLit: 3,
      practiceThanked: true,
    });
    const legacy = restoreSave(model.save());
    expect(legacy?.progress[4].needle).toMatchObject({ eyeLit: 10, practiceLit: 4 });
    const resumed = relaunch(CONTENT, legacy!);
    const current = resumed.state.flight!;
    expect(
      current.objects.find(({ id }) => id === "holodisk") ?? current.world.notables.holodisk,
    ).toMatchObject(needleCourses(current)!.eye.holodisk);
    Object.assign(resumed.state.progress[4], {
      holodisk: true,
      questComplete: true,
      resolved: true,
    });
    resumed.state.tasks[4] = {
      id: "threadNeedle",
      kind: "activity",
      lit: 6,
      place: "elderLoom",
      reward: 150,
    };
    expect(restoreSave(resumed.save())?.tasks[4]).toMatchObject({ lit: 6, reward: 50 });
  });

  it.each(["clean", "speed", "order"] as const)(
    "handles %s crossings in the 10-ring race through Use and Continue",
    (run) => {
      let model = launch(173);
      learn(model);
      model.choose("independent");
      Object.assign(model.state.progress[4], {
        holodisk: true,
        questComplete: true,
        resolved: true,
      });
      Object.assign(model.state.progress[4].needle!, {
        eyeLit: 10,
        practiceLit: 4,
        practiceThanked: true,
      });
      visit(model, "elderLoom");
      model.interact();
      model.choose("take");
      const story = structuredClone(model.state.progress[4].needle);
      const reward = model.state.economy.stardust + 200;
      const race = needleCourses(model.state.flight!)!.activity;
      const marker = () =>
        model.targetMarkers(GAME_AREA).find(({ id }) => id === NEEDLE_ACTIVITY_TARGET);
      const patrols = () =>
        stationPopulationObjects(model.state.flight!).filter(
          ({ id, kind }) => id.startsWith("needle:activity:patrol:") && kind === "enemy",
        );
      const cross = (gate: NeedleGate, speed = 20) => {
        const flight = model.state.flight!;
        flight.player = {
          x: gate.point.x - gate.tangent.x * 0.1,
          y: gate.point.y - gate.tangent.y * 0.1,
        };
        flight.velocity = { x: gate.tangent.x * speed, y: gate.tangent.y * speed };
        model.step(0.05, { ...idle, move: { x: gate.tangent.x * 0.25, y: gate.tangent.y * 0.25 } });
      };
      expect(model.trackedQuestId).toBe("activity:4:threadNeedle");
      expect(marker()).toMatchObject({ ...race.gates[0]!.point, trackedLabel: "Ring 1" });
      if (run !== "clean") {
        expect(model.conversation?.speaker).toBe("elderLoom");
        model.dismissConversation();
        cross(race.gates[run === "speed" ? 0 : 1]!, run === "speed" ? 150 : 20);
        expect(model.state.tasks[4]).toMatchObject({ cleanRun: false, lit: 0 });
        expect(marker()).toMatchObject({ trackedLabel: "Ring 1" });
        if (run === "speed") {
          expect(model.conversation).toMatchObject({
            speaker: "elderLoom",
            text: NEEDLE_LEARNING.tooFast,
          });
        } else {
          expect(model.conversation?.text).not.toBe(NEEDLE_LEARNING.tooFast);
        }
      }
      const admitted = new Set<string>();
      for (const [index, gate] of race.gates.entries()) {
        cross(gate);
        for (const actor of patrols()) {
          if (admitted.has(actor.id)) {
            continue;
          }
          admitted.add(actor.id);
          const world = flightWorldContext(model.state.flight!);
          const home = actor.enemy!.home;
          const hull = enemyPhysicalBody(ROUTE_POSITION[4], actor.enemy!);
          const radius = hull ? Math.max(actor.radius, partsReach(worldParts(hull))) : actor.radius;
          expect(["swarm", "fighter", "interceptor"]).toContain(actor.enemy!.archetype);
          expect(inNeedleChannel({ radius }, race, worldPoint(world, race.path[0]!, home))).toBe(
            false,
          );
          expect(
            race.gates.every(
              ({ point }) => worldDistance(world, home, point) > NEEDLE.gate.rim.outer + radius,
            ),
          ).toBe(true);
        }
        if (index < 9) {
          expect(model.state.tasks[4]).toMatchObject({ lit: index + 1 });
          expect(marker()).toMatchObject({
            ...race.gates[index + 1]!.point,
            trackedLabel: `Ring ${index + 2}`,
          });
        }
        if (index === 6) {
          const atSeven = marker()!;
          expect(model.markerDetails(atSeven)).toMatchObject({
            details: {
              quests: [
                {
                  id: "activity:4:threadNeedle",
                  line: {
                    objectives: expect.arrayContaining([
                      { checked: run === "clean", label: "Clean run" },
                    ]),
                    progress: "7 / 10",
                  },
                },
              ],
            },
            kind: "quest",
          });
          const before = structuredClone(patrols());
          const saved = model.save();
          expect(restoreSave(saved)).not.toBeNull();
          model = relaunch(CONTENT, saved);
          expect(model.state.tasks[4]).toMatchObject({ cleanRun: run === "clean", lit: 7 });
          expect(marker()).toMatchObject({ trackedLabel: "Ring 8" });
          expect(patrols()).toEqual(before);
        }
      }
      expect(admitted.size).toBe(4);
      expect(patrols()).toEqual([]);
      expect(model.state.tasks[4]).toBeUndefined();
      expect(model.state.economy.stardust).toBe(reward);
      expect(model.state.notice).toBe(
        run === "clean"
          ? "Job complete: +200 Stardust Clean run! Every ring on the first try."
          : "Job complete: +200 Stardust",
      );
      expect(model.state.progress[4].needle).toEqual(story);
      expect(marker()).toBeUndefined();
    },
  );

  it("lights and marks the race at the adjacent image across the galaxy seam", () => {
    const model = launch(173);
    const flight = model.state.flight!;
    const side = flight.topology!.side;
    const original = needleCourses(flight)!.activity.gates[0]!.point;
    const anchor = flight.needle!.anchor;
    flight.needle = {
      ...flight.needle!,
      anchor: { ...anchor, x: anchor.x - original.x + side / 2 + 0.1 },
    };
    Object.assign(model.state.progress[4], { holodisk: true, questComplete: true, resolved: true });
    model.state.tasks[4] = {
      id: "threadNeedle",
      kind: "activity",
      lit: 0,
      place: "elderLoom",
      reward: ACTIVITIES[4]!.reward!,
    };
    const first = needleCourses(flight)!.activity.gates[0]!;
    flight.player = wrapPoint(side, {
      x: first.point.x - first.tangent.x * 0.4,
      y: first.point.y - first.tangent.y * 0.4,
    });
    flight.velocity = { x: first.tangent.x * 30, y: first.tangent.y * 30 };
    expect(flight.player.x).toBeGreaterThan(side / 2 - 1);
    expect(
      model.targetMarkers(GAME_AREA).find(({ id }) => id === NEEDLE_ACTIVITY_TARGET),
    ).toMatchObject({ onScreen: true, trackedLabel: "Ring 1" });
    model.step(0.05, { ...idle, move: { x: first.tangent.x * 0.25, y: first.tangent.y * 0.25 } });
    expect(flight.player.x).toBeLessThan(-side / 2 + 2);
    expect(model.state.tasks[4]).toMatchObject({ lit: 1 });
    expect(
      model.targetMarkers(GAME_AREA).find(({ id }) => id === NEEDLE_ACTIVITY_TARGET),
    ).toMatchObject({ trackedLabel: "Ring 2" });
  });

  it("requires an actual learning choice and retains it through Close, save and Continue", () => {
    const model = launch();
    learn(model);
    const choice = structuredClone(model.state.dialogue);
    expect(choice?.choices.map(({ id }) => id)).toEqual(["show", "feedback", "independent"]);
    model.choose("continue");
    expect(model.state.dialogue).toEqual(choice);
    expect(model.state.progress[4].needle?.approach).toBeUndefined();
    model.closeInteraction();
    const saved = model.save();
    expect(restoreSave(saved)).not.toBeNull();
    const loaded = relaunch(CONTENT, saved);
    loaded.interact();
    expect(loaded.state.dialogue).toEqual(choice);
    expect(loaded.state.progress[4].needle?.approach).toBeUndefined();
    loaded.choose("show");
    expect(loaded.state.progress[4].needle?.approach).toBe("show");
    expect(
      needleTrackedObjective({
        content: CONTENT,
        flight: loaded.state.flight!,
        progress: loaded.state.progress[4],
      })?.step,
    ).toBe("flag");
    expect(loaded.state.flight!.needle!.chatter).toHaveLength(1);
    expect(loaded.saveDocument().flight!.needle!.chatter).toEqual([]);
    expect(loaded.state.flight!.needle!.chatter).toHaveLength(1);
    loaded.step(0.001, idle);
    expect(loaded.state.flight!.needle!.chatter).toEqual([]);
    expect(relaunch(CONTENT, loaded.save()).state.progress[4].needle?.approach).toBe("show");
  });

  it("allows travel to the discovered disk but commits Collect only after all ten Eye gates", () => {
    const model = launch();
    learn(model);
    model.choose("independent");
    visit(model, "holodisk");
    expect(model.state.progress[4].known).toContain("holodisk");
    const marker = model.map!.places.find(({ id }) => id === "holodisk")!;
    expect(marker.travel).toBe(true);
    model.interact();
    expect(model.state.progress[4].holodisk).toBe(false);
    model.state.flight!.player = { x: marker.x + CONTENT.tuning.talkRange * 2, y: marker.y };
    model.state.economy.stardust = 50;
    expect(model.canTeleport("holodisk")).toBe(true);
    expect(model.teleport("holodisk")).toBe(true);
    expect(model.state.flight!.player).toEqual({ x: marker.x, y: marker.y });
    expect(model.state.economy.stardust).toBe(0);
    expect(model.state.progress[4]).toMatchObject({ holodisk: false, questComplete: false });
    expect(model.state.dialogue).toBeNull();
    model.interact();
    expect(model.state.progress[4].holodisk).toBe(false);
    Object.assign(model.state.progress[4].needle!, {
      eyeLit: 10,
      practiceLit: 4,
      practiceThanked: true,
    });
    model.interact();
    expect(model.state.dialogue?.context).toBe("needle.collect");
    const copy = interactionCopy(4, model.state.dialogue!);
    expect(copy.party).toBe("Astra");
    expect(model.state.progress[4]).toMatchObject({ holodisk: false, questComplete: false });
    model.closeInteraction();
    const loaded = relaunch(CONTENT, model.save());
    loaded.interact();
    expect(loaded.state.dialogue?.context).toBe("needle.collect");
    const stardust = loaded.state.economy.stardust;
    loaded.choose("continue");
    expect(loaded.state.progress[4]).toMatchObject({ holodisk: true, questComplete: true });
    expect(loaded.state.dialogue?.context).toBe("holodiskMoment");
    loaded.choose("continue");
    expect(loaded.state.economy.stardust).toBe(stardust);
    readStory(loaded);
    visit(loaded, "elderLoom");
    expect(loaded.inDanger).toBe(false);
    loaded.returnHome();
    const resolution = readStory(loaded);
    expect(
      resolution.some(
        ({ speaker, text }) => speaker === "Dad" && text === "Sounding better every day.",
      ),
    ).toBe(true);
    expect(loaded.state.progress[4].resolved).toBe(true);
  });

  it("offers the real repeatable task and optional help without forcing a different approach", () => {
    const model = launch();
    learn(model);
    model.choose("feedback");
    Object.assign(model.state.progress[4], { holodisk: true, questComplete: true, resolved: true });
    Object.assign(model.state.progress[4].needle!, {
      eyeLit: 10,
      practiceLit: 4,
      practiceThanked: true,
    });
    visit(model, "elderLoom");
    model.interact();
    expect(model.state.dialogue?.context).toBe("activity:elderLoom");
    expect(model.state.dialogue?.choices.map(({ id }) => id)).toEqual([
      "take",
      "skip",
      "changeApproach",
    ]);
    model.choose("changeApproach");
    expect(model.state.dialogue?.context).toBe("needle.learningChange");
    expect(model.state.tasks[4]).toBeUndefined();
    expect(model.state.progress[4].needle!.approach).toBe("feedback");
    model.choose("independent");
    expect(model.state.progress[4].needle!.approach).toBe("independent");
    model.interact();
    model.choose("take");
    expect(model.state.tasks[4]).toMatchObject({ id: "threadNeedle", kind: "activity", lit: 0 });
    const progress = structuredClone(model.state.progress[4].needle);
    model.interact();
    expect(model.state.dialogue?.context).toBe("activityActive:elderLoom");
    expect(model.state.dialogue?.choices).toContainEqual({
      id: "continue",
      label: "Keep activity",
    });
    const activity = model.state.tasks[4];
    model.choose("continue");
    expect(model.state.dialogue).toBeNull();
    expect(model.state.tasks[4]).toBe(activity);
    model.interact();
    model.choose("drop");
    expect(model.state.dialogue?.context).toBe("activityDrop");
    expect(model.state.tasks[4]).toBeDefined();
    model.choose("confirmDrop");
    expect(model.state.tasks[4]).toBeUndefined();
    expect(model.state.progress[4].needle).toEqual(progress);
  });

  it("rejects invented Needle namespaces and preserves ordinary station Dock", () => {
    const model = launch();
    const saved = JSON.parse(model.save()) as { progress: Record<number, Record<string, unknown>> };
    saved.progress[1]!.needle = saved.progress[4]!.needle;
    expect(restoreSave(saved)).toBeNull();
    delete saved.progress[1]!.needle;
    (saved.progress[4]!.needle as { eyeLit: number }).eyeLit = 9;
    expect(restoreSave(saved)).toBeNull();
    const station = stationsNear(ECONOMY, 4, 40000, model.state.flight!.player)[0]!;
    ensureStation(CONTENT, station.id, model.state.flight!);
    visit(model, station.id);
    expect(model.contextAction).toBe("dock");
    model.interact();
    expect(model.state.docked).toBe(station.id);
  });
});
