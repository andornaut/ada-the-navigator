import { CONVERSATIONS } from "../data/conversations.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { PROJECT_THANKS } from "../data/projects.ts";
import type { GameContent } from "../data/types.ts";
import { GameModel, newGameState } from "./game.ts";
import { newProgress } from "./progress.ts";
import type { GalaxyProgress, GameSave } from "./types.ts";

const reopenedConversations = new Set(
  [...CONVERSATIONS, ...PROJECT_THANKS]
    .filter(({ trigger }) => ["chapter", "encounter", "funded", "meeting"].includes(trigger.kind))
    .map(({ id }) => id),
);

function rewindProgress(saved: GalaxyProgress): GalaxyProgress {
  return {
    ...newProgress(),
    charted: saved.charted,
    destroyedEnemies: saved.destroyedEnemies,
    discoveries: saved.discoveries,
    explored: saved.explored,
    ...(saved.geography ? { geography: saved.geography } : {}),
    greetings: saved.greetings,
    ...(saved.hostileSites ? { hostileSites: saved.hostileSites } : {}),
    known: saved.known.filter((id) => id !== "holodisk"),
    ...(saved.markerKnowledge
      ? {
          markerKnowledge: Object.fromEntries(
            Object.entries(saved.markerKnowledge).filter(([id]) => id !== "holodisk"),
          ),
        }
      : {}),
    ...(saved.requiredSites ? { requiredSites: saved.requiredSites } : {}),
    stations: saved.stations,
  };
}

/** A rewind starts with a validated persisted game, never the live game or its cheat snapshot. */
export function rewindCampaign(saved: GameSave): GameSave {
  const next = newGameState();
  next.achievements = saved.achievements;
  next.economy = {
    ...saved.economy,
    ...(saved.flight ? { cargo: saved.flight.cargo } : {}),
  };
  next.prologueSeen = saved.prologueSeen;
  next.seenConversations = saved.seenConversations.filter((id) => !reopenedConversations.has(id));
  next.started = saved.started;
  for (const galaxy of GALAXY_NUMBERS) {
    next.progress[galaxy] = rewindProgress(saved.progress[galaxy]);
  }
  return structuredClone(next);
}

/** Use the ordinary Earth opening and persist its new cursor for Continue. */
export function openRewoundCampaign(content: GameContent, saved: GameSave): GameModel {
  const model = new GameModel(content, rewindCampaign(saved));
  if (model.canContinue) {
    model.continueGame();
  } else {
    model.start();
  }
  return model;
}
