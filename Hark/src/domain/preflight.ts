import { courseIssues } from './courseChecks';
import { blockingIssues, planIssues } from "./checks";
import { cueById } from "./fixtures";
import type { PlanDraft } from "./types";

/** Confirmation is collected once; review flags and candidates remain real blockers. */
export function confirmedForPreflight(draft: PlanDraft): PlanDraft {
  const d = structuredClone(draft);
  d.goal.confirmed = true;
  for (const s of d.steps) if (s.status !== "empty") s.status = "confirmed";
  if (d.story) {
    d.story.confirmed = true;
    d.story.apronConfirmed = true;
  }
  return d;
}
export function preflightIssues(d: PlanDraft) {
  if(d.courseFlow) return courseIssues(d);
  const normalized = confirmedForPreflight(d);
  const issues = planIssues(normalized);
  const add = (
    id: string,
    text: string,
    target: (typeof issues)[number]["target"],
  ) => issues.push({ id, text, target, severity: "block" });
  if (d.lessonCandidate)
    add("lesson-candidate", "整课初稿仍有未处理候选", {
      stage: "plan",
      focus: "goal",
    });
  if (!d.goal.observe.trim())
    add("goal-record", "请补充观察与记录方式", {
      stage: "plan",
      focus: "goal",
    });
  if (!d.steps.length)
    add("steps-none", "至少需要一个教学环节", { stage: "plan", focus: "goal" });
  for (const s of d.steps) {
    const t = { stage: "plan" as const, focus: "step" as const, stepId: s.id };
    if (
      !s.fields.title.trim() ||
      !s.fields.teacherScript.trim() ||
      !s.fields.childInteraction.trim() ||
      !s.fields.observe.trim()
    )
      add(
        `step-content-${s.id}`,
        "请补全环节标题、教师引导、儿童互动与观察点",
        t,
      );
    if (
      !Number.isFinite(s.fields.minutes) ||
      s.fields.minutes <= 0 ||
      s.fields.minutes > 30
    )
      add(`step-time-${s.id}`, "环节时长应为 1–30 分钟", t);
  }
  if (d.storyCandidate)
    add("story-candidate", "故事仍有未处理候选", {
      stage: "story",
      focus: "story",
    });
  if (d.story) {
    if (!d.story.title.trim() || !d.story.summary.trim())
      add("story-summary", "请补全故事标题与梗概", {
        stage: "story",
        focus: "story",
      });
    for (const s of d.steps)
      if (!d.story.scenes.some((sc) => sc.stepId === s.id))
        add(`scene-required-${s.id}`, "此环节缺少故事呈现", {
          stage: "plan",
          focus: "step",
          stepId: s.id,
        });
    for (const sc of d.story.scenes) {
      const t = {
        stage: "story" as const,
        focus: "scene" as const,
        sceneId: sc.id,
      };
      if (!sc.narration.trim() || !sc.node.expected.trim())
        add(`scene-content-${sc.id}`, "请补全旁白与期待回应", t);
      if (sc.cueIds.some((id) => !cueById(id)))
        add(
          `cue-unknown-${sc.id}`,
          "包含无法识别的围裙提示，请移除或重新配置",
          t,
        );
    }
  }
  return issues;
}
export const preflightBlocks = (d: PlanDraft) =>
  preflightIssues(d).filter((i) => i.severity === "block");
export function preflightReady(d: PlanDraft) {
  return (
    !preflightBlocks(d).length &&
    !blockingIssues(confirmedForPreflight(d)).length
  );
}
export const PREFLIGHT_GROUPS = [
  "目标与观察方式",
  "环节完整性与时长",
  "故事线与互动节点",
  "围裙提示与限制",
  "版本与传输范围",
];
export function issueGroup(id: string) {
  return id.startsWith("goal")
    ? 0
    : id.startsWith("step")
      ? 1
      : id.startsWith("apron") ||
          id.startsWith("cue") ||
          id.startsWith("scene-conflict") ||
          id.startsWith("scene-sugg")
        ? 3
        : 2;
}
