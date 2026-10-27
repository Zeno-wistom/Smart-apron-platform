import { BookOpen, Check, Image, ListChecks, Volume2 } from "lucide-react";
import { Badge } from "../../components/ui/Feedback";
import type { LessonSession } from "../../domain/types";

export function LessonSummary({ session }: { session: LessonSession }) {
  const source = session.approval && session.transmission.status === "success" ? session.approval : session;
  const cues = source.story.scenes.flatMap((scene) => scene.cues);

  return (
    <div className="lesson-summary">
      <section className="panel summary-section">
        <div className="panel-header"><div><h2>教学目标与限制</h2><p>批准时的核心教学上下文</p></div><ListChecks aria-hidden="true" /></div>
        <div className="panel-body summary-goal-grid">
          <div><h3>教学目标</h3><ol>{source.goalSet.items.map((goal) => <li key={goal.id}>{goal.text}</li>)}</ol></div>
          <div><h3>儿童限制</h3><ul>{source.goalSet.constraints.filter((item) => item.text.trim()).map((item) => <li key={item.id}>{item.text}</li>)}</ul></div>
          <div className="summary-note"><h3>教师备注</h3><p>{source.goalSet.teacherNotes || "未填写"}</p></div>
        </div>
      </section>

      <section className="panel summary-section">
        <div className="panel-header"><div><h2>教学环节</h2><p>{source.steps.length} 个环节 · 顺序以本版教案为准</p></div><Badge variant="success"><Check aria-hidden="true" />教师已确认</Badge></div>
        <div className="summary-step-list">
          {source.steps.map((step, index) => (
            <article key={step.id}>
              <span>{index + 1}</span>
              <div><h3>{step.title}</h3><p>{step.teacherInstruction}</p><blockquote>{step.interaction}</blockquote>{step.note && <small>教师备注：{step.note}</small>}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel summary-section">
        <div className="panel-header"><div><h2>{source.story.title || "尚未命名故事"}</h2><p>{source.story.summary}</p></div><BookOpen aria-hidden="true" /></div>
        <div className="summary-story-list">
          {source.story.scenes.map((scene, index) => (
            <article key={scene.id}><span>{index + 1}</span><div><h3>{scene.title}</h3><p>{scene.text}</p><small>{scene.characters}</small></div></article>
          ))}
        </div>
      </section>

      <section className="panel summary-section">
        <div className="panel-header"><div><h2>模拟围裙反馈</h2><p>{cues.length} 个故事提示点 · 仅包含模拟模块映射</p></div><Badge variant="info">模拟配置</Badge></div>
        <div className="summary-mapping-list">
          {cues.map((cue) => {
            const mapping = source.apronConfig.mappings.find((item) => item.cueId === cue.id);
            const Icon = cue.kind === "visual" ? Image : Volume2;
            return <div key={cue.id}><Icon aria-hidden="true" /><span>{cue.label}</span><strong>{mapping?.enabled ? mapping.moduleId === "sim-visual" ? "模拟视觉反馈模块" : "模拟声音反馈模块" : "未启用"}</strong></div>;
          })}
        </div>
      </section>
    </div>
  );
}
