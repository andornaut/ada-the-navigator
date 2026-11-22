import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import {
  scanDiscreteActionBindings,
  scanDiscreteActionProject,
} from "./discreteActionArchitecture.ts";

it("accepts registered action construction and rejects a raw replacement instead of grandfathering a file", () => {
  expect(
    scanDiscreteActionBindings(
      "src/ui/newCard.ts",
      "bindAdaAction({click: action, current, slopPx}, button);",
    ),
  ).toEqual([]);
  expect(
    scanDiscreteActionBindings(
      "src/ui/newCard.ts",
      'button.addEventListener("click", action);',
    ).map((finding) => finding.kind),
  ).toEqual(["raw-discrete"]);
});
it("finds aliases, onclick forms and delegated glyph callbacks", () => {
  const source = [
    'const event = "click"; glyph.addEventListener(event, action);',
    'button.onclick = action; glyph["onclick"] = action;',
    'const props = {onClick: action}; glyph.setAttribute("onclick", "action()");',
  ].join("");
  expect(
    scanDiscreteActionBindings("src/game/glyph.ts", source).filter(
      (finding) => finding.kind === "raw-discrete",
    ),
  ).toHaveLength(5);
});
it("permits only the registered native bridge and keeps gesture mixtures visible for owner review", () => {
  expect(
    scanDiscreteActionBindings(
      "src/ui/actionBinding.ts",
      'function bindAdaAction(){element.addEventListener("click", click);}',
    ),
  ).toEqual([]);
  expect(
    scanDiscreteActionBindings(
      "src/ui/actionBinding.ts",
      'function bypass(){element.addEventListener("click", action);}',
    )[0]?.kind,
  ).toBe("raw-discrete");
  expect(
    scanDiscreteActionBindings("src/ui/map.ts", 'node.addEventListener("pointerup", select);')[0]
      ?.kind,
  ).toBe("gesture-review");
  expect(
    scanDiscreteActionBindings("src/ui/map.ts", "node.addEventListener(event, action);")[0]?.kind,
  ).toBe("unresolved-event");
});
it("rejects implicit-readiness root attachment until its explicit root port is adopted", () => {
  expect(
    scanDiscreteActionBindings("src/input/controls.ts", "bindAdaHoldActions(guard, root);")[0]
      ?.kind,
  ).toBe("legacy-root");
});

it("requires binding proof for new and disabled native controls independently of raw listeners", () => {
  for (const source of [
    'const button = document.createElement("button");',
    'const button = createButton("Later"); button.disabled = true;',
    'glyph.setAttribute("role", "button");',
    'const input = document.createElement("input"); input.type = "submit";',
    'const node = document.createElement("span"); node.dataset.action = "accept";',
    'button.setAttribute("type", "button");',
    'const button = ui.createButton("New");',
  ]) {
    expect(
      scanDiscreteActionBindings("new/consumer.ts", source).map((finding) => finding.kind),
    ).toContain("unbound-discrete");
  }
  expect(
    scanDiscreteActionBindings(
      "new/consumer.ts",
      `
    const button = createButton("Run");
    bindAdaAction({ click: action, current, slopPx }, button);
  `,
    ),
  ).toEqual([]);
});

it("follows a local binding wrapper without exempting similarly named raw callbacks", () => {
  expect(
    scanDiscreteActionBindings(
      "new/consumer.ts",
      `
    const register = (element, run) => bindAdaAction({click: run, current, slopPx}, element);
    const button = createButton("Run");
    register(button, run);
  `,
    ),
  ).toEqual([]);
  expect(
    scanDiscreteActionBindings(
      "new/consumer.ts",
      `
    const register = (element, run) => element.addEventListener("click", run);
    const button = createButton("Run"); register(button, run);
  `,
    ).map((finding) => finding.kind),
  ).toEqual(["raw-discrete", "unbound-discrete"]);
});

it("does not borrow a binding from a shadowed element in another function", () => {
  const findings = scanDiscreteActionBindings(
    "new/consumer.ts",
    `
    function registered() { const button = createButton("A"); bindAdaAction(options, button); }
    function missing() { const button = createButton("B"); }
  `,
  );
  expect(findings.map((finding) => finding.kind)).toEqual(["unbound-discrete"]);
  expect(findings[0]?.source).toContain('"B"');
});

it("distinguishes pure event suppressors from a suppressor that also invokes an action", () => {
  const benign = scanDiscreteActionBindings(
    "any/consumer.ts",
    `
    const suppress = event => { event.preventDefault(); event.stopPropagation(); };
    node.addEventListener("click", suppress);
  `,
  );
  expect(benign.map(({ classification, kind }) => ({ classification, kind }))).toEqual([
    { classification: "suppressor", kind: "non-action" },
  ]);
  for (const action of ["run()", "state.started = true", "started = true"]) {
    expect(
      scanDiscreteActionBindings(
        "any/consumer.ts",
        `
      node.addEventListener("click", event => { event.preventDefault(); ${action}; });
    `,
      )[0]?.kind,
    ).toBe("raw-discrete");
  }
});

