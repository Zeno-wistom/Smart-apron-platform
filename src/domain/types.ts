export type ConfirmStatus = "draft" | "confirmed";
export type ContentSource = "mock-ai" | "teacher" | "custom";

export interface ChildProfile {
  id: string;
  displayName: string;
  isFictional: true;
  ageBand: string;
  description: string;
  preferences: string[];
  defaultConstraints: string[];
  teacherNotes: string;
}

export interface Goal {
  id: string;
  text: string;
  source: ContentSource;
}

export interface Constraint {
  id: string;
  text: string;
}

export interface GoalSet {
  items: Goal[];
  constraints: Constraint[];
  teacherNotes: string;
  status: ConfirmStatus;
  revision: number;
}

export interface LessonStep {
  id: string;
  templateKey?: string;
  title: string;
  teacherInstruction: string;
  interaction: string;
  note: string;
  status: ConfirmStatus;
  source: ContentSource;
}

export interface StoryCue {
  id: string;
  kind: "visual" | "audio";
  label: string;
  description: string;
}

export interface StoryScene {
  id: string;
  stepId: string;
  title: string;
  text: string;
  characters: string;
  interaction: string;
  cues: StoryCue[];
}

export interface Story {
  title: string;
  summary: string;
  scenes: StoryScene[];
  status: ConfirmStatus;
  basedOnPlanRevision: number;
}

export interface ApronMapping {
  cueId: string;
  moduleId: string;
  enabled: boolean;
  note: string;
}

export interface ApronConfig {
  mappings: ApronMapping[];
  status: ConfirmStatus;
  basedOnPlanRevision: number;
}

export interface ApprovedLessonSnapshot {
  id: string;
  childId: string;
  sessionTitle: string;
  approvedAt: string;
  planRevision: number;
  goalSet: GoalSet;
  steps: LessonStep[];
  story: Story;
  apronConfig: ApronConfig;
}

export interface TransmissionInfo {
  mode: "simulated";
  status: "idle" | "success" | "failure";
  attempts: number;
  message?: string;
  updatedAt?: string;
}

export interface ClassEvent {
  id: string;
  sessionId: string;
  stepId: string;
  occurredAt: string;
  elapsed: string;
  summary: string;
  source: "simulated";
}

export interface ClassRecord {
  id: string;
  sessionId: string;
  snapshotId: string;
  createdAt: string;
  source: "simulated";
  events: ClassEvent[];
}

export interface Reflection {
  id: string;
  sessionId: string;
  status: "draft" | "reviewed";
  observations: string;
  suggestions: string;
  evidenceEventIds: string[];
  updatedAt: string;
  reviewedAt?: string;
}

export interface ProfessionalAssessment {
  note: string;
  authorRole: "teacher";
  updatedAt: string;
}

export interface LessonSession {
  id: string;
  childId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  planRevision: number;
  goalSet: GoalSet;
  steps: LessonStep[];
  story: Story;
  apronConfig: ApronConfig;
  approval?: ApprovedLessonSnapshot;
  transmission: TransmissionInfo;
  classRecord?: ClassRecord;
  reflection?: Reflection;
  professionalAssessment: ProfessionalAssessment;
}

export interface ProfileHistoryEntry {
  id: string;
  childId: string;
  sessionId: string;
  reflectionId: string;
  summary: string;
  createdAt: string;
}

export interface AppData {
  children: ChildProfile[];
  sessions: LessonSession[];
  profileHistory: ProfileHistoryEntry[];
  activeSessionId?: string;
}

export interface PersistedEnvelope {
  schemaVersion: 1;
  savedAt: string;
  data: AppData;
}

export type SessionStage =
  | "planning"
  | "approved"
  | "transferred"
  | "recorded"
  | "reviewed";
