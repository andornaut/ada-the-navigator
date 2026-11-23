import type { claim } from "./claim-jumpers.ts";
import { coralRear, coralSide, mirror } from "./crafts.ts";
import type { HeavyCraft, HeavyPart } from "./heavies.ts";
import { ngon } from "./solid.ts";

type Profile = "maximum" | "narrow" | "compact";

function armour(part: HeavyPart, top: string, side: string, rear = side): HeavyPart {
  return { ...part, top, side, rear };
}

// The retained half plans run from nose to stern. Connect their main corners
// directly and keep the authored outer stations for the preprojection bounds.
function clipped(part: HeavyPart, corners: readonly number[], count: number): HeavyPart {
  if (part.plan.length !== 2 * count) throw new Error("Unexpected heavy hull half plan");
  return { ...part, plan: mirror(corners.map((index) => part.plan[index]!)) };
}

const frigateCorners = {
  maximum: [0, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13],
  narrow: [0, 2, 3, 5, 7, 9, 10, 11, 12, 13, 14],
  compact: [0, 2, 3, 5, 7, 9, 10, 11, 12, 14],
} as const;

function frigateHull(hull: HeavyPart[], profile: Profile): HeavyPart[] {
  const slab = clipped(hull[0]!, frigateCorners[profile], profile === "maximum" ? 14 : 15);
  const bow = hull.find(({ key }) => key === "hammerhead")!;
  // A single bevel over the bow replaces the trim, stamp and separate deck inserts.
  return [slab, bow];
}

function frigateMounts(craft: HeavyCraft): HeavyCraft["hardpoints"] {
  return craft.hardpoints.map((hardpoint) => {
    const model = hardpoint.model;
    if (model.role !== "engine") return hardpoint;
    const intact = model.intact.filter(
      (part) => !(part.on === "block" && part.z0 === part.z1 && part.top === coralSide),
    );
    return { ...hardpoint, model: { ...model, intact } };
  });
}

function capitalHull(hull: HeavyPart[], profile: Profile): HeavyPart[] {
  const compact = profile === "compact";
  const corners = compact
    ? [0, 2, 3, 5, 7, 8, 10, 11, 12, 13, 14, 15]
    : [0, 2, 3, 5, 6, 7, 9, 10, 13, 14, 15, 16, 17];
  const slab = clipped(hull[0]!, corners, compact ? 16 : 18);
  const keel = hull.find(({ key }) => key === "keel")!;
  const recess = hull.find(({ key }) => key === "mine-recess")!;
  // One raised keel, with the stern recess that marks the Mine position.
  return [slab, keel, recess];
}

function gadgetHull(hull: HeavyPart[]): HeavyPart[] {
  const slab = clipped(hull[0]!, [0, 1, 3, 4, 5, 7, 9, 11, 15, 17, 18, 20, 21], 22);
  const ridge = hull.find((part) => part.z0 !== part.z1 && part.top === coralRear)!;
  const flank = "#655966";
  const rear = "#463d52";
  return [armour(slab, "#8a808b", flank, rear), armour(ridge, "#746879", flank, rear)];
}

function gadgetMounts(craft: HeavyCraft): HeavyCraft["hardpoints"] {
  const quiet = (parts: HeavyPart[]) => parts.map((part) => armour(part, "#746879", "#655966"));
  return craft.hardpoints.map((hardpoint) => {
    const model = hardpoint.model;
    if (model.role !== "turret") return hardpoint;
    return {
      ...hardpoint,
      model: {
        ...model,
        intact: quiet(model.intact),
        ...(model.capped ? { capped: quiet(model.capped) } : {}),
      },
    };
  });
}

function platformHull(craft: HeavyCraft, paint: typeof claim): HeavyPart[] {
  const base = craft.hull[0]!;
  const radius = Math.max(...craft.hull.flatMap(({ plan }) => plan.map(([x]) => Math.abs(x))));
  const slab = { ...base, plan: ngon(32, radius) };
  const hubZ = Math.max(...craft.hull.map(({ z1 }) => z1));
  const hub = craft.hull.find(
    (part) => part.z0 === slab.z1 && part.top === paint.steel && part.z1 === hubZ,
  )!;
  const rimZ = craft.hull.find((part) => part.z0 === slab.z1 && part.top === paint.steel)!.z1;
  // Four adjoining sections read as one ring. Its outline stays inside the existing slab.
  const rim = Array.from({ length: 4 }, (_, quadrant): HeavyPart => {
    const start = quadrant * 8;
    const arc = Array.from({ length: 9 }, (_, i) => slab.plan[(start + i) % slab.plan.length]!);
    return {
      plan: [...arc, ...arc.toReversed().map(([x, y]) => [x * 0.87, y * 0.87] as const)],
      z0: slab.z1,
      z1: rimZ,
      top: paint.steelSide,
      side: paint.rustRear,
    };
  });
  return [slab, ...rim, hub];
}

/** Candidate primary planes and finishes. Build normally to trace collision for the selected hull. */
export function restrainHeavyHull(
  craft: HeavyCraft,
  { profile = "maximum", platformPaint }: { profile?: Profile; platformPaint?: typeof claim } = {},
): HeavyCraft {
  switch (craft.name) {
    case "frigate":
      return { ...craft, hull: frigateHull(craft.hull, profile), hardpoints: frigateMounts(craft) };
    case "capital":
      return { ...craft, hull: capitalHull(craft.hull, profile) };
    case "gadget":
      return { ...craft, hull: gadgetHull(craft.hull), hardpoints: gadgetMounts(craft) };
    case "platform":
      if (!platformPaint) throw new Error("The platform finish needs the Claim palette");
      return { ...craft, hull: platformHull(craft, platformPaint) };
    default:
      return craft;
  }
}
