import type { AppData, ChildProfile, LessonSession } from "./types";

export const DEMO_STEP_COUNT = 4;

export const demoChild: ChildProfile = {
  id: "child-xiaozhou",
  displayName: "小舟",
  isFictional: true,
  ageBand: "6–7 岁（虚构设定）",
  description: "一份仅用于产品演示的教学档案，不对应任何真实儿童。",
  preferences: ["船只与灯塔图案", "清晰的一步提示", "先观察，再参与互动"],
  defaultConstraints: ["避免突然大音量", "单个环节约 5 分钟"],
  teacherNotes: "先观察儿童当下的参与状态，再发出轮流表达邀请；等待时不连续追问。",
};

export function createId(prefix: string): string {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  const suffix = randomUUID
    ? randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${suffix}`;
}

export function createInitialAppData(): AppData {
  return {
    children: [structuredClone(demoChild)],
    sessions: [],
    profileHistory: [],
  };
}

export function createEmptySession(
  child: ChildProfile,
  now = new Date().toISOString(),
): LessonSession {
  return {
    id: createId("session"),
    childId: child.id,
    title: "轮流表达｜小船找灯塔",
    createdAt: now,
    updatedAt: now,
    planRevision: 1,
    goalSet: {
      items: [],
      constraints: child.defaultConstraints.map((text, index) => ({
        id: `constraint-${index + 1}`,
        text,
      })),
      teacherNotes: child.teacherNotes,
      status: "draft",
      revision: 0,
    },
    steps: [],
    story: {
      title: "",
      summary: "",
      scenes: [],
      status: "draft",
      basedOnPlanRevision: 0,
    },
    apronConfig: {
      mappings: [],
      status: "draft",
      basedOnPlanRevision: 0,
    },
    transmission: {
      mode: "simulated",
      status: "idle",
      attempts: 0,
    },
    professionalAssessment: {
      note: "",
      authorRole: "teacher",
      updatedAt: now,
    },
  };
}
