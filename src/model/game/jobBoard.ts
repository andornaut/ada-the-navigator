import { ACTIVITIES } from "../../data/activities.ts";
import type { JobType } from "../../data/jobs.ts";
import { questReward } from "../../data/questRewards.ts";
import type { GalaxyNumber } from "../../data/types.ts";
import { isPostedLead } from "../jobs.ts";
import type { JobOffer } from "../types.ts";

/** A job board row: the held job (Active, with Drop) or an offer, refused while Ada is busy. */
export interface JobRow {
  readonly id: string;
  /** A station job, or the galaxy's active repeatable activity. */
  readonly kind: "activity" | "job";
  /** The row's icon: the job's type, or `activity`. */
  readonly type: JobType | "activity";
  readonly title: string;
  readonly detail: string;
  readonly reward: number;
  readonly state: "held" | "offer" | "busy";
}

interface JobBoardViewContext {
  readonly activity: Readonly<{ held: boolean; id: string; reward: number }> | null;
  readonly busy: boolean;
  readonly galaxy: GalaxyNumber;
  readonly held: JobOffer | undefined;
  readonly jobText: (job: JobOffer) => { readonly detail: string; readonly title: string };
  readonly label: (key: string) => string;
}

/** Project the docked board while preserving the posted lead's precedence over available offers. */
export function dockedJobRows(context: JobBoardViewContext, board: readonly JobOffer[]): JobRow[] {
  const { activity, busy, galaxy, held, jobText, label } = context;
  const row = (job: JobOffer, state: JobRow["state"]): JobRow => ({
    ...jobText(job),
    id: job.id,
    kind: "job",
    reward: questReward(job.reward),
    state,
    type: job.type,
  });
  const activityRow: JobRow[] = activity
    ? [
        {
          detail: label(ACTIVITIES[galaxy]?.goal ?? ""),
          id: activity.id,
          kind: "activity",
          reward: questReward(activity.reward),
          state: activity.held ? "held" : busy ? "busy" : "offer",
          title: ACTIVITIES[galaxy]?.name ?? "",
          type: "activity",
        },
      ]
    : [];
  const offers = board.filter((offer) => offer.id !== held?.id);
  const lead = offers.find(isPostedLead);
  const offerState = busy ? "busy" : "offer";
  const featuredFirst = Boolean(activity?.held) || !lead;
  return [
    ...(featuredFirst ? activityRow : []),
    ...(held ? [row(held, "held")] : []),
    ...(lead ? [row(lead, offerState)] : []),
    ...(featuredFirst ? [] : activityRow),
    ...offers.filter((offer) => !isPostedLead(offer)).map((offer) => row(offer, offerState)),
  ];
}
