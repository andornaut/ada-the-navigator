import { readShipJets, type ShipJets } from "../art/index.ts";

const regionalFamilies = ["claim", "garnet", "needle"] as const;
export type EnemyJetFamily = "coral" | (typeof regionalFamilies)[number];

type ColorRamp = [string, string];
type EnemyJetPalette = { core: ColorRamp; outer: ColorRamp };

const fields = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

function colorRamp(value: unknown): ColorRamp | undefined {
  const color = (entry: unknown): entry is string =>
    typeof entry === "string" && /^#[0-9a-f]{6}$/iu.test(entry);
  return Array.isArray(value) && value.length === 2 && color(value[0]) && color(value[1])
    ? [value[0], value[1]]
    : undefined;
}

/** Selects the named outer/core ramps used by the enemy renderer and Art's profile exporter. */
export function selectEnemyJetPalette(family: string, value: unknown): EnemyJetPalette | undefined {
  const root = fields(value);
  if (
    !root ||
    root.version !== 1 ||
    !Array.isArray(root.layers) ||
    !(family === "coral" || regionalFamilies.some((key) => key === family))
  ) {
    return undefined;
  }
  const layers = (root.layers as unknown[]).map(fields);
  const base = (name: keyof EnemyJetPalette) =>
    colorRamp(layers.find((layer) => layer?.name === name)?.colors);
  const outer = base("outer");
  const core = base("core");
  if (!outer || !core) {
    return undefined;
  }
  if (!Object.hasOwn(root, "familyColors")) {
    return { core, outer };
  }

  const palettes = fields(root.familyColors);
  if (
    !palettes ||
    layers.length !== 2 ||
    layers[0]?.name !== "outer" ||
    layers[1]?.name !== "core" ||
    layers.some((layer) => layer && Object.hasOwn(layer, "color")) ||
    Object.keys(palettes).some((key) => !regionalFamilies.some((region) => region === key))
  ) {
    return undefined;
  }
  if (family === "coral") {
    return { core, outer };
  }
  const pair = Object.hasOwn(palettes, family) ? palettes[family] : undefined;
  if (!Array.isArray(pair) || pair.length !== 2) {
    return undefined;
  }
  const familyOuter = colorRamp(pair[0]);
  const familyCore = colorRamp(pair[1]);
  return familyOuter && familyCore ? { core: familyCore, outer: familyOuter } : undefined;
}

export function readEnemyJets(family: EnemyJetFamily, value: unknown): ShipJets | undefined {
  const root = fields(value);
  if (!root || !Object.hasOwn(root, "familyColors")) {
    return readShipJets(value);
  }
  const palette = selectEnemyJetPalette(family, root);
  if (!palette) {
    return undefined;
  }
  const [outer, core] = root.layers as Record<string, unknown>[];
  return readShipJets({
    ...root,
    layers: [
      { ...outer, colors: palette.outer },
      { ...core, colors: palette.core },
    ],
  });
}
