import { describe, expect, it } from "vitest";

import { GAME_AREA } from "./edgeMarkers.ts";
import { recordTargetKnowledge, scopedTargetKnowledge } from "./targetKnowledgeStore.ts";
import {
  type TargetKnowledgeRecord,
  type TargetKnowledgeStore,
  TargetMarkerRegistry,
  type TargetResolution,
} from "./targetMarkers.ts";

function fixture() {
  const actors: TargetKnowledgeRecord = {};
  const sites: TargetKnowledgeRecord = {};
  const scope = {};
  const resolutions = new Map<string, TargetResolution>();
  const geographic = (id: string) => id.startsWith("site:");
  const bind = (actorRecord = actors, siteRecord = sites, identity = scope) =>
    scopedTargetKnowledge({
      actors: recordTargetKnowledge(actorRecord),
      geographic,
      scope: identity,
      sites: recordTargetKnowledge(siteRecord),
    });
  const store = bind();
  const context = {
    area: GAME_AREA,
    player: { x: 0, y: 0 },
    resolve: (id: string): TargetResolution => resolutions.get(id) ?? { state: "unresolved" },
    store,
  };
  const present = (id: string, identified = false) =>
    resolutions.set(id, {
      identified,
      point: { x: 2000, y: 0 },
      state: "present",
      symbol: "station",
    });
  return { actors, bind, context, geographic, present, resolutions, scope, sites, store };
}

describe("registry scoped knowledge writes", () => {
  it("writes actual site and actor records independently through one live registry", () => {
    const f = fixture(),
      registry = new TargetMarkerRegistry();
    f.present("site:station");
    f.present("enemy");
    registry.evaluate(f.context, [
      { id: "site:station", source: "sensed" },
      { id: "enemy", source: "sensed" },
    ]);
    expect(f.sites).toEqual({ "site:station": "sensed" });
    expect(f.actors).toEqual({ enemy: "sensed" });
    const actor = registry.entries().find(({ id }) => id === "enemy");
    f.present("enemy", true);
    registry.evaluate({ ...f.context, store: f.bind() }, []);
    expect(f.actors.enemy).toBe("identified");
    expect(registry.entries().find(({ id }) => id === "enemy")).toBe(actor);
    expect(f.sites["site:station"]).toBe("sensed");
  });
  it("uses owner-selected current actor records on fresh entry while retaining geographic knowledge", () => {
    const f = fixture(),
      registry = new TargetMarkerRegistry();
    f.sites["site:station"] = "identified";
    f.actors.enemy = "sensed";
    f.present("site:station", true);
    f.present("enemy");
    registry.evaluate(f.context, []);
    const actors: TargetKnowledgeRecord = {};
    const next = f.bind(actors, f.sites, {});
    expect(registry.evaluate({ ...f.context, store: next }, []).map(({ id }) => id)).toEqual([
      "site:station",
    ]);
    expect(actors).toEqual({});
    expect(f.actors).toEqual({ enemy: "sensed" });
  });
  it("restores record knowledge without retaining stale positions or reidentifying sensed targets", () => {
    const f = fixture();
    f.sites["site:station"] = "sensed";
    f.actors.enemy = "identified";
    const sites: TargetKnowledgeRecord = JSON.parse(JSON.stringify(f.sites));
    const actors: TargetKnowledgeRecord = JSON.parse(JSON.stringify(f.actors));
    f.resolutions.set("enemy", {
      identified: false,
      point: { x: 4100, y: 0 },
      state: "present",
      symbol: "enemy",
    });
    f.present("site:station");
    const registry = new TargetMarkerRegistry();
    expect(registry.evaluate({ ...f.context, store: f.bind(actors, sites, {}) }, [])).toMatchObject(
      [
        { id: "site:station", identified: false },
        { id: "enemy", identified: true, x: 4100 },
      ],
    );
  });
  it("preserves unresolved records and removes only authoritative tombstones from the correct ledger", () => {
    const f = fixture(),
      registry = new TargetMarkerRegistry();
    f.sites["site:station"] = "sensed";
    f.actors.enemy = "identified";
    expect(registry.evaluate(f.context, [])).toEqual([]);
    expect(f.store.ids()).toEqual(["site:station", "enemy"]);
    f.resolutions.set("enemy", { state: "removed" });
    registry.evaluate(f.context, []);
    expect(f.actors).toEqual({});
    expect(f.sites).toEqual({ "site:station": "sensed" });
  });
  it("does not create optional owner records on a query or rewrite unchanged knowledge", () => {
    const f = fixture(),
      registry = new TargetMarkerRegistry();
    let actorRecord: TargetKnowledgeRecord | undefined;
    let writes = 0;
    const actors: TargetKnowledgeStore = {
      get: (id) => actorRecord?.[id],
      ids: () => Object.keys(actorRecord ?? {}),
      remove: (id) => {
        if (actorRecord) {
          delete actorRecord[id];
        }
      },
      scope: f.scope,
      set: (id, knowledge) => {
        writes++;
        (actorRecord ??= {})[id] = knowledge;
      },
    };
    const store = scopedTargetKnowledge({
      actors,
      geographic: f.geographic,
      scope: f.scope,
      sites: recordTargetKnowledge(f.sites),
    });
    const context = { ...f.context, store };
    f.present("actor");
    registry.evaluate(context, [{ id: "actor", source: "quest" }]);
    expect(actorRecord).toBeUndefined();
    registry.evaluate(context, [{ id: "actor", source: "sensed" }]);
    expect(actorRecord).toEqual({ actor: "sensed" });
    registry.evaluate(context, []);
    expect(writes).toBe(1);
  });
  it("clears an explicit removed ID immediately without waiting for a rendered marker query", () => {
    const f = fixture(),
      registry = new TargetMarkerRegistry();
    f.actors.enemy = "identified";
    f.sites["site:station"] = "sensed";
    f.present("enemy", true);
    f.present("site:station");
    registry.evaluate(f.context, []);
    f.resolutions.set("enemy", { state: "removed" });
    registry.forget({ store: f.store }, "enemy");
    expect(f.actors).toEqual({});
    expect(registry.entries().map(({ id }) => id)).toEqual(["site:station"]);
    expect(f.sites).toEqual({ "site:station": "sensed" });
  });

  it("keeps the existing record facade and does not inherit prototype properties as knowledge", () => {
    const record: TargetKnowledgeRecord = {};
    const store = recordTargetKnowledge(record);
    expect(store.scope).toBe(record);
    expect(store.get("toString")).toBeUndefined();
    store.set("a", "sensed");
    expect(record.a).toBe("sensed");
    store.remove("a");
    expect(store.ids()).toEqual([]);
  });
});