it("keeps mixed drag release actions blocking and classifies native value editing separately", () => {
  const findings = scanDiscreteActionBindings(
    "any/consumer.ts",
    `
    node.addEventListener("pointermove", event => { x = event.clientX; y = event.clientY; });
    node.addEventListener("pointerup", event => { if (!dragged) select(event); });
    input.addEventListener("input", event => { value = event.target.value; });
  `,
  );
  expect(findings.map(({ classification, kind }) => ({ classification, kind }))).toEqual([
    { classification: "drag-state", kind: "gesture-review" },
    { classification: "unclassified", kind: "gesture-review" },
    { classification: "editing-state", kind: "non-action" },
  ]);
  expect(
    scanDiscreteActionBindings(
      "any/consumer.ts",
      `
    input.addEventListener("input", event => { value = event.target.value; save(); });
  `,
    )[0]?.kind,
  ).toBe("unresolved-event");
});

it("resolves event aliases in their lexical scope and leaves unknown keyboard actions open", () => {
  const findings = scanDiscreteActionBindings(
    "src/ui/statusPill.ts",
    `
    const event = "click";
    function drag() { const event = "pointerup"; node.addEventListener(event, select); }
    node.addEventListener(event, action);
    node.addEventListener("keydown", action);
  `,
  );
  expect(findings.map(({ kind }) => kind)).toEqual([
    "gesture-review",
    "raw-discrete",
    "gesture-review",
  ]);
});

it("recognizes a direct local layout event and keeps imported click and pointer actions blocking", () => {
  const eventSource = {
    path: "src/layout/events.ts",
    text: `
      export const VIEW_EVENT = "ada-view-scale";
      export const CLICK_EVENT = "click" as const, RELEASE_EVENT = "pointerup";
    `,
  };
  const result = scanDiscreteActionProject([
    eventSource,
    {
      path: "src/ui/surface.ts",
      text: `
        import { VIEW_EVENT, CLICK_EVENT as selected, RELEASE_EVENT } from "../layout/events.ts";
        window.addEventListener(VIEW_EVENT, resize);
        button.addEventListener((selected), run);
        button.addEventListener(RELEASE_EVENT, select);
      `,
    },
  ]);
  expect(result.findings.map(({ kind, source }) => [kind, source])).toEqual([
    ["raw-discrete", "button.addEventListener((selected), run)"],
    ["gesture-review", "button.addEventListener(RELEASE_EVENT, select)"],
  ]);
});

it.each([
  ["dynamic", "export const EVENT = lookup();"],
  ["mutable", 'export let EVENT = "ada-view-scale"; EVENT = "click";'],
  ["private", 'const EVENT = "ada-view-scale";'],
  ["declaration-only", 'export declare const EVENT = "ada-view-scale";'],
  ["cycle", 'import { EVENT as alias } from "./surface.ts"; export const EVENT = alias;'],
  ["re-export", 'export { EVENT } from "./names.ts";'],
] as const)("leaves a named %s event import unresolved", (_case, text) => {
  const result = scanDiscreteActionProject([
    { path: "src/names.ts", text: 'export const EVENT = "click";' },
    { path: "src/events.ts", text },
    {
      path: "src/surface.ts",
      text: `
        import { EVENT as value } from "./events.ts";
        export const EVENT = value;
        button.addEventListener(value, run);
      `,
    },
  ]);
  expect(result.findings).toEqual([
    expect.objectContaining({
      kind: "unresolved-event",
      source: "button.addEventListener(value, run)",
    }),
  ]);
});

it("does not resolve type-only or lexically shadowed event imports", () => {
  const result = scanDiscreteActionProject([
    { path: "src/events.ts", text: 'export const LAYOUT = "ada-view-scale";' },
    {
      path: "src/shadows.ts",
      text: `
        import { LAYOUT, type LAYOUT as erased } from "./events.ts";
        window.addEventListener(LAYOUT, resize);
        element.on(erased, run);
        function parameter(LAYOUT) { element.on(LAYOUT, fromParameter); }
        try {} catch (LAYOUT) { element.on(LAYOUT, fromCatch); }
        const inner = function LAYOUT() { element.on(LAYOUT, fromNamedFunction); };
        switch (value) {
          case 0:
            let LAYOUT = getEvent();
            element.on(LAYOUT, fromSwitch);
        }
      `,
    },
  ]);
  expect(result.findings.map(({ kind, source }) => [kind, source])).toEqual([
    ["unresolved-event", "element.on(erased, run)"],
    ["unresolved-event", "element.on(LAYOUT, fromParameter)"],
    ["unresolved-event", "element.on(LAYOUT, fromCatch)"],
    ["unresolved-event", "element.on(LAYOUT, fromNamedFunction)"],
    ["unresolved-event", "element.on(LAYOUT, fromSwitch)"],
  ]);
});

