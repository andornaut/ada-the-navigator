import { SPEAKERS } from "../data/conversations.ts";
import { EMERGENCY_RETURN } from "../data/emergencyReturn.ts";
import type { GameState } from "../model/types.ts";
import type { ConversationLineView } from "../ui/conversation.ts";
import type { JumpScene } from "../ui/jumpOverlay.ts";

/** Presentation only: the model has already committed the return and its save outcome. */
export class EmergencyReturn {
  private elapsed = 0;
  private running = false;

  get active(): boolean {
    return this.running;
  }
  private source: JumpScene | null = null;

  get pending(): boolean {
    return this.source !== null;
  }

  get line(): ConversationLineView | null {
    return this.pending
      ? {
          ...SPEAKERS.astra,
          elapsed: this.elapsed,
          key: "emergency-return",
          mood: "upset",
          named: true,
          speaker: "astra",
          text: EMERGENCY_RETURN.line,
        }
      : null;
  }

  begin(returned: boolean, source: JumpScene): boolean {
    if (!returned || this.active) {
      return false;
    }
    this.elapsed = 0;
    this.running = true;
    this.source = source;
    return true;
  }

  /** Hidden time, including a large first frame after resume, cannot consume the warning. */
  advance(visible: boolean, seconds: number): JumpScene | null {
    if (!this.source || !visible || !Number.isFinite(seconds) || seconds <= 0) {
      return null;
    }
    this.elapsed += Math.min(seconds, 0.05);
    if (this.elapsed < EMERGENCY_RETURN.visibleSeconds) {
      return null;
    }
    const source = this.source;
    this.source = null;
    return source;
  }

  cancel(): void {
    this.running = false;
    this.source = null;
    this.elapsed = 0;
  }
}

/** An absorbed hit or a depleted shield that stays in flight is not an emergency return. */
export function returnedOnDepletion(
  wasInSpace: boolean,
  state: Pick<GameState, "mode" | "flight">,
  events: readonly { readonly type: string }[],
): boolean {
  return (
    wasInSpace &&
    state.mode === "home" &&
    !state.flight &&
    events.some((e) => e.type === "depleted")
  );
}
