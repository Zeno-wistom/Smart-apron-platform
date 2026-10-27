/**
 * 模拟 AI 服务。
 *
 * 不接入任何真实模型。所有输出都由“当前真实编辑的上下文”经规则组合而成：
 * 儿童档案、教师填写的目标、限制、备注、前后环节、已确认的故事等。
 * 因此修改目标或限制后，再次生成会得到相应变化的结果。
 */
import { cueById, feedbackCatalog, ROLE_LABEL, uid } from "../domain/fixtures";
import type {
  ChildProfile,
  ClassEvent,
  ClassSession,
  Constraint,
  GoalOption,
  PlanVersion,
  Reflection,
  ReviewItem,
  Scene,
  Step,
  StepFields,
  Story,
} from "../domain/types";
import { simControls } from "./simControls";

export class SimulatedAiError extends Error {}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gate(ms: number) {
  await wait(simControls.latency(ms));
  if (simControls.consumeAiFailure()) {
    throw new SimulatedAiError("模拟 AI 服务暂时不可用（演示控制触发）。你的内容没有改变，可以重试。");
  }
}

/* ---------------- 目标理解 ---------------- */

interface Skill {
  key: string;
  verb: string; // 例如“轮流表达”
  unit: string; // 一次机会的叫法
}

export function readSkill(goalText: string): Skill {
  const t = goalText;
  if (/轮流|轮到/.test(t)) return { key: "turn", verb: "轮流表达", unit: "一轮" };
  if (/指认|指出|选择/.test(t)) return { key: "point", verb: "指认", unit: "一次指认" };
  if (/回顾|顺序|先后/.test(t)) return { key: "sequence", verb: "顺序回顾", unit: "一个事件" };
  if (/请求|我要|表达需要/.test(t)) return { key: "request", verb: "表达请求", unit: "一次请求" };
  const core = t.replace(/^在/, "").replace(/[。.]$/, "").slice(0, 14) || "目标行为";
  return { key: "custom", verb: core, unit: "一次尝试" };
}

function cueWord(goalText: string): string {
  if (/视觉|图片|图示|卡/.test(goalText)) return "视觉提示";
  if (/手势/.test(goalText)) return "手势提示";
  return "提示";
}

function themeFrom(child: ChildProfile, storyTitle?: string) {
  if (storyTitle?.includes("灯塔") || child.preferences.some((p) => /船|灯塔/.test(p))) {
    return { title: "小船找灯塔", hero: "小船", place: "港湾", target: "灯塔" };
  }
  return { title: "小熊找朋友", hero: "小熊", place: "森林", target: "朋友" };
}

export async function recommendGoals(child: ChildProfile, hint: string, constraints: Constraint[]): Promise<GoalOption[]> {
  await gate(650);
  const visual = child.communication.some((c) => c.includes("图片")) ? "在视觉提示下" : "在教师示范后";
  const wait = child.communication.some((c) => c.includes("等待")) ? "，每次给予充足等待时间" : "";
  const pause = constraints.some((c) => c.kind === "allow-pause") ? "（允许中途暂停）" : "";
  const theme = themeFrom(child);
  const base: GoalOption[] = [
    {
      id: "opt-turn",
      text: `${visual}练习轮流表达`,
      rationale: `档案显示${child.name}对图片提示反应更稳定${wait}；轮流卡可让“轮到谁”一目了然${pause}。`,
      observe: "记录每轮是否在提示后回应：独立回应 / 提示后回应 / 未观察到",
    },
    {
      id: "opt-point",
      text: `${visual}指认故事中的${theme.hero}和${theme.target}`,
      rationale: `结合${child.name}喜欢的${child.preferences[0] ?? "图案"}，用一步指令降低参与门槛。`,
      observe: "记录指认是否正确，以及所需提示层级",
    },
    {
      id: "opt-sequence",
      text: "在教师提示下回顾两个故事事件的先后",
      rationale: "回顾任务限定为两个事件，适合作为课程结尾，负担较小。",
      observe: "记录能否按先后指出两张图片",
    },
  ];
  const h = hint.trim();
  if (!h) return base;
  // 教师输入了关注点：生成一条贴合关注点的目标置顶
  const s = readSkill(h);
  const custom: GoalOption = {
    id: "opt-hint",
    text: s.key === "custom" ? `${visual}${h.replace(/^在.*?下/, "")}` : `${visual}练习${s.verb}`,
    rationale: `根据你输入的关注点「${h}」整理为可观察的表述${wait}。`,
    observe: `记录每${s.unit}是否在提示后出现，及所需提示层级`,
  };
  return [custom, ...base.filter((b) => b.text !== custom.text)].slice(0, 3);
}

