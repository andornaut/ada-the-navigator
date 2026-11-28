import { setButtonRole } from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";

import { CONTENT } from "../../data/content.ts";
import {
  type InteractionContext,
  InteractionConversation,
  interactionCopy,
} from "../../model/conversations.ts";
import type { DialogueState } from "../../model/types.ts";
import type { createDialoguePanel } from "../conversation/index.ts";
import { showDialogueChoiceStatus } from "../dialogueChoice.ts";
import { invalidatePressScope } from "../pressScope.ts";
import { createStandardTextAction } from "../standardTextAction.ts";

/** The caller supplies the eligible conversation and accepts only the current panel's choice. */
export interface StationTalkVisit {
  readonly stationId: string;
  readonly context: InteractionContext;
  readonly panel: DialogueState | null;
  readonly choose: (panel: DialogueState, id: string) => void;
}

/** A pane of the station card. It uses the enclosing station's modal, root and visit. */
export function createStationTalk(
  actionRoot: HTMLElement,
  card: Pick<ReturnType<typeof createDialoguePanel>, "choices" | "controls" | "fit" | "showLine">,
  readVisit: () => StationTalkVisit | null,
  canUse: (button: HTMLButtonElement) => boolean,
  audit: (scope: HTMLElement) => void,
  showWelcome: () => void,
) {
  const state = new InteractionConversation();
  let stationId: string | undefined;
  let panel: DialogueState | null = null;
  let actions: ReturnType<typeof createStandardTextAction>[] = [];
  let primary: HTMLButtonElement | undefined;
  const clearActions = () => {
    for (const action of actions) {
      action.dispose();
    }
    actions = [];
    primary = undefined;
    card.choices.replaceChildren();
    card.controls.replaceChildren();
  };
  const reset = () => {
    state.setDocked(undefined);
    state.reset();
    stationId = undefined;
    panel = null;
    clearActions();
  };
  const update = (visit: StationTalkVisit) => {
    if (stationId !== visit.stationId) {
      state.setDocked(visit.stationId);
      stationId = visit.stationId;
      panel = null;
      clearActions();
    }
    if (panel === visit.panel) {
      return false;
    }
    panel = visit.panel;
    if (panel) {
      state.show(interactionCopy(visit.context, panel), panel);
    } else {
      state.hide();
      clearActions();
    }
    return true;
  };
  const draw = (visit: StationTalkVisit) => {
    clearActions();
    const add = (
      label: string,
      run: () => void,
      kind: "choice" | "navigation",
      emphasized = false,
      status?: "completed" | "quest",
      enabled = true,
    ) => {
      const action = createStandardTextAction(actionRoot, label, {
        availability: () => ({ kind: enabled ? "available" : "disabled" }),
        current: (): boolean => {
          if (!canUse(action.element)) {
            return false;
          }
          const live = readVisit();
          return live?.stationId === visit.stationId && live.panel === visit.panel;
        },
        run: () => {
          run();
          const next = readVisit();
          if (next?.stationId === visit.stationId) {
            update(next);
            if (next.panel) {
              draw(next);
              if (primary && canUse(primary)) {
                focusTarget(primary);
              }
            } else {
              showWelcome();
            }
          }
        },
        separateFace: true,
      });
      const { element: button } = action;
      actions.push(action);
      button.disabled = !enabled;
      button.classList.add("ada-story-button");
      button.classList.toggle("ada-primary", emphasized);
      setButtonRole(emphasized ? "primary" : "secondary", button);
      if (status) {
        showDialogueChoiceStatus(button, label, status);
      }
      if (enabled && (emphasized || primary === undefined)) {
        primary = button;
      }
      (kind === "choice" ? card.choices : card.controls).append(button);
    };
    const choose = (id: string) =>
      state.choose(id, () => {
        const live = readVisit();
        if (live?.stationId === visit.stationId && live.panel && live.panel === visit.panel) {
          live.choose(live.panel, id);
          const next = readVisit();
          if (next?.stationId === visit.stationId) {
            update(next);
          }
        }
      });
    if (state.hasPrevious) {
      add(CONTENT.labels.previous ?? "", () => state.previous(), "navigation");
    }
    for (const topic of state.topics) {
      add(
        topic.label,
        state.topicAction(topic.id),
        "choice",
        false,
        state.completedTopic(topic.id) ? "completed" : undefined,
      );
    }
    if (state.topicExitLabel) {
      add(state.topicExitLabel, state.topicExitAction(), "choice", true);
    } else if (state.nextAction === "page") {
      add(CONTENT.labels.next ?? "", () => state.advance(), "navigation", true);
    } else if (state.nextAction === "continue") {
      add(CONTENT.labels.next ?? "", () => choose("continue"), "navigation", true);
    } else {
      for (const choice of state.choices) {
        add(
          choice.label,
          () => choose(choice.id),
          "choice",
          state.choices.length === 1,
          !choice.refused && state.questChoice(choice.id, visit.context) ? "quest" : undefined,
          !choice.refused && state.canReplayChoice(choice.id),
        );
      }
    }
    invalidatePressScope(actionRoot);
    audit(card.choices);
    audit(card.controls);
    card.showLine(state.line?.speaker, state.line?.text ?? "");
    card.fit();
  };
  return {
    /** A render without a panel uses the visit's existing keeper greeting. */
    render(visit: StationTalkVisit | null): boolean {
      if (!visit) {
        if (stationId !== undefined) {
          reset();
        }
        return false;
      }
      const changed = update(visit);
      if (visit.panel && changed) {
        draw(visit);
      }
      return visit.panel !== null;
    },
    reset,
  };
}
