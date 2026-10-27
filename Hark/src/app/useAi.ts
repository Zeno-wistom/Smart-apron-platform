import { useCallback } from "react";
import { candidateRejection, stepsSignature } from "../domain/reducer";
import { uid } from "../domain/fixtures";
import type { Candidate } from "../domain/types";
import * as ai from "../services/mockAi";
import { useRequests, useStore } from "./store";

/** 所有模拟 AI 调用的编排：记录请求、处理失败、拒绝过期结果。 */
export function useAi(activityId: string) {
  const { latest, dispatch, toast } = useStore();
  const req = useRequests();

  const ctx = useCallback(() => {
    const data = latest();
    const a = data.activities.find((x) => x.id === activityId)!;
    const child = data.children.find((c) => c.id === a.childId)!;
    return { a, child, d: a.draft };
  }, [latest, activityId]);

  const recommendGoals = useCallback(
    async (hint: string) => {
      const key = `goals:${activityId}`;
      const id = req.begin(key, "正在整理目标建议");
      const { child, d } = ctx();
      try {
        const options = await ai.recommendGoals(child, hint, d.constraints);
        if (!req.end(key, id)) return;
        dispatch({ type: "goal/options", activityId, options });
      } catch (e) {
        req.end(key, id, (e as Error).message);
      }
    },
    [activityId, ctx, dispatch, req],
  );

  const generateStep = useCallback(
    async (stepId: string, kind: "generate" | "regenerate") => {
      const key = `step:${stepId}`;
      const { child, d } = ctx();
      const step = d.steps.find((s) => s.id === stepId);
      if (!step) return;
      const id = req.begin(key, kind === "regenerate" ? "正在重新生成" : "正在生成建议");
      const basedOnGoalRev = d.goal.rev;
      const basedOnStepRev = step.rev;
      const variant = kind === "regenerate" ? (step.candidate?.variant ?? 0) + 1 : step.source === "ai" ? 1 : 0;
      try {
        const fields = await ai.generateStep({
          child,
          goalText: d.goal.text,
          goalObserve: d.goal.observe,
          constraints: d.constraints,
          notes: d.notes,
          steps: d.steps,
          stepId,
          variant,
        });
        if (!req.end(key, id)) return; // 已取消
        const candidate: Candidate = { requestId: id, kind, fields, basedOnGoalRev, basedOnStepRev, createdAt: new Date().toISOString(), variant };
        const now = ctx();
        const why = candidateRejection(now.d, now.a.draftLocked, stepId, candidate);
        if (why) {
          toast(`AI 结果未写入：${why}`, "warn");
          return;
        }
        dispatch({ type: "step/candidate", activityId, stepId, candidate });
      } catch (e) {
        req.end(key, id, (e as Error).message);
      }
    },
    [activityId, ctx, dispatch, req, toast],
  );

  /** 一键补全：只针对请求发起时仍为空白、且没有候选的环节。 */
  const completeRemaining = useCallback(async () => {
    const key = `complete:${activityId}`;
    const { child, d } = ctx();
    const targets = d.steps.filter((s) => s.status === "empty" && !s.candidate);
    if (targets.length === 0) return;
    const id = req.begin(key, `正在为 ${targets.length} 个空白环节生成候选`);
    const revs = new Map(targets.map((s) => [s.id, s.rev]));
    const basedOnGoalRev = d.goal.rev;
    try {
      const results = await ai.completeSteps(
        { child, goalText: d.goal.text, goalObserve: d.goal.observe, constraints: d.constraints, notes: d.notes, steps: d.steps },
        targets.map((t) => t.id),
      );
      if (!req.end(key, id)) return;
      let ok = 0;
      const skipped: string[] = [];
      for (const r of results) {
        const candidate: Candidate = {
          requestId: id,
          kind: "complete",
          fields: r.fields,
          basedOnGoalRev,
          basedOnStepRev: revs.get(r.stepId) ?? -1,
          createdAt: new Date().toISOString(),
          variant: 0,
        };
        const now = ctx();
        const why = candidateRejection(now.d, now.a.draftLocked, r.stepId, candidate);
        if (why) skipped.push(why);
        else {
          dispatch({ type: "step/candidate", activityId, stepId: r.stepId, candidate });
          ok += 1;
        }
      }
      toast(
        skipped.length
          ? `已生成 ${ok} 个候选；${skipped.length} 个未写入（${skipped[0]}）`
          : `已为 ${ok} 个空白环节生成候选，逐个审核后再采纳`,
        skipped.length ? "warn" : "success",
      );
    } catch (e) {
      req.end(key, id, (e as Error).message);
    }
  }, [activityId, ctx, dispatch, req, toast]);

  const generateStory = useCallback(async () => {
    const key = `story:${activityId}`;
    const { child, d } = ctx();
    const id = req.begin(key, "正在编写故事候选");
    const sig = stepsSignature(d.steps);
    try {
      const story = await ai.generateStory(child, d.goal.text, d.steps, d.constraints);
      if (!req.end(key, id)) return;
      if (stepsSignature(ctx().d.steps) !== sig) {
        toast("AI 结果未写入：生成期间教学环节已修改，请重新生成", "warn");
        return;
      }
      dispatch({ type: "story/candidate", activityId, candidate: { requestId: id, story, basedOnSig: sig, createdAt: new Date().toISOString() } });
    } catch (e) {
      req.end(key, id, (e as Error).message);
    }
  }, [activityId, ctx, dispatch, req, toast]);

  const suggestCues = useCallback(async () => {
    const key = `apron:${activityId}`;
    const { d } = ctx();
    if (!d.story) return;
    const id = req.begin(key, "正在匹配模拟反馈");
    const rev = d.story.rev;
    try {
      const suggestions = await ai.suggestCues(d.story, d.steps, d.constraints);
      if (!req.end(key, id)) return;
      if (ctx().d.story?.rev !== rev) {
        toast("匹配结果未写入：期间故事已修改，请重新匹配", "warn");
        return;
      }
      dispatch({ type: "apron/suggest", activityId, suggestions });
    } catch (e) {
      req.end(key, id, (e as Error).message);
    }
  }, [activityId, ctx, dispatch, req, toast]);

  const draftReflection = useCallback(
    async (sessionId: string) => {
      const key = `reflect:${sessionId}`;
      const { a, child } = ctx();
      const s = a.sessions.find((x) => x.id === sessionId);
      const v = a.versions.find((x) => x.id === s?.versionId);
      if (!s || !v) return;
      const id = req.begin(key, "正在整理复盘草稿");
      try {
        const reflection = await ai.draftReflection(v, s, child);
        if (!req.end(key, id)) return;
        dispatch({ type: "reflection/set", activityId, sessionId, reflection });
      } catch (e) {
        req.end(key, id, (e as Error).message);
      }
    },
    [activityId, ctx, dispatch, req],
  );

  return { recommendGoals, generateStep, completeRemaining, generateStory, suggestCues, draftReflection, newId: uid };
}
