interface ActionRootPolicy {
  readonly permits: (element: HTMLElement) => boolean;
}
interface RootEntry {
  readonly policy: ActionRootPolicy;
  active: boolean;
}
const roots = new WeakMap<HTMLElement, RootEntry>();
const ancestorScopes = new WeakMap<HTMLElement, { readonly root: HTMLElement }>();

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

/** Let an app-wide control group share input ownership with the UI it restores focus to. */
export function registerAdaAncestorActionScope(scope: HTMLElement, root: HTMLElement): () => void {
  if (
    scope === root ||
    !root.contains(scope) ||
    !roots.get(root)?.active ||
    ancestorScopes.has(scope)
  ) {
    throw new Error("Invalid ancestor action scope");
  }
  const entry = { root };
  ancestorScopes.set(scope, entry);
  return () => {
    if (ancestorScopes.get(scope) === entry) {
      ancestorScopes.delete(scope);
    }
  };
}

/** A nested registered root owns its subtree unless a group explicitly shares an ancestor root. */
export function adaActionOwner(element: HTMLElement): HTMLElement | undefined {
  for (let owner: HTMLElement | null = element; owner; owner = owner.parentElement) {
    const ancestor = ancestorScopes.get(owner);
    if (ancestor) {
      return roots.get(ancestor.root)?.active === true ? ancestor.root : undefined;
    }
    const entry = roots.get(owner);
    if (entry) {
      return entry.active ? owner : undefined;
    }
  }
  return undefined;
}

export function adaActionOwnedBy(root: HTMLElement, element: HTMLElement): boolean {
  return root.contains(element) && adaActionOwner(element) === root;
}