/* ---------------- 环节生成 ---------------- */

export interface StepContext {
  child: ChildProfile;
  goalText: string;
  goalObserve: string;
  constraints: Constraint[];
  notes: string;
  steps: Step[];
  stepId: string;
  variant: number;
}

function constraintLines(constraints: Constraint[]) {
  const lines: string[] = [];
  if (constraints.some((c) => c.kind === "no-sudden-sound")) lines.push("全程保持平稳音量，不使用突然的声音");
  if (constraints.some((c) => c.kind === "allow-pause")) lines.push("儿童示意暂停时立即停下，等待其准备好再继续");
  if (constraints.some((c) => c.kind === "no-touch")) lines.push("不进行身体引导");
  for (const c of constraints.filter((x) => x.kind === "free")) lines.push(c.text.replace(/[。.]$/, ""));
  return lines;
}

export function composeStep(ctx: StepContext): StepFields {
  const idx = ctx.steps.findIndex((s) => s.id === ctx.stepId);
  const step = ctx.steps[idx];
  const prev = ctx.steps.slice(0, idx).reverse().find((s) => s.status !== "empty");
  const skill = readSkill(ctx.goalText);
  const cue = cueWord(ctx.goalText);
  const theme = themeFrom(ctx.child);
  const name = ctx.child.name;
  const v = ctx.variant % 3;
  const link = prev ? `承接「${prev.fields.title}」，` : "";
  const rules = constraintLines(ctx.constraints);
  const noteHint = ctx.notes.trim() ? `（按备注：${ctx.notes.trim().slice(0, 24)}${ctx.notes.trim().length > 24 ? "…" : ""}）` : "";

  const byRole: Record<Step["role"], StepFields[]> = {
    warmup: [
      {
        title: `认识${theme.hero}和${theme.target}`,
        teacherScript: `展示${theme.hero}与${theme.target}两张图片，用一句短句介绍：“今天${theme.hero}要去找${theme.target}。”`,
        childInteraction: `邀请${name}看一看或指一指${theme.hero}，先观察、不要求开口。`,
        observe: "是否注视或指向图片",
        minutes: 4,
      },
      {
        title: `${theme.place}出发前`,
        teacherScript: `把${theme.hero}图片放在${theme.place}位置，安静地等待${name}注意到它，再说：“${theme.hero}准备出发。”`,
        childInteraction: `${name}可以把${theme.hero}图片推向前方，表示“出发”。`,
        observe: "是否主动参与移动图片",
        minutes: 4,
      },
      {
        title: "熟悉今天的图片",
        teacherScript: `依次展示今天会用到的${cue}卡片，每张停留数秒，只说出名称。`,
        childInteraction: `${name}跟随教师的手指看卡片，可自由触摸卡片。`,
        observe: "对哪张卡片关注最多",
        minutes: 3,
      },
    ],
    model: [
      {
        title: `教师示范${skill.verb}`,
        teacherScript: `${link}教师先完成${skill.unit}${skill.verb}，再翻转${cue}卡，指向${name}：“轮到你。”`,
        childInteraction: `${name}观察教师的示范，看到${cue}后尝试跟做${skill.unit}。`,
        observe: `是否在${cue}出现后注意到“轮到自己”`,
        minutes: 5,
      },
      {
        title: `用${cue}演示“轮到谁”`,
        teacherScript: `${link}教师与助手（或玩偶）先示范两次${skill.verb}，每次都把${cue}卡转向下一位。`,
        childInteraction: `${name}看示范，必要时教师用手势指向${cue}卡。`,
        observe: `是否跟随${cue}卡的方向`,
        minutes: 5,
      },
      {
        title: `${theme.hero}的第一句话`,
        teacherScript: `${link}教师扮演${theme.hero}说一句短句，然后把${cue}卡交给${name}。`,
        childInteraction: `${name}接过${cue}卡，可用短语、手势或指图回应。`,
        observe: "回应方式（口语 / 手势 / 指图）",
        minutes: 5,
      },
    ],
    practice: [
      {
        title: `${theme.hero}看见${theme.target}：${skill.verb}`,
        teacherScript: `${link}围绕“${theme.hero}看见${theme.target}”的情节，邀请${name}完成两次${skill.verb}，每次只给一个${cue}。`,
        childInteraction: `${name}在${cue}出现后完成${skill.unit}；未回应时先等待，再决定是否降低提示。`,
        observe: ctx.goalObserve || `记录每${skill.unit}的提示层级`,
        minutes: 6,
      },
      {
        title: `轮到${name}说`,
        teacherScript: `${link}教师说一句关于${theme.target}的话后停顿，指向${cue}卡并等待。`,
        childInteraction: `${name}接着说出或指出一个词，与教师完成两次${skill.verb}。`,
        observe: ctx.goalObserve || "记录回应与提示层级",
        minutes: 6,
      },
      {
        title: `${skill.verb}小练习`,
        teacherScript: `${link}用三张情节图组织三次${skill.unit}机会，每次机会之间留出等待时间。`,
        childInteraction: `${name}选择想回应的图片完成${skill.verb}，可以跳过一次。`,
        observe: ctx.goalObserve || "记录每次机会的回应",
        minutes: 7,
      },
    ],
    fade: [
      {
        title: `减少提示再试一次`,
        teacherScript: `${link}只出示${cue}卡、不再口头说“轮到你”，观察${name}是否仍能完成${skill.verb}。`,
        childInteraction: `${name}根据${cue}卡自行完成${skill.unit}；需要时教师再补充口头提示。`,
        observe: "仅视觉提示时是否回应",
        minutes: 5,
      },
      {
        title: "把提示交给孩子",
        teacherScript: `${link}请${name}来翻转${cue}卡，决定“下一位是谁”。`,
        childInteraction: `${name}翻卡并把轮次交给教师，完成一次完整的${skill.verb}循环。`,
        observe: "能否主动交还轮次",
        minutes: 5,
      },
      {
        title: "延迟提示",
        teacherScript: `${link}出示${cue}后多等待几秒再给口头提示。`,
        childInteraction: `${name}可在等待中自发回应。`,
        observe: "是否在口头提示前回应",
        minutes: 5,
      },
    ],
    review: [
      {
        title: `${theme.hero}找到了${theme.target}`,
        teacherScript: `回到两张关键故事图，教师说：“${theme.hero}找到了${theme.target}。”邀请${name}指出先后顺序。`,
        childInteraction: `${name}指出或说出一张图，教师补全回顾，以平静的方式结束。`,
        observe: "是否参与回顾",
        minutes: 3,
      },
      {
        title: "今天我们做了什么",
        teacherScript: `把今天用过的${cue}卡摆成一排，教师逐一指出并简短命名。`,
        childInteraction: `${name}选一张最喜欢的卡片放进盒子里。`,
        observe: "选择了哪张卡片",
        minutes: 3,
      },
      {
        title: "安静道别",
        teacherScript: `教师让${theme.hero}图片“回到${theme.place}”，用固定的结束语结束课程。`,
        childInteraction: `${name}帮忙把图片放回原处。`,
        observe: "过渡到结束是否顺利",
        minutes: 2,
      },
    ],
  };

  const pick = byRole[step.role][v];
  const extra = [...rules].join("；");
  return {
    ...pick,
    teacherScript: `${pick.teacherScript}${noteHint}`,
    childInteraction: extra ? `${pick.childInteraction} 注意：${extra}。` : pick.childInteraction,
  };
}

