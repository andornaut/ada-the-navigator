import { expect, it, vi } from "vitest";

import {
  type AdaActionOptions,
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { adaActionHasRoot, registerAdaActionRoot } from "./actionRegistry.ts";
import { bindAdaActionRoot } from "./holdActionsAdapter.ts";

class NodeFixture extends EventTarget {
  readonly children: NodeFixture[] = [];
  parentElement: NodeFixture | null = null;
  connected = false;
  hidden = false;
  disabled = false;
  inert = false;
  readonly attributes = new Map<string, string>();
  readonly ownerDocument: DocumentFixture;
  readonly control: boolean;
  constructor(ownerDocument: DocumentFixture, control = false) {
    super();
    this.ownerDocument = ownerDocument;
    this.control = control;
  }

  get isConnected(): boolean {
    return this.parentElement?.isConnected ?? this.connected;
  }
  append(child: NodeFixture) {
    child.remove();
    child.parentElement = this;
    this.children.push(child);
  }
  remove() {
    if (this.parentElement) {
      const children = this.parentElement.children;
      children.splice(children.indexOf(this), 1);
      this.parentElement = null;
    }
  }
  contains(value: unknown): boolean {
    return value === this || this.children.some((child) => child.contains(value));
  }
  matches(selector: string): boolean {
    return selector === ":disabled" ? this.disabled : this.control;
  }
  querySelectorAll(selector: string): NodeFixture[] {
    expect(selector).not.toMatch(/:enabled|:disabled|\[hidden\]|\[inert\]/);
    return this.children.flatMap((child) => [
      ...(child.control ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  closest(): NodeFixture | null {
    return this.hidden || this.inert ? this : (this.parentElement?.closest() ?? null);
  }
}
class DocumentFixture extends EventTarget {
  readonly defaultView = Object.assign(new EventTarget(), {
    HTMLElement: NodeFixture,
    Node: NodeFixture,
    clearTimeout,
    performance: { now: () => Date.now() },
    setTimeout,
  });
  hidden = false;
}
const html = (node: NodeFixture) => node as unknown as HTMLElement;
function fixture() {
  const document = new DocumentFixture();
  const root = new NodeFixture(document);
  const scope = new NodeFixture(document);
  const button = new NodeFixture(document, true);
  root.connected = true;
  root.append(scope);
  scope.append(button);
  const options: AdaActionOptions = {
    click: {
      availability: vi.fn(() => ({ kind: "omitted" as const })),
      refuse: vi.fn(),
      run: vi.fn(),
    },
    current: vi.fn(() => false),
    slopPx: vi.fn(() => 8),
  };
  return { button, document, options, root, scope };
}

it("audits detached metadata without requiring an attached root or evaluating action policy", () => {
  const f = fixture();
  f.scope.remove();
  const binding = bindAdaAction(f.options, html(f.button));
  f.button.hidden = true;
  f.button.disabled = true;
  expect(() => assertAdaActionMetadata(html(f.scope))).not.toThrow();
  expect(() => assertAdaActionBindings(html(f.scope))).toThrow("no live action root");
  expect(f.options.current).not.toHaveBeenCalled();
  expect(f.options.slopPx).not.toHaveBeenCalled();
  expect(f.options.click.availability).not.toHaveBeenCalled();
  expect(f.options.click.refuse).not.toHaveBeenCalled();
  expect(f.options.click.run).not.toHaveBeenCalled();
  binding.dispose();
});

it.each(["hidden", "disabled", "future"] as const)("rejects an unbound %s control", (kind) => {
  const f = fixture();
  f.button.hidden = kind !== "disabled";
  f.button.disabled = kind !== "hidden";
  expect(() => assertAdaActionMetadata(html(f.scope))).toThrow("no registered action binding");
});

it("checks the completed scope itself when it is a control", () => {
  const f = fixture();
  expect(() => assertAdaActionMetadata(html(f.button))).toThrow("no registered action binding");
  const binding = bindAdaAction(f.options, html(f.button));
  expect(() => assertAdaActionMetadata(html(f.button))).not.toThrow();
  binding.dispose();
});

it("requires every registered ancestor root to be active without invoking its permits callback", () => {
  const f = fixture();
  const permits = vi.fn(() => {
    throw new Error("Runtime policy must not run");
  });
  const outer = registerAdaActionRoot({ permits }, html(f.root));
  const inner = registerAdaActionRoot({ permits }, html(f.scope));
  const binding = bindAdaAction(f.options, html(f.button));
  expect(() => assertAdaActionBindings(html(f.scope))).not.toThrow();
  outer();
  expect(adaActionHasRoot(html(f.button))).toBe(false);
  expect(() => assertAdaActionMetadata(html(f.scope))).not.toThrow();
  expect(() => assertAdaActionBindings(html(f.scope))).toThrow("no live action root");
  expect(permits).not.toHaveBeenCalled();
  expect(f.options.current).not.toHaveBeenCalled();
  inner();
  binding.dispose();
});

it("does not fall through a disposed nearest root to its active parent", () => {
  const f = fixture();
  const permits = vi.fn(() => false);
  const outer = registerAdaActionRoot({ permits }, html(f.root));
  const inner = registerAdaActionRoot({ permits }, html(f.scope));
  const binding = bindAdaAction(f.options, html(f.button));
  inner();
  expect(() => assertAdaActionBindings(html(f.scope))).toThrow("no live action root");
  expect(permits).not.toHaveBeenCalled();
  binding.dispose();
  outer();
});

it("rechecks lazy insertion, removal and disposed bindings on each completed transaction", () => {
  const f = fixture();
  const stopRoot = registerAdaActionRoot({ permits: () => false }, html(f.root));
  const first = bindAdaAction(f.options, html(f.button));
  expect(() => assertAdaActionBindings(html(f.scope))).not.toThrow();
  const added = new NodeFixture(f.document, true);
  added.hidden = true;
  f.scope.append(added);
  expect(() => assertAdaActionMetadata(html(f.scope))).toThrow("no registered action binding");
  const second = bindAdaAction(f.options, html(added));
  expect(() => assertAdaActionBindings(html(f.scope))).not.toThrow();
  second.dispose();
  expect(() => assertAdaActionBindings(html(f.scope))).toThrow("no registered action binding");
  added.remove();
  expect(() => assertAdaActionBindings(html(f.scope))).not.toThrow();
  first.dispose();
  stopRoot();
});

it("requires fresh structural ownership after reparenting without rebinding metadata", () => {
  const f = fixture();
  const stopRoot = registerAdaActionRoot({ permits: () => false }, html(f.root));
  const binding = bindAdaAction(f.options, html(f.button));
  const next = new NodeFixture(f.document);
  next.connected = true;
  next.append(f.scope);
  expect(() => assertAdaActionMetadata(html(f.scope))).not.toThrow();
  expect(() => assertAdaActionBindings(html(f.scope))).toThrow("no live action root");
  const stopNext = registerAdaActionRoot({ permits: () => false }, html(next));
  expect(() => assertAdaActionBindings(html(f.scope))).not.toThrow();
  binding.dispose();
  stopRoot();
  stopNext();
});

it("audits the exact completed subtree while readiness and current eligibility are false", () => {
  const f = fixture();
  const ready = vi.fn(() => false),
    accepts = vi.fn(() => false);
  const root = bindAdaActionRoot(
    {
      guard: { gate: { accepts, capture: () => () => false } },
      requiredReady: ready,
      subscribeRequired: () => () => {},
    },
    html(f.root),
  );
  const binding = bindAdaAction(f.options, html(f.button));
  f.root.append(new NodeFixture(f.document, true));
  ready.mockClear();
  accepts.mockClear();
  expect(() => root.assertBindings(html(f.scope))).not.toThrow();
  expect(() => root.assertBindings()).toThrow("no registered action binding");
  expect(ready).not.toHaveBeenCalled();
  expect(accepts).not.toHaveBeenCalled();
  expect(f.options.current).not.toHaveBeenCalled();
  expect(f.options.click.availability).not.toHaveBeenCalled();
  expect(f.options.click.refuse).not.toHaveBeenCalled();
  expect(f.options.click.run).not.toHaveBeenCalled();
  binding.dispose();
  root.dispose();
});

it("rejects outside scopes and disposed root handles without auditing a different tree", () => {
  const f = fixture();
  const root = bindAdaActionRoot(
    {
      guard: { gate: { accepts: () => true, capture: () => () => true } },
      requiredReady: () => false,
      subscribeRequired: () => () => {},
    },
    html(f.root),
  );
  const outside = new NodeFixture(f.document);
  outside.connected = true;
  expect(() => root.assertBindings(html(outside))).toThrow("outside this action root");
  root.dispose();
  expect(() => root.assertBindings(html(f.scope))).toThrow("has been disposed");
});

it("requires live attachment even for an empty completed subtree", () => {
  const f = fixture();
  f.button.remove();
  const stop = registerAdaActionRoot({ permits: () => false }, html(f.root));
  expect(() => assertAdaActionBindings(html(f.scope))).not.toThrow();
  f.scope.remove();
  expect(() => assertAdaActionMetadata(html(f.scope))).not.toThrow();
  expect(() => assertAdaActionBindings(html(f.scope))).toThrow("no live action root");
  stop();
});

it.each(["native click", "direct activation"])(
  "requires connected structural ownership for %s after reparenting",
  (kind) => {
    const f = fixture();
    const run = vi.fn();
    const current = vi.fn(() => true);
    const availability = vi.fn(() => ({ kind: "available" as const }));
    const options = { ...f.options, click: { availability, run }, current };
    const binding = bindAdaAction(options, html(f.button));
    const disposeRoot = registerAdaActionRoot({ permits: () => true }, html(f.root));
    const activate = () => {
      if (kind === "direct activation") {
        return binding.activate();
      }
      return f.button.dispatchEvent(new Event("click"));
    };
    activate();
    expect(run).toHaveBeenCalledTimes(1);
    const outside = new NodeFixture(f.document);
    outside.connected = true;
    outside.append(f.scope);
    current.mockClear();
    availability.mockClear();
    activate();
    expect(run).toHaveBeenCalledTimes(1);
    expect(current).not.toHaveBeenCalled();
    expect(availability).not.toHaveBeenCalled();
    f.scope.remove();
    activate();
    expect(run).toHaveBeenCalledTimes(1);
    expect(current).not.toHaveBeenCalled();
    const newer = vi.fn();
    binding.update({ ...options, click: { availability, run: newer } });
    f.root.append(f.scope);
    activate();
    expect(newer).toHaveBeenCalledOnce();
    f.root.connected = false;
    activate();
    expect(newer).toHaveBeenCalledOnce();
    f.root.connected = true;
    activate();
    expect(newer).toHaveBeenCalledTimes(2);
    disposeRoot();
    activate();
    expect(newer).toHaveBeenCalledTimes(2);
    binding.dispose();
  },
);

it("retains runtime readiness, hidden/inert and disposed-ancestor fences for direct activation", () => {
  const f = fixture();
  let ready = false;
  const outer = bindAdaActionRoot(
    {
      guard: { gate: { accepts: () => true, capture: () => () => true } },
      requiredReady: () => ready,
      subscribeRequired: () => () => {},
    },
    html(f.root),
  );
  const inner = registerAdaActionRoot({ permits: () => true }, html(f.scope));
  const run = vi.fn();
  const binding = bindAdaAction(
    {
      ...f.options,
      click: { availability: () => ({ kind: "available" }), run },
      current: () => true,
    },
    html(f.button),
  );
  expect(binding.activate()).toBe(false);
  ready = true;
  f.scope.hidden = true;
  expect(binding.activate()).toBe(false);
  f.scope.hidden = false;
  f.scope.inert = true;
  expect(binding.activate()).toBe(false);
  f.scope.inert = false;
  expect(binding.activate()).toBe(true);
  expect(run).toHaveBeenCalledOnce();
  outer.dispose();
  expect(binding.activate()).toBe(false);
  expect(run).toHaveBeenCalledOnce();
  inner();
  binding.dispose();
});

it("preserves factory-owned native clicks while fencing the shared activation facade", () => {
  const f = fixture();
  const shared = vi.fn(),
    original = vi.fn();
  f.button.addEventListener("click", original);
  const binding = bindAdaAction(
    {
      ...f.options,
      click: { availability: () => ({ kind: "available" }), run: shared },
      current: () => true,
      nativeClickOwner: "factory",
    },
    html(f.button),
  );
  const disposeRoot = registerAdaActionRoot({ permits: () => true }, html(f.root));
  f.button.dispatchEvent(new Event("click"));
  expect(original).toHaveBeenCalledOnce();
  expect(shared).not.toHaveBeenCalled();
  expect(binding.activate()).toBe(true);
  f.scope.remove();
  expect(binding.activate()).toBe(false);
  expect(shared).toHaveBeenCalledOnce();
  binding.dispose();
  f.button.dispatchEvent(new Event("click"));
  expect(original).toHaveBeenCalledTimes(2);
  disposeRoot();
});