it("does not exempt a callback because it is named continuous, drag, or editing", () => {
  for (const callback of ["continuous", "drag", "editing"]) {
    const findings = scanDiscreteActionBindings(
      "src/ui/actionBinding.ts",
      `
      function ${callback}(event) { event.preventDefault(); runAction(); }
      node.addEventListener("pointerup", ${callback});
    `,
    );
    expect(findings[0]?.kind).toBe("gesture-review");
    expect(findings[0]?.classification).toBe("unclassified");
  }
});

it.each([
  ['const button = createButton("Run"); bindAdaAction(options, button);', 0],
  ['node.addEventListener("click", run);', 1],
  ['node.addEventListener("pointerup", select);', 1],
  ['const button = createButton("Later"); button.disabled = true;', 1],
  ['node.addEventListener("click", event => event.preventDefault());', 0],
] as const)("uses the real CLI exit contract for %s", (text, status) => {
  const project = mkdtempSync(join(tmpdir(), "discrete-action-cli-"));
  mkdirSync(join(project, "src"));
  writeFileSync(join(project, "src", "consumer.ts"), text);
  const report = join(project, "report.json");
  const cli = fileURLToPath(new URL("../../tools/check-discrete-actions.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [cli, "--report", report], {
    cwd: project,
    encoding: "utf8",
    timeout: 10_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(status);
  const facts = JSON.parse(readFileSync(report, "utf8"));
  expect(facts.blocking > 0).toBe(status === 1);
  expect(facts.inputs).toEqual([
    { path: "src/consumer.ts", sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
  ]);
});

it("associates exported bound factory returns through renamed imports without exempting raw factories", () => {
  const sources = [
    {
      path: "src/factory.ts",
      text: `
      export function make() { const element = createButton("Run");
        bindAdaAction(options, element); return element; }
    `,
    },
    {
      path: "src/consumer.ts",
      text: `
      import {make as native} from "./factory.ts";
      const element = native(); element.dataset.action = "run";
    `,
    },
  ];
  const project = scanDiscreteActionProject(sources);
  expect(project.findings).toEqual([]);
  expect(project.factoryAssociations).toEqual([
    expect.objectContaining({ exportName: "make", members: [""], path: "src/factory.ts" }),
  ]);
  const raw = scanDiscreteActionProject([
    {
      ...sources[0]!,
      text: 'export function make() { const element = createButton("Run"); return element; }',
    },
    sources[1]!,
  ]);
  expect(raw.factoryAssociations).toEqual([]);
  expect(raw.findings.filter(({ kind }) => kind === "unbound-discrete")).toHaveLength(2);
});

it("associates only the returned bound member across factory chains", () => {
  const result = scanDiscreteActionProject([
    {
      path: "src/a.ts",
      text: `export function make() { const button = createButton("Run");
      bindAdaAction(options, button); return button; }`,
    },
    {
      path: "src/b.ts",
      text: `import {make} from "./a.ts";
      export function wrap() { const button = make(); return {button, label: document.createElement("p")}; }`,
    },
    {
      path: "src/c.ts",
      text: `import {wrap} from "./b.ts";
      const control = wrap(); control.button.dataset.action = "run"; control.label.dataset.action = "missing";`,
    },
  ]);
  expect(result.findings).toEqual([
    expect.objectContaining({
      kind: "unbound-discrete",
      path: "src/c.ts",
      source: 'control.label.dataset.action = "missing"',
    }),
  ]);
  expect(
    result.factoryAssociations.find(({ exportName }) => exportName === "wrap")?.members,
  ).toEqual(["button"]);
});

it.each([
  "if (flag) bindAdaAction(options, button); return button;",
  "if (flag) return button; bindAdaAction(options, button); return button;",
  "const action = bindAdaAction(options, button); action.dispose(); return button;",
])("keeps conditional or disposed factory registrations open: %s", (tail) => {
  const result = scanDiscreteActionProject([
    {
      path: "src/factory.ts",
      text: `export function make(){const button = createButton("Run"); ${tail}}`,
    },
    {
      path: "src/consumer.ts",
      text: `import {make} from "./factory.ts";
      const control = make(); control.dataset.action = "run";`,
    },
  ]);
  expect(result.factoryAssociations).toEqual([]);
  expect(result.findings).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", path: "src/consumer.ts" }),
  );
});

it("reports runtime construction audit calls without treating them as binding exemptions", () => {
  const result = scanDiscreteActionProject([
    {
      path: "src/root.ts",
      text: `
    const button = createButton("Missing"); root.assertBindings();
  `,
    },
  ]);
  expect(result.runtimeAssertions).toEqual([
    expect.objectContaining({ path: "src/root.ts", source: "root.assertBindings()" }),
  ]);
  expect(result.findings[0]?.kind).toBe("unbound-discrete");
});

it("proves focus-only keyboard effects from the public focus contract, not a similarly named callback", () => {
  expect(
    scanDiscreteActionBindings(
      "src/keyboard.ts",
      `
    import {focusTarget as focus} from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
    node.addEventListener("keydown", event => { event.preventDefault(); focus(button); });
  `,
    ),
  ).toEqual([expect.objectContaining({ classification: "keyboard-focus", kind: "non-action" })]);
  for (const extra of ["runAction();", 'state.page = "next";']) {
    expect(
      scanDiscreteActionBindings(
        "src/keyboard.ts",
        `
      import {focusTarget} from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
      node.addEventListener("keydown", event => { focusTarget(button); ${extra} });
    `,
      )[0]?.kind,
    ).toBe("gesture-review");
  }
  expect(
    scanDiscreteActionBindings(
      "src/keyboard.ts",
      `
    function focusTarget(element) { choose(element); }
    node.addEventListener("keydown", () => focusTarget(button));
  `,
    )[0]?.kind,
  ).toBe("gesture-review");
});

it("distinguishes canonical keyboard activation from a second direct action callback", () => {
  const registered = `const button = createButton("Run");
    const binding = bindAdaAction(options, button);`;
  expect(
    scanDiscreteActionBindings(
      "src/keyboard.ts",
      `${registered}
    button.addEventListener("keydown", event => { event.preventDefault(); binding.activate(); });
  `,
    ),
  ).toEqual([
    expect.objectContaining({ classification: "registered-keyboard", kind: "registered-action" }),
  ]);
  expect(
    scanDiscreteActionBindings(
      "src/keyboard.ts",
      `${registered}
    button.addEventListener("keydown", event => { binding.activate(); runAgain(); });
  `,
    )[0]?.kind,
  ).toBe("gesture-review");
});

it("keeps state-latching and mixed drag callbacks open instead of granting continuous exemptions", () => {
  const findings = scanDiscreteActionBindings(
    "src/input.ts",
    `
    const keys = new Set();
    window.addEventListener("keydown", event => keys.add(event.code));
    window.addEventListener("keyup", event => { keys.delete(event.code); use(); });
    node.addEventListener("pointermove", event => { x = event.clientX; });
    node.addEventListener("pointerup", () => select());
  `,
  );
  expect(findings.map(({ classification, kind }) => ({ classification, kind }))).toEqual([
    { classification: "continuous-state", kind: "gesture-review" },
    { classification: "unclassified", kind: "gesture-review" },
    { classification: "drag-state", kind: "gesture-review" },
    { classification: "unclassified", kind: "gesture-review" },
  ]);
});

it("does not let factory click ownership metadata excuse an extra native action listener", () => {
  const findings = scanDiscreteActionBindings(
    "src/factoryConsumer.ts",
    `
    const button = createButton("Run");
    bindAdaAction({nativeClickOwner: "factory", click, current, slopPx}, button);
    button.addEventListener("click", runAgain);
  `,
  );
  expect(findings.map(({ kind }) => kind)).toEqual(["raw-discrete"]);
});

it("does not propagate a mutable returned identity from an earlier registration", () => {
  const project = scanDiscreteActionProject([
    {
      path: "src/factory.ts",
      text: `export function make() {
      let button = createButton("Old"); bindAdaAction(options, button);
      button = createButton("Replacement"); return button;
    }`,
    },
    {
      path: "src/use.ts",
      text: `import {make} from "./factory.ts";
      const button = make(); button.dataset.action = "replacement";`,
    },
  ]);
  expect(project.factoryAssociations).toEqual([]);
  expect(project.findings).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", path: "src/use.ts" }),
  );
});

const registeredFactory = {
  path: "src/factory.ts",
  text: `
  export function make() { const button = createButton("Run");
    bindAdaAction(options, button); return button; }
`,
};

it.each([
  'let button = make(); button = rawButton; button.dataset.action = "run";',
  'const button = make(); button.remove(); button.dataset.action = "run";',
])("rejects replaced or removed factory identities: %s", (text) => {
  const project = scanDiscreteActionProject([
    registeredFactory,
    { path: "src/use.ts", text: `import {make} from "./factory.ts"; ${text}` },
  ]);
  expect(project.findings).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", path: "src/use.ts" }),
  );
});

