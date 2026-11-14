import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { layoutReport, validateLayoutTree } from "@andornaut/game-kit/ui/layoutTree";
import { mountLayout } from "@andornaut/game-kit/web/ui/dom/layoutTree";
import { describe, expect, it } from "vitest";

const viewport = { height: 360, width: 720, x: 0, y: 0 };

describe("published layout-tree consumer API", () => {
  it("resolves the declared DOM renderer and its published stylesheet", () => {
    expect(mountLayout).toBeTypeOf("function");
    const css = readFileSync(
      fileURLToPath(import.meta.resolve("@andornaut/game-kit/web/ui/dom/layoutTree.css")),
      "utf8",
    );
    expect(css.length).toBeGreaterThan(0);
  });

  it("validates typed caller ports and rejects an unknown child slot", () => {
    const slots = { card: ["header", "body", "footer"] } as const;
    const tree = {
      component: "card",
      key: "root",
      kind: "component",
      props: { title: "Menu" },
      slots: { body: [] },
    } as const;
    expect(() => validateLayoutTree(slots, tree)).not.toThrow();
    expect(() =>
      validateLayoutTree(slots, { ...tree, slots: { unknown: [] } } as unknown as typeof tree),
    ).toThrow();
  });

  it("reports unavailable measurements instead of interpreting them as fit", () => {
    const report = layoutReport(viewport, [{ measurement: null, path: ["root", "body"] }]);
    expect(report.status).toBe("unavailable");
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: "unavailable", path: ["root", "body"], viewport }),
    );
  });

  it("reports actual overflow, clipping and overlap at their keyed paths", () => {
    const report = layoutReport(viewport, [
      {
        measurement: {
          available: viewport,
          clipped: true,
          overlaps: [["root", "footer"]],
          required: { ...viewport, height: 500 },
          wrappedLines: [{ height: 20, width: 100, x: 0, y: 0 }],
        },
        path: ["root", "body"],
      },
    ]);
    expect(report.status).toBe("overflow");
    expect(report.diagnostics.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(["overflow", "clip", "overlap"]),
    );
    expect(report.diagnostics.every(({ path }) => path.join("/") === "root/body")).toBe(true);
  });
});
