import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileClock,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { Button } from "../../components/ui/Button";
import { Badge, EmptyState, SimulationBadge } from "../../components/ui/Feedback";
import { PageHeader } from "../../components/ui/PageHeader";
import { createEmptySession } from "../../domain/fixtures";
import {
  formatDateTime,
  getSessionContinuePath,
  getSessionStageLabel,
} from "../../domain/selectors";
import "./workbench.css";

export function WorkbenchPage() {
  const { data, update } = useApp();
  const navigate = useNavigate();
  const child = data.children[0];
  const pendingReflection = data.sessions.filter(
    (session) => session.classRecord && session.reflection?.status !== "reviewed",
  ).length;

  function startSession() {
    const session = createEmptySession(child);
    update({ type: "session/add", session, skipHistory: true });
    navigate(`/sessions/${session.id}/plan`);
  }

  return (
    <div className="workbench-page">
      <PageHeader
        title="教学工作台"
        description="从虚构档案小舟开始，依次完成备课、故事与围裙配置、模拟传输和课后复盘。"
        meta={<SimulationBadge label="P0 本地原型" />}
        actions={
          <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={startSession}>
            开始一节新课
          </Button>
        }
      />

      <section className="summary-strip" aria-label="本地演示概览">
        <div><UserRound aria-hidden="true" /><span>虚构儿童档案</span><strong>{data.children.length}</strong></div>
        <div><BookOpenCheck aria-hidden="true" /><span>本地课程</span><strong>{data.sessions.length}</strong></div>
        <div><FileClock aria-hidden="true" /><span>待复盘审核</span><strong>{pendingReflection}</strong></div>
        <p><ShieldCheck aria-hidden="true" />数据仅存此浏览器</p>
      </section>

      <div className="workbench-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>继续备课</h2>
              <p>同一课程会贯穿课前与课后，不需要重复录入。</p>
            </div>
            {data.sessions.length > 0 && <Badge>{data.sessions.length} 门本地课程</Badge>}
          </div>
          <div className="session-list">
            {data.sessions.length === 0 ? (
              <EmptyState
                icon={<ClipboardList aria-hidden="true" />}
                title="从一门完整演示课开始"
                description="选择小舟后，依次完成目标、教学环节、故事、模拟传输和复盘。"
                action={<Button variant="primary" onClick={startSession}>选择小舟开始备课</Button>}
              />
            ) : (
              data.sessions.map((session) => (
                <article className="session-list-item" key={session.id}>
                  <div className="session-list-icon"><BookOpenCheck aria-hidden="true" /></div>
                  <div className="session-list-content">
                    <div className="session-list-title">
                      <h3>{session.title}</h3>
                      <Badge variant={session.reflection?.status === "reviewed" ? "success" : "info"}>
                        {getSessionStageLabel(session)}
                      </Badge>
                    </div>
                    <p>{child.displayName}（虚构） · {session.goalSet.items[0]?.text ?? "尚未确定教学目标"}</p>
                    <span><Clock3 aria-hidden="true" />更新于 {formatDateTime(session.updatedAt)}</span>
                  </div>
                  <Link className="button button-secondary" to={getSessionContinuePath(session)}>
                    继续<ArrowRight aria-hidden="true" />
                  </Link>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="panel child-card">
          <div className="panel-header">
            <div>
              <h2>儿童档案</h2>
              <p>仅用于演示的虚构资料</p>
            </div>
            <Badge>虚构</Badge>
          </div>
          <div className="panel-body">
            <div className="child-identity">
              <span className="child-avatar">舟</span>
              <div><h3>小舟</h3><p>{child.ageBand}</p></div>
            </div>
            <p className="child-description">{child.description}</p>
            <div className="child-section">
              <h4>教学偏好</h4>
              <div className="tag-list">{child.preferences.map((item) => <span key={item}>{item}</span>)}</div>
            </div>
            <div className="child-section">
              <h4>默认教学限制</h4>
              <ul className="quiet-list">{child.defaultConstraints.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <Button full variant="primary" icon={<Plus aria-hidden="true" />} onClick={startSession}>
              选择小舟开始备课
            </Button>
            <Link className="child-detail-link" to={`/children/${child.id}`}>查看完整虚构档案<ArrowRight aria-hidden="true" /></Link>
          </div>
        </aside>
      </div>

      <section className="panel demo-route">
        <div className="panel-header">
          <div><h2>一节课的流程</h2><p>从课前准备到课后复盘，所有内容保存在这台浏览器中。</p></div>
          <SimulationBadge />
        </div>
        <div className="demo-route-steps">
          <div><span>1</span><strong>确定目标</strong><p>模拟推荐，教师编辑并确认</p></div>
          <div><span>2</span><strong>编排教学</strong><p>逐步生成、一键补全、锁定与撤销</p></div>
          <div><span>3</span><strong>完成课前</strong><p>故事与模拟围裙配置，审核并模拟传输</p></div>
          <div><span>4</span><strong>课后复盘</strong><p>模拟事件、教师审核、档案更新</p></div>
        </div>
        <div className="demo-route-footer"><CheckCircle2 aria-hidden="true" />可演示异常：返回修改、AI 生成失败、传输失败、页面刷新恢复</div>
      </section>
    </div>
  );
}
