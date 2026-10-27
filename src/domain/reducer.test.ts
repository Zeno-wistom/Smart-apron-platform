import { describe, expect, it } from "vitest";
import { createEmptySession, createInitialAppData, demoChild } from "./fixtures";
import { appReducer } from "./reducer";
import { hasCurrentApproval, isStoryStale } from "./selectors";
import type { AppData, LessonSession, LessonStep, ProfileHistoryEntry } from "./types";
import { decodeStorage, encodeStorage } from "../services/localStorageRepository";

const now = "2026-10-27T00:00:00.000Z";

function makeStep(index: number, status: "draft" | "confirmed" = "confirmed"): LessonStep {
  return {
    id: `step-${index}`,
    templateKey: `template-${index}`,
    title: `环节 ${index}`,
    teacherInstruction: `教师指令 ${index}`,
    interaction: `互动建议 ${index}`,
    note: "",
    status,
    source: "teacher",
  };
}

function makeReadySession(): LessonSession {
  const base = createEmptySession(demoChild, now);
  const steps = [makeStep(1), makeStep(2), makeStep(3)];
  return {
    ...base,
    id: "session-test",
    goalSet: {
      ...base.goalSet,
      items: [{ id: "goal-1", text: "完成两次轮流表达", source: "teacher" }],
      status: "confirmed",
    },
    steps,
    story: {
      title: "小船找灯塔",
      summary: "测试故事",
      status: "confirmed",
      basedOnPlanRevision: base.planRevision,
      scenes: steps.map((step) => ({
        id: `scene-${step.id}`,
        stepId: step.id,
        title: step.title,
        text: "故事文本",
        characters: "小船、灯塔",
        interaction: step.interaction,
        cues: [
          {
            id: `cue-${step.id}`,
            kind: "visual" as const,
            label: "视觉提示",
            description: "模拟提示",
          },
        ],
      })),
    },
    apronConfig: {
      status: "confirmed",
      basedOnPlanRevision: base.planRevision,
      mappings: steps.map((step) => ({
        cueId: `cue-${step.id}`,
        moduleId: "sim-visual",
        enabled: true,
        note: "模拟",
      })),
    },
  };
}

function dataWith(session: LessonSession): AppData {
  return { ...createInitialAppData(), sessions: [session], activeSessionId: session.id };
}

function historyEntry(session: LessonSession): ProfileHistoryEntry {
  return {
    id: "history-1",
    childId: session.childId,
    sessionId: session.id,
    reflectionId: "reflection-1",
    summary: "经审核的教学记录",
    createdAt: now,
  };
}

describe("教师控制权与版本规则", () => {
  it("已确认目标只能显式解锁后修改", () => {
    const session = makeReadySession();
    const original = dataWith(session);
    const blocked = appReducer(original, {
      type: "goals/update",
      sessionId: session.id,
      goalId: "goal-1",
      text: "被 AI 覆盖的目标",
      at: now,
    });
    expect(blocked).toBe(original);

    const unlocked = appReducer(original, { type: "goals/unlock", sessionId: session.id, at: now });
    const changed = appReducer(unlocked, {
      type: "goals/update",
      sessionId: session.id,
      goalId: "goal-1",
      text: "教师修改后的目标",
      at: now,
    });
    expect(changed.sessions[0].goalSet.items[0].text).toBe("教师修改后的目标");
    expect(changed.sessions[0].planRevision).toBeGreaterThan(session.planRevision);
  });

  it("已确认步骤不能被候选内容覆盖", () => {
    const session = makeReadySession();
    const original = dataWith(session);
    const replacement = { ...makeStep(9, "draft"), title: "AI 替换内容" };
    const result = appReducer(original, {
      type: "step/adopt",
      sessionId: session.id,
      stepId: "step-1",
      replacement,
      at: now,
    });
    expect(result).toBe(original);
    expect(result.sessions[0].steps[0].title).toBe("环节 1");
  });

  it("一键补全只追加，不改变已有步骤", () => {
    const ready = makeReadySession();
    const session = { ...ready, steps: [ready.steps[0]] };
    const original = dataWith(session);
    const result = appReducer(original, {
      type: "steps/append",
      sessionId: session.id,
      steps: [makeStep(2, "draft"), makeStep(3, "draft")],
      at: now,
    });
    expect(result.sessions[0].steps).toHaveLength(3);
    expect(result.sessions[0].steps[0]).toBe(session.steps[0]);
  });

  it("返回修改保留下游原文并标记过期", () => {
    const session = makeReadySession();
    const original = dataWith(session);
    const unlocked = appReducer(original, { type: "step/unlock", sessionId: session.id, stepId: "step-1", at: now });
    const changed = appReducer(unlocked, {
      type: "step/update",
      sessionId: session.id,
      stepId: "step-1",
      patch: { title: "教师调整后的环节" },
      at: now,
    });
    expect(isStoryStale(changed.sessions[0])).toBe(true);
    expect(changed.sessions[0].story.scenes[0].text).toBe("故事文本");
  });

  it("批准快照不被后续编辑修改，传输后内容只读", () => {
    const session = makeReadySession();
    const original = dataWith(session);
    const approved = appReducer(original, {
      type: "session/approve",
      sessionId: session.id,
      snapshotId: "snapshot-1",
      approvedAt: now,
      at: now,
    });
    expect(hasCurrentApproval(approved.sessions[0])).toBe(true);

    const unlocked = appReducer(approved, { type: "step/unlock", sessionId: session.id, stepId: "step-1", at: now });
    const edited = appReducer(unlocked, {
      type: "step/update",
      sessionId: session.id,
      stepId: "step-1",
      patch: { title: "批准后的新标题" },
      at: now,
    });
    expect(edited.sessions[0].approval?.steps[0].title).toBe("环节 1");
    expect(hasCurrentApproval(edited.sessions[0])).toBe(false);

    const transferred = appReducer(approved, {
      type: "transmission/result",
      sessionId: session.id,
      status: "success",
      message: "模拟成功",
      at: now,
    });
    const blocked = appReducer(transferred, {
      type: "step/delete",
      sessionId: session.id,
      stepId: "step-1",
      at: now,
    });
    expect(blocked).toBe(transferred);
  });

  it("复盘未审核时不能更新儿童档案", () => {
    const session = makeReadySession();
    const original = dataWith(session);
    const result = appReducer(original, {
      type: "profile-history/create",
      sessionId: session.id,
      entry: historyEntry(session),
      at: now,
    });
    expect(result).toBe(original);
  });
});

describe("本地持久化", () => {
  it("版本化数据可以往返恢复", () => {
    const data = dataWith(makeReadySession());
    const restored = decodeStorage(encodeStorage(data, now));
    expect(restored).toEqual(data);
  });

  it("损坏或未知版本不会被静默接受", () => {
    expect(() => decodeStorage("{not-json")).toThrow();
    expect(() => decodeStorage(JSON.stringify({ schemaVersion: 99, data: {} }))).toThrow();
  });
});
