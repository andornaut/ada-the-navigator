import type { Face } from "./crafts.ts";
import { DISPLAY_SCALE } from "./crafts.ts";
import { ADA_MODEL_SPAN } from "./enemy-size.ts";
import { depth, ENEMY_HEADINGS, facesViewer, type Point, projectAt, rotate } from "./projection.ts";
import { HOSTILE_STATION_SIGNATURE } from "../../src/data/enemySignatures.ts";
import { hull } from "../../src/model/convex.ts";

type V2 = readonly [number, number];
type Basis = readonly [Point, Point, Point];
type Sphere = { centre: Point; radius: number };
type Mount = { id: string; body: number; point: Point };
export type Model = {
  bodies: readonly Sphere[];
  anchors: readonly Mount[];
  ring?: Ring;
  trim?: readonly Ring[];
};
type Ring = { basis: Basis; radius: number; halfWidth: number; halfDepth: number; span?: V2 };

const deg = (angle: number) => (angle * Math.PI) / 180;
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (n: number, p: Point): Point => [n * p[0], n * p[1], n * p[2]];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Point, b: Point): Point => add(a, mul(-1, b));
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (p: Point) => Math.hypot(...p);
const unit = (p: Point) => mul(1 / norm(p), p);
const sample = (count: number) => Array.from({ length: count }, (_, index) => index);
const along = (basis: Basis, x: number, y: number, z = 0) =>
  add(mul(x, basis[0]), add(mul(y, basis[1]), mul(z, basis[2])));
const circle = (radius: number, angle: number): V2 => [
  radius * Math.cos(angle),
  radius * Math.sin(angle),
];
const rounded = (x: number) => Math.round(x * 1000) / 1000;

const cameraY: Point = unit([1, 1, -2]);
const cameraX: Point = unit([1, -1, 0]);
const cameraDepth: Point = unit([1, 1, 1]);
// Each canonical camera row has norm sqrt(1.5), so a true sphere projects as a circle.
const logicalPerModel = DISPLAY_SCALE * Math.sqrt(1.5);
const modelPx = (logical: number) => logical / logicalPerModel;
const referenceHeading = 0;
const inModel = (p: Point): Point => [p[1], -p[0], p[2]];

export const concept = {
  spherePressureRadius: 167,
  sphereEnvelopeDiameter: 339,
  podRadius: 48,
  ringRadius: 144,
  ringPlaneRatio: 0.78,
  ringRoll: -16,
  podAngles: [-90, 30, 150],
} as const;

const roll = deg(concept.ringRoll);
const major = add(mul(Math.cos(roll), cameraX), mul(Math.sin(roll), cameraY));
const minor = add(mul(-Math.sin(roll), cameraX), mul(Math.cos(roll), cameraY));
const planeMinor = add(
  mul(concept.ringPlaneRatio, minor),
  mul(Math.sqrt(1 - concept.ringPlaneRatio ** 2), cameraDepth),
);
const plane: Basis = [inModel(major), inModel(planeMinor), inModel(cross(major, planeMinor))];

const giant: Sphere = { centre: [0, 0, 0], radius: modelPx(concept.spherePressureRadius) };
// The sealed sphere's broken, slightly raised circumference trim in the authored view.
const rimBasis: Basis = [inModel(cameraX), inModel(cameraY), inModel(cameraDepth)];
const sphereTrim = [
  [188, 229, 4.5],
  [241, 268, 3.6],
  [278, 306, 2.8],
  [345, 365, 4.2],
  [69, 93, 3.5],
  [110, 130, 2.6],
].map(([from, to, stroke]): Ring => ({
  basis: rimBasis,
  radius: modelPx(concept.spherePressureRadius + 0.1),
  halfWidth: modelPx((stroke! + 1.8) / 2),
  halfDepth: modelPx(0.5),
  span: [from!, to!],
}));
const ring: Ring = {
  basis: plane,
  radius: modelPx(concept.ringRadius),
  halfWidth: modelPx(10), // The sealed concept has a 20 logical px outer rail stroke.
  halfDepth: modelPx(3), // Provisional section thickness for a solid model fit.
};
const pods = concept.podAngles.map((angle) => ({
  centre: along(plane, ...circle(ring.radius, deg(angle))),
  radius: modelPx(concept.podRadius),
}));

