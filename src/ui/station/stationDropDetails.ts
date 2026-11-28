import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { ControlAvailability } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";

import { applyAdaControlTheme } from "../buttonPresentation.ts";
import { readViewUnit } from "../layoutDom/index.ts";
import { type AdaLayoutSchema, mountAdaLayout } from "../layoutTree.ts";
import { createPhysicalLayoutInspector } from "../layoutTreeMeasurements.ts";

export interface StationDropData {
  readonly brief?: string;
  readonly cancelLabel: string;
  readonly closeLabel: string;
  readonly dropLabel: string;
  readonly detail?: string;
  readonly subject: string;
  readonly title: string;
}
export type StationDropAction = "drop-cancel" | "drop-confirm";

/** The same authored data tree is consumed by the actual station and its isolated fixture. */
export function stationDropTree(
  data: StationDropData,
): LayoutNode<AdaLayoutSchema<StationDropAction>> {
  return {
    component: "card",
    key: "station-drop",
    kind: "component",
    props: {
      closeAction: "drop-cancel",
      closeLabel: data.closeLabel,
      footerAction: "back",
      size: "small",
      title: data.title,
    },
    slots: {
      body: [
        {
          component: "text",
          key: "subject",
          kind: "component",
          props: { className: "ada-card-note ada-confirm-about", text: data.subject },
        },
        ...(["detail", "brief"] as const).flatMap((key) => {
          const text = data[key];
          return text
            ? [
                {
                  component: "text" as const,
                  key,
                  kind: "component" as const,
                  props: { className: "ada-card-note ada-confirm-about", text },
                },
              ]
            : [];
        }),
      ],
      footer: [
        {
          component: "button",
          key: "cancel",
          kind: "component",
          props: { actionId: "drop-cancel", label: data.cancelLabel, role: "secondary" },
        },
        {
          component: "button",
          key: "drop",
          kind: "component",
          props: { actionId: "drop-confirm", label: data.dropLabel, role: "primary" },
        },
      ],
    },
  };
}

export function mountStationDropDetails(
  context: {
    readonly actionRoot: HTMLElement;
    readonly active?: () => boolean;
    readonly artReady: Promise<void>;
    readonly availability: () => ControlAvailability;
    readonly onCancel: () => void;
    readonly onDrop: () => void;
  },
  host: HTMLElement,
  data: StationDropData,
) {
  applyAdaControlTheme(host);
  const measurementRoot = host.closest<HTMLElement>(".ada-controls") ?? host;
  const inspector = createPhysicalLayoutInspector(
    () => readViewUnit(measurementRoot),
    measurementRoot,
  );
  const actions: ReadonlyMap<StationDropAction, () => void> = new Map([
    ["drop-cancel", context.onCancel],
    ["drop-confirm", context.onDrop],
  ]);
  const layout = mountAdaLayout(
    {
      actionRoot: context.actionRoot,
      actions,
      availability: (action) =>
        context.active?.() === false
          ? { kind: "omitted" }
          : action === "drop-confirm"
            ? context.availability()
            : { kind: "available" },
    },
    { artReady: context.artReady, host, measure: inspector.measure },
    stationDropTree(data),
  );
  return {
    dispose() {
      layout.dispose();
      inspector.dispose();
    },
    focusCancel() {
      const cancel = host.querySelector<HTMLElement>('.ada-button[data-action="drop-cancel"]');
      if (cancel) {
        focusTarget(cancel);
      }
    },
    inspect(viewport: Rect) {
      return inspector.inspect(viewport, layout);
    },
    settle: layout.settle,
    update(next: StationDropData) {
      layout.update(stationDropTree(next));
    },
  };
}
