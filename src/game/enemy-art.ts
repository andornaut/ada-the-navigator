import type { Vec } from "../model/types.ts";
import { shipDirection } from "./ship-art.ts";
import { type JetTriangle, jetTriangles, readShipJets, type ShipJets } from "./ship-jets.ts";

/** An enemy heading frame from Art's root manifest. */
export interface EnemyFrame {
  archetype?: string;
  directionIndex?: number;
  displayHeight?: number;
  displayWidth?: number;
  id: string;
  path?: string;
  pivot: Vec;
}

/** A complete heading set, with jets when the archetype's jets file is valid. */
export interface EnemyArt<T extends EnemyFrame = EnemyFrame> {
  frames: readonly T[];
  jets: ShipJets | undefined;
}

const FRAME = /^enemy-([a-z][a-zA-Z]*)-(\d+)$/;
/** Art exports every framed enemy in sixteen headings, as Gameplay requires. */
export const ENEMY_HEADINGS = 16;

/**
 * Complete sixteen-heading sets per archetype from `enemy-{archetype}-{index}` entries. An
 * archetype with a missing, extra, duplicate or unsized frame is left out and keeps its vector
 * placeholder.
 */
export function enemyFrameSets<T extends EnemyFrame>(assets: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  const broken = new Set<string>();
  for (const asset of assets) {
    const match = FRAME.exec(asset.id);
    if (!match) {
      continue;
    }
    const archetype = match[1]!;
    const index = Number(match[2]);
    const frames = groups.get(archetype) ?? [];
    groups.set(archetype, frames);
    if (
      asset.archetype !== archetype ||
      asset.directionIndex !== index ||
      !(asset.displayWidth! > 0) ||
      !(asset.displayHeight! > 0) ||
      frames[index]
    ) {
      broken.add(archetype);
      continue;
    }
    frames[index] = asset;
  }
  for (const [archetype, frames] of groups) {
    // Array methods skip holes, so check each heading index.
    const complete = Array.from({ length: ENEMY_HEADINGS }, (_, index) => index in frames);
    if (broken.has(archetype) || frames.length !== ENEMY_HEADINGS || complete.includes(false)) {
      groups.delete(archetype);
    }
  }
  return groups;
}

/** The archetype's jets file sits beside its frames as `{archetype}-jets.json`. */
export function enemyJetsPath(archetype: string, frame: Pick<EnemyFrame, "path">): string {
  const path = frame.path ?? "";
  return `${path.slice(0, path.lastIndexOf("/") + 1)}${archetype}-jets.json`;
}

/** Jets apply only when the file is valid and lists all sixteen headings. */
export function enemyArt<T extends EnemyFrame>(
  jets: (archetype: string) => unknown,
  sets: ReadonlyMap<string, readonly T[]>,
): Map<string, EnemyArt<T>> {
  const result = new Map<string, EnemyArt<T>>();
  for (const [archetype, frames] of sets) {
    const parsed = readShipJets(jets(archetype));
    result.set(archetype, {
      frames,
      jets: parsed?.headings.length === ENEMY_HEADINGS ? parsed : undefined,
    });
  }
  return result;
}

/** The nearest authored heading to the continuous hull facing. */
export function selectEnemyFrame<T extends EnemyFrame>(art: EnemyArt<T>, facing: Vec): T {
  return art.frames[shipDirection(art.frames.length, facing)]!;
}

/** Jet triangles relative to the sprite position; empty at rest or without a jets file. */
export function enemyJetTriangles(
  art: EnemyArt,
  frame: EnemyFrame,
  speedFraction: number,
): JetTriangle[] {
  if (!art.jets || frame.directionIndex === undefined) {
    return [];
  }
  return jetTriangles(
    art.jets,
    {
      displayHeight: frame.displayHeight!,
      displayWidth: frame.displayWidth!,
      pivot: frame.pivot,
    },
    frame.directionIndex,
    speedFraction,
  );
}
