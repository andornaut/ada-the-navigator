interface ActionRootPolicy {
  readonly permits: (element: HTMLElement) => boolean;
}
interface RootEntry {
  readonly policy: ActionRootPolicy;
  active: boolean;
}
const roots = new WeakMap<HTMLElement, RootEntry>();

/** Registers eligibility only; the published input dispatcher owns every gesture. */
export function registerAdaActionRoot(policy: ActionRootPolicy, root: HTMLElement): () => void {
  if (roots.get(root)?.active) {
    throw new Error("Ada action root already registered");
  }
  const entry: RootEntry = { active: true, policy };
  roots.set(root, entry);
  return () => {
    if (roots.get(root) === entry) {
      entry.active = false;
    }
  };
}

/** Every owning ancestor must allow the action, including after root disposal. */
export function adaActionRootAllows(element: HTMLElement): boolean {
  for (let owner: HTMLElement | null = element; owner; owner = owner.parentElement) {
    const entry = roots.get(owner);
    if (entry && (!entry.active || !entry.policy.permits(element))) {
      return false;
    }
  }
  return true;
}

/** Construction checks require a live owning dispatcher, not just a click callback. */
export function adaActionHasRoot(element: HTMLElement): boolean {
  for (let owner: HTMLElement | null = element; owner; owner = owner.parentElement) {
    const entry = roots.get(owner);
    if (entry) {
      return entry.active;
    }
  }
  return false;
}
