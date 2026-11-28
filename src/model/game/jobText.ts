import { DESTINATIONS, STATION_SENTENCE } from "../../data/destinations.ts";
import type { JobType } from "../../data/jobs.ts";
import type { ChapterContent, GalaxyNumber } from "../../data/types.ts";
import { landmarkById, landmarkLabel } from "../landmarks.ts";
import { fill } from "../shop.ts";
import type { JobOffer } from "../types.ts";

interface PlaceLabelContext {
  readonly chapter: () => Pick<ChapterContent, "dialogue" | "name">;
  readonly label: (key: string) => string;
  readonly mappedLabel: () => string | undefined;
  readonly speaker: (chapter: Pick<ChapterContent, "dialogue">) => string | undefined;
}

/** An authored sentence name or the existing mapped and chapter-name fallbacks. */
export function projectPlaceLabel(context: PlaceLabelContext, id: string): string {
  const named =
    context.label(id) || (id.startsWith("settlement:") ? context.label("settlement") : "");
  if (named) {
    return named;
  }
  if (id.startsWith("station:")) {
    return STATION_SENTENCE;
  }
  const chapter = context.chapter();
  return (
    DESTINATIONS[id]?.sentence ?? context.mappedLabel() ?? context.speaker(chapter) ?? chapter.name
  );
}

export function projectJobText(
  label: (key: string) => string,
  placeLabel: (id: string) => string,
  galaxy: GalaxyNumber,
  job: Readonly<Pick<JobOffer, "item" | "target" | "type">>,
): { readonly detail: string; readonly title: string } {
  const landmark = landmarkById(galaxy, job.target.id);
  const titles: Record<JobType, string> = {
    delivery: fill(label("deliveryTitle"), {
      item: job.item,
      place: placeLabel(job.target.id),
    }),
    hunt: fill(label("huntTitle"), { item: job.item }),
    rescue: fill(label("rescueTitle"), { craft: job.item }),
    survey: fill(label("surveyTitle"), {
      landmark: landmark ? landmarkLabel((key) => label(key), landmark) : "",
    }),
  };
  return {
    detail: label(`${job.type}About`),
    title: titles[job.type],
  };
}
