import type {
  AiGateway,
  DemoFailureControls,
  GenerationContext,
  GoalSuggestion,
  PlanningContext,
  ReflectionContext,
  ReflectionDraft,
  StepSuggestion,
  StoryContext,
  StoryDraft,
} from "./contracts";
import type { LessonStep, StoryScene } from "../domain/types";

const delay = (ms = 620) => new Promise((resolve) => setTimeout(resolve, ms));

const goalSuggestions: GoalSuggestion[] = [
  {
    id: "goal-turn-taking",
    text: "在视觉提示下完成两次轮流表达",
    rationale: "目标具体、可观察，适合用故事中的轮流对话进行练习。",
  },
  {
    id: "goal-character-choice",
    text: "在故事暂停时指出指定角色",
    rationale: "利用儿童对船只与灯塔图案的偏好，提供清晰的一步选择任务。",
  },
  {
    id: "goal-sequence-review",
    text: "在成人提示下按顺序回顾两个故事事件",
    rationale: "将回顾任务限定为两个事件，降低一次性表达负担。",
  },
];

const stepTemplates: StepSuggestion[] = [
  {
    id: "step-template-role",
    templateKey: "choose-role",
    title: "看图选择角色",
    teacherInstruction: "展示小船与灯塔的本地示意图，邀请儿童指出今天故事中的小船。等待其作出选择，不连续追问。",
    interaction: "儿童选择后，教师用一句短句复述：“小船要出发了。”不使用突然的声音反馈。",
    note: "把选择时间控制在约 5 分钟内，允许先观察再参与。",
  },
  {
    id: "step-template-model",
    templateKey: "model-turns",
    title: "教师示范轮流",
    teacherInstruction: "教师与儿童轮流指向故事图，各说一句关于小船的话。教师先示范一句，再明确交给孩子。",
    interaction: "使用固定的视觉轮流卡提示“轮到谁”，保持节奏可预测。",
    note: "教师示范保持简短，为儿童预留等待时间。",
  },
  {
    id: "step-template-practice",
    templateKey: "practice-turns",
    title: "师生轮流表达",
    teacherInstruction: "围绕“小船看见灯塔”的情节，邀请儿童与教师完成两次轮流表达；每次只给一个清晰提示。",
    interaction: "两次表达均使用视觉提示。若儿童未回应，先等待，再决定是否降低提示难度。",
    note: "本环节对应“两次轮流表达”目标；不将单次表现解释为疗效。",
  },
  {
    id: "step-template-review",
    templateKey: "story-review",
    title: "共同回顾",
    teacherInstruction: "回到两张关键故事图，邀请儿童指出先发生什么、后发生什么，教师补充完成简短回顾。",
    interaction: "以共同指图和简短表达结束课程，不加入新的强刺激反馈。",
    note: "回顾不超过约 5 分钟，记录需要进一步观察的地方。",
  },
];

function cloneTemplate(template: StepSuggestion): StepSuggestion {
  return { ...template, id: `${template.id}-candidate` };
}

export class MockAiGateway implements AiGateway, DemoFailureControls {
  private failNext = false;

  armNextFailure(): void {
    this.failNext = true;
  }

  clearNextFailure(): void {
    this.failNext = false;
  }

  isFailureArmed(): boolean {
    return this.failNext;
  }

  private async prepareRequest(ms = 620): Promise<void> {
    await delay(ms);
    if (this.failNext) {
      this.failNext = false;
      throw new Error("模拟 AI 生成失败：演示控制触发。原有内容未改变，请重试。");
    }
  }

  async recommendGoals(context: PlanningContext): Promise<GoalSuggestion[]> {
    await this.prepareRequest();
    return goalSuggestions.map((suggestion) => ({
      ...suggestion,
      rationale: `${suggestion.rationale}（基于${context.child.displayName}的虚构档案）`,
    }));
  }

  async generateNextStep(context: GenerationContext): Promise<StepSuggestion> {
    await this.prepareRequest();
    const existingKeys = new Set(context.steps.map((step) => step.templateKey));
    const next = stepTemplates.find((template) => !existingKeys.has(template.templateKey));
    if (!next || context.steps.length >= 4) {
      throw new Error("本次模拟教案已包含完整的 4 个环节，可手动添加或编辑。 ");
    }
    return cloneTemplate(next);
  }

