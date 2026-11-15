export type EntryRecoveryPhase = "module-import" | "unavailable-retirement";

/** These entry boundaries require a fresh document rather than an in-place file retry. */
export class EntryReloadRequired extends Error {
  readonly phase: EntryRecoveryPhase;

  constructor(phase: EntryRecoveryPhase, cause: unknown) {
    super("Startup requires an explicit document retry", { cause });
    this.name = "EntryReloadRequired";
    this.phase = phase;
  }
}
