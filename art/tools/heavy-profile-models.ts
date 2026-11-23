import { mirror, type Plan } from "./crafts.ts";
import { ADA_WIDTH, capital, frigate, type HeavyCraft, planOffset } from "./heavies.ts";

type Class = "frigate" | "capital";
type Profile = "maximum" | "narrow" | "compact";

const baseline = { frigate, capital };

// Width at the waist and ends, then fore-aft length. These factors lay out
// inherited deck details and the unscaled mount models within the new shells.
const dimensions = {
  frigate: { narrow: [0.82, 0.65, 0.99], compact: [0.9, 0.86, 0.84] },
  capital: { narrow: [0.69, 0.82, 0.99], compact: [0.86, 0.77, 0.82] },
} as const;

// Authored half-plans in the normalized model's local units, nose to stern.
const narrowFrigateShell = mirror([
  [9, -123],
  [25, -113],
  [53, -82],
  [48, -66],
  [37, -53],
  [34, -36],
  [41, -31],
  [39, -22],
  [69, -16],
  [79, -4],
  [75, 16],
  [57, 27],
  [36, 32],
  [36, 62],
  [27, 100],
]);
const narrowFrigateBow = mirror([
  [8, -117],
  [20, -105],
  [33, -87],
  [34, -70],
  [24, -52],
  [15, -37],
]);
const compactFrigateShell = mirror([
  [39, -93],
  [56, -82],
  [62, -70],
  [57, -57],
  [34, -50],
  [31, -30],
  [50, -24],
  [72, -12],
  [88, 1],
  [96, 14],
  [96, 34],
  [83, 47],
  [50, 52],
  [39, 64],
  [33, 86],
]);
const compactFrigateBow = mirror([
  [36, -86],
  [49, -79],
  [53, -70],
  [48, -61],
  [32, -57],
]);
const compactCapitalShell = mirror([
  [39, -151],
  [60, -137],
  [74, -119],
  [82, -82],
  [92, -64],
  [92, -50],
  [103, -39],
  [105, -20],
  [106, 22],
  [93, 44],
  [69, 53],
  [60, 65],
  [58, 94],
  [39, 126],
  [17, 126],
  [14, 114],
]);
const compactCapitalBow = mirror([
  [33, -145],
  [48, -135],
  [55, -125],
  [45, -113],
]);
const compactCapitalTrim = mirror([
  [22, -141],
  [31, -141],
  [42, -133],
  [46, -126],
  [36, -124],
]);

function shapeFrigate(hull: HeavyCraft["hull"], compact: boolean): HeavyCraft["hull"] {
  const [slab, bow, , , portRecess, starboardRecess, ...spine] = hull;
  const recess: Plan = compact
    ? [
        [43, 3],
        [69, 4],
        [82, 14],
        [78, 33],
        [64, 40],
        [46, 37],
      ]
    : [
        [33, -13],
        [58, -13],
        [70, -2],
        [68, 11],
        [56, 20],
        [38, 22],
      ];
  return [
    { ...slab!, plan: compact ? compactFrigateShell : narrowFrigateShell },
    { ...bow!, plan: compact ? compactFrigateBow : narrowFrigateBow },
    { ...portRecess!, plan: recess.toReversed().map(([x, y]) => [-x, y]) },
    { ...starboardRecess!, plan: recess },
    ...spine,
  ];
}

function shapeCompactCapital(hull: HeavyCraft["hull"], deck: number): HeavyCraft["hull"] {
  const [slab, keel, trim, ...rest] = hull;
  const lowBow = deck + 4;
  return [
    { ...slab!, plan: compactCapitalShell },
    { ...keel!, plan: compactCapitalBow, z1: lowBow },
    { ...trim!, plan: compactCapitalTrim, z0: lowBow, z1: lowBow },
    ...rest,
  ];
}

export function heavyProfile(kind: Class, profile: Profile): HeavyCraft {
  const source = baseline[kind];
  if (profile === "maximum") return source;

  const [waist, ends, length] = dimensions[kind][profile];
  const reach = Math.max(...source.hull[0]!.plan.map(([, y]) => Math.abs(y)));
  const mapPlan = (x: number, y: number): [number, number] => {
    const station = Math.min(Math.abs(y) / reach, 1);
    return [x * (waist + (ends - waist) * station), y * length];
  };
  const offsetUnit = source.sizeRatio * ADA_WIDTH;
  const compact = profile === "compact";
  const hull = source.hull.map((part) => ({
    ...part,
    plan: part.plan.map(([x, y]) => mapPlan(x, y)),
  }));
  return {
    ...source,
    hull:
      kind === "frigate"
        ? shapeFrigate(hull, compact)
        : compact
          ? shapeCompactCapital(hull, source.hullTop)
          : hull,
    hardpoints: source.hardpoints.map((part) => {
      const [x, y] = mapPlan(...planOffset(source.sizeRatio, part.offset));
      const sweptSponson =
        compact && kind === "frigate" && (part.id === "port" || part.id === "starboard");
      return { ...part, offset: [x / offsetUnit, (y + (sweptSponson ? 11 : 0)) / offsetUnit] };
    }),
  };
}
