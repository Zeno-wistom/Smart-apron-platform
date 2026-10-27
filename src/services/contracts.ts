import type {
  AppData,
  ApprovedLessonSnapshot,
  ChildProfile,
  ClassRecord,
  GoalSet,
  LessonSession,
  LessonStep,
  StoryScene,
} from "../domain/types";

export interface PlanningContext {
  child: ChildProfile;
  goalSet: GoalSet;
}

export interface GenerationContext extends PlanningContext {
  steps: LessonStep[];
  planRevision: number;
}

export interface StoryContext extends GenerationContext {
  steps: LessonStep[];
}

export interface ReflectionContext {
  child: ChildProfile;
  session: LessonSession;
  record: ClassRecord;
}

export interface GoalSuggestion {
  id: string;
  text: string;
  rationale: string;
}

export interface StepSuggestion {
  id: string;
  templateKey: string;
  title: string;
  teacherInstruction: string;
  interaction: string;
  note: string;
}

export interface StoryDraft {
  title: string;
  summary: string;
  scenes: StoryScene[];
}

export interface ReflectionDraft {
  observations: string;
  suggestions: string;
  evidenceEventIds: string[];
}

export interface AiGateway {
  recommendGoals(context: PlanningContext): Promise<GoalSuggestion[]>;
  generateNextStep(context: GenerationContext): Promise<StepSuggestion>;
  regenerateStep(
    context: GenerationContext,
    step: LessonStep,
  ): Promise<StepSuggestion>;
  completeRemainingSteps(context: GenerationContext): Promise<StepSuggestion[]>;
  suggestStory(context: StoryContext): Promise<StoryDraft>;
  draftReflection(context: ReflectionContext): Promise<ReflectionDraft>;
}

export interface DeviceCapability {
  id: string;
  name: string;
  kind: "visual" | "audio";
  description: string;
  simulated: true;
}

export interface ConnectionResult {
  ok: boolean;
  message: string;
}

export interface TransferResult {
  ok: boolean;
  message: string;
}

export interface DeviceAdapter {
  getCapabilities(): Promise<DeviceCapability[]>;
  connect(): Promise<ConnectionResult>;
  transfer(snapshot: ApprovedLessonSnapshot): Promise<TransferResult>;
}

export interface AppStorage {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
  resetToFixtures(): Promise<void>;
}

export interface DemoFailureControls {
  armNextFailure(): void;
  clearNextFailure(): void;
  isFailureArmed(): boolean;
}

