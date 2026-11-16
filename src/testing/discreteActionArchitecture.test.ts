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
