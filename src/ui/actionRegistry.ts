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

/** Structural ownership requires an owning root and every registered ancestor to remain live. */
export function adaActionHasRoot(element: HTMLElement): boolean {
  let found = false;
  for (let owner: HTMLElement | null = element; owner; owner = owner.parentElement) {
    const entry = roots.get(owner);
    if (entry) {
      found = true;
      if (!entry.active) {
        return false;
      }
    }
  }
  return found;
}

/** A nested registered root owns its subtree, including while disposed. */
export function adaActionOwnedBy(root: HTMLElement, element: HTMLElement): boolean {
  for (let owner: HTMLElement | null = element; owner; owner = owner.parentElement) {
    const entry = roots.get(owner);
    if (entry) {
      return owner === root && entry.active;
    }
  }
  return false;
}
