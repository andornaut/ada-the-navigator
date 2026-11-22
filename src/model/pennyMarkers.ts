import type { JobType } from "../data/jobs.ts";
import type { TaskCategory } from "../data/taskCategories.ts";
import type { TargetSymbol } from "./targetMarkers.ts";
import type { Vec } from "./types.ts";

export type PennyCategory = "station" | "objective" | "discovery";

export interface PennyPoint extends Vec {
  readonly category: PennyCategory;
  readonly id: string;
  readonly known: boolean;
  readonly identifiable?: boolean;
  readonly symbol: TargetSymbol;
  readonly jobType?: JobType;
  readonly item?: "stardust";
}
export interface PennyMarker extends PennyPoint {
  readonly identified: boolean;
  readonly taskCategory?: TaskCategory;
}
