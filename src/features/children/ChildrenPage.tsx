import { ArrowLeft, ArrowRight, BookOpenCheck, FileText, Plus, ShieldCheck, UserRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { Button } from "../../components/ui/Button";
import { Badge, EmptyState, Notice } from "../../components/ui/Feedback";
import { PageHeader } from "../../components/ui/PageHeader";
import { createEmptySession } from "../../domain/fixtures";
import { formatDateTime } from "../../domain/selectors";
import "./children.css";

export function ChildrenPage() {
  const { childId } = useParams();
  const { data, update } = useApp();
  const navigate = useNavigate();

  if (!childId) {
    return (
      <div>
        <PageHeader title="儿童档案" description="P0 仅包含明确标记的虚构教学资料，不包含真实儿童身份信息。" meta={<Badge>虚构数据</Badge>} />
        <section className="panel child-directory">
          {data.children.map((child) => (
            <article key={child.id}>
              <span className="child-avatar">{child.displayName.slice(-1)}</span>
              <div><h2>{child.displayName}</h2><p>{child.ageBand} · {child.description}</p></div>
              <Link className="button button-secondary" to={`/children/${child.id}`}>查看档案<ArrowRight aria-hidden="true" /></Link>
            </article>
          ))}
        </section>
      </div>
    );
  }

  const child = data.children.find((item) => item.id === childId);
  if (!child) {
    return <Notice variant="warning" title="未找到该虚构档案"><Link to="/children">返回档案列表</Link></Notice>;
  }
  const history = data.profileHistory.filter((entry) => entry.childId === child.id);
  const childSessions = data.sessions.filter((session) => session.childId === child.id);
  const latestRecord = childSessions.find((session) => session.classRecord);

  function startSession() {
    const session = createEmptySession(child!);
    update({ type: "session/add", session, skipHistory: true });
    navigate(`/sessions/${session.id}/plan`);
  }

  return (
    <div className="child-profile-page">
      <Link className="back-link" to="/children"><ArrowLeft aria-hidden="true" />儿童档案列表</Link>
      <PageHeader
        title={`${child.displayName}的教学档案`}
        description={child.description}
        meta={<Badge>虚构人物</Badge>}
        actions={<Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={startSession}>开始一节新课</Button>}
      />
      <Notice variant="info" title="资料边界">
        此档案仅用于界面与流程演示，不包含医学诊断、真实评估结果或未经许可的测试素材。
      </Notice>

      <div className="profile-layout">
        <div className="profile-main">
          <section className="panel">
            <div className="panel-header"><div><h2>教学上下文</h2><p>备课时会带入这些偏好和限制，教师可在确认目标时调整。</p></div><UserRound aria-hidden="true" /></div>
            <div className="panel-body profile-sections">
              <section><h3>年龄设定</h3><p>{child.ageBand}</p></section>
              <section><h3>教学偏好</h3><div className="tag-list">{child.preferences.map((item) => <span key={item}>{item}</span>)}</div></section>
              <section><h3>默认教学限制</h3><ul className="quiet-list">{child.defaultConstraints.map((item) => <li key={item}>{item}</li>)}</ul></section>
              <section><h3>教师备注</h3><p className="profile-note">{child.teacherNotes}</p></section>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header"><div><h2>经审核的教学历史</h2><p>只有教师审核复盘并显式确认后，记录才会出现在这里。</p></div><Badge>{history.length} 条</Badge></div>
            <div className="profile-history">
              {history.length === 0 ? (
                <EmptyState icon={<BookOpenCheck aria-hidden="true" />} title="还没有经审核的历史" description="完成一次模拟课堂与复盘审核后，可从记录页更新档案。" />
              ) : history.map((entry) => (
                <article key={entry.id}>
                  <span className="history-dot" />
                  <div><h3>{entry.summary}</h3><p>{formatDateTime(entry.createdAt)} · 来源：{entry.sessionId.startsWith("session-") ? "本地演示课程" : entry.sessionId}</p><Link to={`/records/${entry.sessionId}`}>查看对应复盘<ArrowRight aria-hidden="true" /></Link></div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="panel professional-entry">
          <div className="panel-body">
            <span className="professional-icon"><ShieldCheck aria-hidden="true" /></span>
            <h2>专业评估入口</h2>
            <p>首版只提供专业观察文本记录，不生成量表评分、诊断或干预疗效结论。</p>
            {latestRecord ? (
              <Link className="button button-secondary button-full" to={`/records/${latestRecord.id}`}><FileText aria-hidden="true" />填写专业观察</Link>
            ) : (
              <Button full disabled>完成课堂记录后可填写</Button>
            )}
            <div className="professional-rule"><strong>后续接入需要</strong><span>明确量表与版权</span><span>专业人员和角色权限</span><span>测量规则与审计机制</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
