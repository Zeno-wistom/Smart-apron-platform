import { describe, expect, it } from "vitest";
import { reducer, candidateRejection, adoptRejection, stepsSignature, type Action } from "./reducer";
import { initialData, newActivity, seedChild } from "./fixtures";
import { blockingIssues, sceneConflicts } from "./checks";
import type { AppData, Candidate, StepFields } from "./types";
import { composeStep, generateStory, simulateSession, readSkill } from "../services/mockAi";
import { load, save, STORAGE_KEY } from "../services/storage";
import { simControls } from "../services/simControls";

simControls.speed = 0;

const fields = (title: string): StepFields => ({ title, teacherScript: "教师说", childInteraction: "儿童做", observe: "看", minutes: 5 });

function setup() {
  let data: AppData = initialData();
  const act = newActivity(seedChild, "测试活动");
  data = reducer(data, { type: "activity/create", activity: act });
  const run = (a: Action) => (data = reducer(data, a));
  const get = () => data.activities[0];
  return { run, get, id: act.id, data: () => data };
}

function cand(stepRev: number, goalRev: number, kind: Candidate["kind"] = "generate"): Candidate {
  return { requestId: "r", kind, fields: fields("AI 标题"), basedOnGoalRev: goalRev, basedOnStepRev: stepRev, createdAt: "", variant: 0 };
}

function confirmGoal(t: ReturnType<typeof setup>) {
  t.run({ type: "goal/edit", activityId: t.id, patch: { text: "在视觉提示下练习轮流表达", observe: "记录" } });
  t.run({ type: "goal/confirm", activityId: t.id });
}

describe("教师控制规则", () => {
  it("已确认环节不会被 AI 候选写入或采纳覆盖", () => {
    const t = setup();
    confirmGoal(t);
    const s = t.get().draft.steps[0];
    t.run({ type: "step/edit", activityId: t.id, stepId: s.id, patch: fields("教师写的") });
    t.run({ type: "step/confirm", activityId: t.id, stepId: s.id });
    const step = t.get().draft.steps[0];
    expect(step.status).toBe("confirmed");
    const c = cand(step.rev, t.get().draft.goal.rev);
    expect(candidateRejection(t.get().draft, false, s.id, c)).toMatch(/已确认/);
    t.run({ type: "step/candidate", activityId: t.id, stepId: s.id, candidate: c });
    expect(t.get().draft.steps[0].candidate).toBeUndefined();
    t.run({ type: "step/edit", activityId: t.id, stepId: s.id, patch: { title: "被改" } });
    expect(t.get().draft.steps[0].fields.title).toBe("教师写的");
  });

  it("一键补全候选不会覆盖教师在生成期间写下的草稿", () => {
    const t = setup();
    confirmGoal(t);
    const s = t.get().draft.steps[1];
    const c = cand(s.rev, t.get().draft.goal.rev, "complete");
    // 生成期间教师开始写草稿
    t.run({ type: "step/edit", activityId: t.id, stepId: s.id, patch: { title: "我的草稿" } });
    expect(candidateRejection(t.get().draft, false, s.id, c)).not.toBeNull();
    t.run({ type: "step/candidate", activityId: t.id, stepId: s.id, candidate: c });
    expect(t.get().draft.steps[1].candidate).toBeUndefined();
    expect(t.get().draft.steps[1].fields.title).toBe("我的草稿");
  });

  it("候选只是候选：到达时不改正文，采纳后才写入并保持草稿状态", () => {
    const t = setup();
    confirmGoal(t);
    const s = t.get().draft.steps[2];
    t.run({ type: "step/candidate", activityId: t.id, stepId: s.id, candidate: cand(s.rev, t.get().draft.goal.rev) });
    expect(t.get().draft.steps[2].fields.title).toBe("");
    expect(t.get().draft.steps[2].candidate).toBeDefined();
    t.run({ type: "step/adopt", activityId: t.id, stepId: s.id });
    const after = t.get().draft.steps[2];
    expect(after.fields.title).toBe("AI 标题");
    expect(after.status).toBe("draft");
    expect(after.source).toBe("ai");
  });

  it("候选到达后教师又修改了环节，采纳被拒绝", () => {
    const t = setup();
    confirmGoal(t);
    const s = t.get().draft.steps[0];
    t.run({ type: "step/edit", activityId: t.id, stepId: s.id, patch: { title: "草稿" } });
    const cur = t.get().draft.steps[0];
    t.run({ type: "step/candidate", activityId: t.id, stepId: s.id, candidate: cand(cur.rev, t.get().draft.goal.rev) });
    t.run({ type: "step/edit", activityId: t.id, stepId: s.id, patch: { title: "草稿2" } });
    expect(adoptRejection(t.get().draft, false, t.get().draft.steps[0])).toMatch(/修改/);
    t.run({ type: "step/adopt", activityId: t.id, stepId: s.id });
    expect(t.get().draft.steps[0].fields.title).toBe("草稿2");
  });

  it("目标修改后旧请求结果被拒绝，且已有环节标记需复核", () => {
    const t = setup();
    confirmGoal(t);
    const s = t.get().draft.steps[0];
    t.run({ type: "step/edit", activityId: t.id, stepId: s.id, patch: fields("A") });
    t.run({ type: "step/confirm", activityId: t.id, stepId: s.id });
    const empty = t.get().draft.steps[1];
    const old = cand(empty.rev, t.get().draft.goal.rev);
    t.run({ type: "goal/unlock", activityId: t.id });
    t.run({ type: "goal/edit", activityId: t.id, patch: { text: "新的目标" } });
    expect(t.get().draft.steps[0].needsReview).toBeTruthy();
    expect(t.get().draft.steps[0].status).toBe("confirmed"); // 原文保留
    expect(candidateRejection(t.get().draft, false, empty.id, old)).toMatch(/过期/);
    expect(blockingIssues(t.get().draft).some((i) => i.id.startsWith("step-review"))).toBe(true);
    t.run({ type: "step/reviewed", activityId: t.id, stepId: s.id });
    expect(t.get().draft.steps[0].needsReview).toBeUndefined();
  });

  it("限制修改同样触发下游复核", () => {
    const t = setup();
    confirmGoal(t);
    const s = t.get().draft.steps[0];
    t.run({ type: "step/edit", activityId: t.id, stepId: s.id, patch: fields("A") });
    t.run({ type: "constraint/add", activityId: t.id, constraint: { id: "c9", kind: "free", text: "不超过 20 分钟" } });
    expect(t.get().draft.steps[0].needsReview).toMatch(/限制/);
  });
});

