import { SCREEN } from "../data/screen.ts";
import { edgeMarkerKind } from "../model/edgeMarkers.ts";
import type { GameModel } from "../model/game.ts";
import type { Vec } from "../model/types.ts";
import { spriteOwner } from "./spriteKeys.ts";
import { isDiscoveryCache } from "./worldArt.ts";

interface DrawnTarget {
  readonly alpha: number;
  readonly visible: boolean;
  readonly mask?: unknown;
  readonly parentContainer?: DrawnTarget | null;
  getBounds(): {
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
  };
}
interface TargetDrawContext {
  readonly enemySprites: ReadonlyMap<string, DrawnTarget>;
  readonly glintSprite?: DrawnTarget | undefined;
  readonly landmarkSprites: ReadonlyMap<string, DrawnTarget>;
  readonly litCaches: ReadonlySet<string>;
  readonly model: Pick<
    GameModel,
    | "discoveryCacheDisplayed"
    | "markerGlintDisplayed"
    | "markerTargetDisplayed"
    | "screen"
    | "state"
  >;
  readonly revealGroups: ReadonlyMap<string, DrawnTarget>;
  readonly settingsOpen: boolean;
  readonly warpCover: boolean;
}
function displayed(node: DrawnTarget): boolean {
  if (!visibleInk(node)) {
    return false;
  }
  const bounds = node.getBounds();
  return (
    bounds.right > bounds.left &&
    bounds.bottom > bounds.top &&
    bounds.right > 0 &&
    bounds.bottom > 0 &&
    bounds.left < SCREEN.width &&
    bounds.top < SCREEN.height
  );
}

type TargetVisibilityContext = Pick<TargetDrawContext, "model" | "settingsOpen" | "warpCover">;

function targetDrawVisible(context: TargetVisibilityContext): boolean {
  const { model, settingsOpen, warpCover } = context;
  return (
    model.screen === "space" &&
    !model.state.dialogue &&
    !model.state.docked &&
    !settingsOpen &&
    !warpCover
  );
}

/** A placed render node supplies identification; missing assets supply no projected-point fallback. */
export function acknowledgeTargetDraws(context: TargetDrawContext): void {
  const { model } = context;
  const flight = model.state.flight;
  if (!flight || !targetDrawVisible(context)) {
    return;
  }
  const ids = new Set(
    flight.objects
      .filter(
        (object) =>
          object.hp > 0 &&
          (object.kind === "destination" ||
            edgeMarkerKind(object) !== null ||
            isDiscoveryCache(object)),
      )
      .map(({ id }) => id),
  );
  const seen = new Set<string>();
  for (const [nodes, landmarks] of [
    [context.enemySprites, false],
    [context.revealGroups, false],
    [context.landmarkSprites, true],
  ] as const) {
    for (const [key, node] of nodes) {
      const owner = spriteOwner(key);
      const id = ids.has("family") && owner.startsWith("family:") ? "family" : owner;
      if ((!landmarks && !ids.has(id)) || seen.has(id) || !displayed(node)) {
        continue;
      }
      seen.add(id);
      model.markerTargetDisplayed(id, context.litCaches);
    }
  }
  if (context.glintSprite && displayed(context.glintSprite)) {
    model.markerGlintDisplayed();
  }
}

export type PrimitiveTargetShape =
  | {
      readonly center: Vec;
      readonly filled: boolean;
      readonly height: number;
      readonly kind: "ellipse";
      readonly strokeWidth?: 1 | 1.5 | 2;
      readonly width: number;
    }
  | {
      readonly closed: boolean;
      readonly filled: boolean;
      readonly kind: "path";
      readonly points: readonly Vec[];
      readonly strokeWidth?: 1 | 1.5 | 2;
    };

interface DrawVisibility {
  readonly alpha: number;
  readonly mask?: unknown;
  readonly parentContainer?: DrawVisibility | null;
  readonly visible: boolean;
}
type PrimitiveDrawContext = Pick<
  TargetDrawContext,
  "litCaches" | "model" | "settingsOpen" | "warpCover"
>;

function visibleInk(node: DrawVisibility): boolean {
  for (
    let current: DrawVisibility | null | undefined = node;
    current;
    current = current.parentContainer
  ) {
    if (!current.visible || current.alpha <= 0 || current.mask) {
      return false;
    }
  }
  return true;
}
function segmentInView(a: Vec, b: Vec): boolean {
  let enter = 0,
    leave = 1;
  for (const [start, delta, extent] of [
    [a.x, b.x - a.x, SCREEN.width],
    [a.y, b.y - a.y, SCREEN.height],
  ]) {
    if (delta === 0) {
      if (start! < 0 || start! > extent!) {
        return false;
      }
    } else {
      const first = -start! / delta!,
        second = (extent! - start!) / delta!;
      enter = Math.max(enter, Math.min(first, second));
      leave = Math.min(leave, Math.max(first, second));
      if (enter > leave) {
        return false;
      }
    }
  }
  return true;
}
function contains(points: readonly Vec[], point: Vec): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!,
      b = points[j]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}
function distanceToViewSquared(point: Vec): number {
  const x = Math.max(0, -point.x, point.x - SCREEN.width);
  const y = Math.max(0, -point.y, point.y - SCREEN.height);
  return x * x + y * y;
}

