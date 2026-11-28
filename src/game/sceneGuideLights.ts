import PROJECTS_FILE from "../../public/art/projects.json" with { type: "json" };
import {
  boundsOnScreen,
  frameBounds,
  outpostParts,
  type PathProjectArt,
  type PlacedProjectArt,
  playDepth,
  readProjectArt,
  revealAlpha,
  stationFrameIndex,
} from "../art/index.ts";
import { ANDROMEDA_PLACES } from "../data/andromeda.ts";
import { SCREEN } from "../data/screen.ts";
import { pointOnCurrent } from "../model/currents.ts";
import {
  guideBeaconCell,
  guideBeaconCellKey,
  guideBeaconSlotAt,
  spareGuideBeacon,
} from "../model/guideBeacons.ts";
import { type NeedleCourse, needleCourses } from "../model/needle.ts";
import type { FlightState, Vec } from "../model/types.ts";
import { flightWorldContext } from "../model/world/index.ts";
import { keylineSprite } from "./sceneHud.ts";
import { needleCourseOffset } from "./sceneNeedle.ts";
import type { ObjectsContext } from "./sceneObjects.ts";
import type { Asset } from "./sceneShared.ts";
import { objectSprite } from "./sceneSprites.ts";

export function channelLampPlaces(
  course: Pick<NeedleCourse, "path" | "width">,
  { inset, sides, spacing, start }: PathProjectArt<Asset>["anchors"],
) {
  const stations = [0];
  for (let index = 1; index < course.path.length; index++) {
    const [from, to] = [course.path[index - 1]!, course.path[index]!];
    stations.push(stations[index - 1]! + Math.hypot(to.x - from.x, to.y - from.y));
  }
  const length = stations.at(-1)!;
  const reach = Math.max(0, course.width / 2 - inset);
  const lamps: { index: number; point: Vec; side: number }[] = [];
  if (length === 0) {
    return lamps;
  }
  for (let index = 0, arc = start; arc <= length; index++, arc += spacing) {
    const { point, tangent } = pointOnCurrent({ length, points: course.path, stations }, arc);
    for (const side of sides) {
      lamps.push({
        index,
        point: { x: point.x - side * tangent.y * reach, y: point.y + side * tangent.x * reach },
        side,
      });
    }
  }
  return lamps;
}

type GuideScene = ObjectsContext &
  Pick<
    import("./scene.ts").GameScene,
    "flightClock" | "flightLive" | "galaxyManifests" | "whirlpoolProjects"
  >;

