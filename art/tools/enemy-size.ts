import { ENEMY_SIZE_RATIOS } from "../../src/data/enemyDimensions.ts";
import type { Craft, Part } from "./crafts.ts";
import type { HeavyCraft, Model, Top } from "./heavies.ts";
import { ENEMY_HEADINGS, type Point, projectAt, rotate } from "./projection.ts";
import { retroMouthAxis } from "./ship-model.ts";

// The existing source wing corners, before any yaw, projection or frame padding.
const adaCorners = [retroMouthAxis(-1).corner[0], retroMouthAxis(1).corner[0]];
export const ADA_MODEL_SPAN = Math.max(...adaCorners) - Math.min(...adaCorners);

type SizeKey = keyof typeof ENEMY_SIZE_RATIOS;
export function enemySizeKey(name: string): SizeKey {
  const key = name === "archie" ? "flagship" : name;
  if (!Object.hasOwn(ENEMY_SIZE_RATIOS, key)) throw new Error(`Unknown enemy size ${name}`);
  return key as SizeKey;
}
export const enemySizeRatio = (name: string): number => ENEMY_SIZE_RATIOS[enemySizeKey(name)];

export function partPoints(
  parts: readonly Part[],
  origin: readonly [number, number] = [0, 0],
): Point[] {
  return parts.flatMap(({ plan, z0, z1 }) =>
    plan.flatMap(
      ([x, y]) =>
        [
          [x + origin[0], y + origin[1], z0],
          [x + origin[0], y + origin[1], z1],
        ] as Point[],
    ),
  );
}

const mountOrigin = (craft: HeavyCraft, offset: readonly [number, number]): [number, number] => [
  offset[0] * craft.sizeRatio * ADA_MODEL_SPAN,
  offset[1] * craft.sizeRatio * ADA_MODEL_SPAN,
];

function mountTops(craft: HeavyCraft, id: string, model: Model): Top[] {
  if (model.top) return [model.top];
  return craft.mounts?.fill.includes(id)
    ? Object.values(craft.mounts.weapons).map((weapon) => weapon!.top)
    : [];
}

/** Intact authored assembly, with tops in their source orientation before any aim or hull yaw. */
export function assembledPoints(craft: Craft | HeavyCraft): Point[] {
  if ("parts" in craft) return partPoints(craft.parts);
  return [
    ...partPoints(craft.hull),
    ...craft.hardpoints.flatMap(({ id, model, offset }) => {
      const origin = mountOrigin(craft, offset);
      return [
        ...partPoints(model.intact, origin),
        ...mountTops(craft, id, model).flatMap((top) => partPoints(top.parts, origin)),
      ];
    }),
  ];
}

export function lateralSpan(points: readonly Point[]): number {
  const bounds = points.reduce(
    (box, [x]) => ({ left: Math.min(box.left, x), right: Math.max(box.right, x) }),
    { left: Infinity, right: -Infinity },
  );
  return bounds.right - bounds.left;
}

/** Export-bounds union only: broken states and independently aimed tops never choose a new scale. */
export function allStatePoints(craft: Craft | HeavyCraft): Point[] {
  if ("parts" in craft) return partPoints(craft.parts);
  return [
    ...partPoints(craft.hull),
    ...craft.hardpoints.flatMap(({ id, model, offset }) => {
      const origin = mountOrigin(craft, offset);
      return [
        ...partPoints(
          [...model.intact, ...(model.destroyed ?? []), ...(model.capped ?? [])],
          origin,
        ),
        ...mountTops(craft, id, model).flatMap((top) =>
          Array.from({ length: ENEMY_HEADINGS }, (_, aim) =>
            partPoints(top.parts).map((point): Point => {
              const [x, y, z] = rotate(ENEMY_HEADINGS, aim, point);
              return [x + origin[0], y + origin[1], z];
            }),
          ).flat(),
        ),
      ];
    }),
  ];
}

export function projectedBounds(points: readonly Point[], heading: number) {
  return points.reduce(
    (bounds, point) => {
      const [x, y] = projectAt(0, 0, rotate(ENEMY_HEADINGS, heading, point));
      return {
        bottom: Math.max(bounds.bottom, y),
        left: Math.min(bounds.left, x),
        right: Math.max(bounds.right, x),
        top: Math.min(bounds.top, y),
      };
    },
    { bottom: -Infinity, left: Infinity, right: -Infinity, top: Infinity },
  );
}