it("does not retain binding proof after direct eager disposal", () => {
  const findings = scanDiscreteActionBindings(
    "src/use.ts",
    `
    const button = createButton("Run"); const binding = bindAdaAction(options, button);
    binding.dispose(); button.dataset.action = "run";
  `,
  );
  expect(findings).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", source: 'button.dataset.action = "run"' }),
  );
});

it("does not borrow a same-module factory summary through a shadowed parameter or variable", () => {
  for (const declaration of [
    'function use(make) { const button = make(); button.dataset.action = "run"; }',
    'function use() { const make = rawFactory; const button = make(); button.dataset.action = "run"; }',
    "export function wrap(make) { const button = make(); return button; }",
  ]) {
    const result = scanDiscreteActionProject([
      { path: "src/factory.ts", text: registeredFactory.text + declaration },
      {
        path: "src/use.ts",
        text: `import {wrap} from "./factory.ts";
        const button = wrap(rawFactory); button.dataset.action = "run";`,
      },
    ]);
    expect(result.factoryAssociations.some(({ exportName }) => exportName === "wrap")).toBe(false);
    expect(result.findings.some(({ kind }) => kind === "unbound-discrete")).toBe(true);
    if (!declaration.startsWith("export")) {
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "unbound-discrete", path: "src/factory.ts" }),
      );
    }
  }
});

