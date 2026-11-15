import type {
  TargetKnowledge,
  TargetKnowledgeRecord,
  TargetKnowledgeStore,
} from "./targetMarkers.ts";

/** The existing record facade uses the record itself as its stable scope identity. */
export function recordTargetKnowledge(record: TargetKnowledgeRecord): TargetKnowledgeStore {
  return {
    get: (id) => (Object.hasOwn(record, id) ? record[id] : undefined),
    ids: () => Object.keys(record),
    remove: (id) => {
      delete record[id];
    },
    scope: record,
    set: (id, knowledge) => {
      record[id] = knowledge;
    },
  };
}
export interface TargetKnowledgeScopes {
  /** Already selected by the owner's shared epoch helper; this adapter does not validate epochs. */
  readonly actors: TargetKnowledgeStore;
  readonly geographic: (id: string) => boolean;
  /** Stable for the active geography/encounter pair, replaced on a scope change. */
  readonly scope: object;
  readonly sites: TargetKnowledgeStore;
}

/** Writes through to the owner's actual ledgers without flattening them into a detached copy. */
export function scopedTargetKnowledge(context: TargetKnowledgeScopes): TargetKnowledgeStore {
  const { actors, sites } = context;
  const record = (id: string) => (context.geographic(id) ? sites : actors);
  return {
    get: (id): TargetKnowledge | undefined => record(id).get(id),
    ids: () => [...new Set([...sites.ids(), ...actors.ids()])],
    remove: (id) => {
      record(id).remove(id);
    },
    scope: context.scope,
    set: (id, knowledge) => {
      record(id).set(id, knowledge);
    },
  };
}
