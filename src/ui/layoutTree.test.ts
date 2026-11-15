import { afterEach, describe, expect, it, vi } from "vitest";

import { type AdaButtonProps, type AdaCardProps, createAdaLayoutPorts } from "./layoutTree.ts";

class Element extends EventTarget {
  children: Element[] = [];
  className = "";
  dataset: Record<string, string> = {};
  hidden = false;
  disabled = false;
  style = { alignSelf: "", minWidth: "" };
  textContent = "";
  firstChild = { nodeType: 3, nodeValue: "" };
  attributes = new Map<string, string>();
  ownerDocument = { createElement: () => new Element() };
  classList = { toggle: vi.fn() };
  append(...nodes: Element[]) {
    this.children.push(...nodes);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  click() {
    this.dispatchEvent(new Event("click", { cancelable: true }));
  }
}

const factories = vi.hoisted(() => ({ dispose: vi.fn(), fit: vi.fn() }));
vi.mock("./modal.ts", () => ({
  createActions: () => new Element(),
  createButton: (label: string) => {
    const button = new Element();
    button.firstChild.nodeValue = label;
    return button;
  },
  createCard: () => {
    const body = new Element(),
      header = new Element(),
      title = new Element(),
      close = new Element(),
      frame = new Element();
    header.append(title);
    frame.append(header, body, close);
    return { body, close, dispose: factories.dispose, fit: factories.fit, frame, header, title };
  },
  setFooterAction: (intent: string, element: Element) => {
    element.dataset.footerAction = intent;
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function fixture() {
  const first = vi.fn(),
    second = vi.fn(),
    dispose = vi.fn(),
    update = vi.fn();
  let state: { kind: "available" } | { kind: "unavailable"; reason: string } | { kind: "omitted" } =
    { kind: "available" };
  let button: Element;
  let reason: Element;
  const ports = createAdaLayoutPorts({
    actions: new Map([
      ["first", first],
      ["second", second],
    ]),
    availability: () => state,
    presentButton(actual) {
      button = actual as unknown as Element;
      reason = new Element();
      const root = new Element();
      root.append(button, reason);
      return {
        dispose,
        element: root as unknown as HTMLElement,
        reason: reason as unknown as HTMLElement,
        update,
      };
    },
  });
  return {
    button: () => button!,
    dispose,
    first,
    ports,
    reason: () => reason!,
    second,
    setState: (next: typeof state) => {
      state = next;
    },
    update,
  };
}

it("retains actual label/root identity while dispatch resolves the current action and availability", () => {
  const f = fixture();
  const initial: AdaButtonProps<string> = { actionId: "first", label: "First", role: "secondary" };
  const part = f.ports.components.button.create(initial);
  const root = part.element,
    label = f.button().firstChild;
  f.button().click();
  expect(f.first).toHaveBeenCalledOnce();
  part.update({ actionId: "second", label: "Second", role: "primary" });
  expect(part.element).toBe(root);
  expect(f.button().firstChild).toBe(label);
  expect(label.nodeValue).toBe("Second");
  f.button().click();
  expect(f.second).toHaveBeenCalledOnce();
  f.setState({ kind: "unavailable", reason: "Requires weapon" });
  f.button().click();
  expect(f.second).toHaveBeenCalledOnce();
  expect(f.reason().textContent).toBe("Requires weapon");
  expect(f.button().disabled).toBe(false);
  expect(f.button().attributes.get("aria-disabled")).toBe("true");
  f.setState({ kind: "omitted" });
  part.update(initial);
  expect(root.hidden).toBe(true);
  f.setState({ kind: "available" });
  part.dispose();
  f.button().click();
  expect(f.first).toHaveBeenCalledOnce();
  expect(f.dispose).toHaveBeenCalledOnce();
});

it("uses the same guard for programmatic/context actions", () => {
  const f = fixture();
  f.setState({ kind: "unavailable", reason: "Busy" });
  expect(f.ports.dispatch("first")).toBe(false);
  expect(f.first).not.toHaveBeenCalled();
  f.setState({ kind: "available" });
  expect(f.ports.dispatch("first")).toBe(true);
  expect(f.first).toHaveBeenCalledOnce();
});

it("retains native title and sibling body/footer slots without fitting before descendants", () => {
  const f = fixture();
  const initial: AdaCardProps<string> = {
    closeAction: "first",
    closeLabel: "Close",
    footerAction: "close",
    size: "medium",
    title: "Menu",
  };
  const card = f.ports.components.card.create(initial);
  const slots = card.slots;
  const child = new Element();
  (slots.body as unknown as Element).append(child);
  card.update({ ...initial, closeAction: "second", footerAction: "back", title: "Detail" });
  expect(card.slots).toBe(slots);
  expect(slots.body.style.alignSelf).toBe("stretch");
  expect((slots.body as unknown as Element).children).toEqual([child]);
  expect((slots.header as unknown as Element).children[0]!.textContent).toBe("Detail");
  expect(slots.footer.dataset.footerAction).toBe("back");
  expect(factories.fit).not.toHaveBeenCalled();
  f.ports.fit();
  expect(factories.fit).toHaveBeenCalledOnce();
  const close = (card.element as unknown as Element).children[2]!;
  close.click();
  expect(f.second).toHaveBeenCalledOnce();
  card.dispose();
  f.ports.fit();
  expect(factories.fit).toHaveBeenCalledOnce();
  close.click();
  expect(f.second).toHaveBeenCalledOnce();
  expect(factories.dispose).toHaveBeenCalledOnce();
});

describe("shared production prose", () => {
  it("retains its element when authored text changes", () => {
    vi.stubGlobal("document", { createElement: () => new Element() });
    const f = fixture();
    const part = f.ports.components.text.create({ text: "First" });
    const node = part.element;
    expect(node.className).toBe("ada-prose");
    part.update({ className: "ada-card-note", text: "Second" });
    expect(part.element).toBe(node);
    expect(node.textContent).toBe("Second");
    expect(node.className).toBe("ada-prose ada-card-note");
  });
});
