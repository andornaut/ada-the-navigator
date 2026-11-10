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
  let busy = false;
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
    busy: () => busy,
    dispose(): void {
      disposed = true;
      epoch++;
    },
    eligible: refresh,
    async execute(id: string): Promise<boolean> {
      if (busy || !available()) {
        return false;
      }
      const action = options.actions.find((entry) => entry.id === id);
      if (!action) {
        return false;
      }
      const token = epoch;
      let committed = false;
      busy = true;
      try {
        await action.execute({
          commit(effect) {
            if (!available() || epoch !== token) {
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
        busy = false;
      }
    },
  };
}
