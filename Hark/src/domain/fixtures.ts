import type { Activity, AppData, ChildProfile, Constraint, FeedbackCue, PlanDraft, Step } from "./types";

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  const rand =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}${counter.toString(36)}`;
}

export const nowIso = () => new Date().toISOString();

/** 全部为虚构演示数据，不对应任何真实儿童。 */
export const seedChild: ChildProfile = {
  id: "child-xiaozhou",
  name: "小舟",
  fictional: true,
  ageLabel: "6 岁（虚构设定）",
  summary: "虚构演示档案。喜欢船只和灯塔图案，熟悉的流程中更愿意参与。",
  communication: [
    "能用 2–3 个字的短语表达需要",
    "对图片提示的反应比口头提示更稳定",
    "需要较长等待时间才开始回应",
  ],
  preferences: ["船只、灯塔、海浪图案", "一次只给一个清晰指令", "先观察、再参与"],
  sensory: ["对突然的大音量敏感", "环境嘈杂时会捂耳朵，需要暂停"],
  teacherNotes: "邀请轮流时先用手势指向轮流卡，再说“轮到你”。等待时不连续追问。",
  observations: [
    {
      id: "obs-seed-1",
      text: "（虚构初始记录）在熟悉的绘本活动中，可在图片提示后说出“我的”。",
      origin: { kind: "seed" },
      createdAt: "2026-10-10T02:00:00.000Z",
    },
  ],
};

/** 模拟反馈目录：只描述教学意图，不代表真实模块、型号或参数。 */
export const feedbackCatalog: FeedbackCue[] = [
  {
    id: "cue-turn-card",
    channel: "visual",
    name: "轮流卡图示",
    description: "围裙上显示“轮到谁”的图示，教师翻转时切换。",
    trigger: "teacher",
    sudden: false,
    flashing: false,
  },
  {
    id: "cue-lighthouse-glow",
    channel: "visual",
    name: "灯塔柔光图示",
    description: "灯塔图案缓慢亮起，表示故事进入互动时刻。",
    trigger: "teacher",
    sudden: false,
    flashing: false,
  },
  {
    id: "cue-wave-blink",
    channel: "visual",
    name: "海浪闪烁动画",
    description: "海浪图案快速闪烁，吸引注意。",
    trigger: "auto",
    sudden: true,
    flashing: true,
  },
  {
    id: "cue-voice-your-turn",
    channel: "sound",
    name: "教师预录短语“轮到你了”",
    description: "教师手动触发的一句温和语音。",
    trigger: "teacher",
    sudden: false,
    flashing: false,
  },
  {
    id: "cue-soft-chime",
    channel: "sound",
    name: "渐入提示音",
    description: "渐入的短提示音，由教师按下后播放。",
    trigger: "teacher",
    sudden: false,
    flashing: false,
  },
  {
    id: "cue-horn",
    channel: "sound",
    name: "船笛音效（自动）",
    description: "场景开始时自动播放的船笛声，出现较突然。",
    trigger: "auto",
    sudden: true,
    flashing: false,
  },
];

export const cueById = (id: string) => feedbackCatalog.find((c) => c.id === id);

export const STEP_ROLES: Step["role"][] = ["warmup", "model", "practice", "fade", "review"];
export const ROLE_LABEL: Record<Step["role"], string> = {
  warmup: "引入",
  model: "示范",
  practice: "引导练习",
  fade: "减少提示",
  review: "回顾",
};

export function emptyStep(role: Step["role"]): Step {
  return {
    id: uid("step"),
    role,
    fields: { title: "", teacherScript: "", childInteraction: "", observe: "", minutes: 5 },
    status: "empty",
    source: "teacher",
    rev: 0,
    basedOnGoalRev: 0,
  };
}

export function constraintsFromChild(child: ChildProfile): Constraint[] {
  const list: Constraint[] = [];
  if (child.sensory.some((s) => s.includes("音量"))) {
    list.push({ id: uid("con"), kind: "no-sudden-sound", text: "避免突然的大音量" });
  }
  if (child.sensory.some((s) => s.includes("暂停"))) {
    list.push({ id: uid("con"), kind: "allow-pause", text: "允许儿童随时暂停" });
  }
  return list;
}

export function emptyDraft(child: ChildProfile): PlanDraft {
  return {
    revision: 1,
    goal: { text: "", observe: "", source: "teacher", confirmed: false, rev: 0 },
    goalOptions: [],
    constraints: constraintsFromChild(child),
    notes: "",
    steps: STEP_ROLES.map(emptyStep),
    story: null,
  };
}

export function newActivity(child: ChildProfile, title: string): Activity {
  const at = nowIso();
  return {
    id: uid("act"),
    childId: child.id,
    title: title.trim() || "未命名教学活动",
    createdAt: at,
    updatedAt: at,
    draft: emptyDraft(child),
    versions: [],
    transfers: [],
    sessions: [],
    draftLocked: false,
    lastStage: "plan",
  };
}

export function initialData(): AppData {
  return { children: [structuredClone(seedChild)], activities: [] };
}