describe("版本与闭环", () => {
  async function fullPlan() {
    const t = setup();
    confirmGoal(t);
    for (const s of t.get().draft.steps) {
      t.run({ type: "step/edit", activityId: t.id, stepId: s.id, patch: fields(`环节-${s.role}`) });
      t.run({ type: "step/confirm", activityId: t.id, stepId: s.id });
    }
    const d = t.get().draft;
    const story = await generateStory(seedChild, d.goal.text, d.steps, d.constraints);
    t.run({ type: "story/candidate", activityId: t.id, candidate: { requestId: "s", story, basedOnSig: stepsSignature(d.steps), createdAt: "" } });
    t.run({ type: "story/adopt", activityId: t.id });
    t.run({ type: "story/confirm", activityId: t.id });
    for (const sc of t.get().draft.story!.scenes) t.run({ type: "apron/toggle", activityId: t.id, sceneId: sc.id, cueId: "cue-turn-card" });
    t.run({ type: "apron/confirm", activityId: t.id });
    return t;
  }

  it("冲突的反馈配置阻止确认", async () => {
    const t = setup();
    confirmGoal(t);
    const d = t.get().draft;
    const story = await generateStory(seedChild, d.goal.text, d.steps, d.constraints);
    const sc = { ...story.scenes[0], cueIds: ["cue-horn"] };
    expect(sceneConflicts(sc, d.constraints).length).toBeGreaterThan(0);
  });

  it("批准生成不可变快照；继续修订不改变旧版本、传输和课堂", async () => {
    const t = await fullPlan();
    expect(blockingIssues(t.get().draft)).toEqual([]);
    t.run({ type: "plan/approve", activityId: t.id, versionId: "v1", at: "now" });
    const v1 = t.get().versions[0];
    expect(t.get().draftLocked).toBe(true);
    // 锁定后编辑无效
    t.run({ type: "notes/edit", activityId: t.id, notes: "x" });
    expect(t.get().draft.notes).toBe("");
    t.run({ type: "transfer/record", activityId: t.id, attempt: { id: "t1", versionId: "v1", versionNo: 1, at: "", ok: true, message: "", simulated: true } });
    const session = simulateSession(v1);
    t.run({ type: "session/create", activityId: t.id, session });
    expect(t.get().sessions[0].versionId).toBe("v1");
    const frozen = JSON.stringify(t.get().versions[0].snapshot);
    t.run({ type: "plan/revise", activityId: t.id });
    const s0 = t.get().draft.steps[0];
    t.run({ type: "step/unlock", activityId: t.id, stepId: s0.id });
    t.run({ type: "step/edit", activityId: t.id, stepId: s0.id, patch: { title: "v2 修改" } });
    expect(JSON.stringify(t.get().versions[0].snapshot)).toBe(frozen);
    expect(t.get().sessions[0].versionId).toBe("v1");
  });

  it("没有成功传输不能创建课堂记录", async () => {
    const t = await fullPlan();
    t.run({ type: "plan/approve", activityId: t.id, versionId: "v1", at: "now" });
    t.run({ type: "session/create", activityId: t.id, session: simulateSession(t.get().versions[0]) });
    expect(t.get().sessions.length).toBe(0);
  });

  it("复盘未审核不能写入档案，审核后只写入一次", async () => {
    const t = await fullPlan();
    t.run({ type: "plan/approve", activityId: t.id, versionId: "v1", at: "now" });
    t.run({ type: "transfer/record", activityId: t.id, attempt: { id: "t1", versionId: "v1", versionNo: 1, at: "", ok: true, message: "", simulated: true } });
    const session = simulateSession(t.get().versions[0]);
    t.run({ type: "session/create", activityId: t.id, session });
    t.run({ type: "reflection/set", activityId: t.id, sessionId: session.id, reflection: { items: [], teacherSummary: "", status: "draft", proposedObservation: "观察A" } });
    const count = () => t.data().children[0].observations.length;
    const before = count();
    t.run({ type: "profile/apply", activityId: t.id, sessionId: session.id, observationId: "o1", at: "" });
    expect(count()).toBe(before);
    t.run({ type: "reflection/review", activityId: t.id, sessionId: session.id, at: "" });
    expect(t.get().sessions[0].reflection!.status).toBe("draft"); // 缺少教师总结
    t.run({ type: "reflection/field", activityId: t.id, sessionId: session.id, patch: { teacherSummary: "总结" } });
    t.run({ type: "reflection/review", activityId: t.id, sessionId: session.id, at: "" });
    t.run({ type: "profile/apply", activityId: t.id, sessionId: session.id, observationId: "o1", at: "" });
    t.run({ type: "profile/apply", activityId: t.id, sessionId: session.id, observationId: "o2", at: "" });
    expect(count()).toBe(before + 1);
    // AI 草稿不能覆盖已有复盘
    t.run({ type: "reflection/set", activityId: t.id, sessionId: session.id, reflection: { items: [], teacherSummary: "AI", status: "draft", proposedObservation: "" } });
    expect(t.get().sessions[0].reflection!.teacherSummary).toBe("总结");
  });
});