export async function generateStep(ctx: StepContext): Promise<StepFields> {
  await gate(700);
  return composeStep(ctx);
}

export async function completeSteps(ctx: Omit<StepContext, "stepId" | "variant">, stepIds: string[]) {
  await gate(1100);
  return stepIds.map((stepId) => ({ stepId, fields: composeStep({ ...ctx, stepId, variant: 0 }) }));
}

/* ---------------- 故事生成 ---------------- */

export async function generateStory(child: ChildProfile, goalText: string, steps: Step[], constraints: Constraint[]): Promise<Story> {
  await gate(900);
  const theme = themeFrom(child);
  const skill = readSkill(goalText);
  const allowPause = constraints.some((c) => c.kind === "allow-pause");
  const scenes: Scene[] = steps.map((s, i) => ({
    id: uid("scene"),
    stepId: s.id,
    title: s.fields.title || `${ROLE_LABEL[s.role]}场景`,
    narration: narrationFor(s, i, steps.length, theme),
    node: {
      prompt:
        s.role === "practice" || s.role === "fade" || s.role === "model"
          ? `轮到你了：${theme.hero}看见了什么？`
          : s.role === "warmup"
            ? `${theme.hero}在哪里？`
            : `${theme.hero}先去了哪里？`,
      expected: s.fields.childInteraction.split(/[。；]/)[0] || `完成${skill.unit}${skill.verb}`,
      allowPause,
    },
    cueIds: [],
    rev: 0,
  }));
  return {
    title: theme.title,
    summary: `${theme.hero}在${theme.place}出发，一路和朋友${skill.verb}，最后找到${theme.target}。故事节奏平缓，每个场景只有一个互动时刻。`,
    characters: [
      { id: uid("ch"), name: theme.hero, description: `主角，动作慢、说话短，${child.name}可以“帮助”它。` },
      { id: uid("ch"), name: theme.target, description: "目的地，柔和地亮着，不会突然出现。" },
      { id: uid("ch"), name: "海鸥", description: "陪伴角色，负责把“轮到你”的卡片递给孩子。" },
    ],
    scenes,
    confirmed: false,
    apronConfirmed: false,
    source: "ai",
    rev: 0,
  };
}

