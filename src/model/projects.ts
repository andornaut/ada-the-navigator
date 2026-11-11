import type { CommunityProject, ProjectAlly } from "../data/projects.ts";
import type { SectorProgress } from "./types.ts";

// Community projects (gameplay/economy.md "Donations"): once a galaxy's chapter is complete, its
// stations offer its projects, which Ada funds with Stardust in parts, with progress kept across
// flights. A funded project plays its thank-you line, changes the world at its site, counts
// toward achievements and makes one ally for the finale. No project changes combat outside it.

/** What one Donate press pays at most. */
export const DONATION_STEP = 100;

export type ProjectProgress = Pick<SectorProgress, "donated" | "resolved">;

/** A project as the station shows it: what is paid, what remains, and whether it is funded. */
export interface ProjectView {
  readonly cost: number;
  readonly funded: boolean;
  readonly id: string;
  readonly name: string;
  readonly paid: number;
  readonly remaining: number;
}

/** A Donate press: refused, or paid, with whether that payment funded the project. */
export type DonationResult =
  | { readonly kind: "refused" }
  | { readonly amount: number; readonly funded: boolean; readonly kind: "paid" };

/** Projects are offered once the galaxy's chapter is complete: its space story and home page. */
export function projectsOffered(progress: ProjectProgress): boolean {
  return progress.resolved;
}

/** Each of a galaxy's projects with its progress. */
export function projectViews(
  projects: readonly CommunityProject[],
  progress: ProjectProgress,
): ProjectView[] {
  return projects.map(({ cost, id, name }) => {
    const paid = Math.min(cost, progress.donated[id] ?? 0);
    return { cost, funded: paid >= cost, id, name, paid, remaining: cost - paid };
  });
}

/** What one Donate press costs: the step, or less when less remains. */
export function donationAmount(view: ProjectView): number {
  return Math.min(DONATION_STEP, view.remaining);
}

/**
 * One Donate press toward a project, paid from balance when it covers the press. Refused when
 * projects are not offered, the project is unknown or funded, or the balance falls short.
 */
export function donate(
  projects: readonly CommunityProject[],
  progress: ProjectProgress,
  balance: number,
  id: string,
): DonationResult {
  const view = projectViews(projects, progress).find((entry) => entry.id === id);
  if (!view || view.funded || !projectsOffered(progress)) {
    return { kind: "refused" };
  }
  const amount = donationAmount(view);
  if (amount > balance) {
    return { kind: "refused" };
  }
  progress.donated[id] = view.paid + amount;
  return { amount, funded: amount === view.remaining, kind: "paid" };
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

/** The galaxy's allies for the Black Eye finale: one per funded project. */
export function projectAllies(
  projects: readonly CommunityProject[],
  progress: ProjectProgress,
): { readonly ally: ProjectAlly; readonly project: string }[] {
  return fundedProjects(projects, progress).map(({ ally, id }) => ({ ally, project: id }));
}

/**
 * The galaxy's world changes: each funded project's site, where Art's sprite shows on every later
 * flight. CLEANUP (added 2026-11-11): the scene draws nothing for them until Art's world-change
 * sprites land; draw each at its site then.
 */
export function worldChanges(
  projects: readonly CommunityProject[],
  progress: ProjectProgress,
): { readonly project: string; readonly site: string }[] {
  return fundedProjects(projects, progress).map(({ id, site }) => ({ project: id, site }));
}