it("does not export overwritten members from an otherwise constant factory container", () => {
  const result = scanDiscreteActionProject([
    {
      path: "src/a.ts",
      text: `export function make() { const button = createButton("Run");
      bindAdaAction(options, button); return {button}; }`,
    },
    {
      path: "src/b.ts",
      text: `import {make} from "./a.ts";
      export function wrap() { const controls = make(); controls.button = rawButton; return controls; }`,
    },
    {
      path: "src/use.ts",
      text: `import {wrap} from "./b.ts";
      const controls = wrap(); controls.button.dataset.action = "run";`,
    },
  ]);
  expect(result.factoryAssociations.some(({ exportName }) => exportName === "wrap")).toBe(false);
  expect(result.findings).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", path: "src/use.ts" }),
  );
});

it.each([
  "let binding = bindAdaAction(options, button); binding = rawBinding;",
  "const binding = bindAdaAction(options, button); binding.activate = rawAction;",
  "const binding = bindAdaAction(options, button); binding.dispose();",
])("keeps mutated or disposed keyboard entry proof open: %s", (binding) => {
  expect(
    scanDiscreteActionBindings(
      "src/keyboard.ts",
      `
    const button = createButton("Run"); ${binding}
    button.addEventListener("keydown", () => binding.activate());
  `,
    ).some(({ kind }) => kind === "gesture-review"),
  ).toBe(true);
});

it.each(["++count", "--count"])(
  "does not hide outer prefix mutation in focus-only keyboard classification: %s",
  (mutation) => {
    expect(
      scanDiscreteActionBindings(
        "src/keyboard.ts",
        `
    import {focusTarget} from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
    let count = 0;
    node.addEventListener("keydown", event => { ${mutation}; event.preventDefault(); focusTarget(button); });
  `,
      )[0]?.kind,
    ).toBe("gesture-review");
  },
);

it("follows constant aliases when a binding method or returned member is overwritten", () => {
  const keyboard = scanDiscreteActionBindings(
    "src/alias.ts",
    `
    const button = createButton("Run"); const binding = bindAdaAction(options, button);
    const alias = binding; alias.activate = rawAction;
    button.addEventListener("keydown", () => binding.activate());
  `,
  );
  expect(keyboard.some(({ kind }) => kind === "gesture-review")).toBe(true);
  const member = scanDiscreteActionProject([
    {
      path: "src/factory.ts",
      text: `export function make() { const button = createButton("Run");
      bindAdaAction(options, button); return {button}; }`,
    },
    {
      path: "src/use.ts",
      text: `import {make} from "./factory.ts";
      const controls = make(); const alias = controls; alias["button"] = rawButton;
      controls.button.dataset.action = "run";`,
    },
  ]);
  expect(member.findings).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", path: "src/use.ts" }),
  );
});

it("invalidates eager local disposer calls but preserves a returned deferred disposal lifecycle", () => {
  const stopped = scanDiscreteActionBindings(
    "src/dispose.ts",
    `
    const button = createButton("Run"); const action = bindAdaAction(options, button);
    const stop = () => action.dispose(); stop(); button.dataset.action = "run";
  `,
  );
  expect(stopped).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", source: 'button.dataset.action = "run"' }),
  );
  const deferred = scanDiscreteActionBindings(
    "src/deferred.ts",
    `
    const button = createButton("Run"); const action = bindAdaAction(options, button);
    button.dataset.action = "run"; const controls = {dispose: () => action.dispose()};
  `,
  );
  expect(deferred).toEqual([]);
});

it("does not prove a keyboard entry that escaped to an unknown mutator", () => {
  expect(
    scanDiscreteActionBindings(
      "src/escape.ts",
      `
    const button = createButton("Run"); const binding = bindAdaAction(options, button);
    mutate(binding); button.addEventListener("keydown", () => binding.activate());
  `,
    ).some(({ kind }) => kind === "gesture-review"),
  ).toBe(true);
});

