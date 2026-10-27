import { Clock3, ListTree } from "lucide-react";
import { Badge, SimulationBadge } from "../../components/ui/Feedback";
import type { LessonSession } from "../../domain/types";

export function ClassTimeline({ session }: { session: LessonSession }) {
  const record = session.classRecord!;
  const steps = session.approval?.steps ?? session.steps;

  return (
    <section className="panel class-timeline-panel">
      <div className="panel-header">
        <div><h2>活动事件记录</h2><p>按模拟时间顺序关联到批准教案中的步骤</p></div>
        <SimulationBadge label="模拟课堂事件" />
      </div>
      <div className="class-timeline">
        {record.events.map((event) => {
          const step = steps.find((item) => item.id === event.stepId);
          return (
            <article key={event.id}>
              <div className="timeline-time"><Clock3 aria-hidden="true" /><span>{event.elapsed}</span></div>
              <span className="timeline-marker" />
              <div className="timeline-content">
                <div><h3>{step?.title ?? "未知环节"}</h3><Badge>模拟</Badge></div>
                <p>{event.summary.replace("模拟：", "")}</p>
                <small>事件 ID：{event.id.slice(-18)}</small>
              </div>
            </article>
          );
        })}
      </div>
      <div className="timeline-footer"><ListTree aria-hidden="true" />仅由本地模拟器生成，不代表实时设备采集或专业观察。</div>
    </section>
  );
}
