import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { restartTree } from "./restartTree.ts";

const labels = {
  cancel: CONTENT.labels.confirmCancel!,
  close: CONTENT.labels.close!,
  restart: CONTENT.labels.restart!,
  title: CONTENT.labels.restartTitle!,
};

describe("Restart confirmation configuration", () => {
  it("uses the published typed ports with the existing small card and action order", () => {
    const tree = restartTree(labels);
    expect(() =>
      validateLayoutTree({ button: [], card: ["header", "body", "footer"], text: [] }, tree),
    ).not.toThrow();
    expect(tree).toMatchObject({
      component: "card",
      key: "restart",
      props: {
        body: false,
        closeAction: "close-restart",
        closeLabel: labels.close,
        footerAction: "close",
        size: "small",
        title: labels.title,
      },
    });
    if (tree.kind !== "component" || tree.component !== "card") {
      throw Error("Expected native card binding");
    }
    expect(tree.slots?.body).toBeUndefined();
    expect(tree.slots?.footer).toEqual([
      {
        component: "button",
        key: "cancel",
        kind: "component",
        props: { actionId: "restart-cancel", label: labels.cancel, role: "secondary" },
      },
      {
        component: "button",
        key: "confirm",
        kind: "component",
        props: { actionId: "restart-confirm", label: labels.restart, role: "primary" },
      },
    ]);
  });

  it("changes authored labels without changing action or reconciliation identity", () => {
    const before = restartTree(labels),
      after = restartTree({ ...labels, cancel: "Keep progress", title: "Start again?" });
    if (
      before.kind !== "component" ||
      before.component !== "card" ||
      after.kind !== "component" ||
      after.component !== "card"
    ) {
      throw Error("Expected native card binding");
    }
    expect(after.key).toBe(before.key);
    expect(after.props.title).toBe("Start again?");
    expect(after.slots?.footer?.map(({ key }) => key)).toEqual(
      before.slots?.footer?.map(({ key }) => key),
    );
    expect(after.slots?.footer?.[0]).toMatchObject({
      props: { actionId: "restart-cancel", label: "Keep progress" },
    });
  });
});
