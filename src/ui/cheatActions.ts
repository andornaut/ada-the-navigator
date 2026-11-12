import { type AppWindowHost, runsInAppWindow } from "@andornaut/game-kit/web/pwa/appWindow";

export interface CheatExecution {
  /** Deferred actions must put their mutation inside this eligibility-checked callback. */
  commit(effect: () => void): boolean;
}

export interface CheatAction {
  readonly description: string;
  readonly execute: (context: CheatExecution) => void | Promise<void>;
  readonly id: string;
  readonly label: string;
  readonly scope: "save" | "run";
}

/** The cheat groups to show, Save-changing then Run-only; a group with no actions is hidden. */
export function cheatGroups(actions: readonly Pick<CheatAction, "scope">[]): ("save" | "run")[] {
  return (["save", "run"] as const).filter((scope) =>
    actions.some((action) => action.scope === scope),
  );
}

export interface CheatSessionOptions {
  readonly actions: readonly CheatAction[];
  readonly canExecute: () => boolean;
  readonly host: AppWindowHost;
  readonly onSave: () => void;
  readonly run: () => object | null;
}

export function createCheatSession(options: CheatSessionOptions) {
  let disposed = false;
  let epoch = 0;
  const pending = new Set<symbol>();
  let run = options.run();
  let eligible = !runsInAppWindow(options.host);
  const refresh = (): boolean => {
    const nextRun = options.run();
    const nextEligible = !disposed && !runsInAppWindow(options.host);
    if (nextRun !== run || nextEligible !== eligible) {
      epoch++;
    }
    run = nextRun;
    eligible = nextEligible;
    return eligible;
  };
  const available = (): boolean => refresh() && run !== null && options.canExecute();
  return {
    available,
    busy: () => pending.size > 0,
    dispose(): void {
      disposed = true;
      epoch++;
    },
    eligible: refresh,
    async execute(id: string): Promise<boolean> {
      if (pending.size > 0 || !available()) {
        return false;
      }
      const action = options.actions.find((entry) => entry.id === id);
      if (!action) {
        return false;
      }
      const token = epoch;
      let committed = false;
      const work = Symbol("cheat invocation");
      pending.add(work);
      try {
        await action.execute({
          commit(effect) {
            if (!pending.has(work) || !available() || epoch !== token) {
              return false;
            }
            effect();
            if (action.scope === "save") {
              options.onSave();
            }
            committed = true;
            return true;
          },
        });
        return committed;
      } finally {
        pending.delete(work);
      }
    },
  };
}
