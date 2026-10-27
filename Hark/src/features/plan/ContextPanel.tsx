import { Link } from "react-router-dom";
import { Ear, Lock, MessageCircle, PencilLine, Sparkle, Target } from "lucide-react";
import { Button, Tag } from "../../components/ui";
import type { Activity, ChildProfile } from "../../domain/types";
import { KIND_LABEL } from "./GoalEditor";
import type { Focus } from "./PlanStage";

/**
 * 右侧参考栏：始终可见，内容随当前编辑对象变化，避免与中间编辑区重复。
 * - 编辑目标时：显示儿童档案要点（制定目标的依据）
 * - 编辑环节时：显示本课目标、限制与备注（编写环节的依据）
 */
export function ContextPanel({ activity, child, focus, onEditGoal }: { activity: Activity; child: ChildProfile; focus: Focus; onEditGoal: () => void }) {
  const d = activity.draft;
  if (focus.kind === "goal") {
    return (
      <aside className="context" aria-label="参考信息">
        <div className="ctx-head">
          <span className="eyebrow">参考 · {child.name}的档案</span>
          <Tag>虚构</Tag>
        </div>
        <CtxBlock icon={MessageCircle} title="沟通方式" items={child.communication} />
        <CtxBlock icon={Sparkle} title="教学偏好" items={child.preferences} />
        <CtxBlock icon={Ear} title="感官限制" items={child.sensory} />
        {child.teacherNotes && (
          <div className="ctx-block">
            <h3>档案备注</h3>
            <p className="small">{child.teacherNotes}</p>
          </div>
        )}
        <Link to={`/children/${child.id}`} className="small">
          打开完整档案
        </Link>
      </aside>
    );
  }
  return (
    <aside className="context" aria-label="本课目标与限制">
      <div className="ctx-head">
        <span className="eyebrow">本课依据</span>
        {!activity.draftLocked && (
          <Button size="sm" variant="quiet" icon={PencilLine} onClick={onEditGoal}>
            修改
          </Button>
        )}
      </div>
      <div className="ctx-goal">
        <div className="row" style={{ gap: 6 }}>
          <Target className="ico primary-ink" />
          <span className="small muted grow">教学目标</span>
          {d.goal.confirmed && <Lock className="ico ok-ink" aria-label="已确认" />}
        </div>
        <p className="ctx-goal-text">{d.goal.text || <span className="muted">尚未设定</span>}</p>
        {d.goal.observe && <p className="small muted">记录：{d.goal.observe}</p>}
      </div>
      <div className="ctx-block">
        <h3>限制条件</h3>
        {d.constraints.length === 0 ? (
          <p className="small muted">无</p>
        ) : (
          <ul className="ctx-constraints">
            {d.constraints.map((c) => (
              <li key={c.id}>
                <Tag tone={c.kind === "free" ? "neutral" : "warn"}>{KIND_LABEL[c.kind]}</Tag>
                <span className="small">{c.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ctx-block">
        <h3>教师备注</h3>
        <p className="small">{d.notes || <span className="muted">无。可在“目标与限制”中填写，AI 会参考。</span>}</p>
      </div>
      <div className="ctx-block">
        <h3>{child.name}的沟通特点</h3>
        <p className="small">{child.communication.join("；")}</p>
      </div>
    </aside>
  );
}

function CtxBlock({ icon: Icon, title, items }: { icon: typeof Ear; title: string; items: string[] }) {
  return (
    <div className="ctx-block">
      <div className="row" style={{ gap: 6, marginBottom: 4 }}>
        <Icon className="ico muted" />
        <h3>{title}</h3>
      </div>
      <ul className="ctx-list">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