it("does not borrow a mutable factory container through a constant member snapshot", () => {
  const result = scanDiscreteActionProject([
    {
      path: "src/factory.ts",
      text: `export function make(){const button = createButton("Run");
      bindAdaAction(options, button);return {button};}`,
    },
    {
      path: "src/use.ts",
      text: `import {make} from "./factory.ts";
      let controls = make(); const button = controls.button;
      button.dataset.action = "run";`,
    },
  ]);
  expect(result.findings).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", path: "src/use.ts" }),
  );
});

it("invalidates extracted disposers and entries escaped through containers", () => {
  const disposed = scanDiscreteActionBindings(
    "src/dispose.ts",
    `
    const button = createButton("Run");const action = bindAdaAction(options, button);
    const stop = action.dispose;stop();button.dataset.action = "run";
  `,
  );
  expect(disposed).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", source: 'button.dataset.action = "run"' }),
  );
  const escaped = scanDiscreteActionBindings(
    "src/escape.ts",
    `
    const button = createButton("Run");const binding = bindAdaAction(options, button);
    mutate({entry: binding}); button.addEventListener("keydown", () => binding.activate());
  `,
  );
  expect(escaped.some(({ kind }) => kind === "gesture-review")).toBe(true);
});

it("resolves function-scoped var shadowing instead of borrowing a top-level factory", () => {
  const result = scanDiscreteActionProject([
    {
      path: "src/factory.ts",
      text: `${registeredFactory.text}
    function use(flag) { if (flag) { var make = rawFactory; }
      const button = make(); button.dataset.action = "run"; }
  `,
    },
  ]);
  expect(result.findings).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", path: "src/factory.ts" }),
  );
});

it.each([
  "(() => action.dispose())();",
  "invokeUnknown(() => action.dispose());",
  "const stop = action.dispose; invokeUnknown({stop});",
])("keeps possibly eager disposal paths open: %s", (cleanup) => {
  expect(
    scanDiscreteActionBindings(
      "src/eager.ts",
      `
    const button = createButton("Run");const action = bindAdaAction(options, button);
    ${cleanup} button.dataset.action = "run";
  `,
    ),
  ).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", source: 'button.dataset.action = "run"' }),
  );
});

it("preserves a structurally proven WeakMap disposal store without treating it as eager execution", () => {
  expect(
    scanDiscreteActionBindings(
      "src/store.ts",
      `
    const disposers = new WeakMap(); const button = createButton("Run");
    const action = bindAdaAction(options, button);
    disposers.set(button, () => action.dispose()); button.dataset.action = "run";
  `,
    ),
  ).toEqual([]);
});

it("does not assume a shadowed WeakMap class stores callbacks without invoking them", () => {
  expect(
    scanDiscreteActionBindings(
      "src/shadow-store.ts",
      `
    class WeakMap { set(key, callback) { callback(); } }
    const disposers = new WeakMap(); const button = createButton("Run");
    const action = bindAdaAction(options, button);
    disposers.set(button, () => action.dispose()); button.dataset.action = "run";
  `,
    ),
  ).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", source: 'button.dataset.action = "run"' }),
  );
});

it.each([false, true])(
  "uses canonical lifetime proof for returned aliases after extracted disposal (dispose=%s)",
  (dispose) => {
    const result = scanDiscreteActionProject([
      {
        path: "src/factory.ts",
        text: `export function make(rawButton: HTMLElement) {
      const button = rawButton; const action = bindAdaAction(options, button);
      ${dispose ? "const stop = action.dispose; stop();" : ""}
      return button;
    }`,
      },
      {
        path: "src/consumer.ts",
        text: `import {make} from "./factory.ts";
      const rawButton = document.createElement("button"); const button = make(rawButton);
      button.dataset.action = "run";`,
      },
    ]);
    const returnedProof = result.factoryAssociations.find(
      ({ exportName }) => exportName === "make",
    );
    expect(returnedProof?.members ?? []).toEqual(dispose ? [] : [""]);
    const returnedUse = result.findings.filter(
      ({ path, source }) =>
        path === "src/consumer.ts" && source === 'button.dataset.action = "run"',
    );
    expect(returnedUse.map(({ kind }) => kind)).toEqual(dispose ? ["unbound-discrete"] : []);
    // Argument-construction association is separate from the returned-node proof.
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        kind: "unbound-discrete",
        path: "src/consumer.ts",
        source: 'document.createElement("button")',
      }),
    );
  },
);

