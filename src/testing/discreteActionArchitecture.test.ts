import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { scanDiscreteActionBindings } from "./discreteActionArchitecture.ts";

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
