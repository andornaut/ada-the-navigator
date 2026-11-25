import type { EnemyNavigation, Point } from "../../data/enemyCatalog.ts";
import { type WorldContext, worldDelta } from "../worldContacts.ts";
import { rotate, seeded } from "./course.ts";

/** Samples along the shared ellipse for its arc length. */
const SAMPLES = 64;

/** One pack member as its shared route sees it. */
export interface PackMember {
  readonly age: number;
  readonly home: Point;
  readonly id: string;
  /** Its spacing radius at the route position. */
  readonly spacing: number;
}

/** A member's moving place on its pack's shared route. */
export interface PackSlot {
  /** Where the member should be now. */
  readonly point: Point;
  /** The route's unit direction of travel at that point. */
  readonly tangent: Point;
}

/** The mean of the members' homes, taken across the seam from `origin`'s frame. */
export function packAnchor(
  context: WorldContext,
  origin: Point,
  members: readonly PackMember[],
): Point {
  const sum = members.reduce(
    (total, member) => {
      const offset = worldDelta(context, origin, member.home);
      return { x: total.x + offset.x, y: total.y + offset.y };
    },
    { x: 0, y: 0 },
  );
  return { x: origin.x + sum.x / members.length, y: origin.y + sum.y / members.length };
}

/**
 * The place of member `id` on its pack's shared route (gameplay/ships.md "Keep moving"): the
 * standard seeded patrol ellipse, seeded from `packId`, through `anchor`. Members fly it in ship
 * id order at `speed`, each the pair spacing (the larger of `memberSpacing` and both spacing radii
 * plus `gap`) behind the one ahead; the ellipse grows until the pair spacings fit around it. The
 * first member's age is the route's clock, so every member reads the same route. Null when `id` is
 * not a member.
 */
export function packSlot(
  navigation: Pick<EnemyNavigation, "ellipseRatio" | "patrolRadius">,
  spacing: { readonly gap: number; readonly memberSpacing: number },
  packId: string,
  anchor: Point,
  speed: number,
  members: readonly PackMember[],
  id: string,
): PackSlot | null {
  const ordered = [...members].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rank = ordered.findIndex((member) => member.id === id);
  if (rank < 0) {
    return null;
  }
  const pair = (a: PackMember, b: PackMember) =>
    Math.max(spacing.memberSpacing, a.spacing + b.spacing + spacing.gap);
  const total = ordered.reduce(
    (sum, member, index) => sum + pair(member, ordered[(index + 1) % ordered.length]!),
    0,
  );
  const behind = ordered
    .slice(0, rank)
    .reduce((sum, member, index) => sum + pair(member, ordered[index + 1]!), 0);
  const ellipse =
    navigation.ellipseRatio[0] +
    seeded(packId, 12) * (navigation.ellipseRatio[1] - navigation.ellipseRatio[0]);
  const heading = seeded(packId, 13) * Math.PI * 2;
  const side = seeded(packId, 14) < 0.5 ? -1 : 1;
  // A unit ellipse's arc length, sampled; the route scales it to fit the pair spacings.
  const unitPoints = Array.from({ length: SAMPLES + 1 }, (_, index) => {
    const angle = (index / SAMPLES) * Math.PI * 2;
    return { x: 1 + Math.cos(angle + Math.PI), y: ellipse * Math.sin(angle + Math.PI) };
  });
  const lengths = [0];
  for (let index = 1; index <= SAMPLES; index++) {
    const a = unitPoints[index - 1]!;
    const b = unitPoints[index]!;
    lengths.push(lengths[index - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const unitLength = lengths[SAMPLES]!;
  const seededRadius =
    navigation.patrolRadius[0] +
    seeded(packId, 11) * (navigation.patrolRadius[1] - navigation.patrolRadius[0]);
  const radius = Math.max(seededRadius, total / unitLength);
  const length = unitLength * radius;
  const clock = ordered[0]!.age;
  const start = seeded(packId, 15) * length;
  const along = (((start + speed * clock - behind) % length) + length) % length;
  // Travel on `side`: side 1 runs the samples forward, side -1 backward.
  const position = side > 0 ? along / radius : unitLength - along / radius;
  let index = 1;
  while (index < SAMPLES && lengths[index]! < position) {
    index++;
  }
  const a = unitPoints[index - 1]!;
  const b = unitPoints[index]!;
  const share =
    (position - lengths[index - 1]!) / Math.max(1e-9, lengths[index]! - lengths[index - 1]!);
  const local = {
    x: (a.x + (b.x - a.x) * share) * radius,
    y: (a.y + (b.y - a.y) * share) * radius,
  };
  const offset = rotate(local, heading);
  const step = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const tangent = rotate(
    { x: ((b.x - a.x) / step) * side, y: ((b.y - a.y) / step) * side },
    heading,
  );
  return { point: { x: anchor.x + offset.x, y: anchor.y + offset.y }, tangent };
}