function onSphere({ centre, radius }: Sphere, azimuth: number, zRatio: number): Point {
  return add(centre, [
    ...circle(radius * Math.sqrt(1 - zRatio ** 2), deg(azimuth)),
    radius * zRatio,
  ]);
}

function mounts(
  bodies: readonly Sphere[],
  placements: readonly (readonly [number, number])[],
  zRatio: number,
): Mount[] {
  return placements.map(([body, azimuth], index) => ({
    id: HOSTILE_STATION_SIGNATURE.fill[index]!,
    body,
    point: onSphere(bodies[body]!, azimuth, zRatio),
  }));
}

export const models = {
  // Same identifiers and tier prefixes. These are surveyed mount suggestions.
  phantom: {
    bodies: [giant],
    trim: sphereTrim,
    anchors: mounts(
      [giant],
      [0, 60, 120, 180, 240, 300, 30, 210].map((angle) => [0, angle]),
      0.65,
    ),
  },
  andromeda: {
    bodies: pods,
    ring,
    anchors: mounts(
      pods,
      [
        [0, 20],
        [1, 140],
        [2, 260],
        [0, 200],
        [1, 320],
        [2, 80],
        [0, 110],
        [1, 230],
      ],
      0.63,
    ),
  },
} satisfies Record<string, Model>;

function outward(points: Point[], normal: Point): Point[] {
  const [a, b, c] = points;
  return dot(cross(sub(b!, a!), sub(c!, a!)), normal) > 0 ? points : points.toReversed();
}

/** Shared native Face values, with every mesh vertex on the true sphere. */
export function sphereFaces({ centre, radius }: Sphere, color: string): Face[] {
  const sides = 48;
  const bands = 24;
  const vertex = (ring: number, side: number): Point => {
    const lat = (ring / bands - 0.5) * Math.PI;
    return add(centre, [
      ...circle(radius * Math.cos(lat), (side * 2 * Math.PI) / sides),
      radius * Math.sin(lat),
    ]);
  };
  return sample(bands).flatMap((ring) =>
    sample(sides).map((side) => {
      const a = vertex(ring, side),
        b = vertex(ring, side + 1);
      const c = vertex(ring + 1, side + 1),
        d = vertex(ring + 1, side);
      const points = ring === 0 ? [a, c, d] : ring === bands - 1 ? [a, b, c] : [a, b, c, d];
      return { color, points: outward(points, sub(add(a, c), mul(2, centre))) };
    }),
  );
}

/** Annular rail with a cross section in the same plane as the three equators. */
export function ringFaces(
  { basis, radius, halfWidth, halfDepth, span = [0, 360] }: Ring,
  color: string,
): Face[] {
  const count = Math.ceil((span[1] - span[0]) / 3.75);
  const angle = (index: number) => deg(span[0] + (index * (span[1] - span[0])) / count);
  const vertex = (i: number, side: number, cap: number) =>
    along(basis, ...circle(radius + side * halfWidth, angle(i)), cap * halfDepth);
  return sample(count).flatMap((i) => {
    const next = i + 1;
    const radial = along(basis, ...circle(1, angle(i + 0.5)));
    return [
      [vertex(i, -1, 1), vertex(i, 1, 1), vertex(next, 1, 1), vertex(next, -1, 1)],
      [vertex(i, -1, -1), vertex(i, 1, -1), vertex(next, 1, -1), vertex(next, -1, -1)],
      [vertex(i, -1, -1), vertex(i, -1, 1), vertex(next, -1, 1), vertex(next, -1, -1)],
      [vertex(i, 1, -1), vertex(i, 1, 1), vertex(next, 1, 1), vertex(next, 1, -1)],
    ].map((points, j) => ({
      color,
      points: outward(points, [basis[2], mul(-1, basis[2]), mul(-1, radial), radial][j]!),
    }));
  });
}

function orient(yaw: number, side: 1 | -1, point: Point): Point {
  const [x, y, z] = rotate(ENEMY_HEADINGS, yaw, point);
  return [x, y, side * z];
}
export const screen = (yaw: number, side: 1 | -1, p: Point) =>
  projectAt(0, 0, orient(yaw, side, p));

/** Proposed hull Face seam. The legacy prism path remains the default in the exporter. */
export function cameraFaces(faces: readonly Face[], yaw: number, side: 1 | -1 = 1): Face[] {
  return faces
    .map(({ color, points }) => {
      const viewPoints = points.map((p) => orient(yaw, side, p));
      return { color, points: side === 1 ? viewPoints : viewPoints.reverse() };
    })
    .filter(({ points }) => facesViewer(points))
    .sort((a, b) => depth(b.points) - depth(a.points));
}