function fitFrame(craft: Craft | HeavyCraft): number {
  const points = allStatePoints(craft);
  const extent = Math.max(
    ...Array.from({ length: ENEMY_HEADINGS }, (_, heading) =>
      Object.values(projectedBounds(points, heading)).map(Math.abs),
    ).flat(),
  );
  // Preserve existing padding; grow only when a physical part needs the frame edge margin.
  return extent < craft.frame / 2 - 1 ? craft.frame : Math.ceil((2 * extent + 2) / 8) * 8;
}

const scalePart = <T extends Part>(s: number, part: T): T => ({
  ...part,
  plan: part.plan.map(([x, y]) => [s * x, s * y] as const),
  z0: s * part.z0,
  z1: s * part.z1,
});

export interface SizeReceipt {
  readonly adaSpan: number;
  readonly after: number;
  readonly before: number;
  readonly factor: number;
  readonly frameAfter: number;
  readonly frameBefore: number;
  readonly key: SizeKey;
  readonly ratio: number;
}
export const sizeReceipts = new Map<string, SizeReceipt>();

function record(source: Craft | HeavyCraft, normalized: Craft | HeavyCraft, factor: number) {
  const receipt: SizeReceipt = {
    adaSpan: ADA_MODEL_SPAN,
    after: lateralSpan(assembledPoints(normalized)),
    before: lateralSpan(assembledPoints(source)),
    factor,
    frameAfter: normalized.frame,
    frameBefore: source.frame,
    key: enemySizeKey(source.name),
    ratio: enemySizeRatio(source.name),
  };
  const variant = "variant" in source ? source.variant : undefined;
  sizeReceipts.set(variant ? `${source.name}:${variant}` : source.name, receipt);
  if (!variant || variant === "cargo") sizeReceipts.set(source.name, receipt);
}

export function normalizeCraft(source: Craft): Craft {
  const factor =
    (enemySizeRatio(source.name) * ADA_MODEL_SPAN) / lateralSpan(assembledPoints(source));
  const result: Craft = {
    ...source,
    mouthWidth: source.mouthWidth * factor,
    mouthZ: (source.mouthZ ?? 2) * factor,
    mouths: source.mouths.map(([x, y]) => [x * factor, y * factor]),
    parts: source.parts.map((part) => scalePart(factor, part)),
  };
  result.frame = fitFrame(result);
  record(source, result, factor);
  return result;
}

export function normalizeHeavy(source: HeavyCraft): HeavyCraft {
  const factor =
    (enemySizeRatio(source.name) * ADA_MODEL_SPAN) / lateralSpan(assembledPoints(source));
  const tops = new Map<Top, Top>();
  const scaleTop = (top: Top): Top => {
    if (!tops.has(top))
      tops.set(top, {
        ...top,
        muzzles: top.muzzles.map(([x, y, z]) => [x * factor, y * factor, z * factor]),
        parts: top.parts.map((part) => scalePart(factor, part)),
        z: top.z * factor,
      });
    return tops.get(top)!;
  };
  const scaleModel = (model: Model): Model => ({
    ...model,
    intact: model.intact.map((part) => scalePart(factor, part)),
    z: model.z * factor,
    ...(model.destroyed
      ? { destroyed: model.destroyed.map((part) => scalePart(factor, part)) }
      : {}),
    ...(model.capped ? { capped: model.capped.map((part) => scalePart(factor, part)) } : {}),
    ...(model.top ? { top: scaleTop(model.top) } : {}),
    ...(model.jets
      ? {
          jets: {
            mouths: model.jets.mouths.map(([x, y]) => [x * factor, y * factor]),
            width: model.jets.width * factor,
            z: model.jets.z * factor,
          },
        }
      : {}),
  });
  const ratio = enemySizeRatio(source.name);
  const result: HeavyCraft = {
    ...source,
    hardpoints: source.hardpoints.map(({ id, model, offset }) => ({
      id,
      model: scaleModel(model),
      offset: [
        (offset[0] * source.sizeRatio * factor) / ratio,
        (offset[1] * source.sizeRatio * factor) / ratio,
      ],
    })),
    hull: source.hull.map((part) => scalePart(factor, part)),
    hullTop: source.hullTop * factor,
    sizeRatio: ratio,
    ...(source.mounts
      ? {
          mounts: {
            ...source.mounts,
            weapons: Object.fromEntries(
              Object.entries(source.mounts.weapons).map(([key, value]) => [
                key,
                { ...value, top: scaleTop(value!.top) },
              ]),
            ),
          },
        }
      : {}),
  };
  result.frame = fitFrame(result);
  record(source, result, factor);
  return result;
}
