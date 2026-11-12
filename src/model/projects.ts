import type { CommunityProject, ProjectAlly } from "../data/projects.ts";
import type { GalaxyProgress } from "./types.ts";

// Community projects (gameplay/economy.md "Donations"): once a galaxy's chapter is complete, its
// stations offer its projects, which Ada funds with Stardust in parts, with progress kept across
// flights. A funded project plays its thank-you line, changes the world at its site, counts
// toward achievements and makes one ally for the finale. No project changes combat outside it.

export type ProjectProgress = Pick<GalaxyProgress, "donated" | "resolved" | "revealed">;

/** A funded project's world change at its site, and whether its reveal has played. */
export interface WorldChange {
  readonly project: string;
  readonly revealed: boolean;
  readonly site: string;
}

/** A project as the station shows it: what is paid, what remains, and whether it is funded. */
export interface ProjectView {
  /** Its effect line's and description's label key suffix. */
  readonly copy: string;
  readonly cost: number;
  readonly funded: boolean;
  readonly icon: string;
  readonly id: string;
  readonly name: string;
  readonly paid: number;
  readonly remaining: number;
}

/** A donation: refused, or paid, with whether that payment funded the project. */
export type DonationResult =
  | { readonly kind: "refused" }
  | { readonly amount: number; readonly funded: boolean; readonly kind: "paid" };

/** What the donation confirm shows: the amount it pays, and what is left and still needed after. */
export type DonationRequest =
  | { readonly kind: "refused" }
  | {
      readonly amount: number;
      readonly kind: "confirm";
      readonly left: number;
      readonly stillNeeded: number;
    };

/** Projects are offered once the galaxy's chapter is complete: its space story and home page. */
export function projectsOffered(progress: ProjectProgress): boolean {
  return progress.resolved;
}

/** Each of a galaxy's projects with its progress. */
export function projectViews(
  projects: readonly CommunityProject[],
  progress: ProjectProgress,
): ProjectView[] {
  return projects.map(({ copy, cost, icon, id, name }) => {
    const paid = Math.min(cost, progress.donated[id] ?? 0);
    return { copy, cost, funded: paid >= cost, icon, id, name, paid, remaining: cost - paid };
  });
}

/** What a donation pays: as much of the remaining cost as the balance covers. */
export function donationAmount(view: ProjectView, balance: number): number {
  return Math.max(0, Math.min(view.remaining, Math.floor(balance)));
}

/**
 * The confirm for a donation toward a project, or refused when projects are not offered, the
 * project is unknown or funded, or the balance is empty.
 */
export function donationRequest(
  projects: readonly CommunityProject[],
  progress: ProjectProgress,
  balance: number,
  id: string,
): DonationRequest {
  const view = projectViews(projects, progress).find((entry) => entry.id === id);
  const amount =
    view && !view.funded && projectsOffered(progress) ? donationAmount(view, balance) : 0;
  return view && amount > 0
    ? { amount, kind: "confirm", left: balance - amount, stillNeeded: view.remaining - amount }
    : { kind: "refused" };
}

/**
 * A confirmed donation toward a project: it pays min(balance, remaining), so a short balance
 * makes a part payment that persists. Refused as donationRequest refuses.
 */
export function donate(
  projects: readonly CommunityProject[],
  progress: ProjectProgress,
  balance: number,
  id: string,
): DonationResult {
  const request = donationRequest(projects, progress, balance, id);
  if (request.kind === "refused") {
    return request;
  }
  progress.donated[id] = (progress.donated[id] ?? 0) + request.amount;
  return { amount: request.amount, funded: request.stillNeeded === 0, kind: "paid" };
}

/** The galaxy's funded projects, which count toward achievements. */
export function fundedProjects(
  projects: readonly CommunityProject[],
  progress: ProjectProgress,
): CommunityProject[] {
  const funded = new Set(
    projectViews(projects, progress)
      .filter((view) => view.funded)
      .map(({ id }) => id),
  );
  return projects.filter(({ id }) => funded.has(id));
}

/** The galaxy's allies for the Phantom finale: one per funded project. */
export function projectAllies(
  projects: readonly CommunityProject[],
  progress: ProjectProgress,
): { readonly ally: ProjectAlly; readonly project: string }[] {
  return fundedProjects(projects, progress).map(({ ally, id }) => ({ ally, project: id }));
}

/**
 * The galaxy's world changes: each funded project's site, where Art's change shows on every later
 * flight once its one reveal has played.
 */
export function worldChanges(
  projects: readonly CommunityProject[],
  progress: ProjectProgress,
): WorldChange[] {
  return fundedProjects(projects, progress).map(({ id, site }) => ({
    project: id,
    revealed: progress.revealed.includes(id),
    site,
  }));
}

/** Records a funded project's reveal as played; false if it is unfunded or already revealed. */
export function revealWorldChange(
  projects: readonly CommunityProject[],
  progress: ProjectProgress,
  id: string,
): boolean {
  const funded = fundedProjects(projects, progress).some((project) => project.id === id);
  if (!funded || progress.revealed.includes(id)) {
    return false;
  }
  progress.revealed.push(id);
  return true;
}