  async regenerateStep(
    context: GenerationContext,
    step: LessonStep,
  ): Promise<StepSuggestion> {
    await this.prepareRequest();
    const template =
      stepTemplates.find((item) => item.templateKey === step.templateKey) ??
      stepTemplates[context.steps.findIndex((item) => item.id === step.id)] ??
      stepTemplates[0];
    return {
      ...cloneTemplate(template),
      title: `${template.title}｜备选建议`,
      teacherInstruction: `备选写法：${template.teacherInstruction}`,
      note: `仍须继承 ${context.goalSet.constraints.filter((item) => item.text.trim()).map((item) => item.text).join("；") || "教师已确认的限制"}。`,
    };
  }

  async completeRemainingSteps(
    context: GenerationContext,
  ): Promise<StepSuggestion[]> {
    await this.prepareRequest(700);
    const existingKeys = new Set(context.steps.map((step) => step.templateKey));
    const remainingCount = Math.max(0, 4 - context.steps.length);
    return stepTemplates
      .filter((template) => !existingKeys.has(template.templateKey))
      .slice(0, remainingCount)
      .map(cloneTemplate);
  }

  async suggestStory(context: StoryContext): Promise<StoryDraft> {
    await this.prepareRequest(720);
    if (context.steps.length < 3 || context.steps.some((step) => step.status !== "confirmed")) {
      throw new Error("请先确认至少 3 个教学环节，再生成故事。 ");
    }
    const scenes: StoryScene[] = context.steps.map((step, index) => {
      const storyTexts = [
        "小船停在安静的港湾。儿童从两张图中找到小船，故事从这里开始。",
        "小船慢慢向前。教师先说一句，再把轮流卡转向儿童，示范故事里的轮流表达。",
        "远处亮起柔和的灯塔。教师与儿童围绕小船和灯塔完成两次轮流表达。",
        "小船找到了灯塔。师生回到两张关键图，共同回顾这段安静的旅程。",
      ];
      const cueKind = index % 2 === 0 ? "visual" : "audio";
      return {
        id: `scene-${step.id}`,
        stepId: step.id,
        title: step.title,
        text: storyTexts[index] ?? `围绕“${step.title}”展开《小船找灯塔》的互动情节。`,
        characters: "小船、灯塔、教师与儿童",
        interaction: step.interaction,
        cues: [
          {
            id: `cue-${step.id}-${cueKind}`,
            kind: cueKind,
            label: cueKind === "visual" ? "柔和视觉提示" : "可预测声音提示",
            description:
              cueKind === "visual"
                ? "本地素材占位：灯塔或轮流卡图示；P0 未生成真实图像。"
                : "本地素材占位：简短、温和的提示音建议；P0 未生成真实音频。",
          },
        ],
      };
    });
    return {
      title: "小船找灯塔",
      summary: "一段围绕角色选择、轮流表达和共同回顾的简短故事。所有内容均为本地模拟草案。",
      scenes,
    };
  }

  async draftReflection(context: ReflectionContext): Promise<ReflectionDraft> {
    await this.prepareRequest();
    const turnEvents = context.record.events.filter((event) =>
      event.summary.includes("轮流表达"),
    );
    const evidence = turnEvents.length > 0 ? turnEvents : context.record.events;
    return {
      observations:
        evidence.length > 0
          ? `本次为模拟课堂记录，共有 ${evidence.length} 条与轮流表达相关的事件。${evidence.map((event) => event.summary.replace("模拟：", "")).join("；")}。这些描述只来自演示数据，不能作为真实教学效果或专业评估结论。`
          : "本次模拟记录没有足够事件支持教学过程描述，请由教师补充观察。",
      suggestions:
        "后续真实课堂可继续观察视觉提示下的等待时间与轮流表达过程，并由教师记录实际发生的情况。不要仅凭单次活动调整专业评估结论。",
      evidenceEventIds: evidence.map((event) => event.id),
    };
  }
}

export const mockAi = new MockAiGateway();