it.each([false, true])(
  "checks rewritten object-literal return members against canonical identity proof (overwrite=%s)",
  (overwrite) => {
    const consumerSetup = overwrite
      ? 'const rawButton = document.createElement("button");const controls = wrap(rawButton);'
      : "const controls = wrap();";
    const result = scanDiscreteActionProject([
      {
        path: "src/a.ts",
        text: `export function make(){const button = createButton("Run");
      bindAdaAction(options, button); return {button};}`,
      },
      {
        path: "src/b.ts",
        text: `import {make} from "./a.ts";
      export function wrap(rawButton?: HTMLElement){const controls = make();
        ${overwrite ? "controls.button = rawButton;" : ""}
        return {button: controls.button};
      }`,
      },
      {
        path: "src/consumer.ts",
        text: `import {wrap} from "./b.ts";
      ${consumerSetup}
      controls.button.dataset.action = "run";`,
      },
    ]);
    const wrap = result.factoryAssociations.find(({ exportName }) => exportName === "wrap");
    expect(wrap?.members ?? []).toEqual(overwrite ? [] : ["button"]);
    const returnedUse = result.findings.filter(
      ({ path, source }) =>
        path === "src/consumer.ts" && source === 'controls.button.dataset.action = "run"',
    );
    expect(returnedUse.map(({ kind }) => kind)).toEqual(overwrite ? ["unbound-discrete"] : []);
    if (overwrite) {
      expect(result.findings).toContainEqual(
        expect.objectContaining({
          kind: "unbound-discrete",
          path: "src/consumer.ts",
          source: 'document.createElement("button")',
        }),
      );
    } else {
      expect(result.findings).toEqual([]);
    }
  },
);

it.each([
  ["{button, ...{button: rawButton}}", false],
  ["{button, button: rawButton}", false],
  ['{button, "button": rawButton}', false],
  ["{button, [key]: rawButton}", false],
  ["{button, get button(){return rawButton;}}", false],
  ["{button, button(){return rawButton;}}", false],
  ["{button}", true],
  ["{button: rawButton, button}", true],
  ['{"button": rawButton, button}', true],
] as const)("uses final object-return property semantics for %s", (object, bound) => {
  const result = scanDiscreteActionProject([
    {
      path: "src/factory.ts",
      text: `export function make(rawButton:HTMLElement,key:string){
      const button=createButton("Bound");bindAdaAction(options,button);return ${object};
    }`,
    },
    {
      path: "src/consumer.ts",
      text: `import {make} from "./factory.ts";
      const rawButton=document.createElement("button");const controls=make(rawButton,"button");
      controls.button.dataset.action="run";`,
    },
  ]);
  expect(
    result.factoryAssociations.find(({ exportName }) => exportName === "make")?.members ?? [],
  ).toEqual(bound ? ["button"] : []);
  const returnedUse = result.findings.filter(
    ({ path, source }) =>
      path === "src/consumer.ts" && source === 'controls.button.dataset.action="run"',
  );
  expect(returnedUse.map(({ kind }) => kind)).toEqual(bound ? [] : ["unbound-discrete"]);
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      kind: "unbound-discrete",
      path: "src/consumer.ts",
      source: 'document.createElement("button")',
    }),
  );
});

it.each([
  ["export function make():any { BODY }", true],
  ["export function* make():any { BODY }", false],
  ["export async function make():any { BODY }", false],
  ["export async function* make():any { BODY }", false],
  ["export const make = async ():Promise<any> => { BODY };", false],
  ["export const make = async function():Promise<any> { BODY };", false],
  ["export const make = function*():any { BODY };", false],
] as const)(
  "does not confuse factory runtime kind with an action element: %s",
  (declaration, modeled) => {
    const result = scanDiscreteActionProject([
      {
        path: "src/factory.ts",
        text: declaration.replace(
          "BODY",
          `
      const button = createButton("Run");bindAdaAction(options,button);return button;
    `,
        ),
      },
      {
        path: "src/consumer.ts",
        text: `import {make} from "./factory.ts";
      const button = make();button.dataset.action="run";`,
      },
    ]);
    expect(
      result.factoryAssociations.find(({ exportName }) => exportName === "make")?.members ?? [],
    ).toEqual(modeled ? [""] : []);
    const returnedUse = result.findings.filter(
      ({ path, source }) => path === "src/consumer.ts" && source === 'button.dataset.action="run"',
    );
    expect(returnedUse.map(({ kind }) => kind)).toEqual(modeled ? [] : ["unbound-discrete"]);
  },
);

it.each([
  ["function register(element){bindAdaAction(options,element);}", true],
  ["async function register(element){await tick();bindAdaAction(options,element);}", false],
  ["function* register(element){bindAdaAction(options,element);}", false],
  ["const register=async(element)=>{await tick();bindAdaAction(options,element);};", false],
  ["const register=async function(element){await tick();bindAdaAction(options,element);};", false],
  ["const register=function*(element){bindAdaAction(options,element);};", false],
  ["const register=(element)=>bindAdaAction(options,element);", true],
  ["const register=function(element){bindAdaAction(options,element);};", true],
] as const)(
  "requires synchronous registration wrapper runtime kind: %s",
  (declaration, synchronous) => {
    const result = scanDiscreteActionBindings(
      "src/wrapper.ts",
      `${declaration}
    const button=createButton("Run");register(button);button.dataset.action="run";
  `,
    );
    const returnedUse = result.filter(({ source }) => source === 'button.dataset.action="run"');
    expect(returnedUse.map(({ kind }) => kind)).toEqual(synchronous ? [] : ["unbound-discrete"]);
    if (synchronous) {
      expect(result).toEqual([]);
    }
  },
);

