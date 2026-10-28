import type { StepFields, Story } from "./types";
export interface LessonCandidate {
  revision: number;
  steps: { stepId: string; fields: StepFields; rev: number }[];
  story?: Story;
}