function narrationFor(s: Step, i: number, n: number, theme: ReturnType<typeof themeFrom>) {
  if (i === 0) return `${theme.place}很安静。${theme.hero}醒来了，它想去找远处的${theme.target}。`;
  if (i === n - 1) return `${theme.hero}慢慢靠近，${theme.target}亮着柔和的光。${theme.hero}找到了${theme.target}，它想起一路上的朋友。`;
  return `${theme.hero}继续向前。${s.fields.title ? `这时，${s.fields.title.replace(/：.*/, "")}。` : ""}海鸥飞来，把卡片递给你。`;
}

/* ---------------- 围裙反馈匹配（规则） ---------------- */

/** 按场景角色与已知限制匹配模拟反馈。结果只作建议，教师采纳后才写入。 */
export async function suggestCues(story: Story, steps: Step[], constraints: Constraint[]): Promise<Record<string, string[]>> {
  await gate(500);
  const strict = constraints.some((c) => c.kind === "no-sudden-sound");
  const noFlash = constraints.some((c) => c.kind === "no-flash") || strict;
  const out: Record<string, string[]> = {};
  for (const sc of story.scenes) {
    const role = steps.find((s) => s.id === sc.stepId)?.role ?? "practice";
    let ids: string[];
    if (role === "warmup") ids = ["cue-lighthouse-glow", strict ? "cue-soft-chime" : "cue-horn"];
    else if (role === "review") ids = ["cue-lighthouse-glow"];
    else if (role === "fade") ids = ["cue-turn-card"];
    else ids = ["cue-turn-card", "cue-voice-your-turn"];
    if (noFlash) ids = ids.filter((id) => !cueById(id)?.flashing);
    out[sc.id] = ids.filter((id) => feedbackCatalog.some((c) => c.id === id));
  }
  return out;
}

/* ---------------- 课堂记录（模拟） ---------------- */