/** Euclidean distance to an axis-aligned ellipse, including points inside its boundary. */
function ellipseDistance(center: Vec, width: number, height: number, point: Vec): number {
  const horizontal = width >= height;
  const a = Math.max(width, height) / 2,
    b = Math.min(width, height) / 2;
  const x = Math.abs(horizontal ? point.x - center.x : point.y - center.y);
  const y = Math.abs(horizontal ? point.y - center.y : point.x - center.x);
  if (a === b) {
    return Math.abs(Math.hypot(x, y) - a);
  }
  if (y === 0) {
    const at = (a * x) / (a * a - b * b);
    if (at >= 1) {
      return Math.abs(x - a);
    }
    return Math.hypot(a * at - x, b * Math.sqrt(1 - at * at));
  }
  let low = -b * b + b * y;
  let high = Math.max(0, Math.hypot(a * x, b * y));
  for (let i = 0; i < 64; i++) {
    const mid = (low + high) / 2;
    const value = ((a * x) / (mid + a * a)) ** 2 + ((b * y) / (mid + b * b)) ** 2;
    if (value > 1) {
      low = mid;
    } else {
      high = mid;
    }
  }
  const t = (low + high) / 2;
  return Math.hypot((a * a * x) / (t + a * a) - x, (b * b * y) / (t + b * b) - y);
}

function pathInView(points: readonly Vec[], closed: boolean, filled: boolean): boolean {
  if (points.length < 2) {
    return false;
  }
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    if (segmentInView(points[i]!, points[(i + 1) % points.length]!)) {
      return true;
    }
  }
  return filled && viewCorners().some((corner) => contains(points, corner));
}
function viewCorners(): Vec[] {
  return [
    { x: 0, y: 0 },
    { x: SCREEN.width, y: 0 },
    { x: SCREEN.width, y: SCREEN.height },
    { x: 0, y: SCREEN.height },
  ];
}

/** Current WebGL strokes are at most two pixels wide and use butt-ended segment quads. */
function strokePathInView(points: readonly Vec[], closed: boolean, width: number): boolean {
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i]!,
      b = points[(i + 1) % points.length]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) {
      continue;
    }
    const x = ((b.y - a.y) * width) / (2 * length),
      y = ((a.x - b.x) * width) / (2 * length);
    if (
      pathInView(
        [
          { x: a.x + x, y: a.y + y },
          { x: a.x - x, y: a.y - y },
          { x: b.x - x, y: b.y - y },
          { x: b.x + x, y: b.y + y },
        ],
        true,
        true,
      )
    ) {
      return true;
    }
  }
  return false;
}

/** Intersection uses the emitted geometry, including shapes whose origin is outside the view. */
export function primitiveTargetInView(shape: PrimitiveTargetShape): boolean {
  const corners = viewCorners();
  if (shape.kind === "ellipse") {
    if (!(shape.width > 0 && shape.height > 0)) {
      return false;
    }
    const { center, height, width } = shape;
    const distance = (point: Vec) =>
      ((point.x - center.x) / (width / 2)) ** 2 + ((point.y - center.y) / (height / 2)) ** 2;
    const nearest = {
      x: Math.max(0, Math.min(SCREEN.width, center.x)),
      y: Math.max(0, Math.min(SCREEN.height, center.y)),
    };
    if (
      distance(nearest) <= 1 &&
      (shape.filled || corners.some((corner) => distance(corner) >= 1))
    ) {
      return true;
    }
    if (!shape.strokeWidth) {
      return false;
    }
    const half = shape.strokeWidth / 2;
    const extremes = [
      { x: center.x - width / 2, y: center.y },
      { x: center.x + width / 2, y: center.y },
      { x: center.x, y: center.y - height / 2 },
      { x: center.x, y: center.y + height / 2 },
    ];
    return (
      extremes.some((point) => distanceToViewSquared(point) < half * half) ||
      corners.some((point) => ellipseDistance(center, width, height, point) < half)
    );
  }
  return (
    pathInView(shape.points, shape.closed, shape.filled) ||
    Boolean(shape.strokeWidth && strokePathInView(shape.points, shape.closed, shape.strokeWidth))
  );
}

function primitiveDisplayed(
  context: PrimitiveDrawContext,
  ink: DrawVisibility,
  shape: PrimitiveTargetShape,
): boolean {
  const { model } = context;
  return Boolean(
    model.state.flight &&
    targetDrawVisible(context) &&
    visibleInk(ink) &&
    primitiveTargetInView(shape),
  );
}

/** Called only after the named target's existing primitive draw command has executed. */
export function acknowledgePrimitiveTarget(
  context: PrimitiveDrawContext,
  ink: DrawVisibility,
  shape: PrimitiveTargetShape,
  id: string,
): void {
  if (primitiveDisplayed(context, ink, shape)) {
    context.model.markerTargetDisplayed(id, context.litCaches);
  }
}

/** A live cache member qualifies only through its placed frame or emitted fallback. */
export function acknowledgeCacheSprite(
  context: TargetVisibilityContext,
  node: DrawnTarget,
  group: string,
): void {
  if (targetDrawVisible(context) && displayed(node)) {
    context.model.discoveryCacheDisplayed(group);
  }
}

export function acknowledgeCachePrimitive(
  context: PrimitiveDrawContext,
  ink: DrawVisibility,
  shape: PrimitiveTargetShape,
  group: string,
): void {
  if (primitiveDisplayed(context, ink, shape)) {
    context.model.discoveryCacheDisplayed(group);
  }
}

/** The hunt's emitted cross shares its existing canonical job identity. */
export function acknowledgePrimitiveGlint(
  context: PrimitiveDrawContext,
  ink: DrawVisibility,
  shape: PrimitiveTargetShape,
): void {
  if (primitiveDisplayed(context, ink, shape)) {
    context.model.markerGlintDisplayed();
  }
}
