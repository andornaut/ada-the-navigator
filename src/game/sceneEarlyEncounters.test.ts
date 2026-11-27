import { expect, it } from "vitest";

import { FALLBACK_SPACE_PALETTE } from "../art/index.ts";
import { NEEDLE_CADENCE, WHIRLPOOL_CAPITAL_BOSS } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { toScreen } from "../model/convex.ts";
import { createUnpopulatedFlight, spawnChapterEnemy } from "../model/flight.ts";
import { CURRENT_FLIGHT_TOPOLOGY } from "../model/flightTopology.ts";
import type { Vec } from "../model/types.ts";
import { drawEarlyEncounters } from "./sceneEarlyEncounters.ts";

function surface(player: Vec = { x: 0, y: 0 }) {
  const segments: number[][] = [];
  const overlay = {
    lineBetween: (...coords: number[]) => segments.push(coords),
    lineStyle: () => {},
  };
  const project = (point: Vec) => {
    const screen = toScreen({ x: point.x - player.x, y: point.y - player.y });
    return { x: 360 + screen.x, y: 180 + screen.y };
  };
  return { scene: { overlay, palette: FALLBACK_SPACE_PALETTE, project }, segments };
}

it("draws Manta's admitted active crossing and leaves a gap for reposition or a missing escort", () => {
  const flight = createUnpopulatedFlight(CONTENT, 3, 173);
  const at = { x: 0, y: 0 };
  const leader = spawnChapterEnemy(CONTENT, "capital", WHIRLPOOL_CAPITAL_BOSS.id, at, flight)!;
  const escort = spawnChapterEnemy(CONTENT, "fighter", `${leader.id}:escort:0`, at, flight)!;
  const plan = {
    courses: [
      { entry: { x: 0, y: 10 }, exit: { x: 40, y: 10 }, station: { x: 0, y: 10 } },
      { entry: { x: 40, y: -10 }, exit: { x: 0, y: -10 }, station: { x: 40, y: -10 } },
    ],
    elapsed: 1.5,
    kind: "manta",
  } as const;
  leader.enemy!.earlyEncounter = plan;
  flight.objects = [leader, escort];
  const { scene, segments } = surface();
  drawEarlyEncounters(scene, flight);
  expect(segments).toContainEqual([350, 185, 390, 205]);
  segments.length = 0;
  leader.enemy!.earlyEncounter = { ...plan, elapsed: 3.5 };
  drawEarlyEncounters(scene, flight);
  expect(segments).toEqual([]);
  leader.enemy!.earlyEncounter = plan;
  flight.objects = [leader];
  drawEarlyEncounters(scene, flight);
  expect(segments).toEqual([]);
  delete leader.enemy!.earlyEncounter;
  flight.objects = [leader, escort];
  drawEarlyEncounters(scene, flight);
  expect(segments).toEqual([]);
});

it("keeps both Crossbow lane rails fixed while the warning and firing sector change shape", () => {
  const flight = createUnpopulatedFlight(CONTENT, 4, 173);
  flight.needle = { anchor: { x: 200, y: 300 } } as NonNullable<typeof flight.needle>;
  const boss = spawnChapterEnemy(CONTENT, "capital", NEEDLE_CADENCE.id, { x: 0, y: 0 }, flight)!;
  flight.objects = [boss];
  const { scene, segments } = surface();
  const paint = (elapsed: number) => {
    boss.enemy!.earlyEncounter = { elapsed, kind: "crossbow" };
    segments.length = 0;
    drawEarlyEncounters(scene, flight);
    return [...segments];
  };
  const warning = paint(0.5);
  const active = paint(2);
  const crossing = paint(4.5);
  const next = paint(5.5);
  expect(crossing).toHaveLength(4);
  expect(warning.slice(0, 4)).toEqual(crossing);
  expect(active.slice(0, 4)).toEqual(crossing);
  expect(next.slice(0, 4)).toEqual(crossing);
  expect(warning.length).toBeGreaterThan(active.length);
  expect(next[4]).not.toEqual(warning[4]);
});

it("marks the prepared Cartwheel bypass only after warning and keeps one world image at the seam", () => {
  const flight = createUnpopulatedFlight(CONTENT, 2, 173);
  flight.topology = CURRENT_FLIGHT_TOPOLOGY;
  flight.player = { x: 89970, y: 0 };
  const entry = { x: -89960, y: 0 };
  const exit = { x: -89830, y: 0 };
  const actor = spawnChapterEnemy(CONTENT, "fighter", "patrol:0", entry, flight)!;
  flight.objects = [actor];
  const patrol = {
    actors: [actor.id],
    plan: {
      allocationId: "patrol",
      anchor: entry,
      approach: [entry, exit],
      bypass: [entry, exit],
      coverIds: ["moving:a", "moving:b"],
      fieldId: "ore",
      homes: [entry],
    },
  } as const;
  flight.cartwheelMiningPatrol = patrol;
  const { scene, segments } = surface(flight.player);
  drawEarlyEncounters(scene, flight);
  expect(segments).toEqual([]);

  flight.cartwheelMiningPatrol = { ...patrol, warnedAt: 0 };
  drawEarlyEncounters(scene, flight);
  expect(segments.length).toBeGreaterThan(4);
  expect(segments.some(([, , x, y]) => x === 560 && y === 280)).toBe(true);
  expect(segments.every((line) => line.every((coordinate) => Math.abs(coordinate) < 720))).toBe(
    true,
  );

  segments.length = 0;
  actor.hp = 0;
  drawEarlyEncounters(scene, flight);
  expect(segments).toEqual([]);
});