/** Disjoint convex plan proxies. Ring participation is a later physical-contract decision. */
export function bodyFootprints({ bodies }: Model): V2[][] {
  return bodies.map(({ centre, radius }) =>
    sample(64).map((index) => {
      const [x, y] = circle(radius, (index * 2 * Math.PI) / 64);
      return [x + centre[0], y + centre[1]];
    }),
  );
}

export function hidden({ point, body }: Mount, model: Model, yaw: number, side: 1 | -1) {
  const offset = sub(point, model.bodies[body]!.centre);
  if (dot(orient(yaw, side, offset), cameraDepth) <= 0) return true;
  return model.bodies.some(({ centre, radius }, i) => {
    if (i === body) return false;
    const delta = orient(yaw, side, sub(centre, point));
    const distance = dot(delta, cameraDepth);
    return distance > 0 && norm(sub(delta, mul(distance, cameraDepth))) < radius;
  });
}

function envelope(frame: number) {
  const columns = Math.min(4, Math.floor(1728 / frame));
  return {
    frame,
    columns,
    maxPageEdge: columns * frame,
    pages: columns ? Math.ceil(ENEMY_HEADINGS / columns ** 2) : null,
  };
}

function rails(model: Model): readonly Ring[] {
  return [...(model.trim ?? []), ...(model.ring ? [model.ring] : [])];
}

export function modelFaces(model: Model): Face[] {
  return [
    ...model.bodies.flatMap((body) => sphereFaces(body, "#668097")),
    ...rails(model).flatMap((rail) => ringFaces(rail, "#567b73")),
  ];
}

function railCells({ basis, radius, halfWidth, halfDepth, span = [0, 360] }: Ring): Point[][] {
  const count = Math.ceil((span[1] - span[0]) / 3.75);
  const angle = (i: number) => deg(span[0] + (i * (span[1] - span[0])) / count);
  return sample(count).map((i) =>
    [i, i + 1].flatMap((at) =>
      [-1, 1].flatMap((side) =>
        [-1, 1].map((cap) =>
          along(basis, ...circle(radius + side * halfWidth, angle(at)), cap * halfDepth),
        ),
      ),
    ),
  );
}

function convexRails(model: Model, project: (point: Point) => V2): V2[][] {
  return rails(model)
    .flatMap(railCells)
    .map((points) => {
      const projected = points.map((point) => {
        const [x, y] = project(point);
        return { x: rounded(x), y: rounded(y) };
      });
      return hull(projected).map(({ x, y }): V2 => [x, y]);
    });
}

/** Local plan union for clearance inspection, without an enclosing polygon across the pods. */
export function planCollision(model: Model): V2[][] {
  return [...bodyFootprints(model), ...convexRails(model, ([x, y]) => [x, y])];
}

/** One convex component per sphere and per annular cell. The union never fills the loop's hole. */
export function projectedCollision(model: Model, yaw: number): V2[][] {
  const spheres = model.bodies.map(({ centre, radius }) => {
    const [cx, cy] = screen(yaw, 1, centre);
    return sample(96).map((index): V2 => {
      const [x, y] = circle(radius * Math.sqrt(1.5), (index * 2 * Math.PI) / 96);
      return [rounded(cx + x), rounded(cy + y)];
    });
  });
  return [...spheres, ...convexRails(model, (point) => screen(yaw, 1, point))];
}

