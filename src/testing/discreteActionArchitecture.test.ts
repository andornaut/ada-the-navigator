import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import {
  type DiscreteActionSource,
  scanDiscreteActionBindings as scanSingleSource,
  scanDiscreteActionProject,
} from "./discreteActionArchitecture.ts";

it("accepts registered action construction and rejects a raw replacement instead of grandfathering a file", () => {
  expect(
    scanWithRegistry(
      "src/ui/newCard.ts",
      "bindAdaAction({click: action, current, slopPx}, button);",
    ),
  ).toEqual([]);
  expect(
    scanWithRegistry("src/ui/newCard.ts", 'button.addEventListener("click", action);').map(
      (finding) => finding.kind,
    ),
  ).toEqual(["raw-discrete"]);
});
it("finds aliases, onclick forms and delegated glyph callbacks", () => {
  const source = [
    'const event = "click"; glyph.addEventListener(event, action);',
    'button.onclick = action; glyph["onclick"] = action;',
    'const props = {onClick: action}; glyph.setAttribute("onclick", "action()");',
  ].join("");
  expect(
    scanWithRegistry("src/game/glyph.ts", source).filter(
      (finding) => finding.kind === "raw-discrete",
    ),
  ).toHaveLength(5);
});
it("permits the implementation-owned click and keeps gestures visible for review", () => {
  expect(scanSingleSource(canonicalRegistry.path, canonicalRegistry.text)).toEqual([]);
  expect(
    scanSingleSource(
      "src/ui/consumer.ts",
      'function bindAdaAction(){element.addEventListener("click", click);}',
    )[0]?.kind,
  ).toBe("raw-discrete");
  expect(
    scanSingleSource(
      "src/ui/actionBinding.ts",
      'function bypass(){element.addEventListener("click", action);}',
    )[0]?.kind,
  ).toBe("raw-discrete");
  expect(
    scanWithRegistry("src/ui/map.ts", 'node.addEventListener("pointerup", select);')[0]?.kind,
  ).toBe("gesture-review");
  expect(scanWithRegistry("src/ui/map.ts", "node.addEventListener(event, action);")[0]?.kind).toBe(
    "unresolved-event",
  );
});
it("rejects implicit-readiness root attachment until its explicit root port is adopted", () => {
  expect(
    scanWithRegistry("src/input/controls.ts", "bindAdaHoldActions(guard, root);")[0]?.kind,
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
    expect(scanWithRegistry("new/consumer.ts", source).map((finding) => finding.kind)).toContain(
      "unbound-discrete",
    );
  }
  expect(
    scanWithRegistry(
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
    scanWithRegistry(
      "new/consumer.ts",
      `
    const register = (element, run) => bindAdaAction({click: run, current, slopPx}, element);
    const button = createButton("Run");
    register(button, run);
  `,
    ),
  ).toEqual([]);
  expect(
    scanWithRegistry(
      "new/consumer.ts",
      `
    const register = (element, run) => element.addEventListener("click", run);
    const button = createButton("Run"); register(button, run);
  `,
    ).map((finding) => finding.kind),
  ).toEqual(["raw-discrete", "unbound-discrete"]);
});

it("does not borrow a binding from a shadowed element in another function", () => {
  const findings = scanWithRegistry(
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
  const benign = scanWithRegistry(
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
      scanWithRegistry(
        "any/consumer.ts",
        `
      node.addEventListener("click", event => { event.preventDefault(); ${action}; });
    `,
      )[0]?.kind,
    ).toBe("raw-discrete");
  }
});

function compatibilityClicks(after = "", mutate = (source: string) => source) {
  const source = mutate(`
    export function build() {
      const surface = document.createElement("div");
      let pending: number | null = null;
      surface.addEventListener("pointerdown", event => {
        if (arriving) {
          pending = event.pointerId;
          finish();
        } else if (pending === event.pointerId) {
          pending = null;
        }
      }, true);
      surface.addEventListener("click", event => {
        if (event.detail !== 0 && event.pointerId === pending) {
          pending = null;
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);
      ${after}
    }
  `);
  // This fixture has only native listeners and no imported action binding or factory.
  return scanSingleSource("src/ui/independent.ts", source).filter(({ source }) =>
    source.includes('addEventListener("click"'),
  );
}

it("recognizes a private pointer latch reset on a physical captured click", () => {
  expect(compatibilityClicks()).toEqual([
    expect.objectContaining({ classification: "suppressor", kind: "non-action" }),
  ]);
});

const legacyCompatibilitySource = `
  export function build() {
    const list = document.createElement("div");
    for (const node of [list]) {
      let dragged: number | undefined;
      let latest: number | undefined;
      node.addEventListener("pointerdown", event => {
        latest = event.pointerId;
        if (dragged === event.pointerId) {
          dragged = undefined;
        }
      });
      node.addEventListener("pointermove", event => {
        dragged = event.pointerId;
      });
      node.addEventListener("click", event => {
        const physical = typeof event.pointerId === "number" ? event.pointerId : latest;
        if (event.detail === 0 || dragged === undefined || physical !== dragged) {
          return;
        }
        dragged = undefined;
        event.preventDefault();
        event.stopPropagation();
      }, true);
      for (const type of ["pointerup", "pointercancel"] as const) {
        node.addEventListener(type, event => {
          if (type === "pointercancel" && dragged === event.pointerId) {
            dragged = undefined;
          }
        });
      }
    }
  }
`;

it("recognizes a legacy physical click tied to the same receiver's latest pointer", () => {
  const findings = scanWithRegistry("src/paging.ts", legacyCompatibilitySource);
  expect(findings.find(({ source }) => source.includes('addEventListener("click"'))).toMatchObject({
    classification: "suppressor",
    kind: "non-action",
  });
  expect(findings.filter(({ kind }) => kind === "gesture-review")).toHaveLength(3);
});

it.each([
  ["calls an action", "event.stopPropagation();", "event.stopPropagation(); activate();"],
  ["moves focus", "event.stopPropagation();", "event.stopPropagation(); button.focus();"],
  [
    "writes other state",
    "event.stopPropagation();",
    "event.stopPropagation(); state.changed = true;",
  ],
  [
    "adds a listener",
    "event.stopPropagation();",
    'event.stopPropagation(); surface.addEventListener("keydown", activate);',
  ],
  [
    "evaluates a suppression argument",
    "event.stopPropagation();",
    "event.stopPropagation(activate());",
  ],
  [
    "calls suppression on a different receiver",
    "event.stopPropagation();",
    "audit.stopPropagation();",
  ],
  ["does not check for a physical click", "event.detail !== 0 && ", ""],
  [
    "rearms the latch",
    "pending = null;\n          event.preventDefault();",
    "pending = event.pointerId; event.preventDefault();",
  ],
  [
    "clears a different value",
    "pending = null;\n          event.preventDefault();",
    "other = null; event.preventDefault();",
  ],
  ["takes its pointer ID from a helper", "pending = event.pointerId;", "pending = readPointer();"],
  [
    "uses a latch read to gate an action",
    "pending === event.pointerId) {",
    "pending === event.pointerId && activate()) {",
  ],
  [
    "runs outside capture",
    "event.stopPropagation();\n        }\n      }, true);",
    "event.stopPropagation();\n        }\n      }, false);",
  ],
  ["listens on a non-DOM target", 'document.createElement("div")', "new FakeTarget()"],
] as const)("keeps a compatibility click blocking when it %s", (_case, before, next) => {
  expect(
    compatibilityClicks("", (text) => {
      expect(text).toContain(before);
      return text.replace(before, next);
    }).some(({ kind }) => kind === "raw-discrete"),
    next,
  ).toBe(true);
});

it.each([
  ["passes the latch to an action", "activate(pending);"],
  ["branches to an action on the latch", "if (pending === null) activate();"],
  ["returns the latch in an object", "return { pending };"],
  ["reads the latch through eval", 'eval("activate(pending)");'],
  ["keeps a copy of the latch", "let stale = pending;"],
  ["increments the latch", "++pending;"],
  ["replaces the listener method", "surface.addEventListener = intercept;"],
] as const)("keeps a compatibility click blocking when outside code %s", (_case, use) => {
  expect(compatibilityClicks(use)[0]?.kind, use).toBe("raw-discrete");
});

it("keeps legacy click latches blocking without an armed check or stable pointer provenance", () => {
  for (const [before, next] of [
    ["dragged === undefined || ", ""],
    [": latest;", ": selectPointer();"],
    ["latest = event.pointerId;", "latest = getPointer();"],
    ["event.stopPropagation();", "event.stopPropagation(); return dragged;"],
    [
      'type === "pointercancel" && dragged === event.pointerId',
      'dragged === event.pointerId && type === "pointercancel" && act()',
    ],
  ] as const) {
    const findings = scanWithRegistry(
      "src/paging.ts",
      legacyCompatibilitySource.replace(before, next),
    );
    expect(
      findings.find(({ source }) => source.includes('addEventListener("click"'))?.kind,
      next,
    ).toBe("raw-discrete");
  }
});

it("keeps mixed drag release actions blocking and classifies native value editing separately", () => {
  const findings = scanWithRegistry(
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
    scanWithRegistry(
      "any/consumer.ts",
      `
    input.addEventListener("input", event => { value = event.target.value; save(); });
  `,
    )[0]?.kind,
  ).toBe("unresolved-event");
});

it.each(["gotpointercapture", "lostpointercapture"])(
  "reviews a pointer capture callback that can activate an action (%s)",
  (event) => {
    const findings = scanSingleSource(
      "src/ui/consumer.ts",
      `
      const type = "${event}";
      screen.addEventListener(type, event => {
        event.preventDefault();
        select(event);
      });
    `,
    );
    expect(findings).toEqual([
      expect.objectContaining({ classification: "unclassified", kind: "gesture-review" }),
    ]);
  },
);

it("resolves event aliases in their lexical scope and leaves unknown keyboard actions open", () => {
  const findings = scanWithRegistry(
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

it("resolves only the pinned Phaser lifecycle event exports", () => {
  const require = createRequire(import.meta.url);
  const phaser = dirname(require.resolve("phaser/package.json"));
  for (const [path, name] of [
    ["loader/events/FILE_COMPLETE_EVENT.js", "filecomplete"],
    ["scale/events/RESIZE_EVENT.js", "resize"],
    ["scene/events/PRE_RENDER_EVENT.js", "prerender"],
  ] as const) {
    const source = readFileSync(join(phaser, "src", path), "utf8");
    expect(/module\.exports = '([^']+)';/u.exec(source)?.[1]).toBe(name);
  }
  const { findings } = scanDiscreteActionProject([
    {
      path: "src/game/scene.ts",
      text: `
        import { Loader as AssetLoader, Scale, Scenes, Input, type Loader as Erased } from "phaser";
        import { Loader } from "./fake.ts";
        scene.load.on(AssetLoader.Events.FILE_COMPLETE, draw);
        scene.scale.on(Scale.Events.RESIZE, resize);
        scene.events.on(Scenes.Events.PRE_RENDER, refresh);
        shadow.on(Loader.Events.FILE_COMPLETE, activate);
        surface.on(Erased.Events.FILE_COMPLETE, activate);
        surface.on(Input.Events.POINTER_UP, select);
        function local(Scale) { surface.on(Scale.Events.RESIZE, activate); }
        surface.on(Scenes.Events[name], activate);
      `,
    },
  ]);
  expect(findings.map(({ kind, source }) => [kind, source])).toEqual([
    ["unresolved-event", "shadow.on(Loader.Events.FILE_COMPLETE, activate)"],
    ["unresolved-event", "surface.on(Erased.Events.FILE_COMPLETE, activate)"],
    ["unresolved-event", "surface.on(Input.Events.POINTER_UP, select)"],
    ["unresolved-event", "surface.on(Scale.Events.RESIZE, activate)"],
    ["unresolved-event", "surface.on(Scenes.Events[name], activate)"],
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

const canonicalRegistry = {
  path: "src/ui/actionBinding.ts",
  text: readFileSync(new URL("../ui/actionBinding.ts", import.meta.url), "utf8"),
};

// Legacy synthetic fixtures model a consumer with an explicit import from the real registry.
function registryImport(path: string): string {
  const relative = posix.relative(posix.dirname(path), canonicalRegistry.path);
  return `import { bindAdaAction } from ${JSON.stringify(relative.startsWith(".") ? relative : `./${relative}`)}; `;
}

function scanRegistryFixtures(inputs: readonly DiscreteActionSource[]) {
  const result = scanDiscreteActionProject([
    canonicalRegistry,
    ...inputs.map(({ path, text }) => ({ path, text: registryImport(path) + text })),
  ]);
  return result;
}

function scanWithRegistry(path: string, text: string) {
  return scanRegistryFixtures([{ path, text }]).findings.filter((finding) => finding.path === path);
}

const originFixture = `
  export function makePanel() {
    const button = document.createElement("button");
    register({click:{run:()=>updatePanel()}},button);
    button.dataset.action = "next";
    return {button};
  }
`;

it.each([
  ["direct alias", 'import { bindAdaAction as register } from "./actionBinding.ts";', true],
  ["same-named local", "function bindAdaAction() {}", false],
  ["wrong module", 'import { bindAdaAction } from "./observe.ts";', false],
  ["type-only", 'import type { bindAdaAction } from "./actionBinding.ts";', false],
  ["re-export", 'import { bindAdaAction } from "./barrel.ts";', false],
  ["unavailable", 'import { bindAdaAction } from "./unavailable.ts";', false],
] as const)("requires a canonical value export for a %s", (scenario, prefix, proven) => {
  const path = "src/ui/panel.ts";
  const body =
    scenario === "direct alias"
      ? originFixture
      : originFixture.replace("register(", "bindAdaAction(");
  const result = scanDiscreteActionProject([
    canonicalRegistry,
    { path: "src/ui/observe.ts", text: "export function bindAdaAction() {}" },
    { path: "src/ui/barrel.ts", text: 'export {bindAdaAction} from "./actionBinding.ts";' },
    { path, text: prefix + body },
  ]);
  expect(
    result.findings.filter((finding) => finding.path === path).map(({ kind }) => kind),
  ).toEqual(proven ? [] : ["unbound-discrete", "unbound-discrete"]);
  expect(
    result.factoryAssociations
      .filter((fact) => fact.path === path)
      .flatMap(({ members }) => members),
  ).toEqual(proven ? ["button"] : []);
});

it("does not promote a lexically shadowed wrapper or fake lifetime handle to a binding proof", () => {
  const path = "src/ui/panel.ts";
  const result = scanDiscreteActionProject([
    canonicalRegistry,
    {
      path,
      text: `
      import { bindAdaAction } from "./actionBinding.ts";
      function fakeRegistry(bindAdaAction) {
        function register(button) { return bindAdaAction(opts, button); }
        const button = createButton("Run");
        const binding = register(button);
        button.dataset.action = "wrong-wrapper";
        button.addEventListener("keydown", () => binding.activate());
      }
      function unprovenHandle(bindAdaAction) {
        const button = createButton("Run");
        const binding = bindAdaAction(opts, button);
        button.dataset.action = "wrong-handle";
        button.addEventListener("keydown", () => binding.activate());
      }
    `,
    },
  ]);
  expect(
    result.findings.filter((finding) => finding.path === path).map(({ kind }) => kind),
  ).toEqual([
    "unbound-discrete",
    "unbound-discrete",
    "gesture-review",
    "unbound-discrete",
    "unbound-discrete",
    "gesture-review",
  ]);
});

it("keeps the actual registry bridge but flags an unrelated raw click in the same implementation", () => {
  const marker = 'element.addEventListener("click", click);';
  const extra = 'element.addEventListener("click", () => bypass());';
  const patched = canonicalRegistry.text.replace(marker, `${marker}\n    ${extra}`);
  expect(patched).not.toBe(canonicalRegistry.text);
  const findings = scanDiscreteActionProject([{ ...canonicalRegistry, text: patched }]).findings;
  expect(
    findings.filter(({ kind }) => kind === "raw-discrete").map(({ source }) => source),
  ).toEqual([marker.slice(0, -1), 'element.addEventListener("click", () => bypass())']);
  const external = "src/ui/unrelated.ts";
  const impostor =
    'export function bindAdaAction(options, button) { button.addEventListener("click", options.run); }';
  expect(
    scanDiscreteActionProject([canonicalRegistry, { path: external, text: impostor }]).findings,
  ).toEqual([expect.objectContaining({ kind: "raw-discrete", path: external })]);
});

function constructionFindings(path: string, text: string) {
  return scanDiscreteActionProject([canonicalRegistry, { path, text }]).findings.filter(
    (finding) => finding.path === path,
  );
}

it("accepts the actual Ship row's pre-bind metadata and catches a native click bypass on an early return", () => {
  const path = "src/ui/shipCard.ts";
  const source = readFileSync(new URL("../ui/shipCard.ts", import.meta.url), "utf8");
  const metadata = 'line.type = "button"';
  expect(constructionFindings(path, source)).toEqual([]);
  const bypass = source.replace(
    `${metadata};`,
    `${metadata};
     if (legacy()) {
       document.body.append(line);
       line.addEventListener("click", () => onItem(row, line));
       return line;
     }`,
  );
  expect(bypass).not.toBe(source);
  expect(constructionFindings(path, bypass).map(({ kind, source }) => [kind, source])).toEqual([
    ["unbound-discrete", 'document.createElement("button")'],
    ["unbound-discrete", metadata],
    ["raw-discrete", 'line.addEventListener("click", () => onItem(row, line))'],
  ]);
});

function constructWith(
  prelude = "",
  between = "",
  bind = "bindAdaAction({ click: { run: () => act() } }, control)",
) {
  return `
    import { bindAdaAction } from "./ui/actionBinding.ts";
    function build() {
      ${prelude}
      const control = document.createElement("button");
      control.type = "button";
      control.dataset.action = "select-row";
      ${between}
      const registration = ${bind};
      return control;
    }
  `;
}

it("covers consecutive literal metadata on another fresh node before its canonical registration", () => {
  expect(constructionFindings("src/otherSurface.ts", constructWith())).toEqual([]);
});

it.each([
  ["shadowed bind", "const bindAdaAction = fake;", "", "bindAdaAction({}, control)"],
  ["different node", "", "", "bindAdaAction({}, sibling)"],
  ["shadowed receiver", "const document = alternate;", "", "bindAdaAction({}, control)"],
  ["call receiver", "", "", "fake.bindAdaAction({}, control)"],
  ["attached node", "", "root.append(control);", "bindAdaAction({}, control)"],
  ["escaped options", "", "", "bindAdaAction({ click: expose(control) }, control)"],
  ["conditional bind", "", "", "enabled && bindAdaAction({}, control)"],
] as const)("keeps pre-bind metadata open for a %s", (_case, prelude, between, bind) => {
  const result = constructionFindings("src/otherSurface.ts", constructWith(prelude, between, bind));
  expect(result).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", source: 'control.type = "button"' }),
  );
  expect(result).toContainEqual(
    expect.objectContaining({
      kind: "unbound-discrete",
      source: 'control.dataset.action = "select-row"',
    }),
  );
});

it("does not extend pre-bind proof through a destructured cleanup handle", () => {
  const source = constructWith()
    .replace("const registration =", "const { dispose } =")
    .replace("return control", "dispose(); return control");
  expect(constructionFindings("src/otherSurface.ts", source)).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", source: 'control.type = "button"' }),
  );
});

it("does not exempt a callback because it is named continuous, drag, or editing", () => {
  for (const callback of ["continuous", "drag", "editing"]) {
    const findings = scanWithRegistry(
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
  ['const button = createButton("Run"); bindAdaAction(options, button);', 0, true],
  ['const button = createButton("Run"); bindAdaAction(options, button);', 1, false],
  ['node.addEventListener("click", run);', 1, false],
  ['node.addEventListener("pointerup", select);', 1, false],
  ['node.addEventListener("lostpointercapture", select);', 1, false],
  ["recovery.root.assertBindings();", 1, false],
  ['const button = createButton("Later"); button.disabled = true;', 1, false],
  ['node.addEventListener("click", event => event.preventDefault());', 0, false],
] as const)("uses the real CLI exit contract for %s", (text, status, imported) => {
  const project = mkdtempSync(join(tmpdir(), "discrete-action-cli-"));
  mkdirSync(join(project, "src"));
  const consumer = "src/consumer.ts";
  writeFileSync(join(project, consumer), imported ? registryImport(consumer) + text : text);
  if (imported) {
    mkdirSync(join(project, "src/ui"));
    writeFileSync(join(project, canonicalRegistry.path), canonicalRegistry.text);
  }
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
  expect(facts.blocking).toBe(status);
  expect(facts.status).toBe(status === 1 ? "OPEN" : "CLOSED_LOCAL_STATIC_CHECKS");
  expect(facts.inputs).toEqual(
    [consumer, ...(imported ? [canonicalRegistry.path] : [])].map((path) => ({
      path,
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    })),
  );
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
  const project = scanRegistryFixtures(sources);
  expect(project.findings).toEqual([]);
  expect(project.factoryAssociations).toEqual([
    expect.objectContaining({ exportName: "make", members: [""], path: "src/factory.ts" }),
  ]);
  const raw = scanRegistryFixtures([
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
  const result = scanRegistryFixtures([
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
  const result = scanRegistryFixtures([
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

it("distinguishes direct live-root and metadata assertion sites from unresolved methods", () => {
  const path = "src/ui/assertionConsumer.ts";
  const result = scanDiscreteActionProject([
    canonicalRegistry,
    {
      path,
      text: `
        import { assertAdaActionBindings as verify, assertAdaActionMetadata } from "./actionBinding.ts";
        verify(panel);
        assertAdaActionMetadata(panel);
        const repaint = { assertBindings() {} };
        repaint.assertBindings();
      `,
    },
  ]);
  expect(result.runtimeAssertions).toEqual([
    { kind: "live-root", line: 3, path, source: "verify(panel)" },
    { kind: "metadata", line: 4, path, source: "assertAdaActionMetadata(panel)" },
  ]);
  expect(result.unresolvedRuntimeAssertions).toEqual([
    { line: 6, path, source: "repaint.assertBindings()" },
  ]);
});

const recoveryAdapter = {
  path: "src/ui/holdActionsAdapter.ts",
  text: readFileSync(new URL("../ui/holdActionsAdapter.ts", import.meta.url), "utf8"),
};

const recoveryRegistry = {
  path: "src/ui/actionRegistry.ts",
  text: readFileSync(new URL("../ui/actionRegistry.ts", import.meta.url), "utf8"),
};
const recoveryStartup = {
  path: "src/loading/startup.ts",
  text: readFileSync(new URL("../loading/startup.ts", import.meta.url), "utf8"),
};

const recoveryCrash = {
  path: "src/crash/crashScreen.ts",
  text: readFileSync(new URL("../crash/crashScreen.ts", import.meta.url), "utf8"),
};

const crashAssertion = "completed.root.assertBindings()";
const recoverySources = [canonicalRegistry, recoveryRegistry, recoveryAdapter, recoveryCrash];

it("associates the eager Startup and guarded lazy Crash recovery assertions", () => {
  const result = scanDiscreteActionProject([...recoverySources, recoveryStartup]);
  expect(result.runtimeAssertions).toContainEqual(
    expect.objectContaining({
      kind: "live-root",
      path: recoveryStartup.path,
      source: "recovery.assertBindings()",
    }),
  );
  expect(result.runtimeAssertions).toContainEqual(
    expect.objectContaining({
      kind: "live-root",
      path: recoveryCrash.path,
      source: crashAssertion,
    }),
  );
  expect(result.unresolvedRuntimeAssertions).toEqual([]);
});

it.each([
  [
    "another receiver",
    recoveryCrash,
    crashAssertion,
    "foreign.root.assertBindings()",
    "foreign.root.assertBindings()",
  ],
  [
    "a foreign root factory",
    recoveryCrash,
    'from "../ui/holdActionsAdapter.ts"',
    'from "./foreignRecovery.ts"',
  ],
  [
    "a root registered on the wrong host",
    recoveryCrash,
    "bindAdaRecoveryActionRoot({ guard: rootPressGuard(host) }, host)",
    "bindAdaRecoveryActionRoot({ guard: rootPressGuard(host) }, body)",
  ],
  [
    "replacement of the captured root",
    recoveryCrash,
    "metadata.add(stop);",
    "metadata.add(stop); Object.assign(completed, { root: { assertBindings() {} } });",
  ],
  [
    "disposal before the liveness guard",
    recoveryCrash,
    "metadata.add(stop);",
    "metadata.add(stop); completed.root.dispose();",
  ],
  [
    "publishing the captured record through a shorthand property",
    recoveryCrash,
    "metadata.add(stop);",
    "metadata.add(stop); publish({ completed });",
  ],
  [
    "binding with the record as its receiver",
    recoveryCrash,
    "const bind = completed.bind;",
    "const bind = action => completed.bind(action);",
  ],
  ["teardown retaining the disposed instance", recoveryCrash, "  recovery = undefined;", ""],
  [
    "teardown calling out before retiring the record",
    recoveryCrash,
    "  if (retiring) {",
    "  retiring?.root.invalidate(); if (retiring) {",
  ],
  ["the final guard omitting liveness", recoveryCrash, "    completed.live", "    true"],
  [
    "the final guard omitting current identity",
    recoveryCrash,
    "    recovery === completed &&",
    "    true &&",
  ],
  [
    "a call after the liveness guard",
    recoveryCrash,
    "    completed.live",
    "    completed.live && probe()",
  ],
  ["an already disposed adapter", recoveryAdapter, "let disposed = false;", "let disposed = true;"],
  [
    "an adapter that unregisters before returning",
    recoveryAdapter,
    "  const resolve = (target:",
    "  unregister(); const resolve = (target:",
  ],
] as const)(
  "keeps Crash recovery reviewable with %s",
  (_label, input, original, replacement, site?: string) => {
    expect(input.text.split(original)).toHaveLength(2);
    const mutated = { ...input, text: input.text.replace(original, replacement) };
    const result = scanDiscreteActionProject([
      ...recoverySources.map((source) => (source.path === input.path ? mutated : source)),
      {
        path: "src/crash/foreignRecovery.ts",
        text: "export function bindAdaRecoveryActionRoot() { return { assertBindings() {} }; }",
      },
    ]);
    expect(result.runtimeAssertions.filter(({ path }) => path === recoveryCrash.path)).toEqual([]);
    expect(result.unresolvedRuntimeAssertions).toEqual([
      expect.objectContaining({ path: recoveryCrash.path, source: site ?? crashAssertion }),
    ]);
  },
);

it("associates the guarded lazy Crash recovery assertion even when binding can invoke teardown", () => {
  const original = "const binding = bindAdaAction(";
  expect(canonicalRegistry.text.split(original)).toHaveLength(2);
  const mutated = {
    ...canonicalRegistry,
    text: canonicalRegistry.text.replace(
      original,
      `root.ownerDocument.defaultView?.dispatchEvent(new PageTransitionEvent("pagehide")); ${original}`,
    ),
  };
  const result = scanDiscreteActionProject([
    mutated,
    ...recoverySources.filter(({ path }) => path !== canonicalRegistry.path),
  ]);
  expect(result.runtimeAssertions).toContainEqual(
    expect.objectContaining({
      kind: "live-root",
      path: recoveryCrash.path,
      source: crashAssertion,
    }),
  );
  expect(result.unresolvedRuntimeAssertions).toEqual([]);
});

it.each([
  [
    "root guard redirects the delegated argument",
    recoveryAdapter,
    "if (!root.contains(completedSubtree))",
    "if ((completedSubtree = document.body, false))",
  ],
  [
    "adapter redirects the construction root",
    recoveryAdapter,
    "function bindRoot(policy: RootPolicy, root: HTMLElement) {",
    "function bindRoot(policy: RootPolicy, root: HTMLElement) { root = root.ownerDocument.body;",
  ],
  [
    "adapter destructures a replacement construction root",
    recoveryAdapter,
    "const options = policy.options;",
    "const options = policy.options; ({root} = {root: root.ownerDocument.body});",
  ],
  [
    "registration takes a different root",
    recoveryAdapter,
    "    root,\n  );\n  const resolve",
    "    root.ownerDocument.body,\n  );\n  const resolve",
  ],
  [
    "caller redirects the document owner",
    recoveryStartup,
    'const frame = root.ownerDocument.createElement("div");',
    'root = root.ownerDocument.body; const frame = root.ownerDocument.createElement("div");',
  ],
  [
    "construction passes a shadowed root",
    recoveryStartup,
    'const frame = root.ownerDocument.createElement("div");',
    "const other = () => { const root = document.body;" +
      ' return root.ownerDocument.createElement("div"); }; const frame = other();',
  ],
])("leaves Startup unresolved when the %s", (_label, input, original, replacement) => {
  const mutated = { ...input, text: input.text.replace(original, replacement) };
  expect(mutated.text).not.toBe(input.text);
  const { path } = recoveryStartup;
  const result = scanDiscreteActionProject([
    canonicalRegistry,
    recoveryRegistry,
    ...[recoveryAdapter, recoveryStartup].map((source) =>
      source.path === input.path ? mutated : source,
    ),
  ]);
  expect(result.runtimeAssertions.filter((site) => site.path === path)).toEqual([]);
  expect(result.unresolvedRuntimeAssertions).toEqual([
    expect.objectContaining({ path, source: "recovery.assertBindings()" }),
  ]);
});

it("keeps recovery method calls unresolved when their binding or eager lifetime is ambiguous", () => {
  const path = "src/recovery.ts";
  const result = scanDiscreteActionProject([
    canonicalRegistry,
    recoveryRegistry,
    recoveryAdapter,
    {
      path: "src/lookalike.ts",
      text: "export function bindAdaRecoveryActionRoot(options, root) { return root; }",
    },
    {
      path,
      text: `
        import {bindAdaRecoveryActionRoot as bind} from "./ui/holdActionsAdapter.ts";
        import {bindAdaRecoveryActionRoot as fake} from "./lookalike.ts";
        function wrongModule(root) {
          const panel = root.ownerDocument.createElement("div");
          const recovery = fake(options, panel);
          recovery.assertBindings();
        }
        function shadow(root, bind) {
          const panel = root.ownerDocument.createElement("div");
          const recovery = bind(options, panel);
          recovery.assertBindings();
        }
        function replace(root) {
          const panel = root.ownerDocument.createElement("div");
          let recovery = bind(options, panel);
          recovery = replacement;
          recovery.assertBindings();
        }
        function fakeType(root) {
          const panel = root.ownerDocument.createElement("div");
          const recovery = replacement as ReturnType<typeof bind>;
          recovery.assertBindings();
        }
        function redefine(root) {
          const panel = root.ownerDocument.createElement("div");
          const recovery = bind(options, panel);
          recovery.assertBindings = replacement;
          recovery.assertBindings();
        }
        function disposed(root) {
          const panel = root.ownerDocument.createElement("div");
          const recovery = bind(options, panel);
          recovery.dispose();
          recovery.assertBindings();
        }
        function escaped(root) {
          const panel = root.ownerDocument.createElement("div");
          const recovery = bind(options, panel);
          publish({ recovery });
          recovery.assertBindings();
        }
        function deferred(root) {
          const panel = root.ownerDocument.createElement("div");
          const recovery = bind(options, panel);
          publish(() => recovery.assertBindings());
          recovery.dispose();
        }
        function beforeAudit(root) {
          const panel = root.ownerDocument.createElement("div");
          const recovery = bind(options, panel);
          mount(() => recovery.dispose());
          recovery.assertBindings();
        }
        function hoisted(root) {
          const panel = root.ownerDocument.createElement("div");
          const recovery = bind(options, panel);
          mount(teardown);
          recovery.assertBindings();
          function teardown() { recovery.dispose(); }
        }
      `,
    },
  ]);
  expect(result.runtimeAssertions.filter((site) => site.path === path)).toEqual([]);
  expect(result.unresolvedRuntimeAssertions.filter((site) => site.path === path)).toHaveLength(10);
});

it("requires the adapter method to delegate to the canonical assertion import", () => {
  const path = "src/caller.ts";
  const result = scanDiscreteActionProject([
    canonicalRegistry,
    recoveryRegistry,
    {
      ...recoveryAdapter,
      text: recoveryAdapter.text.replace(
        "assertAdaActionBindings(completedSubtree);",
        "log(completedSubtree);",
      ),
    },
    {
      path,
      text: `
        import {bindAdaRecoveryActionRoot} from "./ui/holdActionsAdapter.ts";
        function construct(root) {
          const panel = root.ownerDocument.createElement("div");
          const audit = bindAdaRecoveryActionRoot(options, panel);
          audit.assertBindings();
        }
      `,
    },
  ]);
  expect(result.runtimeAssertions.filter((site) => site.path === path)).toEqual([]);
  expect(result.unresolvedRuntimeAssertions).toEqual([
    expect.objectContaining({ path, source: "audit.assertBindings()" }),
  ]);
});

it("does not authenticate a wrong module, lexical shadow, bare name or indirect assertion call", () => {
  const path = "src/ui/assertionConsumer.ts";
  const result = scanDiscreteActionProject([
    canonicalRegistry,
    {
      path: "src/ui/observe.ts",
      text: "export function assertAdaActionBindings(panel) {}",
    },
    {
      path,
      text: `
        import { assertAdaActionBindings } from "./observe.ts";
        import { assertAdaActionMetadata as verify } from "./actionBinding.ts";
        assertAdaActionBindings(panel);
        function shadow(verify) { verify(panel); }
        function assertAdaActionMetadata(panel) {}
        assertAdaActionMetadata(panel);
        const local = verify;
        local(panel);
        verify?.(panel);
      `,
    },
  ]);
  expect(result.runtimeAssertions).toEqual([]);
  expect(result.unresolvedRuntimeAssertions).toEqual([]);
});

it("retains construction findings when a control escapes before a genuine conditional assertion", () => {
  const path = "src/ui/assertionConsumer.ts";
  const result = scanDiscreteActionProject([
    canonicalRegistry,
    {
      path,
      text: `
        import { assertAdaActionBindings, assertAdaActionMetadata as inspect } from "./actionBinding.ts";
        export function createPanel() {
          const button = document.createElement("button");
          button.dataset.action = "unbound";
          root.append(button);
          if (early) { return button; }
          if (check) { assertAdaActionBindings(root); }
          inspect(button);
          recovery.assertBindings();
          return button;
        }
      `,
    },
  ]);
  expect(result.runtimeAssertions.map(({ kind, source }) => [kind, source])).toEqual([
    ["live-root", "assertAdaActionBindings(root)"],
    ["metadata", "inspect(button)"],
  ]);
  expect(result.unresolvedRuntimeAssertions.map(({ source }) => source)).toEqual([
    "recovery.assertBindings()",
  ]);
  expect(result.findings.map(({ kind, source }) => [kind, source])).toEqual([
    ["unbound-discrete", 'document.createElement("button")'],
    ["unbound-discrete", 'button.dataset.action = "unbound"'],
  ]);
  expect(result.factoryAssociations).toEqual([]);
});

it("proves focus-only keyboard effects from the public focus contract, not a similarly named callback", () => {
  expect(
    scanWithRegistry(
      "src/keyboard.ts",
      `
    import {focusTarget as focus} from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
    node.addEventListener("keydown", event => { event.preventDefault(); focus(button); });
  `,
    ),
  ).toEqual([expect.objectContaining({ classification: "keyboard-focus", kind: "non-action" })]);
  for (const extra of ["runAction();", 'state.page = "next";']) {
    expect(
      scanWithRegistry(
        "src/keyboard.ts",
        `
      import {focusTarget} from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
      node.addEventListener("keydown", event => { focusTarget(button); ${extra} });
    `,
      )[0]?.kind,
    ).toBe("gesture-review");
  }
  expect(
    scanWithRegistry(
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
    scanWithRegistry(
      "src/keyboard.ts",
      `${registered}
    button.addEventListener("keydown", event => { event.preventDefault(); binding.activate(); });
  `,
    ),
  ).toEqual([
    expect.objectContaining({ classification: "registered-keyboard", kind: "registered-action" }),
  ]);
  expect(
    scanWithRegistry(
      "src/keyboard.ts",
      `${registered}
    button.addEventListener("keydown", event => { binding.activate(); runAgain(); });
  `,
    )[0]?.kind,
  ).toBe("gesture-review");
});

it("keeps state-latching and mixed drag callbacks open instead of granting continuous exemptions", () => {
  const findings = scanWithRegistry(
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
  const findings = scanWithRegistry(
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
  const project = scanRegistryFixtures([
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
  const project = scanRegistryFixtures([
    registeredFactory,
    { path: "src/use.ts", text: `import {make} from "./factory.ts"; ${text}` },
  ]);
  expect(project.findings).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", path: "src/use.ts" }),
  );
});

it("does not retain binding proof after direct eager disposal", () => {
  const findings = scanWithRegistry(
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
    const result = scanRegistryFixtures([
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
  const result = scanRegistryFixtures([
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
    scanWithRegistry(
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
      scanWithRegistry(
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
  const keyboard = scanWithRegistry(
    "src/alias.ts",
    `
    const button = createButton("Run"); const binding = bindAdaAction(options, button);
    const alias = binding; alias.activate = rawAction;
    button.addEventListener("keydown", () => binding.activate());
  `,
  );
  expect(keyboard.some(({ kind }) => kind === "gesture-review")).toBe(true);
  const member = scanRegistryFixtures([
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
  const stopped = scanWithRegistry(
    "src/dispose.ts",
    `
    const button = createButton("Run"); const action = bindAdaAction(options, button);
    const stop = () => action.dispose(); stop(); button.dataset.action = "run";
  `,
  );
  expect(stopped).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", source: 'button.dataset.action = "run"' }),
  );
  const deferred = scanWithRegistry(
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
    scanWithRegistry(
      "src/escape.ts",
      `
    const button = createButton("Run"); const binding = bindAdaAction(options, button);
    mutate(binding); button.addEventListener("keydown", () => binding.activate());
  `,
    ).some(({ kind }) => kind === "gesture-review"),
  ).toBe(true);
});

it("does not borrow a mutable factory container through a constant member snapshot", () => {
  const result = scanRegistryFixtures([
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
  const disposed = scanWithRegistry(
    "src/dispose.ts",
    `
    const button = createButton("Run");const action = bindAdaAction(options, button);
    const stop = action.dispose;stop();button.dataset.action = "run";
  `,
  );
  expect(disposed).toContainEqual(
    expect.objectContaining({ kind: "unbound-discrete", source: 'button.dataset.action = "run"' }),
  );
  const escaped = scanWithRegistry(
    "src/escape.ts",
    `
    const button = createButton("Run");const binding = bindAdaAction(options, button);
    mutate({entry: binding}); button.addEventListener("keydown", () => binding.activate());
  `,
  );
  expect(escaped.some(({ kind }) => kind === "gesture-review")).toBe(true);
});

it("resolves function-scoped var shadowing instead of borrowing a top-level factory", () => {
  const result = scanRegistryFixtures([
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
    scanWithRegistry(
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
    scanWithRegistry(
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
    scanWithRegistry(
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
    const result = scanRegistryFixtures([
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
    const result = scanRegistryFixtures([
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
  const result = scanRegistryFixtures([
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
    const result = scanRegistryFixtures([
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
    const result = scanWithRegistry(
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
    scanWithRegistry(
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
  const result = scanWithRegistry(
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
    const result = scanWithRegistry(
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
    scanWithRegistry(
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
    const result = scanRegistryFixtures([
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
  const result = scanRegistryFixtures([
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
  const result = scanRegistryFixtures([
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

it.each([
  ["opaque argument", "expose(button);", "", true],
  ["asserted opaque argument", "expose(button);", "", true],
  ["container escape", "expose({ button });", "", true],
  ["exceptional publication", "try { prepare(); } finally { expose(button); }", "", true],
  ["hoisted publication", "publish();", "function publish() { expose(button); }", true],
  ["unbound audit", "", "", true],
  ["conditional registration", "", "", true],
  ["deferred registration", "", "", true],
  ["shadowed registration", "const bindAdaAction = fake;", "", true],
  ["post-disposal publication", "", "action.dispose(); root.append(button);", true],
  [
    "post-disposal through a stored handle",
    "",
    "const saved = { action }; saved.action.dispose(); root.append(button);",
    true,
  ],
  ["different receiver", "{ const button = other; expose(button); }", "", false],
  ["ordinary staging", 'button.type = "button"; button.dataset.action = "run";', "", false],
] as const)(
  "requires a live registration before constructor publication (%s)",
  (name, before, after, open) => {
    const target = name === "asserted opaque argument" ? "(button as HTMLElement)!" : "button";
    const direct = `const action = bindAdaAction({click: {run: () => act(button)}}, ${target});`;
    const registration =
      name === "unbound audit"
        ? "assertAdaActionBindings(button);"
        : name === "conditional registration"
          ? "if (enabled) bindAdaAction(options, button);"
          : name === "deferred registration"
            ? "later(() => bindAdaAction(options, button));"
            : direct;
    const path = "src/ui/owner.ts";
    const result = scanRegistryFixtures([
      {
        path,
        text: `import {assertAdaActionBindings} from "./actionBinding.ts";
      export function make(root) {
        const button = document.createElement("button");
        ${before}
        ${registration}
        ${after}
        return button;
      }`,
      },
      {
        path: "src/consumer.ts",
        text: `import {make} from "./ui/owner.ts";
        const control = make(root);
        control.dataset.action = "use";`,
      },
    ]);
    const construction = result.findings.find(
      (finding) => finding.path === path && finding.source === 'document.createElement("button")',
    );
    expect(construction?.kind).toBe(open ? "unbound-discrete" : undefined);
    expect(result.factoryAssociations.flatMap(({ members }) => members)).toEqual(open ? [] : [""]);
    expect(result.findings.some((finding) => finding.path === "src/consumer.ts")).toBe(open);
  },
);

it.each([
  ["", "return bindAdaAction(options, control);", false],
  ["expose(control);", "return bindAdaAction(options, control);", true],
  ["", "const action = bindAdaAction(options, control); action.dispose();", true],
] as const)("requires a live, unpublished wrapper argument (%s %s)", (before, body, open) => {
  const result = scanWithRegistry(
    "src/wrapper.ts",
    `
    function register(control) { ${before} ${body} }
    const button = document.createElement("button");
    register(button);
    root.append(button);
    `,
  );
  expect(result.map(({ kind }) => kind)).toEqual(open ? ["unbound-discrete"] : []);
});
