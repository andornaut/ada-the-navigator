import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import { STACK_BUTTON_GAP } from "../layout/tokens.ts";
import { menuActions, menuTree } from "./menuTree.ts";

const data = {
  closeLabel: "Close",
  labels: {
    achievements: "Achievements",
    backToTitle: "Back to title",
    cheats: "Cheats",
    settings: "Settings",
  },
  title: "Menu",
};

function menuStack(tree: ReturnType<typeof menuTree>) {
  const [stack, ...others] = tree.slots?.actions ?? [];
  if (stack?.kind !== "stack" || others.length > 0) {
    throw new Error("Expected one structural action stack");
  }
  return stack;
}

describe("production Menu tree", () => {
  it.each(["start", "nonplay"] as const)(
    "keeps native small card and primary Close last for %s",
    (context) => {
      const tree = menuTree({ ...data, context });
      validateLayoutTree(
        { button: [], card: ["header", "body", "footer"], menu: ["actions"], text: [] },
        tree,
      );
      expect(tree.props).toEqual({
        closeAction: "close-menu",
        closeLabel: "Close",
        footerAction: "close",
        size: "small",
        title: "Menu",
      });
      const stack = menuStack(tree);
      expect(stack).toMatchObject({ gap: STACK_BUTTON_GAP, padding: 0 });
      const buttons = stack.children;
      expect(buttons.map((node) => node.key)).toEqual([...menuActions(context), "close"]);
      expect(
        buttons.map((node) =>
          node.kind === "component" && node.component === "button" ? node.props : undefined,
        ),
      ).toEqual([
        ...menuActions(context).map((action) => ({
          actionId: `menu-${action}`,
          label: data.labels[action],
          role: "secondary",
        })),
        { actionId: "menu-close", label: "Close", role: "primary" },
      ]);
    },
  );
  it("keeps canonical keys/actions even when all labels are empty or identical", () => {
    const tree = menuTree({
      ...data,
      closeLabel: "",
      context: "nonplay",
      labels: { achievements: "Same", backToTitle: "", cheats: "Same", settings: "Same" },
    });
    expect(menuStack(tree).children.map((node) => node.key)).toEqual([
      "achievements",
      "cheats",
      "settings",
      "backToTitle",
      "close",
    ]);
    expect(JSON.stringify(tree)).not.toContain("onAction");
  });
});

it("sorts the actions by label, then Back to title and primary Close", () => {
  const labels = {
    achievements: "Trophies",
    backToTitle: "Accueil",
    cheats: "Astuces",
    settings: "Options",
  };
  expect(
    menuStack(menuTree({ ...data, context: "nonplay", labels })).children.map((node) => node.key),
  ).toEqual(["cheats", "settings", "achievements", "backToTitle", "close"]);
  expect(
    menuStack(menuTree({ ...data, context: "start", labels })).children.map((node) => node.key),
  ).toEqual(["cheats", "settings", "achievements", "close"]);
});
