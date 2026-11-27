import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import type { ConversationDirector } from "./conversations.ts";
import {
  acknowledgePhantomBlockadeRecovery,
  phantomBlockadeSignal,
  type PhantomContext,
} from "./phantom.ts";

const recoveryLine = {
  speaker: "astra",
  text: "Pull back and recharge if you need to. The frigate waits ahead.",
} as const;

/** Uses the nonmodal box's ordinary warning priority and first-showing receipt. */
export function queuePhantomBlockadeCue(
  talk: Pick<ConversationDirector, "authoredCue">,
  seen: readonly string[],
  context: PhantomContext,
): void {
  for (const id of PHANTOM_DESTINATIONS) {
    const signal = phantomBlockadeSignal(context, id);
    if (signal?.phase !== "recovery" || !signal.cuePending) {
      continue;
    }
    const key = `phantom:blockade:recovery:${id}`;
    const acknowledge = () => acknowledgePhantomBlockadeRecovery(context, id);
    if (seen.includes(key)) {
      acknowledge();
    } else {
      talk.authoredCue(key, recoveryLine, {
        onFirstShowing: acknowledge,
        relevant: () => phantomBlockadeSignal(context, id)?.phase === "recovery",
      });
    }
  }
}
