import type { Scene, StoryPosition } from "../storybook.ts";
import { storyCursor, type StorySceneReference } from "../storyCursor.ts";
import { referenceStoryScene } from "../storyScenes.ts";
import type { FlightState, GameSave, GameState } from "../types.ts";

export type HeldFlight = Pick<GameState, "dialogue" | "docked" | "flight" | "mode" | "notice">;

interface SaveSnapshotContext {
  readonly depletionContinuation: boolean;
  readonly emergency: (scene: Scene) => StorySceneReference | undefined;
  readonly heldFlight: HeldFlight | null;
  readonly pendingInteraction: NonNullable<GameSave["pendingInteraction"]> | null;
  readonly story: { readonly position: StoryPosition; readonly slept: number } | null;
}

function saveFlight({ enemyBeams, ...flight }: FlightState): FlightState {
  const pending = enemyBeams?.filter((beam) => !beam.fired && !beam.authored);
  return {
    ...flight,
    ...(flight.needle ? { needle: { ...flight.needle, chatter: [] } } : {}),
    ...(pending?.length ? { enemyBeams: structuredClone(pending) } : {}),
  };
}

/** Project the saved flight and story while leaving live model state alone. */
export function saveSnapshot(context: SaveSnapshotContext, state: GameState): GameSave {
  const { depletionContinuation, emergency, heldFlight, pendingInteraction, story } = context;
  const effective = heldFlight ? { ...state, ...heldFlight } : state;
  const flight = effective.flight;
  const snapshot =
    flight && (flight.needle || flight.phantom || flight.enemyBeams)
      ? { ...effective, flight: saveFlight(flight) }
      : effective;
  return {
    ...snapshot,
    depletionContinuation: depletionContinuation || undefined,
    pendingInteraction: pendingInteraction ?? undefined,
    pendingStory: story
      ? {
          cursor: storyCursor(
            { reference: (scene) => referenceStoryScene({ emergency }, scene) },
            story.position,
          ),
          slept: story.slept,
        }
      : undefined,
  };
}