export function simulateSession(version: PlanVersion): ClassSession {
  const snap = version.snapshot;
  const events: ClassEvent[] = [];
  let sec = 0;
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const push = (e: Omit<ClassEvent, "id" | "t" | "simulated">, step = 20) => {
    events.push({ ...e, id: uid("ev"), t: fmt(sec), simulated: true });
    sec += step;
  };
  snap.steps.forEach((s) => {
    const scene = snap.story?.scenes.find((sc) => sc.stepId === s.id);
    push({ stepId: s.id, sceneId: scene?.id, kind: "start", text: `开始「${s.fields.title}」` }, 30);
    for (const cid of scene?.cueIds ?? []) {
      const cue = cueById(cid);
      if (cue) push({ stepId: s.id, sceneId: scene?.id, kind: "cue", text: `教师触发：${cue.name}` }, 15);
    }
    if (s.role === "practice") {
      push({ stepId: s.id, sceneId: scene?.id, kind: "response", text: "第 1 轮：提示后回应（模拟）" }, 25);
      if (scene?.node.allowPause) push({ stepId: s.id, sceneId: scene.id, kind: "pause", text: "儿童示意暂停，教师等待约 20 秒后继续（模拟）" }, 40);
      push({ stepId: s.id, sceneId: scene?.id, kind: "response", text: "第 2 轮：独立回应（模拟）" }, 25);
    } else if (s.role === "fade") {
      push({ stepId: s.id, sceneId: scene?.id, kind: "response", text: "仅视觉提示：未观察到回应，补充口头提示后回应（模拟）" }, 30);
    } else if (s.role === "model") {
      push({ stepId: s.id, sceneId: scene?.id, kind: "response", text: "注视教师示范并指向轮流卡（模拟）" }, 30);
    } else {
      push({ stepId: s.id, sceneId: scene?.id, kind: "response", text: "指向图片参与（模拟）" }, 30);
    }
    sec += Math.max(0, s.fields.minutes * 60 - 120);
  });
  return {
    id: uid("ses"),
    versionId: version.id,
    versionNo: version.versionNo,
    createdAt: new Date().toISOString(),
    events,
    reflection: null,
    simulated: true,
  };
}

/* ---------------- 复盘草稿 ---------------- */

export async function draftReflection(version: PlanVersion, session: ClassSession, child: ChildProfile): Promise<Reflection> {
  await gate(900);
  const snap = version.snapshot;
  const responses = session.events.filter((e) => e.kind === "response");
  const pauses = session.events.filter((e) => e.kind === "pause");
  const practice = snap.steps.filter((s) => s.role === "practice").map((s) => s.id);
  const practiceResp = responses.filter((e) => practice.includes(e.stepId));
  const independent = responses.filter((e) => e.text.includes("独立"));
  const fadeEv = responses.filter((e) => e.text.includes("仅视觉"));
  const items: ReviewItem[] = [
    {
      id: uid("ri"),
      kind: "fact",
      text: `本次使用已批准的教案 v${version.versionNo}，共 ${snap.steps.length} 个环节，目标为「${snap.goal.text}」。`,
      evidence: [],
      edited: false,
    },
    {
      id: uid("ri"),
      kind: "simulated",
      text: `模拟记录中，引导练习环节有 ${practiceResp.length} 次回应事件，其中 ${independent.length} 次标为独立回应。`,
      evidence: practiceResp.map((e) => e.id),
      edited: false,
    },
  ];
  if (pauses.length) {
    items.push({
      id: uid("ri"),
      kind: "simulated",
      text: `模拟记录中出现 ${pauses.length} 次暂停，教师等待后继续。`,
      evidence: pauses.map((e) => e.id),
      edited: false,
    });
  }
  if (fadeEv.length) {
    items.push({
      id: uid("ri"),
      kind: "inference",
      text: "AI 推断：减少提示后需要补充口头提示，下次可在减少提示环节延长等待时间。此推断仅基于模拟数据，需教师判断。",
      evidence: fadeEv.map((e) => e.id),
      edited: false,
    });
  }
  items.push(
    {
      id: uid("ri"),
      kind: "inference",
      text: `AI 推断：${child.name}在${cueWord(snap.goal.text)}出现后回应较多，可继续保留轮流卡。需教师结合实际课堂确认。`,
      evidence: session.events.filter((e) => e.kind === "cue").map((e) => e.id).slice(0, 3),
      edited: false,
    },
    {
      id: uid("ri"),
      kind: "unknown",
      text: "未知：儿童当天的情绪与身体状态、真实的回应等待时长（模拟记录不含这些信息）。",
      evidence: [],
      edited: false,
    },
  );
  return {
    items,
    teacherSummary: "",
    status: "draft",
    proposedObservation: `在《${snap.story?.title ?? "故事"}》活动中，于${cueWord(snap.goal.text)}后完成${readSkill(snap.goal.text).verb}（来源：模拟课堂，教师审核）。`,
  };
}
