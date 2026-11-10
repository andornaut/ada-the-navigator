import { type AtlasPolicy, packAtlas } from "@andornaut/art-kit/atlasLayout";
import { validateRegistry } from "@andornaut/delivery-kit/registry";
import { describe, expect, it } from "vitest";

const atlasPolicy: AtlasPolicy<string> = {
  compare: (left, right) => left.value.localeCompare(right.value),
  extrude: 1,
  maxSize: 8,
  widths: [8],
};

const config: NonNullable<Parameters<typeof validateRegistry>[0]> = {
  games: {
    starter: { name: "Starter", path: "../starter", roles: ["tech"] },
  },
  kits: {},
  schema: 1,
  sharedRoles: [],
  timezone: "America/Toronto",
  wakeMinutes: [20, 50],
};

function registry() {
  return {
    harness: "codex",
    host: { nativeProjectId: "fixture", root: "." },
    operations: { starter: { busOwner: "starter/tech" } },
    revision: 0,
    roles: {
      "starter/tech": {
        conversations: { codex: "00000000-0000-4000-8000-000000000001" },
        ownership: "source",
        worktree: "../starter/.worktrees/tech",
      },
    },
    schema: 1,
    transfers: [],
    updatedAt: "2026-11-09T12:00:00.000Z",
  };
}

describe("published kit boundaries", () => {
  it("packs padded rectangles onto separate bounded pages without assets", () => {
    const result = packAtlas(atlasPolicy, [
      { rectangles: [{ height: 6, width: 6 }], value: "b" },
      { rectangles: [{ height: 6, width: 6 }], value: "a" },
    ]);
    expect(result?.pages).toHaveLength(2);
    expect(result?.pages.map((page) => page.placed[0]?.item.value)).toEqual(["a", "b"]);
    for (const page of result?.pages ?? []) {
      expect(page.width).toBe(8);
      expect(page.height).toBe(8);
      expect(page.placed[0]?.at).toEqual([{ x: 1, y: 1 }]);
    }
  });

  it("rejects a rectangle whose extrusion exceeds the explicit page limit", () => {
    expect(
      packAtlas(atlasPolicy, [{ rectangles: [{ height: 6, width: 7 }], value: "too-wide" }]),
    ).toBeUndefined();
  });

  it("validates a registered source owner and rejects an unregistered delivery recipient", () => {
    const value = registry();
    expect(validateRegistry(config, value).operations.starter?.busOwner).toBe("starter/tech");
    value.operations.starter.busOwner = "starter/unknown";
    expect(() => validateRegistry(config, value)).toThrow(/busOwner/);
  });

  it("rejects malformed native recipients and roles absent from the configured scope", () => {
    const invalidRecipient = registry();
    invalidRecipient.roles["starter/tech"].conversations.codex = "not-a-native-id";
    expect(() => validateRegistry(config, invalidRecipient)).toThrow(/conversations/);
    const invalidRole = registry();
    expect(() =>
      validateRegistry(config, {
        ...invalidRole,
        roles: { "starter/unknown": invalidRole.roles["starter/tech"] },
      }),
    ).toThrow(/not a role/);
  });
});
