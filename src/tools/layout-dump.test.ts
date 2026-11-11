import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  formatLayoutDump,
  LAYOUT_MODULES,
  layoutDump,
  UNDUMPED_FUNCTIONS,
} from "../../tools/layout-dump.ts";

const LAYOUT = new URL("../ui/layout/", import.meta.url);
const FIXTURE = new URL("../../tools/layout-dump.json", import.meta.url);

describe("layout dump", () => {
  it("matches the recorded dump byte for byte", () => {
    // Re-record with `node tools/layout-dump.ts > tools/layout-dump.json` only for an intended
    // layout change; a pure refactor leaves the file untouched.
    expect(formatLayoutDump()).toBe(readFileSync(FIXTURE, "utf8"));
  });

  it("is deterministic and sorts every object's keys", () => {
    expect(formatLayoutDump()).toBe(formatLayoutDump());
    const sorted = (value: unknown): boolean =>
      Array.isArray(value)
        ? value.every(sorted)
        : value && typeof value === "object"
          ? Object.keys(value).join() === Object.keys(value).sort().join() &&
            Object.values(value).every(sorted)
          : true;
    expect(sorted(layoutDump())).toBe(true);
  });

  it("covers every layout module and every exported function", () => {
    const files = readdirSync(LAYOUT)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .sort();
    expect(Object.keys(LAYOUT_MODULES).sort()).toEqual(files);
    const { functions } = layoutDump() as { functions: Record<string, Record<string, unknown[]>> };
    for (const [module, exports] of Object.entries(LAYOUT_MODULES)) {
      for (const [name, value] of Object.entries(exports)) {
        if (typeof value !== "function" || UNDUMPED_FUNCTIONS[module]?.[name]) {
          continue;
        }
        // A re-exported function counts where any module that exports it records it.
        const recorded = Object.entries(functions).some(
          ([owner, cases]) => LAYOUT_MODULES[owner]?.[name] === value && cases[name]?.length,
        );
        expect(recorded, `${module} ${name}`).toBe(true);
      }
    }
  });
});
