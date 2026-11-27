import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import {
  type EnemyDefinition,
  enemyDefinition,
  PHANTOM_FLAGSHIP_ID,
} from "../data/enemyCatalog.ts";
import { weaponAt } from "../data/weaponCatalog.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { playOpening, supportEntropy } from "../testing/launch.ts";
import { createEnemy, type EnemyContext, type EnemyState, stepEnemy } from "./enemyAi.ts";
import { GameModel } from "./game.ts";

function fixture(archetype: "capital" | "frigate" = "frigate", flagship = false) {
  const galaxy = flagship ? 6 : 1;
  const id = flagship ? PHANTOM_FLAGSHIP_ID : `phase:${archetype}`;
  const definition = enemyDefinition(galaxy, archetype, id);
  const state = createEnemy(
    definition,
    { archetype, id, packId: null, phase: 0 },
    { x: 300, y: 0 },
  );
  state.engaged = true;
  // Its nose on Ada, so the front Lasers' clocks run with the mounts'.
  state.facing = { x: -1, y: 0 };
  return { definition, state };
}
function context(state: EnemyState, dt = 0.01): EnemyContext {
  return {
    adaWidth: CONTENT.tuning.flight.shipRadius * 2,
    dt,
    inPlayView: true,
    initialPackSizes: {},
    lead: 1,
    peers: [state],
    player: { x: 0, y: 0 },
    playerVelocity: { x: 0, y: 0 },
    routePosition: 1,
    targetable: true,
    visibility: "visible",
  };
}
/** The weapons in phase order: the mounts in fill order, then the front Lasers. */
function mounts(definition: EnemyDefinition) {
  return [
    ...definition.mounts!.fill.flatMap((id) => {
      const part = definition.hardpoints.find((part) => part.id === id);
      return part?.kind === "weapon" ? [part] : [];
    }),
    ...definition.hardpoints.flatMap((part) =>
      part.kind === "weapon" && part.fixed ? [part] : [],
    ),
  ];
}

