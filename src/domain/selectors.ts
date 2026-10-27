import type { AppData, LessonSession, SessionStage } from "./types";

export function selectSession(
  data: AppData,
  sessionId: string | undefined,
): LessonSession | undefined {
  return data.sessions.find((session) => session.id === sessionId);
}

export function isSessionContentLocked(session: LessonSession): boolean {
  return session.transmission.status === "success";
}

export function isStoryStale(session: LessonSession): boolean {
  return (
    session.story.scenes.length > 0 &&
    session.story.basedOnPlanRevision !== session.planRevision
  );
}

export function isApronStale(session: LessonSession): boolean {
  return (
    session.apronConfig.mappings.length > 0 &&
    session.apronConfig.basedOnPlanRevision !== session.planRevision
  );
}

export function getUnmappedCueIds(session: LessonSession): string[] {
  const enabledMappings = new Set(
    session.apronConfig.mappings
      .filter((mapping) => mapping.enabled && mapping.moduleId)
      .map((mapping) => mapping.cueId),
  );
  return session.story.scenes
    .flatMap((scene) => scene.cues)
    .filter((cue) => !enabledMappings.has(cue.id))
    .map((cue) => cue.id);
}

export function getApprovalBlockers(session: LessonSession): string[] {
  const blockers: string[] = [];
  if (session.goalSet.status !== "confirmed" || session.goalSet.items.length === 0) {
    blockers.push("确认至少一个教学目标");
  }
  if (session.steps.length < 3) {
    blockers.push("至少准备 3 个教学环节");
  }
  if (session.steps.some((step) => step.status !== "confirmed")) {
    blockers.push("确认全部教学环节");
  }
  if (session.story.scenes.length === 0 || session.story.status !== "confirmed") {
    blockers.push("生成并确认故事与互动内容");
  }
  if (isStoryStale(session)) {
    blockers.push("核对基于旧版教案的故事");
  }
  const stepIds = new Set(session.steps.map((step) => step.id));
  if (session.story.scenes.some((scene) => !stepIds.has(scene.stepId))) {
    blockers.push("更新故事中对已移除环节的引用");
  }
  if (session.apronConfig.status !== "confirmed") {
    blockers.push("确认围裙反馈配置");
  }
  if (isApronStale(session)) {
    blockers.push("核对基于旧版教案的围裙配置");
  }
  if (getUnmappedCueIds(session).length > 0) {
    blockers.push("为全部故事提示点匹配模拟模块");
  }
  if (isSessionContentLocked(session) && !session.approval) {
    blockers.push("传输记录缺少批准快照");
  }
  return blockers;
}

export function hasCurrentApproval(session: LessonSession): boolean {
  return session.approval?.planRevision === session.planRevision;
}

export function getSessionStage(session: LessonSession): SessionStage {
  if (session.reflection?.status === "reviewed") return "reviewed";
  if (session.classRecord) return "recorded";
  if (session.transmission.status === "success") return "transferred";
  if (hasCurrentApproval(session)) return "approved";
  return "planning";
}

export function getSessionStageLabel(session: LessonSession): string {
  const labels: Record<SessionStage, string> = {
    planning: "备课中",
    approved: "待模拟传输",
    transferred: "待课堂记录",
    recorded: "待复盘审核",
    reviewed: "复盘已审核",
  };
  return labels[getSessionStage(session)];
}

export function getSessionContinuePath(session: LessonSession): string {
  if (session.classRecord || session.transmission.status === "success") {
    return session.classRecord
      ? `/records/${session.id}`
      : `/sessions/${session.id}/review`;
  }
  if (
    session.goalSet.status === "confirmed" &&
    session.steps.length >= 3 &&
    session.steps.every((step) => step.status === "confirmed")
  ) {
    if (
      session.story.status === "confirmed" &&
      session.apronConfig.status === "confirmed" &&
      !isStoryStale(session) &&
      !isApronStale(session)
    ) {
      return `/sessions/${session.id}/review`;
    }
    return `/sessions/${session.id}/experience`;
  }
  return `/sessions/${session.id}/plan`;
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return "尚未记录";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
