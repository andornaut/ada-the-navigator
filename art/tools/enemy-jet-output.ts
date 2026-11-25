import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

import { selectEnemyJetPalette } from "../../src/game/enemyJetPalette.ts";
import { readManifest, type Sidecars } from "./manifest.ts";

const families = {
  core: "coral",
  andromeda: "garnet",
  cartwheel: "claim",
  needle: "needle",
} as const;
type Owner = keyof typeof families;

const sharedCrafts = new Set([
  "capital",
  "capitalCompact",
  "capitalNarrow",
  "fighter",
  "frigate",
  "frigateCompact",
  "frigateNarrow",
  "hostileStation",
  "interceptor",
  "retaliator",
  "retaliatorMiningFreighter",
  "swarm",
]);

type Selected = { path: string; content: string };
type JetPayload = {
  familyColors: unknown;
  layers: ({ name: "outer" | "core" } & Record<string, unknown>)[];
} & Record<string, unknown>;

export function installedEnemyJetOutput() {
  const owners = Object.keys(families) as Owner[];
  const sidecars = new Map(
    owners.map((owner) => [owner, (readManifest(owner).sidecars ?? {}) as Sidecars]),
  );
  const shared = new Map<string, Selected>();
  for (const craft of sharedCrafts) {
    const path = `/art/enemies/${craft}-jets.json`;
    const expected =
      craft === "hostileStation" ? owners.filter((owner) => owner !== "needle") : owners;
    const names = craft === "retaliator" ? [craft, "retaliatorCargoHauler"] : [craft];
    const selected = expected.some(
      (owner) =>
        owner !== "core" && names.some((name) => sidecars.get(owner)?.[name]?.jets === path),
    );
    if (!selected) continue;
    if (
      expected.some((owner) => names.some((name) => sidecars.get(owner)?.[name]?.jets !== path))
    ) {
      throw new Error(`Incomplete shared enemy jet selection: ${craft}`);
    }
    // The installed packed body is the family-palette input. A writer validates its normal
    // output against it before preserving the shared path or re-emitting the core body.
    const content = readFileSync(new URL(`../../public${path}`, import.meta.url), "utf8");
    const data = JSON.parse(content) as JetPayload;
    if (
      !Object.hasOwn(data, "familyColors") ||
      expected.some((owner) => !selectEnemyJetPalette(families[owner], data))
    ) {
      throw new Error(`Invalid or incomplete installed enemy jet palettes: ${path}`);
    }
    for (const name of names) shared.set(`${name}-jets.json`, { path, content });
  }

  return (owner: Owner, file: string, generated: string): Selected | undefined => {
    const selected = shared.get(file);
    if (!selected) return undefined;
    const { path, content } = selected;
    const name = file.slice(0, -"-jets.json".length);
    if (sidecars.get(owner)?.[name]?.jets !== path) return undefined;
    const data = JSON.parse(content) as JetPayload;
    const palette = selectEnemyJetPalette(families[owner], data);
    if (!palette) throw new Error(`Invalid ${owner} jet palette in ${path}`);
    const { familyColors, ...base } = data;
    void familyColors;
    const reconstructed = {
      ...base,
      layers: data.layers.map((layer) => ({ ...layer, colors: palette[layer.name] })),
    };
    if (!isDeepStrictEqual(JSON.parse(generated), reconstructed)) {
      throw new Error(`Generated ${owner} jet sidecar differs from the selected payload: ${file}`);
    }
    return selected;
  };
}
