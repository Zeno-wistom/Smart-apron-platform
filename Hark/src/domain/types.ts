/**
 * Hark 版本的领域模型。
 *
 * 设计要点：
 * - 所有引用使用稳定 ID；
 * - 每个可编辑单元都有自己的 rev（内容修订号），异步结果凭 rev 判断是否过期；
 * - 教案草稿（PlanDraft）可变，批准版本（PlanVersion）为深拷贝快照，永不修改；
 * - 传输、课堂、复盘都引用 versionId，而不是草稿。
 */

export type Source = "teacher" | "ai" | "ai-edited";

/** 环节状态：空白 → 草稿 → 已确认（锁定）。needsReview 为独立标记。 */
export type StepStatus = "empty" | "draft" | "confirmed";

export interface Observation {
  id: string;
  text: string;
  /** 来源：初始档案（虚构）或某次经教师审核的复盘 */
  origin: { kind: "seed" } | { kind: "review"; activityId: string; sessionId: string; versionNo: number };
  createdAt: string;
}

export interface ChildProfile {
  id: string;
  name: string;
  fictional: true;
  ageLabel: string;
  summary: string;
  communication: string[];
  preferences: string[];
  sensory: string[];
  teacherNotes: string;
  observations: Observation[];
}

export type ConstraintKind = "no-sudden-sound" | "allow-pause" | "no-flash" | "no-touch" | "free";

export interface Constraint {
  id: string;
  kind: ConstraintKind;
  text: string;
}

export interface GoalOption {
  id: string;
  text: string;
  rationale: string;
  observe: string;
}

export interface Goal {
  text: string;
  /** 记录方式 / 可观察标准 */
  observe: string;
  source: Source;
  confirmed: boolean;
  /** 目标内容修订号：每次修改文字或限制都会递增 */
  rev: number;
}

export interface StepFields {
  title: string;
  teacherScript: string;
  childInteraction: string;
  observe: string;
  minutes: number;
}

export interface Candidate {
  requestId: string;
  kind: "generate" | "regenerate" | "complete";
  fields: StepFields;
  /** 生成时依据的目标修订号与环节修订号 */
  basedOnGoalRev: number;
  basedOnStepRev: number;
  createdAt: string;
  variant: number;
}

export interface Step {
  id: string;
  /** 环节在教学结构中的角色，用于模拟 AI 理解上下文 */
  role: "warmup" | "model" | "practice" | "fade" | "review";
  fields: StepFields;
  status: StepStatus;
  source: Source;
  rev: number;
  basedOnGoalRev: number;
  needsReview?: string;
  candidate?: Candidate;
}

export interface Character {
  id: string;
  name: string;
  description: string;
}

/** 互动节点：故事里需要儿童参与的关键时刻 */
export interface InteractionNode {
  prompt: string;
  expected: string;
  allowPause: boolean;
}

/** 模拟反馈能力目录中的一项。仅描述教学意图，不包含任何设备参数。 */
export interface FeedbackCue {
  id: string;
  channel: "visual" | "sound";
  name: string;
  description: string;
  /** 触发方式：教师手动 / 自动播放。用于约束检查，不是设备协议。 */
  trigger: "teacher" | "auto";
  /** 是否属于突然出现的强刺激（定性标签，供限制检查） */
  sudden: boolean;
  flashing: boolean;
}

export interface Scene {
  id: string;
  stepId: string;
  title: string;
  narration: string;
  node: InteractionNode;
  /** 已配置的模拟反馈 cue ID（教师可改） */
  cueIds: string[];
  /** 模拟匹配给出的建议（未采纳前不写入 cueIds） */
  suggestedCueIds?: string[];
  rev: number;
}

export interface Story {
  title: string;
  summary: string;
  characters: Character[];
  scenes: Scene[];
  confirmed: boolean;
  apronConfirmed: boolean;
  source: Source;
  needsReview?: string;
  rev: number;
}

export interface CourseOutlineItem { id: string; title: string; purpose: string; minutes: number; story: boolean; role: Step["role"] }
export interface CourseInteraction { cueIds: string[]; allowPause: boolean; narration: string }
export interface CourseFlow {
  stage: 'goal' | 'outline' | 'document' | 'review';
  outline: CourseOutlineItem[];
  interactions: Record<string, CourseInteraction>;
  expanded: boolean;
  story?: Pick<Story, 'title' | 'summary' | 'characters'>;
  candidate?: { revision: number; kind: 'outline' | 'detail'; outline?: CourseOutlineItem[]; steps?: Step[]; interactions?: Record<string, CourseInteraction>; story?: Pick<Story, 'title' | 'summary' | 'characters'> };
}
export interface PlanDraft {
  courseFlow?: CourseFlow;
  /** Additive UX candidate; absent in v1 data. Never silently applied. */
  lessonCandidate?: import('./lessonCandidate').LessonCandidate;
  revision: number;
  goal: Goal;
  goalOptions: GoalOption[];
  constraints: Constraint[];
  notes: string;
  steps: Step[];
  story: Story | null;
  /** AI 生成的故事候选；采纳前不写入 story */
  storyCandidate?: { requestId: string; story: Story; basedOnSig: string; createdAt: string };
  /** 草稿是否来自某个批准版本的继续修订 */
  basedOnVersionNo?: number;
}

export interface PlanVersion {
  id: string;
  versionNo: number;
  approvedAt: string;
  planRevision: number;
  /** 不可变快照：批准时深拷贝 */
  snapshot: Omit<PlanDraft, "goalOptions" | "storyCandidate">;
  checksum: string;
}

export interface TransferAttempt {
  id: string;
  versionId: string;
  versionNo: number;
  at: string;
  ok: boolean;
  message: string;
  receipt?: { receiptId: string; checksum: string; stepCount: number; sceneCount: number };
  simulated: true;
}

export interface ClassEvent {
  id: string;
  t: string; // mm:ss
  stepId: string;
  sceneId?: string;
  kind: "start" | "cue" | "response" | "pause" | "note";
  text: string;
  simulated: true;
}

export type ReviewItemKind = "fact" | "simulated" | "inference" | "unknown";

export interface ReviewItem {
  id: string;
  kind: ReviewItemKind;
  text: string;
  evidence: string[]; // event ids
  edited: boolean;
}

export interface Reflection {
  items: ReviewItem[];
  teacherSummary: string;
  status: "draft" | "reviewed";
  reviewedAt?: string;
  /** 教师勾选、准备写入档案的观察 */
  proposedObservation: string;
  appliedObservationId?: string;
}

export interface ClassSession {
  id: string;
  versionId: string;
  versionNo: number;
  createdAt: string;
  events: ClassEvent[];
  reflection: Reflection | null;
  simulated: true;
}

export interface Activity {
  id: string;
  childId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  draft: PlanDraft;
  versions: PlanVersion[];
  transfers: TransferAttempt[];
  sessions: ClassSession[];
  /** 草稿是否已被批准锁定（批准后需“继续修订”才可编辑） */
  draftLocked: boolean;
  lastStage?: Stage;
}

export type Stage = "plan" | "story" | "review" | "class";

export interface AppData {
  children: ChildProfile[];
  activities: Activity[];
}

export interface Envelope {
  schemaVersion: 1;
  savedAt: string;
  data: AppData;
}