it.each([
  "function register(element){if(enabled)bindAdaAction(options,element);}",
  "function register(element){if(!ready)return;bindAdaAction(options,element);}",
  "const register=(element)=>enabled&&bindAdaAction(options,element);",
  "function register(element){const methods={later(){bindAdaAction(options,element);}};}",
])("does not infer a guaranteed wrapper invocation from a conditional body: %s", (declaration) => {
  expect(
    scanDiscreteActionBindings(
      "src/wrapper.ts",
      `${declaration}
    const button=createButton("Run");register(button);button.dataset.action="run";
  `,
    ),
  ).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", source: 'button.dataset.action="run"' }),
  );
});

it.each(
  (
    [
      ["if(enabled)CALL;", false],
      ["function never(){CALL;}", false],
      ["later(()=>{CALL;});", false],
      ["for(const item of items){CALL;}", false],
      ["enabled&&CALL;", false],
      ["CALL;", true],
    ] as const
  ).flatMap(([invocation, proven]) =>
    ["register(button)", "bindAdaAction(options,button)"].map(
      (call) => [invocation, proven, call] as const,
    ),
  ),
)("requires same-phase invocation dominance: %s %s %s", (invocation, proven, call) => {
  const result = scanDiscreteActionBindings(
    "src/caller.ts",
    `
    function register(element){bindAdaAction(options,element);}
    const button=createButton("Run");${invocation.replace("CALL", call)}
    button.dataset.action="run";
  `,
  );
  expect(
    result.filter(({ source }) => source === 'button.dataset.action="run"').map(({ kind }) => kind),
  ).toEqual(proven ? [] : ["unbound-discrete"]);
});
it.each(["register(button)", "bindAdaAction(options,button)"])(
  "does not use a later registration to prove an earlier action use: %s",
  (call) => {
    const result = scanDiscreteActionBindings(
      "src/order.ts",
      `
      function register(element){bindAdaAction(options,element);}
      const button=createButton("Run");button.dataset.action="run";${call};
    `,
    );
    expect(result).toContainEqual(
      expect.objectContaining({ kind: "unbound-discrete", source: 'button.dataset.action="run"' }),
    );
  },
);
it("retains local unconditional synchronous registration within an invoked owner", () => {
  expect(
    scanDiscreteActionBindings(
      "src/local.ts",
      `
    function register(element){bindAdaAction(options,element);}
    function assemble(){const button=createButton("Run");register(button);button.dataset.action="run";}
    assemble();
  `,
    ),
  ).toEqual([]);
});

it.each([
  ["if(enabled)CALL;", false],
  ["function never(){CALL;}", true],
  ["later(()=>{CALL;});", true],
  ["CALL;", true],
] as const)(
  "applies invocation dominance to imported factory results: %s",
  (invocation, proven) => {
    const result = scanDiscreteActionProject([
      {
        path: "src/factory.ts",
        text: `export function make(){
      const button=createButton("Run");bindAdaAction(options,button);return button;
    }`,
      },
      {
        path: "src/consumer.ts",
        text: `import {make} from "./factory.ts";
      ${invocation.replace("CALL", 'const button=make();button.dataset.action="run"')}
    `,
      },
    ]);
    expect(
      result.findings
        .filter(
          ({ path, source }) =>
            path === "src/consumer.ts" && source === 'button.dataset.action="run"',
        )
        .map(({ kind }) => kind),
    ).toEqual(proven ? [] : ["unbound-discrete"]);
  },
);
it.each([
  "if(enabled)bindAdaAction(options,button);",
  "function never(){bindAdaAction(options,button);}",
  "later(()=>bindAdaAction(options,button));",
])("does not export a factory result with unexecuted registration: %s", (registration) => {
  const result = scanDiscreteActionProject([
    {
      path: "src/factory.ts",
      text: `export function make(){
      const button=createButton("Run");${registration}return button;
    }`,
    },
    {
      path: "src/consumer.ts",
      text: `import {make} from "./factory.ts";
      const button=make();button.dataset.action="run";`,
    },
  ]);
  expect(result.factoryAssociations).toEqual([]);
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      kind: "unbound-discrete",
      path: "src/consumer.ts",
      source: 'button.dataset.action="run"',
    }),
  );
});

it("does not transfer imported factory proof across execution owners", () => {
  const result = scanDiscreteActionProject([
    {
      path: "src/factory.ts",
      text: `export function make(){
      const button=createButton("Run");bindAdaAction(options,button);return button;
    }`,
    },
    {
      path: "src/consumer.ts",
      text: `import {make} from "./factory.ts";
      const button=make();function later(){button.dataset.action="run";}`,
    },
  ]);
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      kind: "unbound-discrete",
      path: "src/consumer.ts",
      source: 'button.dataset.action="run"',
    }),
  );
});
