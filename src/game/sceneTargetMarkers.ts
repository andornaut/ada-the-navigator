import { SCREEN } from "../data/screen.ts";
import { edgeMarkerKind } from "../model/edgeMarkers.ts";
import type { GameModel } from "../model/game.ts";
import { spriteOwner } from "./spriteKeys.ts";
import { isDiscoveryCache } from "./worldArt.ts";

interface DrawnTarget {
  readonly alpha: number;
  readonly visible: boolean;
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
  if (!node.visible || node.alpha <= 0) {
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
