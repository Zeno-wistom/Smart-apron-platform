/**
 * 集中的业务规则。页面只派发 action，所有“能不能改”的判断都在这里。
 * 每个 guard 不通过时返回原 state（不抛错），由调用方通过 select* 函数预先判断给出提示。
 */
import { blockingIssues, checksum } from "./checks";
import { emptyStep, nowIso } from "./fixtures";
import type {
  Activity,
  AppData,
  Candidate,
  Character,
  ClassSession,
  Constraint,
  GoalOption,
  InteractionNode,
  PlanDraft,
  PlanVersion,
  Reflection,
  ReviewItem,
  Scene,
  Stage,
  Step,
  StepFields,
  Story,
  TransferAttempt,
} from "./types";

export type Action =
  | { type: "data/replace"; data: AppData }
  | { type: "activity/create"; activity: Activity }
  | { type: "activity/delete"; activityId: string }
  | { type: "activity/rename"; activityId: string; title: string }
  | { type: "activity/stage"; activityId: string; stage: Stage }
  | { type: "goal/options"; activityId: string; options: GoalOption[] }
  | { type: "goal/edit"; activityId: string; patch: { text?: string; observe?: string }; source?: "teacher" | "ai" }
  | { type: "goal/confirm"; activityId: string }
  | { type: "goal/unlock"; activityId: string }
  | { type: "constraint/add"; activityId: string; constraint: Constraint }
  | { type: "constraint/edit"; activityId: string; id: string; text: string }
  | { type: "constraint/remove"; activityId: string; id: string }
  | { type: "notes/edit"; activityId: string; notes: string }
  | { type: "step/edit"; activityId: string; stepId: string; patch: Partial<StepFields> }
  | { type: "step/candidate"; activityId: string; stepId: string; candidate: Candidate }
  | { type: "step/adopt"; activityId: string; stepId: string }
  | { type: "step/discard"; activityId: string; stepId: string }
  | { type: "step/confirm"; activityId: string; stepId: string }
  | { type: "step/unlock"; activityId: string; stepId: string }
  | { type: "step/reviewed"; activityId: string; stepId: string }
  | { type: "step/add"; activityId: string; afterStepId?: string }
  | { type: "step/remove"; activityId: string; stepId: string }
  | { type: "story/candidate"; activityId: string; candidate: NonNullable<PlanDraft["storyCandidate"]> }
  | { type: "story/adopt"; activityId: string }
  | { type: "story/discard"; activityId: string }
  | { type: "story/edit"; activityId: string; patch: { title?: string; summary?: string } }
  | { type: "story/confirm"; activityId: string }
  | { type: "story/unlock"; activityId: string }
  | { type: "story/reviewed"; activityId: string }
  | { type: "character/upsert"; activityId: string; character: Character }
  | { type: "character/remove"; activityId: string; id: string }
  | { type: "scene/edit"; activityId: string; sceneId: string; patch: { title?: string; narration?: string; stepId?: string } }
  | { type: "scene/node"; activityId: string; sceneId: string; patch: Partial<InteractionNode> }
  | { type: "apron/suggest"; activityId: string; suggestions: Record<string, string[]> }
  | { type: "apron/accept"; activityId: string; sceneId: string }
  | { type: "apron/dismiss"; activityId: string; sceneId: string }
  | { type: "apron/toggle"; activityId: string; sceneId: string; cueId: string }
  | { type: "apron/confirm"; activityId: string }
  | { type: "apron/unlock"; activityId: string }
  | { type: "plan/approve"; activityId: string; versionId: string; at: string }
  | { type: "plan/revise"; activityId: string }
  | { type: "transfer/record"; activityId: string; attempt: TransferAttempt }
  | { type: "session/create"; activityId: string; session: ClassSession }
  | { type: "reflection/set"; activityId: string; sessionId: string; reflection: Reflection }
  | { type: "reflection/item"; activityId: string; sessionId: string; itemId: string; text: string }
  | { type: "reflection/item-kind"; activityId: string; sessionId: string; itemId: string; kind: ReviewItem["kind"] }
  | { type: "reflection/item-remove"; activityId: string; sessionId: string; itemId: string }
  | { type: "reflection/item-add"; activityId: string; sessionId: string; item: ReviewItem }
  | { type: "reflection/field"; activityId: string; sessionId: string; patch: { teacherSummary?: string; proposedObservation?: string } }
  | { type: "reflection/review"; activityId: string; sessionId: string; at: string }
  | { type: "reflection/reopen"; activityId: string; sessionId: string }
  | { type: "profile/apply"; activityId: string; sessionId: string; observationId: string; at: string }
  | { type: "child/notes"; childId: string; notes: string };

