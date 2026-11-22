/** Approved task hues shared by cards, the Local Map and the edge marker layer. */
export const TASK_COLORS = {
  generic: "#ead4aa",
  job: "#feae34",
  project: "#8f9cf0",
  story: "#65c9bf",
} as const;

export type TaskCategory = keyof typeof TASK_COLORS;