describe("heavy fire clocks", () => {
  it("leaves a full warning between the flagship's paired lances", () => {
    const { definition, state } = fixture("capital", true);
    const next = stepEnemy(definition, context(state), state);
    const lances = next.fire.filter(({ weapon }) => weapon === "chargedLance");
    expect(lances.map(({ hardpointId }) => hardpointId)).toEqual(["weapon-left"]);
    const cooldown = (hardpoint: string) =>
      next.state.hardpoints.find(({ id }) => id === hardpoint)!.cooldown;
    expect(cooldown("claw-right")).toBeCloseTo(0.99, 9);
    expect(cooldown("weapon-left") - cooldown("claw-right")).toBeCloseTo(1, 9);
  });

  it.each(["frigate", "capital", "flagship"] as const)(
    "starts %s phases at first eligibility using each mount's own interval",
    (kind) => {
      const { definition, state } = fixture(
        kind === "frigate" ? "frigate" : "capital",
        kind === "flagship",
      );
      const held = stepEnemy(definition, { ...context(state, 0.2), visibility: "occluded" }, state);
      expect(held.state.firePhasesInitialized).toBeUndefined();
      expect(held.state.hardpoints.map((part) => part.cooldown)).toEqual(
        state.hardpoints.map((part) => part.cooldown),
      );
      const first = stepEnemy(definition, context(held.state), held.state);
      expect(first.state.firePhasesInitialized).toBe(true);
      const ordered = mounts(definition);
      expect(new Set(first.fire.map((shot) => shot.hardpointId))).toEqual(
        new Set([ordered[0]!.id]),
      );
      ordered.forEach((part, index) => {
        const remaining = first.state.hardpoints.find((value) => value.id === part.id)!.cooldown;
        expect(remaining).toBeCloseTo(
          (index ? index / ordered.length : 1) * part.fire.interval - 0.01,
          9,
        );
      });
      expect(state.firePhasesInitialized).toBeUndefined();
    },
  );

  it.each([
    [5, 6, 0.35, 3],
    [2, 7, 0.45, 2],
    [6, 8, 0.45, 2],
  ] as const)(
    "phases and pauses the actual station tier in galaxy %i",
    (galaxy, count, share, ringInterval) => {
      const definition = enemyDefinition(galaxy, "hostileStation", "phased-station", 3);
      const state = createEnemy(
        definition,
        {
          archetype: "hostileStation",
          id: "phased-station",
          packId: null,
          phase: 0,
          weaponLevel: 3,
        },
        { x: 300, y: 0 },
      );
      state.engaged = true;
      const ineligible = { ...context(state, 0.2), targetable: false };
      const before = stepEnemy(definition, ineligible, state);
      expect(before.state.firePhasesInitialized).toBeUndefined();
      expect(before.fire).toEqual([]);
      const first = stepEnemy(definition, context(before.state), before.state);
      expect(first.state.firePhasesInitialized).toBe(true);
      expect(first.fire.map(({ hardpointId }) => hardpointId)).toEqual(["weapon-0"]);
      expect(first.state.hardpoints).toHaveLength(count);
      for (const [index, mount] of first.state.hardpoints.entries()) {
        expect(mount.id).toBe(`weapon-${index}`);
        const interval =
          index === 5 ? ringInterval : weaponAt("rapidMissile", 3).intervalSeconds / share;
        expect(mount.cooldown).toBeCloseTo((index ? index / count : 1) * interval - 0.01, 9);
      }
      first.state.hardpoints[0]!.hp = 0;
      const paused = stepEnemy(
        definition,
        { ...context(first.state, 0.3), visibility: "occluded" },
        first.state,
      );
      expect(paused.fire).toEqual([]);
      expect(paused.state.hardpoints.map(({ cooldown }) => cooldown)).toEqual(
        first.state.hardpoints.map(({ cooldown }) => cooldown),
      );
      const ringWait = paused.state.hardpoints[5]!.cooldown;
      const resumed = stepEnemy(definition, context(paused.state, ringWait + 0.001), paused.state);
      const ring = resumed.fire.filter(({ weapon }) => weapon === "ringBurst");
      expect(ring).toHaveLength(8);
      expect(ring.map(({ delay, hardpointId }) => ({ delay, hardpointId }))).toEqual(
        Array.from({ length: 8 }, () => ({ delay: ringWait, hardpointId: "weapon-5" })),
      );
    },
  );

  it.each(["occluded", "unknown", "untargetable", "out-of-range", "summoned"] as const)(
    "suspends initialized clocks while %s",
    (reason) => {
      const { definition, state } = fixture();
      const first = stepEnemy(definition, context(state), state).state;
      const observation = context(first, 0.25);
      if (reason === "occluded" || reason === "unknown") {
        observation.visibility = reason;
      }
      if (reason === "untargetable") {
        observation.targetable = false;
      }
      if (reason === "out-of-range") {
        observation.player = { x: -definition.engagement - 1000, y: 0 };
      }
      if (reason === "summoned") {
        observation.summoned = true;
      }
      const held = stepEnemy(definition, observation, first);
      expect(held.fire).toEqual([]);
      expect(held.state.hardpoints.map(({ burst, cooldown }) => ({ burst, cooldown }))).toEqual(
        first.hardpoints.map(({ burst, cooldown }) => ({ burst, cooldown })),
      );
      expect(held.state.firePhasesInitialized).toBe(true);
    },
  );

  it("does not reindex or reseed surviving mounts after a weapon is disabled", () => {
    const { definition, state } = fixture();
    const ordered = mounts(definition);
    const first = stepEnemy(definition, context(state), state).state;
    first.hardpoints.find((part) => part.id === ordered[0]!.id)!.hp = 0;
    const survivor = first.hardpoints.find((part) => part.id === ordered[1]!.id)!;
    const wait = survivor.cooldown;
    const next = stepEnemy(definition, context(first, wait + 0.001), first);
    expect(next.fire).toHaveLength(ordered[1]!.fire.angles.length);
    expect(next.fire.every((shot) => shot.hardpointId === survivor.id)).toBe(true);
    expect(next.fire[0]!.delay).toBeCloseTo(wait, 9);
  });

  it("allows later mixed-period coincidences without a global volley lock", () => {
    const { definition, state } = fixture();
    state.firePhasesInitialized = true;
    const first = stepEnemy(definition, context(state), state);
    expect(new Set(first.fire.map((shot) => shot.hardpointId))).toEqual(
      new Set(mounts(definition).map((part) => part.id)),
    );
    expect(first.fire.every((shot) => shot.delay === 0)).toBe(true);
  });

  it("preserves legacy active clocks without introducing a new phase on resume", () => {
    const { definition, state } = fixture();
    for (const part of state.hardpoints) {
      part.cooldown = 0.37;
    }
    const resumed = stepEnemy(definition, context(state), state);
    expect(resumed.state.firePhasesInitialized).toBe(true);
    expect(resumed.fire).toEqual([]);
    for (const part of mounts(definition)) {
      expect(resumed.state.hardpoints.find((value) => value.id === part.id)!.cooldown).toBeCloseTo(
        0.36,
      );
    }
  });

  it("keeps scheduled firing times independent of frame partition", () => {
    const { definition } = fixture();
    const run = (dt: number) => {
      let state = fixture().state;
      const fired: { mount: string | null; time: number }[] = [];
      for (let elapsed = 0; elapsed < 3.4 - 1e-9; elapsed += dt) {
        const result = stepEnemy(definition, context(state, dt), state);
        fired.push(
          ...result.fire.map((shot) => ({
            mount: shot.hardpointId,
            time: Number((elapsed + shot.delay).toFixed(8)),
          })),
        );
        state = result.state;
      }
      return fired.sort(
        (a, b) => a.time - b.time || String(a.mount).localeCompare(String(b.mount)),
      );
    };
    expect(run(0.2)).toEqual(run(0.01));
  });

  it("preserves a partial burst across ineligible time and a validated save", () => {
    const { definition: original, state } = fixture();
    const firstMount = mounts(original)[0]!;
    // The existing burst API is exercised without changing any production profile.
    const definition: EnemyDefinition = {
      ...original,
      hardpoints: original.hardpoints.map((part) =>
        part.kind === "weapon" && part.id === firstMount.id
          ? { ...part, fire: { ...part.fire, burst: { count: 3, gap: 0.05 } } }
          : part,
      ),
    };
    const first = stepEnemy(definition, context(state), state).state;
    const held = stepEnemy(definition, { ...context(first, 0.2), targetable: false }, first).state;
    expect(held.hardpoints.find((part) => part.id === firstMount.id)).toMatchObject({
      burst: 1,
      cooldown: 0.04,
    });
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.startGalaxy(1);
    playOpening(model);
    model.state.flight!.objects = [
      {
        ...held.position,
        enemy: held,
        hp: held.hp,
        id: held.id,
        kind: "enemy",
        radius: original.sizeRatio * CONTENT.tuning.flight.shipRadius,
      },
    ];
    const saved = JSON.parse(model.save());
    const restored = restoreSave(saved)!;
    expect(restored).not.toBeNull();
    const enemy = restored.flight!.objects[0]!.enemy!;
    expect(enemy.firePhasesInitialized).toBe(true);
    expect(enemy.hardpoints).toEqual(held.hardpoints);
    expect(stepEnemy(definition, context(enemy, 0.05), enemy)).toEqual(
      stepEnemy(definition, context(held, 0.05), held),
    );
    for (const invalid of [false, 1, "initialized"]) {
      const bad = structuredClone(saved);
      bad.flight.objects[0].enemy.firePhasesInitialized = invalid;
      expect(restoreSave(bad)).toBeNull();
    }
    delete saved.flight.objects[0].enemy.firePhasesInitialized;
    expect(restoreSave(saved)).not.toBeNull();
  });

  it("leaves platform clocks continuous", () => {
    const archetype = "platform";
    const definition = enemyDefinition(6, archetype, "continuous-clock");
    const state = createEnemy(
      definition,
      { archetype, id: "continuous-clock", packId: null, phase: 0 },
      { x: 300, y: 0 },
    );
    for (const part of state.hardpoints) {
      part.cooldown = 0.3;
    }
    const next = stepEnemy(definition, { ...context(state, 0.1), targetable: false }, state);
    expect(next.state.firePhasesInitialized).toBeUndefined();
    for (const part of definition.hardpoints.filter((part) => part.kind === "weapon")) {
      expect(next.state.hardpoints.find((value) => value.id === part.id)!.cooldown).toBeCloseTo(
        0.2,
      );
    }
  });
});