export function auditModel(model: Model) {
  const { bodies, anchors } = model;
  const extras = rails(model).flatMap((rail) => ringFaces(rail, "#567b73"));
  const mesh = modelFaces(model);
  const projected = ([1, -1] as const).map((side) => ({
    camera: side === 1 ? "above" : "below",
    headings: sample(ENEMY_HEADINGS).map((yaw) => {
      const views = bodies.map(({ centre, radius }) => ({
        centre: screen(yaw, side, centre),
        radius: Math.sqrt(1.5) * radius,
      }));
      const solid = views.flatMap(({ centre: [x, y], radius }) => [
        [x - radius, y - radius],
        [x + radius, y + radius],
      ]);
      for (const { points } of extras) {
        solid.push(...points.map((point) => screen(yaw, side, point)));
      }
      const planeFacing = model.ring
        ? Math.abs(dot(orient(yaw, side, model.ring.basis[2]), cameraDepth))
        : 1;
      const railCoversCentre = model.ring
        ? model.ring.halfDepth * Math.sqrt(Math.max(0, 1 - planeFacing ** 2)) >=
          planeFacing * (model.ring.radius - model.ring.halfWidth)
        : false;
      const bounds = [
        Math.min(...solid.map(([x]) => x!)),
        Math.max(...solid.map(([x]) => x!)),
        Math.min(...solid.map(([, y]) => y!)),
        Math.max(...solid.map(([, y]) => y!)),
      ];
      return {
        yaw,
        rawBounds: bounds.map(rounded),
        projectedVisualWidthLogical: rounded((bounds[1]! - bounds[0]!) * DISPLAY_SCALE),
        railCoversCentre,
        centreClearanceRaw: rounded(
          Math.min(...views.map(({ centre, radius }) => Math.hypot(...centre) - radius)),
        ),
        projectedCentreCircles: views.map(({ centre, radius }) => ({
          centre: centre.map(rounded),
          radius: rounded(radius),
        })),
        occludedByBodies: anchors
          .filter((mount) => hidden(mount, model, yaw, side))
          .map(({ id }) => id),
        mounts: anchors.map(({ id, point }) => ({
          id,
          raw: screen(yaw, side, point).map(rounded),
        })),
      };
    }),
  }));
  const extent = Math.max(
    ...projected.flatMap(({ headings }) =>
      headings.flatMap(({ rawBounds }) => rawBounds.map(Math.abs)),
    ),
  );
  const bodyFrame = Math.ceil((2 * extent + 16) / 8) * 8;
  const footprints = bodyFootprints(model);
  const centreClearance = Math.min(
    ...bodies.map(({ centre: [x, y], radius }) => Math.hypot(x, y) - radius),
  );
  const gap = bodies.flatMap(({ centre: [x, y], radius }, i) =>
    bodies
      .slice(i + 1)
      .map((other) => Math.hypot(x - other.centre[0], y - other.centre[1]) - radius - other.radius),
  );
  return {
    bodies,
    mounts: anchors,
    projected,
    provisionalBodyOnlyPaging: envelope(bodyFrame),
    plan: {
      pieces: footprints,
      centreClearance: rounded(centreClearance),
      minPodGap: gap.length ? rounded(Math.min(...gap)) : null,
    },
    mesh: {
      faces: mesh.length,
      visibleFacesAtReference: cameraFaces(mesh, referenceHeading).length,
    },
  };
}

export function auditContacts() {
  const chord = 2 * Math.asin(pods[0]!.radius / (2 * ring.radius));
  return concept.podAngles.flatMap((angle, i) =>
    [-chord, chord].map((delta) => {
      const hit = along(plane, ...circle(ring.radius, deg(angle) + delta));
      const vector = sub(hit, pods[i]!.centre);
      return {
        centreAngle: angle,
        contactAngle: rounded(angle + (delta * 180) / Math.PI),
        distanceFromCentre: rounded(norm(vector)),
        signedPlaneError: rounded(dot(vector, plane[2])),
        view: screen(referenceHeading, 1, hit).map(rounded),
      };
    }),
  );
}

export function auditConstants() {
  return {
    canonicalDisplayScale: DISPLAY_SCALE,
    projectionGain: Math.sqrt(1.5),
    adaSourceSpan: ADA_MODEL_SPAN,
    legacyPhysicalLateralSpan: ADA_MODEL_SPAN * 7,
    spherePressureModelRadius: modelPx(concept.spherePressureRadius),
    spherePressureProjectedRawRadius: concept.spherePressureRadius / DISPLAY_SCALE,
    spherePaintedEnvelopeModelRadius: modelPx(concept.sphereEnvelopeDiameter / 2),
    spherePaintedEnvelopeProjectedRawRadius: concept.sphereEnvelopeDiameter / 2 / DISPLAY_SCALE,
    spherePaintedBodyPaging: envelope(
      Math.ceil((concept.sphereEnvelopeDiameter / DISPLAY_SCALE + 16) / 8) * 8,
    ),
    ringPlane: plane,
    tierCounts: HOSTILE_STATION_SIGNATURE.tiers,
  };
}
