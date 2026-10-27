import type { ClassEvent, ClassRecord, LessonSession } from "../domain/types";

const eventTemplates = [
  { elapsed: "00:40", summary: "模拟：儿童看向图片，并指向小船角色。" },
  { elapsed: "02:10", summary: "模拟：教师示范一次表达，儿童保持观看。" },
  { elapsed: "04:20", summary: "模拟：在视觉提示下，儿童完成第一次轮流表达。" },
  { elapsed: "05:05", summary: "模拟：教师等待后，儿童完成第二次轮流表达。" },
  { elapsed: "06:30", summary: "模拟：师生共同指向故事图，完成回顾。" },
];

export function createSimulatedClassRecord(
  session: LessonSession,
  now = new Date(),
): ClassRecord {
  if (!session.approval || session.transmission.status !== "success") {
    throw new Error("只有模拟传输成功后，才能生成本次模拟课堂记录。");
  }
  const events: ClassEvent[] = eventTemplates.map((template, index) => {
    const stepIndex = index < 2 ? index : index < 4 ? 2 : 3;
    const step = session.approval!.steps[Math.min(stepIndex, session.approval!.steps.length - 1)];
    const occurredAt = new Date(now.getTime() + index * 45_000).toISOString();
    return {
      id: `event-${session.id}-${index + 1}`,
      sessionId: session.id,
      stepId: step.id,
      occurredAt,
      elapsed: template.elapsed,
      summary: template.summary,
      source: "simulated",
    };
  });
  return {
    id: `record-${session.id}`,
    sessionId: session.id,
    snapshotId: session.approval.id,
    createdAt: now.toISOString(),
    source: "simulated",
    events,
  };
}
