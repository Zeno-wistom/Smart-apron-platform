import { courseIssues } from './courseChecks';
import { cueById, ROLE_LABEL } from "./fixtures";
import type { Activity, Constraint, PlanDraft, Scene } from "./types";

export type IssueTarget =
  | { stage: "plan"; focus: "goal" | "constraints" }
  | { stage: "plan"; focus: "step"; stepId: string }
  | { stage: "story"; focus: "story" | "scene"; sceneId?: string };

export interface Issue {
  id: string;
  severity: "block" | "warn";
  text: string;
  target: IssueTarget;
}

/** 检查某个场景的反馈配置是否违反结构化限制。返回人类可读的冲突说明。 */
export function sceneConflicts(scene: Scene, constraints: Constraint[]): string[] {
  const out: string[] = [];
  const kinds = new Set(constraints.map((c) => c.kind));
  for (const id of scene.cueIds) {
    const cue = cueById(id);
    if (!cue) continue;
    if (kinds.has("no-sudden-sound") && cue.channel === "sound" && (cue.sudden || cue.trigger === "auto")) {
      out.push(`「${cue.name}」为自动或突然出现的声音，与“避免突然的大音量”冲突`);
    }
    if (kinds.has("no-flash") && cue.flashing) {
      out.push(`「${cue.name}」含闪烁，与“避免闪烁”冲突`);
    }
    if (kinds.has("no-sudden-sound") && cue.channel === "visual" && cue.sudden) {
      out.push(`「${cue.name}」属于突然出现的强刺激，建议改为教师手动触发的提示`);
    }
  }
  if (kinds.has("allow-pause") && !scene.node.allowPause) {
    out.push("互动节点未开启“允许暂停”，与“允许儿童随时暂停”不符");
  }
  return out;
}

/** 汇总教案批准前的所有问题。block 级问题会阻止批准。 */
export function planIssues(draft: PlanDraft): Issue[] {
  if (draft.courseFlow) return courseIssues(draft);
  const issues: Issue[] = [];
  const g = draft.goal;
  if (!g.text.trim()) {
    issues.push({ id: "goal-empty", severity: "block", text: "尚未填写教学目标", target: { stage: "plan", focus: "goal" } });
  } else if (!g.confirmed) {
    issues.push({ id: "goal-unconfirmed", severity: "block", text: "教学目标尚未确认", target: { stage: "plan", focus: "goal" } });
  }
  if (!g.observe.trim() && g.text.trim()) {
    issues.push({ id: "goal-observe", severity: "warn", text: "目标缺少观察方式，课后复盘将难以对照", target: { stage: "plan", focus: "goal" } });
  }

  draft.steps.forEach((s, i) => {
    const label = `第 ${i + 1} 环节（${ROLE_LABEL[s.role]}）`;
    const target = { stage: "plan" as const, focus: "step" as const, stepId: s.id };
    if (s.status === "empty") issues.push({ id: `step-empty-${s.id}`, severity: "block", text: `${label}仍为空白`, target });
    else if (s.status === "draft") issues.push({ id: `step-draft-${s.id}`, severity: "block", text: `${label}尚未确认`, target });
    if (s.needsReview) issues.push({ id: `step-review-${s.id}`, severity: "block", text: `${label}需复核：${s.needsReview}`, target });
    if (s.candidate) issues.push({ id: `step-cand-${s.id}`, severity: "block", text: `${label}有未处理的 AI 候选`, target });
  });

  const st = draft.story;
  if (!st) {
    issues.push({ id: "story-none", severity: "block", text: "尚未创建故事", target: { stage: "story", focus: "story" } });
  } else {
    if (st.needsReview) issues.push({ id: "story-review", severity: "block", text: `故事需复核：${st.needsReview}`, target: { stage: "story", focus: "story" } });
    if (!st.confirmed) issues.push({ id: "story-unconfirmed", severity: "block", text: "故事尚未确认", target: { stage: "story", focus: "story" } });
    const stepIds = new Set(draft.steps.map((s) => s.id));
    for (const step of draft.steps) {
      if (!st.scenes.some((sc) => sc.stepId === step.id)) {
        issues.push({ id: `scene-missing-${step.id}`, severity: "warn", text: `「${step.fields.title || ROLE_LABEL[step.role]}」没有对应的故事场景`, target: { stage: "story", focus: "story" } });
      }
    }
    for (const sc of st.scenes) {
      const t = { stage: "story" as const, focus: "scene" as const, sceneId: sc.id };
      if (!stepIds.has(sc.stepId)) issues.push({ id: `scene-orphan-${sc.id}`, severity: "block", text: `场景「${sc.title}」关联的环节已不存在`, target: t });
      if (!sc.node.prompt.trim()) issues.push({ id: `scene-node-${sc.id}`, severity: "block", text: `场景「${sc.title}」缺少互动节点提示语`, target: t });
      if (sc.cueIds.length === 0) issues.push({ id: `scene-cue-${sc.id}`, severity: "warn", text: `场景「${sc.title}」未配置模拟反馈`, target: t });
      if (sc.suggestedCueIds) issues.push({ id: `scene-sugg-${sc.id}`, severity: "block", text: `场景「${sc.title}」有未处理的反馈建议`, target: t });
      for (const c of sceneConflicts(sc, draft.constraints)) {
        issues.push({ id: `scene-conflict-${sc.id}-${c}`, severity: "block", text: `场景「${sc.title}」：${c}`, target: t });
      }
    }
    if (!st.apronConfirmed) issues.push({ id: "apron-unconfirmed", severity: "block", text: "围裙反馈配置尚未确认", target: { stage: "story", focus: "story" } });
  }
  return issues;
}

export const blockingIssues = (d: PlanDraft) => planIssues(d).filter((i) => i.severity === "block");

export type ActivityPhase =
  | { key: "planning"; label: string }
  | { key: "approved"; label: string }
  | { key: "transferred"; label: string }
  | { key: "recorded"; label: string }
  | { key: "reviewed"; label: string };

/** 活动当前所处阶段（用于工作台与标签）。 */
export function activityPhase(a: Activity): ActivityPhase {
  const latest = a.versions[a.versions.length - 1];
  if (!latest || !a.draftLocked) {
    if (a.versions.length > 0 && !a.draftLocked) return { key: "planning", label: `修订中 · v${a.versions.length + 1} 草稿` };
    return { key: "planning", label: "备课中" };
  }
  const sessions = a.sessions.filter((s) => s.versionId === latest.id);
  if (sessions.some((s) => s.reflection?.status === "reviewed")) return { key: "reviewed", label: "复盘已审核" };
  if (sessions.length > 0) return { key: "recorded", label: "待复盘" };
  if (a.transfers.some((t) => t.versionId === latest.id && t.ok)) return { key: "transferred", label: "已传输（模拟）" };
  return { key: "approved", label: `已批准 v${latest.versionNo}` };
}

/** 备课完成度：用于进度条与工作台展示。 */
export function planProgress(d: PlanDraft): { done: number; total: number } {
  const total = 1 + d.steps.length + 2;
  let done = d.goal.confirmed ? 1 : 0;
  done += d.steps.filter((s) => s.status === "confirmed" && !s.needsReview).length;
  if (d.story?.confirmed && !d.story.needsReview) done += 1;
  if (d.story?.apronConfirmed) done += 1;
  return { done, total };
}

/** 简单稳定哈希（FNV-1a），用于模拟回执和版本校验。 */
export function checksum(value: unknown): string {
  const str = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
