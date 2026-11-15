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
    "markerGlintDisplayed" | "markerTargetDisplayed" | "screen" | "state"
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

/** A placed render node supplies identification; missing assets supply no projected-point fallback. */
export function acknowledgeTargetDraws(context: TargetDrawContext): void {
  const { model } = context;
  const flight = model.state.flight;
  if (
    !flight ||
    context.settingsOpen ||
    context.warpCover ||
    model.screen !== "space" ||
    model.state.dialogue ||
    model.state.docked
  ) {
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
      readonly width: number;
    }
  | {
      readonly closed: boolean;
      readonly filled: boolean;
      readonly kind: "path";
      readonly points: readonly Vec[];
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
/** Intersection uses the emitted geometry, including shapes whose origin is outside the view. */
export function primitiveTargetInView(shape: PrimitiveTargetShape): boolean {
  const corners = [
    { x: 0, y: 0 },
    { x: SCREEN.width, y: 0 },
    { x: SCREEN.width, y: SCREEN.height },
    { x: 0, y: SCREEN.height },
  ];
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
    return (
      distance(nearest) <= 1 && (shape.filled || corners.some((corner) => distance(corner) >= 1))
    );
  }
  if (shape.points.length < 2) {
    return false;
  }
  const count = shape.closed ? shape.points.length : shape.points.length - 1;
  for (let i = 0; i < count; i++) {
    if (segmentInView(shape.points[i]!, shape.points[(i + 1) % shape.points.length]!)) {
      return true;
    }
  }
  return shape.filled && corners.some((corner) => contains(shape.points, corner));
}
function primitiveDisplayed(
  context: PrimitiveDrawContext,
  ink: DrawVisibility,
  shape: PrimitiveTargetShape,
): boolean {
  const { model } = context;
  return Boolean(
    model.state.flight &&
    model.screen === "space" &&
    !model.state.dialogue &&
    !model.state.docked &&
    !context.settingsOpen &&
    !context.warpCover &&
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
