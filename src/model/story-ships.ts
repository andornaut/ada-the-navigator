import { PROJECTS } from "../data/projects.ts";
import {
  CARTWHEEL_STORY_SHIPS,
  type StoryPath,
  type StorySceneId,
  type StoryShipId,
} from "../data/story-ships.ts";
import { fundedProjects, type ProjectProgress } from "./projects.ts";
import type { SectorProgress, Vec } from "./types.ts";

/** A story ship's world position, unit heading and whether its thrust jets fire. */
export interface StoryShip extends Vec {
  heading: Vec;
  id: StoryShipId;
  thrust: boolean;
}

/** The scene playing in a flight: which, the flight time it started, and whether its line is due. */
export interface StorySceneState {
  at: number;
  id: StorySceneId;
  lineDue: boolean;
}

const STAGE_DOCKED = 5;

function unit(v: Vec): Vec {
  const size = Math.hypot(v.x, v.y);
  return size > 0 ? { x: v.x / size, y: v.y / size } : { x: 0, y: -1 };
}

/** Position, heading and thrust along a path `t` seconds in; holds the ends outside it. */
function along(path: StoryPath, t: number): { heading: Vec; point: Vec; thrust: boolean } {
  const first = path[0]!;
  const last = path.at(-1)!;
  if (t <= first.at || path.length === 1) {
    const next = path[1] ?? first;
    return {
      heading: unit({ x: next.x - first.x, y: next.y - first.y }),
      point: first,
      thrust: false,
    };
  }
  for (let index = 1; index < path.length; index++) {
    const from = path[index - 1]!;
    const to = path[index]!;
    if (t <= to.at) {
      const span = to.at - from.at;
      const f = span > 0 ? (t - from.at) / span : 1;
      if (from.x === to.x && from.y === to.y) {
        const next = path.slice(index).find((point) => point.x !== from.x || point.y !== from.y);
        const ahead = next ? unit({ x: next.x - from.x, y: next.y - from.y }) : { x: 0, y: -1 };
        return { heading: ahead, point: from, thrust: false };
      }
      return {
        heading: unit({ x: to.x - from.x, y: to.y - from.y }),
        point: { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f },
        thrust: true,
      };
    }
  }
  const before = path.at(-2)!;
  return {
    heading: unit({ x: last.x - before.x, y: last.y - before.y }),
    point: last,
    thrust: false,
  };
}

/**
 * Cartwheel's story ships around the hub at flight time `time`. They are not flight objects,
 * so shots pass through them and they never fight. The miner and the visitors wait at their
 * holding points until the docking scene, after which they stay docked, facing into their
 * docks; `bay` (hubBay) moves the first visitor to the second docking bay's berth. The
 * blocking pilot flies only in its scenes.
 */
export function storyShips(
  hub: Vec,
  progress: Pick<SectorProgress, "stage">,
  bay: boolean,
  scene: StorySceneState | undefined,
  time: number,
): StoryShip[] {
  const data = CARTWHEEL_STORY_SHIPS;
  const playing =
    scene && time >= scene.at && time < scene.at + data.scenes[scene.id].duration
      ? data.scenes[scene.id]
      : undefined;
  const ships: StoryShip[] = [];
  const place = (id: StoryShipId, local: Vec, heading: Vec, thrust: boolean) =>
    ships.push({ heading, id, thrust, x: hub.x + local.x, y: hub.y + local.y });
  for (const id of ["miner", "visitor-1", "visitor-2", "blocker"] as const) {
    const path = playing?.paths[id];
    if (path) {
      const { heading, point, thrust } = along(path, time - scene!.at);
      place(id, point, heading, thrust);
    } else if (id !== "blocker" && progress.stage < STAGE_DOCKED) {
      const hold = data.hold[id];
      place(id, hold, unit({ x: -hold.x, y: -hold.y }), false);
    } else if (id !== "blocker") {
      const docked = data.docked[bay ? "bay" : "hub"][id];
      place(id, docked.at, docked.heading, false);
    }
  }
  return ships;
}

/** A heading snapped to the nearest of the 16 drawn headings. */
export function drawnHeading(heading: Vec): Vec {
  const step = (Math.PI * 2) / 16;
  const angle = Math.round(Math.atan2(heading.y, heading.x) / step) * step;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/** Whether Cartwheel's project with this id is funded. */
function cartwheelFunded(progress: ProjectProgress, id: string): boolean {
  return fundedProjects(PROJECTS[2], progress).some((project) => project.id === id);
}

/** The hub looks worn until its Hub repairs project is funded. */
export function hubWorn(progress: ProjectProgress): boolean {
  return !cartwheelFunded(progress, "hubRepairs");
}

/** The second docking bay overlays the hub once its project is funded. */
export function hubBay(progress: ProjectProgress): boolean {
  return cartwheelFunded(progress, "dockingBay");
}