/* ------------------------------------------------------------------ */
/* 纯函数判断（UI 也会使用）                                            */
/* ------------------------------------------------------------------ */

export const stepHasContent = (f: StepFields) =>
  Boolean(f.title.trim() || f.teacherScript.trim() || f.childInteraction.trim() || f.observe.trim());

export const stepReadyToConfirm = (s: Step) =>
  Boolean(s.fields.title.trim() && s.fields.teacherScript.trim() && s.fields.childInteraction.trim());

/** 异步候选能否写入（返回 null 表示可以，否则返回拒绝原因）。 */
export function candidateRejection(draft: PlanDraft, locked: boolean, stepId: string, c: Candidate): string | null {
  if (locked) return "教案已批准锁定";
  const step = draft.steps.find((s) => s.id === stepId);
  if (!step) return "该环节已被删除";
  if (step.status === "confirmed") return "该环节已确认，AI 不能覆盖已确认内容";
  if (c.basedOnGoalRev !== draft.goal.rev) return "生成期间教学目标或限制已修改，结果已过期";
  if (c.basedOnStepRev !== step.rev) return "生成期间你修改了该环节，旧结果不会覆盖你的修改";
  if (c.kind === "complete" && step.status !== "empty") return "该环节已有教师草稿，一键补全不会覆盖";
  return null;
}

/** 已到达的候选此刻能否采纳。 */
export function adoptRejection(draft: PlanDraft, locked: boolean, step: Step): string | null {
  const c = step.candidate;
  if (!c) return "没有候选";
  if (locked) return "教案已批准锁定";
  if (step.status === "confirmed") return "已确认内容需先解除确认";
  if (c.basedOnStepRev !== step.rev) return "候选生成后你又修改了本环节，请重新生成或丢弃";
  if (c.kind === "complete" && step.status !== "empty") return "你已在此环节写了草稿，一键补全候选不会覆盖";
  if (c.basedOnGoalRev !== draft.goal.rev) return "候选基于旧的目标或限制，请重新生成";
  return null;
}

export function stepsSignature(steps: Step[]): string {
  return steps.map((s) => `${s.id}:${s.rev}:${s.status}`).join("|");
}

/* ------------------------------------------------------------------ */
/* 内部工具                                                             */
/* ------------------------------------------------------------------ */

function withActivity(data: AppData, id: string, fn: (a: Activity) => Activity | null): AppData {
  const idx = data.activities.findIndex((a) => a.id === id);
  if (idx < 0) return data;
  const current = data.activities[idx];
  const next = fn(structuredClone(current));
  if (!next) return data; // guard 未通过
  next.updatedAt = nowIso();
  const activities = data.activities.slice();
  activities[idx] = next;
  return { ...data, activities };
}

/** 草稿编辑统一入口：锁定时拒绝，成功时递增 revision。 */
function editDraft(data: AppData, id: string, fn: (d: PlanDraft, a: Activity) => boolean | void): AppData {
  return withActivity(data, id, (a) => {
    if (a.draftLocked) return null;
    const ok = fn(a.draft, a);
    if (ok === false) return null;
    a.draft.revision += 1;
    return a;
  });
}

/** 目标或限制变化：所有基于旧目标的非空环节与故事标记需复核。 */
function bumpGoal(d: PlanDraft, reason: string) {
  d.goal.rev += 1;
  for (const s of d.steps) {
    if (s.status !== "empty" && s.basedOnGoalRev < d.goal.rev) s.needsReview = reason;
  }
  if (d.story) d.story.needsReview = reason;
}

function markStoryForSteps(d: PlanDraft) {
  if (d.story) d.story.needsReview = "教学环节有修改，请检查对应场景";
}

function findStep(d: PlanDraft, stepId: string) {
  return d.steps.find((s) => s.id === stepId);
}

