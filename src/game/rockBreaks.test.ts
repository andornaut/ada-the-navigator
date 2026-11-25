import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { ASTEROID_ART, type AsteroidArt } from "../data/asteroidCatalog.ts";
import { rockFrame } from "../model/asteroids.ts";
import type { FlightEvent } from "../model/types.ts";
import { drawnRockId, rockArt } from "./asteroidArt.ts";

// Execute the production break start without starting Phaser's DOM renderer.
const source = ts.createSourceFile(
  "sceneEffects.ts",
  readFileSync(new URL("./sceneEffects.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const startCode = source.statements
  .filter((node) => ts.isFunctionDeclaration(node) && node.name?.text === "startRockBreaks")
  .map((node) => node.getText(source).replace(/^export /u, ""))
  .join("\n");

interface Break {
  readonly art: AsteroidArt;
  readonly frame: number;
  readonly id: string;
}

function startBreaks(events: readonly FlightEvent[]): Break[] {
  const context = createContext({ drawnRockId, rockArt, rockFrame });
  runInContext(
    ts.transpileModule(startCode, { compilerOptions: { target: ts.ScriptTarget.ES2023 } })
      .outputText,
    context,
  );
  const scene = {
    asteroidArt: ASTEROID_ART,
    model: { flightEvents: events, state: { flight: { seed: 314, time: 12.5 } } },
    reducedMotion: false,
    rockBreaks: [] as Break[],
  };
  (context.startRockBreaks as (scene: unknown, nowMs: number) => void)(scene, 1000);
  return scene.rockBreaks;
}

describe("rock breaks", () => {
  it("break a crystal rock as its variant and a plain rock as itself, in the frame they showed", () => {
    const destroyed = (asteroid: string, crystals?: "full" | "small"): FlightEvent => ({
      asteroid,
      ...(crystals ? { crystals } : {}),
      id: `rock:${asteroid}:${crystals ?? "plain"}`,
      type: "asteroidDestroyed",
      x: 10,
      y: 20,
    });
    const breaks = startBreaks([
      destroyed("asteroid-m3", "full"),
      destroyed("asteroid-l2", "small"),
      destroyed("asteroid-m3"),
    ]);
    expect(breaks.map((entry) => entry.art.id)).toEqual([
      "asteroid-m3-crystals-full",
      "asteroid-l2-crystals-small",
      "asteroid-m3",
    ]);
    for (const entry of breaks) {
      const plain = rockArt(entry.art.id.replace(/-crystals-(?:small|full)$/u, ""))!;
      expect(entry.frame).toBe(rockFrame(plain, 314, false, entry.id, 12.5));
    }
  });
});