export function createGuideLights() {
  let assets: readonly Asset[] | undefined;
  let worldArt: ReturnType<typeof readProjectArt<Asset>>;
  let lit: readonly [Asset, Asset] | undefined;
  let local: ReturnType<typeof guideBeaconCell> | undefined;
  let spareFor: { beacon: Vec; point: Vec | undefined } | undefined;
  let practice: NeedleCourse | undefined;
  let lamps: ReturnType<typeof channelLampPlaces> = [];
  return (scene: GuideScene, flight: FlightState): string[] => {
    if (flight.galaxy !== 3 && flight.galaxy !== 4 && flight.galaxy !== 5) {
      return [];
    }
    const galaxyAssets = scene.galaxyManifests.get(flight.galaxy)?.assets;
    if (!galaxyAssets) {
      return [];
    }
    if (assets !== galaxyAssets) {
      assets = galaxyAssets;
      worldArt = readProjectArt(assets, scene.outpostArt, PROJECTS_FILE);
      const a = assets.find(({ id }) => id === "beacon-guide-lit-a");
      const b = assets.find(({ id }) => id === "beacon-guide-lit-b");
      lit = a && b ? [a, b] : undefined;
    }
    const drawn: string[] = [];
    const draw = (
      key: string,
      kind: "guideBeacon" | "needleLamp" | "nurseryBeacon" | "station",
      frame: Asset,
      point: Vec,
      alpha: number,
      depth = playDepth(point.y),
    ) => {
      const sprite = objectSprite(scene, key, frame.id)
        .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setPosition(point.x, point.y)
        .setDepth(depth)
        .setAlpha(alpha);
      keylineSprite(scene, kind, key, sprite);
      scene.passes(sprite);
      drawn.push(key);
    };
    const visible = (frame: Asset, point: Vec) =>
      scene.textures.exists(frame.id) && boundsOnScreen(SCREEN, point, frameBounds(frame));
    const changeAlpha = (project: string, onScreen: boolean): number | undefined => {
      if (!onScreen) {
        return undefined;
      }
      const change = scene.model
        .worldChanges(flight.galaxy)
        .find((entry) => entry.project === project);
      if (!change) {
        return undefined;
      }
      const now = scene.flightClock;
      if (!change.revealed) {
        if (!scene.flightLive || !scene.model.revealWorldChange(flight.galaxy, project)) {
          return undefined;
        }
        if (!scene.reducedMotion) {
          scene.reveals.set(project, now);
        }
      }
      const start = scene.reveals.get(project);
      const duration = (flight.galaxy === 3 ? scene.projectArt : worldArt)?.revealMs ?? 0;
      if (start === undefined || now - start >= duration) {
        scene.reveals.delete(project);
        return 1;
      }
      return revealAlpha(duration, now - start);
    };
    const drawPlaced = (
      project: string,
      kind: Parameters<typeof draw>[1],
      art: PlacedProjectArt<Asset> | undefined,
      anchor: Vec | undefined,
      reducedFrame: 0 | 1 = 0,
    ) => {
      if (!art || !anchor) {
        return;
      }
      const index = scene.reducedMotion
        ? reducedFrame
        : Math.floor(scene.time.now / art.frameMs) % 2;
      const frame = art.frames[index]!;
      const point = scene.project({ x: anchor.x + art.offset.x, y: anchor.y + art.offset.y });
      const alpha = changeAlpha(project, visible(frame, point));
      if (alpha !== undefined) {
        draw(`project:${project}`, kind, frame, point, alpha);
      }
    };

    if (flight.galaxy === 3) {
      const art = scene.whirlpoolProjects;
      const family = flight.objects.find(
        (object) => object.kind === "destination" && object.id === "family",
      );
      drawPlaced("quietCrossing", "nurseryBeacon", art?.quietCrossing, family, art?.reducedFrame);
      return drawn;
    }

    if (flight.galaxy === 5) {
      const school = worldArt?.world.get("courierSchool");
      const base = scene.galaxyStations.get(5)?.base;
      const [a, b] = base?.frames ?? [];
      if (
        base &&
        a?.id === "station-settlers-a" &&
        b?.id === "station-settlers-b" &&
        school?.kind === "stationOverlay" &&
        school.overlay.frames.every((frame) => scene.textures.exists(frame.id))
      ) {
        const index = stationFrameIndex(base, scene.reducedMotion, scene.time.now);
        const parts = outpostParts(
          { frameMs: base.frameMs, frames: [a, b] },
          [school.overlay],
          index,
        ).filter(({ order }) => order !== 0);
        const shown = flight.objects.flatMap((station) => {
          if (station.kind !== "station") {
            return [];
          }
          const base = scene.project(station);
          return parts.flatMap(({ frame, offset, order }) => {
            const point = { x: base.x + offset.x, y: base.y + offset.y };
            const key = `project:courierSchool:${station.id}:${order}`;
            return visible(frame, point)
              ? [{ depth: playDepth(base.y) + order * 1e-7, frame, key, point }]
              : [];
          });
        });
        const alpha = changeAlpha("courierSchool", shown.length > 0);
        if (alpha !== undefined) {
          for (const { depth, frame, key, point } of shown) {
            draw(key, "station", frame, point, alpha, depth);
          }
        }
      }
      const exchange = worldArt?.world.get("routeExchange");
      const settlement = scene.model.state.progress[5].andromeda?.settlement;
      const anchor = settlement
        ? flight.objects.find(
            (object) =>
              object.kind === "destination" &&
              object.id === settlement &&
              object.role === ANDROMEDA_PLACES.settlement,
          )
        : undefined;
      drawPlaced(
        "routeExchange",
        "guideBeacon",
        exchange?.kind === "placed" ? exchange : undefined,
        anchor,
      );
      const beaconId = ANDROMEDA_PLACES.beacon;
      const beacon =
        flight.objects.find((object) => object.id === beaconId) ??
        scene.model.state.progress[5].requiredSites?.[beaconId];
      if (lit) {
        if (local?.key !== guideBeaconCellKey(flight.player)) {
          local = guideBeaconCell(flight.player);
        }
        for (const slot of local.slots) {
          if (beacon && Math.hypot(slot.point.x - beacon.x, slot.point.y - beacon.y) < 1e-6) {
            continue;
          }
          const frame = lit[slot.index % 2]!;
          const point = scene.project(slot.point);
          if (visible(frame, point)) {
            draw(`guide:${slot.id}`, "guideBeacon", frame, point, 1);
          }
        }
      }
      const spare = worldArt?.world.get("spareBeacon");
      if (spare?.kind === "overlay" && beacon && scene.model.state.progress[5].questComplete) {
        // The spare can only appear near the dark beacon, so defer its link lookup until nearby.
        if (Math.hypot(beacon.x - flight.player.x, beacon.y - flight.player.y) <= 600) {
          if (spareFor?.beacon.x !== beacon.x || spareFor.beacon.y !== beacon.y) {
            const slot = guideBeaconSlotAt(beacon);
            spareFor = {
              beacon: { x: beacon.x, y: beacon.y },
              point: slot && spareGuideBeacon(slot),
            };
          }
          if (spareFor.point) {
            const point = scene.project(spareFor.point);
            const alpha = changeAlpha("spareBeacon", visible(spare.frame, point));
            if (alpha !== undefined) {
              draw("project:spareBeacon", "guideBeacon", spare.frame, point, alpha);
            }
          }
        }
      }
      return drawn;
    }

    const course = needleCourses(flight)?.practice;
    const berth = worldArt?.world.get("practiceBerth");
    drawPlaced(
      "practiceBerth",
      "needleLamp",
      berth?.kind === "placed" ? berth : undefined,
      course?.path[0],
    );
    const art = worldArt?.world.get("channelLights");
    if (art?.kind !== "path" || !course) {
      return drawn;
    }
    if (practice !== course) {
      practice = course;
      lamps = channelLampPlaces(practice, art.anchors);
    }
    const shift = needleCourseOffset(course, flight.player, flightWorldContext(flight));
    const tick = Math.floor(scene.time.now / art.frameMs);
    const shown = lamps.flatMap(({ index, point, side }) => {
      const phase = scene.reducedMotion ? 0 : (tick + index + (side === 1 ? 1 : 0)) % 2;
      const frame = art.frames[phase]!;
      const screen = scene.project({ x: point.x + shift.x, y: point.y + shift.y });
      return visible(frame, screen) ? [{ frame, index, screen, side }] : [];
    });
    const alpha = changeAlpha("channelLights", shown.length > 0);
    if (alpha !== undefined) {
      for (const { frame, index, screen, side } of shown) {
        draw(`project:channelLights:${index}:${side}`, "needleLamp", frame, screen, alpha);
      }
    }
    return drawn;
  };
}
