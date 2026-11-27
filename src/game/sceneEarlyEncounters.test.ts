import { expect, it } from "vitest";

import { FALLBACK_SPACE_PALETTE } from "../art/spacePalette.ts";
import { NEEDLE_CADENCE, WHIRLPOOL_CAPITAL_BOSS } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { toScreen } from "../model/convex.ts";
import { createUnpopulatedFlight, spawnChapterEnemy } from "../model/flight.ts";
import type { Vec } from "../model/types.ts";
import { drawEarlyEncounters } from "./sceneEarlyEncounters.ts";

function surface() {
  const segments: number[][] = [];
  const overlay = {
    lineBetween: (...coords: number[]) => segments.push(coords),
    lineStyle: () => {},
  };
  const project = (point: Vec) => {
    const screen = toScreen(point);
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