function sceneOf(d: PlanDraft, sceneId: string): Scene | undefined {
  return d.story?.scenes.find((s) => s.id === sceneId);
}

function withSession(
  data: AppData,
  activityId: string,
  sessionId: string,
  fn: (s: ClassSession, a: Activity) => boolean | void,
): AppData {
  return withActivity(data, activityId, (a) => {
    const s = a.sessions.find((x) => x.id === sessionId);
    if (!s) return null;
    return fn(s, a) === false ? null : a;
  });
}

function editableReflection(s: ClassSession): Reflection | null {
  return s.reflection && s.reflection.status === "draft" ? s.reflection : null;
}

/* ------------------------------------------------------------------ */
/* Reducer                                                              */
/* ------------------------------------------------------------------ */

export function reducer(data: AppData, action: Action): AppData {
  switch (action.type) {
    case "data/replace":
      return action.data;

    case "activity/create":
      return { ...data, activities: [action.activity, ...data.activities] };

    case "activity/delete":
      return { ...data, activities: data.activities.filter((a) => a.id !== action.activityId) };

    case "activity/rename":
      return withActivity(data, action.activityId, (a) => {
        a.title = action.title;
        return a;
      });

    case "activity/stage": {
      const a = data.activities.find((x) => x.id === action.activityId);
      if (!a || a.lastStage === action.stage) return data;
      return { ...data, activities: data.activities.map((x) => (x.id === a.id ? { ...x, lastStage: action.stage } : x)) };
    }

    /* ---------- 目标与限制 ---------- */
    case "goal/options":
      return editDraft(data, action.activityId, (d) => {
        d.goalOptions = action.options;
      });

    case "goal/edit":
      return editDraft(data, action.activityId, (d) => {
        if (d.goal.confirmed) return false;
        const { text, observe } = action.patch;
        if (text !== undefined) d.goal.text = text;
        if (observe !== undefined) d.goal.observe = observe;
        d.goal.source = action.source === "ai" ? "ai" : d.goal.source === "ai" || d.goal.source === "ai-edited" ? "ai-edited" : "teacher";
        bumpGoal(d, "教学目标已修改");
      });

    case "goal/confirm":
      return editDraft(data, action.activityId, (d) => {
        if (!d.goal.text.trim() || d.goal.confirmed) return false;
        d.goal.confirmed = true;
      });

    case "goal/unlock":
      return editDraft(data, action.activityId, (d) => {
        if (!d.goal.confirmed) return false;
        d.goal.confirmed = false;
      });

    case "constraint/add":
      return editDraft(data, action.activityId, (d) => {
        if (!action.constraint.text.trim()) return false;
        d.constraints.push(action.constraint);
        bumpGoal(d, "限制条件已修改");
      });

    case "constraint/edit":
      return editDraft(data, action.activityId, (d) => {
        const c = d.constraints.find((x) => x.id === action.id);
        if (!c || c.text === action.text) return false;
        c.text = action.text;
        bumpGoal(d, "限制条件已修改");
      });

    case "constraint/remove":
      return editDraft(data, action.activityId, (d) => {
        const before = d.constraints.length;
        d.constraints = d.constraints.filter((x) => x.id !== action.id);
        if (d.constraints.length === before) return false;
        bumpGoal(d, "限制条件已修改");
      });

    case "notes/edit":
      return editDraft(data, action.activityId, (d) => {
        d.notes = action.notes;
      });

    /* ---------- 教学环节 ---------- */
    case "step/edit":
      return editDraft(data, action.activityId, (d) => {
        const s = findStep(d, action.stepId);
        if (!s || s.status === "confirmed") return false;
        s.fields = { ...s.fields, ...action.patch };
        s.rev += 1;
        s.status = stepHasContent(s.fields) ? "draft" : "empty";
        s.source = s.source === "ai" || s.source === "ai-edited" ? "ai-edited" : "teacher";
        if (s.status === "empty") s.source = "teacher";
        if (s.status === "draft" && s.basedOnGoalRev === 0) s.basedOnGoalRev = d.goal.rev;
        markStoryForSteps(d);
      });

    case "step/candidate":
      return withActivity(data, action.activityId, (a) => {
        if (candidateRejection(a.draft, a.draftLocked, action.stepId, action.candidate)) return null;
        const s = findStep(a.draft, action.stepId)!;
        s.candidate = action.candidate;
        return a;
      });

    case "step/adopt":
      return editDraft(data, action.activityId, (d, a) => {
        const s = findStep(d, action.stepId);
        if (!s || adoptRejection(d, a.draftLocked, s)) return false;
        const c = s.candidate!;
        s.fields = { ...c.fields };
        s.status = "draft";
        s.source = "ai";
        s.rev += 1;
        s.basedOnGoalRev = c.basedOnGoalRev;
        s.needsReview = undefined;
        s.candidate = undefined;
        markStoryForSteps(d);
      });

    case "step/discard":
      return withActivity(data, action.activityId, (a) => {
        const s = findStep(a.draft, action.stepId);
        if (!s?.candidate) return null;
        s.candidate = undefined;
        return a;
      });

    case "step/confirm":
      return editDraft(data, action.activityId, (d) => {
        const s = findStep(d, action.stepId);
        if (!s || s.status !== "draft" || s.candidate || !stepReadyToConfirm(s)) return false;
        s.status = "confirmed";
        s.needsReview = undefined;
        s.basedOnGoalRev = d.goal.rev;
      });

    case "step/unlock":
      return editDraft(data, action.activityId, (d) => {
        const s = findStep(d, action.stepId);
        if (!s || s.status !== "confirmed") return false;
        s.status = "draft";
      });

    case "step/reviewed":
      return editDraft(data, action.activityId, (d) => {
        const s = findStep(d, action.stepId);
        if (!s?.needsReview) return false;
        s.needsReview = undefined;
        s.basedOnGoalRev = d.goal.rev;
      });

    case "step/add":
      return editDraft(data, action.activityId, (d) => {
        const idx = action.afterStepId ? d.steps.findIndex((s) => s.id === action.afterStepId) : d.steps.length - 1;
        d.steps.splice(idx + 1, 0, emptyStep("practice"));
        markStoryForSteps(d);
      });

    case "step/remove":
      return editDraft(data, action.activityId, (d) => {
        const s = findStep(d, action.stepId);
        if (!s || s.status === "confirmed" || d.steps.length <= 1) return false;
        d.steps = d.steps.filter((x) => x.id !== action.stepId);
        markStoryForSteps(d);
      });

    /* ---------- 故事 ---------- */
    case "story/candidate":
      return withActivity(data, action.activityId, (a) => {
        if (a.draftLocked) return null;
        if (a.draft.story?.confirmed) return null;
        // 生成期间环节有变化：结果过期，不写入
        if (action.candidate.basedOnSig !== stepsSignature(a.draft.steps)) return null;
        a.draft.storyCandidate = action.candidate;
        return a;
      });

    case "story/adopt":
      return editDraft(data, action.activityId, (d) => {
        const c = d.storyCandidate;
        if (!c || d.story?.confirmed) return false;
        if (c.basedOnSig !== stepsSignature(d.steps)) return false;
        d.story = structuredClone(c.story);
        d.storyCandidate = undefined;
      });

    case "story/discard":
      return withActivity(data, action.activityId, (a) => {
        if (!a.draft.storyCandidate) return null;
        a.draft.storyCandidate = undefined;
        return a;
      });

    case "story/edit":
      return editDraft(data, action.activityId, (d) => {
        if (!d.story || d.story.confirmed) return false;
        Object.assign(d.story, action.patch);
        d.story.rev += 1;
        if (d.story.source === "ai") d.story.source = "ai-edited";
      });

    case "story/confirm":
      return editDraft(data, action.activityId, (d) => {
        const st = d.story;
        if (!st || st.confirmed || st.needsReview) return false;
        if (st.scenes.length === 0 || st.scenes.some((s) => !s.node.prompt.trim() || !s.narration.trim())) return false;
        st.confirmed = true;
      });

    case "story/unlock":
      return editDraft(data, action.activityId, (d) => {
        if (!d.story?.confirmed) return false;
        d.story.confirmed = false;
      });

    case "story/reviewed":
      return editDraft(data, action.activityId, (d) => {
        if (!d.story?.needsReview) return false;
        // 场景若关联了已删除的环节，需先修正关联
        const ids = new Set(d.steps.map((s) => s.id));
        if (d.story.scenes.some((sc) => !ids.has(sc.stepId))) return false;
        d.story.needsReview = undefined;
      });

    case "character/upsert":
      return editDraft(data, action.activityId, (d) => {
        if (!d.story || d.story.confirmed) return false;
        const i = d.story.characters.findIndex((c) => c.id === action.character.id);
        if (i >= 0) d.story.characters[i] = action.character;
        else d.story.characters.push(action.character);
        d.story.rev += 1;
      });

    case "character/remove":
      return editDraft(data, action.activityId, (d) => {
        if (!d.story || d.story.confirmed) return false;
        d.story.characters = d.story.characters.filter((c) => c.id !== action.id);
        d.story.rev += 1;
      });

    case "scene/edit":
      return editDraft(data, action.activityId, (d) => {
        if (!d.story || d.story.confirmed) return false;
        const sc = sceneOf(d, action.sceneId);
        if (!sc) return false;
        if (action.patch.stepId && !findStep(d, action.patch.stepId)) return false;
        Object.assign(sc, action.patch);
        sc.rev += 1;
        d.story.rev += 1;
        if (d.story.source === "ai") d.story.source = "ai-edited";
      });

    case "scene/node":
      return editDraft(data, action.activityId, (d) => {
        if (!d.story || d.story.confirmed) return false;
        const sc = sceneOf(d, action.sceneId);
        if (!sc) return false;
        sc.node = { ...sc.node, ...action.patch };
        sc.rev += 1;
        d.story.rev += 1;
        d.story.apronConfirmed = false; // 互动节点变化后，反馈配置需重新确认
      });

    /* ---------- 围裙反馈（模拟） ---------- */
    case "apron/suggest":
      return editDraft(data, action.activityId, (d) => {
        if (!d.story || d.story.apronConfirmed) return false;
        for (const sc of d.story.scenes) {
          const s = action.suggestions[sc.id];
          if (s) sc.suggestedCueIds = s;
        }
      });

    case "apron/accept":
      return editDraft(data, action.activityId, (d) => {
        const sc = d.story && !d.story.apronConfirmed ? sceneOf(d, action.sceneId) : undefined;
        if (!sc?.suggestedCueIds) return false;
        sc.cueIds = sc.suggestedCueIds;
        sc.suggestedCueIds = undefined;
      });

    case "apron/dismiss":
      return editDraft(data, action.activityId, (d) => {
        const sc = d.story ? sceneOf(d, action.sceneId) : undefined;
        if (!sc?.suggestedCueIds) return false;
        sc.suggestedCueIds = undefined;
      });

    case "apron/toggle":
      return editDraft(data, action.activityId, (d) => {
        if (!d.story || d.story.apronConfirmed) return false;
        const sc = sceneOf(d, action.sceneId);
        if (!sc) return false;
        sc.cueIds = sc.cueIds.includes(action.cueId) ? sc.cueIds.filter((c) => c !== action.cueId) : [...sc.cueIds, action.cueId];
      });

    case "apron/confirm":
      return editDraft(data, action.activityId, (d) => {
        if (!d.story || d.story.apronConfirmed) return false;
        if (d.story.scenes.some((s) => s.suggestedCueIds)) return false;
        const conflicts = blockingIssues(d).some((i) => i.id.startsWith("scene-conflict"));
        if (conflicts) return false;
        d.story.apronConfirmed = true;
      });

    case "apron/unlock":
      return editDraft(data, action.activityId, (d) => {
        if (!d.story?.apronConfirmed) return false;
        d.story.apronConfirmed = false;
      });

    /* ---------- 批准与版本 ---------- */
    case "plan/approve":
      return withActivity(data, action.activityId, (a) => {
        if (a.draftLocked) return null;
        if (blockingIssues(a.draft).length > 0) return null;
        const { goalOptions: _g, storyCandidate: _c, ...rest } = structuredClone(a.draft);
        void _g;
        void _c;
        const version: PlanVersion = {
          id: action.versionId,
          versionNo: a.versions.length + 1,
          approvedAt: action.at,
          planRevision: a.draft.revision,
          snapshot: rest,
          checksum: checksum(rest),
        };
        a.versions.push(version);
        a.draftLocked = true;
        return a;
      });

    case "plan/revise":
      return withActivity(data, action.activityId, (a) => {
        if (!a.draftLocked) return null;
        a.draftLocked = false;
        a.draft.basedOnVersionNo = a.versions[a.versions.length - 1]?.versionNo;
        a.draft.revision += 1;
        return a;
      });

    case "transfer/record":
      return withActivity(data, action.activityId, (a) => {
        if (!a.versions.some((v) => v.id === action.attempt.versionId)) return null;
        a.transfers.push(action.attempt);
        return a;
      });

    /* ---------- 课堂与复盘 ---------- */
    case "session/create":
      return withActivity(data, action.activityId, (a) => {
        const v = a.versions.find((x) => x.id === action.session.versionId);
        if (!v) return null;
        if (!a.transfers.some((t) => t.versionId === v.id && t.ok)) return null;
        a.sessions.push(action.session);
        return a;
      });

    case "reflection/set":
      return withSession(data, action.activityId, action.sessionId, (s) => {
        // AI 复盘草稿只能写入空白复盘，不覆盖教师已编辑内容
        if (s.reflection) return false;
        s.reflection = action.reflection;
      });

    case "reflection/item":
      return withSession(data, action.activityId, action.sessionId, (s) => {
        const r = editableReflection(s);
        const it = r?.items.find((i) => i.id === action.itemId);
        if (!it) return false;
        it.text = action.text;
        it.edited = true;
      });

    case "reflection/item-kind":
      return withSession(data, action.activityId, action.sessionId, (s) => {
        const r = editableReflection(s);
        const it = r?.items.find((i) => i.id === action.itemId);
        if (!it) return false;
        it.kind = action.kind;
        it.edited = true;
      });

    case "reflection/item-remove":
      return withSession(data, action.activityId, action.sessionId, (s) => {
        const r = editableReflection(s);
        if (!r) return false;
        r.items = r.items.filter((i) => i.id !== action.itemId);
      });

    case "reflection/item-add":
      return withSession(data, action.activityId, action.sessionId, (s) => {
        const r = editableReflection(s);
        if (!r) return false;
        r.items.push(action.item);
      });

    case "reflection/field":
      return withSession(data, action.activityId, action.sessionId, (s) => {
        const r = editableReflection(s);
        if (!r) return false;
        Object.assign(r, action.patch);
      });

    case "reflection/review":
      return withSession(data, action.activityId, action.sessionId, (s) => {
        const r = editableReflection(s);
        if (!r || !r.teacherSummary.trim()) return false;
        r.status = "reviewed";
        r.reviewedAt = action.at;
      });

    case "reflection/reopen":
      return withSession(data, action.activityId, action.sessionId, (s) => {
        if (s.reflection?.status !== "reviewed") return false;
        s.reflection.status = "draft";
      });

    case "profile/apply": {
      const a = data.activities.find((x) => x.id === action.activityId);
      const s = a?.sessions.find((x) => x.id === action.sessionId);
      const r = s?.reflection;
      if (!a || !s || !r || r.status !== "reviewed" || r.appliedObservationId || !r.proposedObservation.trim()) return data;
      const child = data.children.find((c) => c.id === a.childId);
      if (!child) return data;
      // 同一课堂只能写入一次
      if (child.observations.some((o) => o.origin.kind === "review" && o.origin.sessionId === s.id)) return data;
      const children = data.children.map((c) =>
        c.id !== child.id
          ? c
          : {
              ...c,
              observations: [
                ...c.observations,
                {
                  id: action.observationId,
                  text: r.proposedObservation.trim(),
                  origin: { kind: "review" as const, activityId: a.id, sessionId: s.id, versionNo: s.versionNo },
                  createdAt: action.at,
                },
              ],
            },
      );
      const next = withSession({ ...data, children }, a.id, s.id, (ss) => {
        ss.reflection!.appliedObservationId = action.observationId;
      });
      return next;
    }

    case "child/notes":
      return {
        ...data,
        children: data.children.map((c) => (c.id === action.childId ? { ...c, teacherNotes: action.notes } : c)),
      };

    default:
      return data;
  }
}

export type { Story };
