import type { Face } from "./crafts.ts";
import { preparedStationHullSvg } from "./heavies.ts";
import { ENEMY_HEADINGS, type Point, projectAt, rotate } from "./projection.ts";
import { cameraFaces, concept, type Model, ringFaces } from "./station-model.ts";

type Sphere = Model["bodies"][number];
type Ring = NonNullable<Model["ring"]>;
type Palette = {
  dark: string;
  armor: string;
  alternate: string;
  seam: string;
  light: string;
  signal: string;
};
type Layer = { faces: readonly Face[]; mask?: string };

const armored: Palette = {
  dark: "#182139",
  armor: "#7788a8",
  alternate: "#777b9c",
  seam: "#202c49",
  light: "#dbeaff",
  signal: "#a2bbdf",
};
const pods: Palette = {
  dark: "#15302e",
  armor: "#67978e",
  alternate: "#6b999b",
  seam: "#233e43",
  light: "#dceff0",
  signal: "#96c9c5",
};

const unit = (p: Point) => scale(1 / Math.hypot(...p), p);
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Point, b: Point): Point => add(a, scale(-1, b));
const scale = (n: number, p: Point): Point => [n * p[0], n * p[1], n * p[2]];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const rad = (angle: number) => (angle * Math.PI) / 180;
const right: Point = unit([1, -1, 0]);
const down: Point = unit([1, 1, -2]);
const view: Point = unit([1, 1, 1]);
const lamp: Point = unit(add(scale(-0.39, right), add(scale(-0.51, down), scale(0.72, view))));
const rotateTo = (yaw: number, p: Point) => rotate(ENEMY_HEADINGS, yaw, p);
const fromReference = ([x, y, z]: Point): Point => [y, -x, z];
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const rgb = (hex: string) =>
  [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
const mix = (a: string, b: string, k: number) =>
  "#" +
  rgb(a)
    .map((channel, index) =>
      Math.round(channel + (rgb(b)[index]! - channel) * clamp(k))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const sample = (from: number, to: number, step = 3) => {
  const count = Math.max(1, Math.ceil(Math.abs(to - from) / step));
  return Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / count);
};
function spherePaint(yaw: number, body: Sphere, small: boolean, ordinal: number): Face[] {
  const palette = small ? pods : armored;
  const angle = rad(small ? (-Math.asin(concept.ringPlaneRatio) * 180) / Math.PI : 20);
  const roll = rad(small ? concept.ringRoll : -23);
  // Longitude zero follows each pod's outward ring radius.
  const turn = small ? 90 - concept.podAngles[ordinal]! : 4;
  const centre = rotateTo(yaw, body.centre);
  const faces: Face[] = [];
  const normal = (longitude: number, latitude: number) => {
    const a = rad(longitude + turn),
      b = rad(latitude);
    const x = Math.cos(b) * Math.sin(a),
      y = -Math.sin(b),
      z = Math.cos(b) * Math.cos(a);
    const vertical = y * Math.cos(angle) - z * Math.sin(angle);
    return rotateTo(
      yaw,
      fromReference(
        add(
          scale(x * Math.cos(roll) - vertical * Math.sin(roll), right),
          add(
            scale(x * Math.sin(roll) + vertical * Math.cos(roll), down),
            scale(y * Math.sin(angle) + z * Math.cos(angle), view),
          ),
        ),
      ),
    );
  };
  const fill = (a: number, b: number, lo: number, hi: number, color: string, armor = false) => {
    const boundary = [
      ...sample(a, b).map((u) => normal(u, lo)),
      ...sample(lo, hi).map((v) => normal(b, v)),
      ...sample(b, a).map((u) => normal(u, hi)),
      ...sample(hi, lo).map((v) => normal(a, v)),
    ];
    // Start on the visible hemisphere so each hidden interval has both
    // boundary crossings. Broad armor follows the limb between crossings.
    const first = boundary.findIndex((point) => dot(point, view) >= 0);
    if (first < 0) return;
    const ordered = [...boundary.slice(first), ...boundary.slice(0, first)];
    const visible: Point[] = [];
    let exit: Point | undefined;
    for (const [i, p] of ordered.entries()) {
      const q = ordered[(i + 1) % ordered.length]!;
      const z0 = dot(p, view),
        z1 = dot(q, view);
      if (z0 >= 0) visible.push(p);
      if (z0 >= 0 === z1 >= 0) continue;
      const hit = unit(add(p, scale(z0 / (z0 - z1), sub(q, p))));
      if (armor && exit && z1 >= 0) {
        const start = Math.atan2(dot(exit, down), dot(exit, right));
        const end = Math.atan2(dot(hit, down), dot(hit, right));
        const arc = Math.atan2(Math.sin(end - start), Math.cos(end - start));
        const count = Math.ceil(Math.abs(arc) / rad(2));
        for (let j = 1; j < count; j++) {
          const angle = start + (arc * j) / count;
          visible.push(add(scale(Math.cos(angle), right), scale(Math.sin(angle), down)));
        }
      }
      exit = z0 >= 0 ? hit : undefined;
      visible.push(hit);
    }
    if (visible.length >= 3)
      faces.push({ color, points: visible.map((p) => add(centre, scale(body.radius, p))) });
  };
  // An opaque underpaint removes antialias gaps between adjoining curved patches.
  faces.push({
    color: palette.dark,
    points: sample(0, 357, 3).map((az) =>
      add(
        centre,
        scale(body.radius, add(scale(Math.cos(rad(az)), right), scale(Math.sin(rad(az)), down))),
      ),
    ),
  });
  // Large contiguous armor sections. The seams are reserved for the service
  // runs and the equator, so the shell reads through broad changes in value.
  const bands = small ? [-90, -32, 32, 90] : [-90, -55, -23, 23, 55, 90];
  const panelWidth = 90;
  for (let row = 0; row < bands.length - 1; row++) {
    const lo = bands[row]!,
      hi = bands[row + 1]!;
    const latitude = (lo + hi) / 2;
    const material =
      Math.abs(latitude) > 23 && Math.abs(latitude) < 55 ? palette.alternate : palette.armor;
    for (let left = -135; left < 225; left += panelWidth) {
      const light = (dot(normal(left + panelWidth / 2, latitude), lamp) + 1) / 2;
      const shade = [0.24, 0.36, 0.49, 0.65, 0.81][Math.min(4, Math.floor(light * 5))]!;
      const color = mix(palette.dark, material, shade);
      fill(left, left + panelWidth + 0.16, lo, Math.min(90, hi + 0.16), color, true);
    }
  }

  const windows = (
    center: number,
    latitude: number,
    count: number,
    pitch: number,
    width: number,
    height: number,
    color: string,
    trench = false,
  ) => {
    const first = center - ((count - 1) * pitch) / 2;
    if (trench) {
      const half = ((count - 1) * pitch) / 2 + width / 2 + 4;
      fill(center - half, center + half, latitude - 2.4, latitude + 2.4, palette.seam);
    }
    for (let i = 0; i < count; i++) {
      const lon = first + i * pitch;
      fill(lon - width / 2, lon + width / 2, latitude - height / 2, latitude + height / 2, color);
    }
  };
  if (small) {
    for (const from of [-180, 0]) {
      fill(from, from + 180, -4.6, 4.6, "#193039");
      fill(from, from + 180, -1.1, 1.1, "#aec0c7");
    }
    // Each pod repeats the same centered bank on the outer and inner axes.
    for (const center of [0, 180]) windows(center, 24, 3, 7, 3.9, 1.9, palette.light);
  } else {
    // Paired inset arcs share the panel axis. The shorter service run stays quiet.
    for (const center of [0, 180]) {
      windows(center, 25, 12, 9, 4.2, 1.2, palette.light, true);
      windows(center, -25, 10, 9, 4.2, 1.2, palette.light, true);
      windows(center, -50, 5, 8, 3.8, 1.25, palette.signal);
    }
    // Sparse banks on the open armor, staggered off the main service runs.
    for (const center of [45, 135, 225, 315]) windows(center, 42, 2, 8, 2.6, 1.05, palette.signal);
    for (const center of [90, 270]) windows(center, -5, 3, 7, 2.7, 1.1, palette.light);
  }
  return faces;
}

function railPaint(ring: Ring, yaw: number): Face[] {
  const faces = cameraFaces(ringFaces(ring, "#273f46"), yaw);
  const basis = ring.basis.map((p) => rotateTo(yaw, p));
  const front = Math.sign(dot(basis[2]!, view));
  const point = (r: number, a: number) =>
    add(
      add(scale(r * Math.cos(rad(a)), basis[0]!), scale(r * Math.sin(rad(a)), basis[1]!)),
      scale(front * ring.halfDepth, basis[2]!),
    );
  const patch = (a: number, b: number, left: number, rightEdge: number, color: string) => {
    const radius = ring.radius,
      width = ring.halfWidth;
    faces.push({
      color,
      points: [
        ...sample(a, b).map((angle) => point(radius + left * width, angle)),
        ...sample(b, a).map((angle) => point(radius + rightEdge * width, angle)),
      ],
    });
  };
  const near = (Math.atan2(dot(basis[1]!, view), dot(basis[0]!, view)) * 180) / Math.PI;
  patch(near - 90, near + 90, -0.9, 0.9, "#4a7973");
  patch(near + 90, near + 270, -0.9, 0.9, "#34585d");
  // Three equal banks sit on the bisectors of the open spans.
  for (const angle of [90, 210, 330]) {
    for (const offset of [-5, 0, 5]) {
      const center = angle + offset;
      patch(center - 1.4, center + 1.4, 0.28, 0.53, "#acd3d5");
    }
  }
  return faces;
}

/** A sphere hides the rail except in the projected sliver where the ring plane is nearer. */
function railMask(model: Model, yaw: number, frame: number, id: string): string {
  const n = rotateTo(yaw, model.ring!.basis[2]);
  const facing = dot(n, view);
  const near = sub(view, scale(facing, n));
  const [nx, ny] = projectAt(0, 0, near);
  const roll = (Math.atan2(-nx, ny) * 180) / Math.PI;
  const paths = model.bodies.map((body) => {
    const [x, y] = projectAt(frame / 2, frame / 2, rotateTo(yaw, body.centre));
    const r = body.radius * Math.sqrt(1.5);
    const minor = Math.max(0.005, Math.abs(facing) * r);
    // Even-odd removes the visible sliver from each opaque disk. Black from
    // another nearer body still masks over it wherever the two projections overlap.
    const disk = `M${r} 0 A${r} ${r} 0 0 1 ${-r} 0 A${r} ${r} 0 0 1 ${r} 0Z`;
    const sliver = `M${r} 0 A${r} ${r} 0 0 1 ${-r} 0 A${r} ${minor} 0 0 0 ${r} 0Z`;
    return `<path transform="translate(${x} ${y}) rotate(${roll})" d="${disk}${sliver}" fill="#000" fill-rule="evenodd"/>`;
  });
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${frame}" height="${frame}"><rect width="${frame}" height="${frame}" fill="#fff"/>${paths.join("")}</mask></defs>`;
}

export function paintedStationHull(model: Model, frame: number, yaw: number, title: string) {
  const bodyLayers = model.bodies
    .map((body, ordinal) => ({
      depth: dot(rotateTo(yaw, body.centre), view),
      faces: spherePaint(yaw, body, Boolean(model.ring), ordinal),
    }))
    .sort((a, b) => a.depth - b.depth);
  const layers: Layer[] = [
    ...(model.trim ?? []).map((rail) => ({ faces: cameraFaces(ringFaces(rail, "#7d98bf"), yaw) })),
    ...bodyLayers,
  ];
  const definitions: string[] = [];
  if (model.ring) {
    const mask = `rail-visible-${yaw}`;
    layers.push({ faces: railPaint(model.ring, yaw), mask });
    definitions.push(railMask(model, yaw, frame, mask));
  }
  const points = layers.flatMap(({ faces }) =>
    faces.flatMap(({ points }) => points.map((point) => projectAt(frame / 2, frame / 2, point))),
  );
  const bounds = points.reduce(
    (b, [x, y]) => ({
      left: Math.min(b.left, x),
      right: Math.max(b.right, x),
      top: Math.min(b.top, y),
      bottom: Math.max(b.bottom, y),
    }),
    { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity },
  );
  return { svg: preparedStationHullSvg(frame, title, layers, definitions), bounds };
}
