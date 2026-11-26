import { afterEach, beforeEach, expect, it, vi } from "vitest";

type Attach = (action: { readonly element: HTMLElement }) => () => void;
const host = vi.hoisted(() => ({
  attach: undefined as Attach | undefined,
  duringBind: undefined as (() => void) | undefined,
  newRoot: vi.fn(() => ({ assertBindings: vi.fn(), dispose: vi.fn(), invalidate: vi.fn() })),
  register: vi.fn(),
  stop: undefined as (() => void) | undefined,
  unbind: vi.fn(),
}));
vi.mock("@andornaut/game-kit/runtime/web/crash/dom/crashScreen", () => ({
  installCrashScreen({ bindHoldAction }: { readonly bindHoldAction: Attach }) {
    host.attach = bindHoldAction;
    return {
      stopGameOnCrash(stop: () => void) {
        host.register();
        host.stop = stop;
      },
    };
  },
}));
vi.mock("./actionBinding.ts", () => ({
  createAdaFactoryHoldBinding: () => () => {
    host.duringBind?.();
    return host.unbind;
  },
}));
vi.mock("./holdActionsAdapter.ts", () => ({
  bindAdaRecoveryActionRoot: host.newRoot,
}));
vi.mock("./pressScope.ts", () => ({
  rootPressGuard: () => ({}),
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  host.duringBind = undefined;
  vi.stubGlobal("window", { location: { search: "" } });
});
afterEach(() => vi.unstubAllGlobals());

it("runs the main save fence before loading cleanup through one Kit crash registration", async () => {
  const { CRASH_SCREEN } = await import("./crashScreen.ts");
  const calls: string[] = [];
  CRASH_SCREEN.stopGameOnCrash(() => calls.push("loading"));
  CRASH_SCREEN.stopGameOnCrash(() => calls.push("save-fence"));
  host.stop!();
  expect(calls).toEqual(["save-fence", "loading"]);
  expect(host.register).toHaveBeenCalledOnce();
});

it("still releases loading resources when another page-owned crash cleanup throws", async () => {
  const { CRASH_SCREEN } = await import("./crashScreen.ts");
  const loading = vi.fn();
  CRASH_SCREEN.stopGameOnCrash(loading);
  CRASH_SCREEN.stopGameOnCrash(() => {
    throw new Error("main cleanup failed");
  });
  expect(() => host.stop!()).toThrow(AggregateError);
  expect(loading).toHaveBeenCalledOnce();
});

it("releases a binding retired during construction and audits only the next live instance", async () => {
  const page = Object.assign(new EventTarget(), { location: { search: "" } });
  vi.stubGlobal("window", page);
  await import("./crashScreen.ts");

  const body = {};
  const dialog = {
    getAttribute: () => "alertdialog",
    parentElement: body,
    querySelector: () => null,
    querySelectorAll: () => [element],
  };
  const element = {
    closest: () => null,
    matches: () => false,
    ownerDocument: { body },
    parentElement: dialog,
  } as unknown as HTMLElement;
  host.duringBind = () => {
    page.dispatchEvent(Object.assign(new Event("pagehide"), { persisted: false }));
  };

  host.attach!({ element })();
  const retired = host.newRoot.mock.results[0]!.value;
  expect(retired.invalidate).toHaveBeenCalledOnce();
  expect(retired.dispose).toHaveBeenCalledOnce();
  expect(host.unbind).toHaveBeenCalledOnce();
  expect(retired.assertBindings).not.toHaveBeenCalled();

  host.duringBind = undefined;
  host.attach!({ element })();
  expect(host.newRoot).toHaveBeenCalledTimes(2);
  expect(retired.assertBindings).not.toHaveBeenCalled();
  expect(host.newRoot.mock.results[1]!.value.assertBindings).toHaveBeenCalledOnce();
  expect(host.unbind).toHaveBeenCalledTimes(2);
});