describe("模拟 AI 读取上下文", () => {
  const base = () => {
    const a = newActivity(seedChild, "x");
    return { a, steps: a.draft.steps };
  };
  it("不同目标得到不同环节内容，并带入限制与备注", () => {
    const { a, steps } = base();
    const ctx = { child: seedChild, goalObserve: "", constraints: a.draft.constraints, notes: "先用手势", steps, stepId: steps[2].id, variant: 0 };
    const turn = composeStep({ ...ctx, goalText: "在视觉提示下练习轮流表达" });
    const point = composeStep({ ...ctx, goalText: "在视觉提示下指认故事中的小船" });
    expect(turn.title).not.toBe(point.title);
    expect(turn.teacherScript).toContain("轮流表达");
    expect(point.teacherScript).toContain("指认");
    expect(turn.childInteraction).toContain("暂停");
    expect(turn.teacherScript).toContain("先用手势");
    expect(readSkill("自定义的观察目标").key).toBe("custom");
  });
  it("重新生成给出不同写法", () => {
    const { a, steps } = base();
    const ctx = { child: seedChild, goalText: "轮流表达", goalObserve: "", constraints: a.draft.constraints, notes: "", steps, stepId: steps[1].id };
    expect(composeStep({ ...ctx, variant: 0 }).title).not.toBe(composeStep({ ...ctx, variant: 1 }).title);
  });
});

describe("本地存储", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
  };
  it("使用独立前缀并能恢复", () => {
    const s = mem();
    expect(save(initialData(), s).ok).toBe(true);
    expect([...s.m.keys()]).toEqual([STORAGE_KEY]);
    expect(STORAGE_KEY).toBe("smart-apron:hark:v1");
    expect(load(s).status).toBe("restored");
  });
  it("损坏数据被识别，不当作正常数据", () => {
    const s = mem();
    s.setItem(STORAGE_KEY, "{bad json");
    expect(load(s).status).toBe("corrupt");
  });
});
