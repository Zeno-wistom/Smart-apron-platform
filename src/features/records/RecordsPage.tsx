import { ArrowLeft, ArrowRight, BookOpenCheck, ClipboardClock, FileClock, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { Button } from "../../components/ui/Button";
import { Badge, EmptyState, Notice, SimulationBadge } from "../../components/ui/Feedback";
import { PageHeader } from "../../components/ui/PageHeader";
import { selectSession } from "../../domain/selectors";
import { createSimulatedClassRecord } from "../../services/mockClassroom";
import { ClassTimeline } from "./ClassTimeline";
import { ReflectionPanel } from "./ReflectionPanel";
import "./records.css";

export function RecordsPage() {
  const { sessionId } = useParams();
  const { data, update } = useApp();

  if (!sessionId) {
    const sessions = data.sessions.filter((session) => session.classRecord || session.transmission.status === "success");
    return (
      <div>
        <PageHeader title="教学记录" description="查看模拟课堂事件、教学复盘与教师审核状态。" meta={<SimulationBadge label="模拟课堂数据" />} />
        <section className="panel records-directory">
          {sessions.length === 0 ? (
            <EmptyState icon={<ClipboardClock aria-hidden="true" />} title="还没有课堂记录" description="完成教案批准与模拟传输后，可显式生成本次模拟课堂记录。" action={<Link className="button button-primary" to="/">返回工作台</Link>} />
          ) : sessions.map((session) => {
            const child = data.children.find((item) => item.id === session.childId);
            return (
              <article key={session.id}>
                <span className="record-list-icon"><BookOpenCheck aria-hidden="true" /></span>
                <div><div className="record-list-title"><h2>{session.title}</h2><Badge variant={session.reflection?.status === "reviewed" ? "success" : "info"}>{session.reflection?.status === "reviewed" ? "复盘已审核" : session.classRecord ? "待复盘" : "待生成记录"}</Badge></div><p>{child?.displayName}（虚构） · {session.classRecord?.events.length ?? 0} 条模拟事件</p></div>
                <Link className="button button-secondary" to={`/records/${session.id}`}>查看记录<ArrowRight aria-hidden="true" /></Link>
              </article>
            );
          })}
        </section>
      </div>
    );
  }

  const session = selectSession(data, sessionId);
  if (!session) return <Notice variant="warning" title="未找到课程记录"><Link to="/records">返回教学记录</Link></Notice>;
  const child = data.children.find((item) => item.id === session.childId)!;

  if (!session.classRecord) {
    return (
      <div>
        <Link className="back-link" to="/records"><ArrowLeft aria-hidden="true" />教学记录列表</Link>
        <PageHeader title="课堂记录尚未生成" description={session.title} />
        <section className="panel">
          <EmptyState
            icon={<FileClock aria-hidden="true" />}
            title={session.transmission.status === "success" ? "可以生成本次模拟课堂记录" : "请先完成课前审核与模拟传输"}
            description="系统不会自动编造课堂过程，只有教师显式点击后才生成固定模拟事件。"
            action={session.transmission.status === "success" ? <Button variant="primary" onClick={() => update({ type: "class-record/create", sessionId: session.id, record: createSimulatedClassRecord(session), skipHistory: true })}>生成模拟课堂记录</Button> : <Link className="button button-primary" to={`/sessions/${session.id}/review`}>返回确认与传输</Link>}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="records-detail-page">
      <Link className="back-link" to="/records"><ArrowLeft aria-hidden="true" />教学记录列表</Link>
      <PageHeader
        title="教学记录与课后复盘"
        description={`${session.title} · ${child.displayName}（虚构）`}
        meta={<SimulationBadge label="全部课堂数据为模拟" />}
        actions={<Link className="button button-secondary" to={`/sessions/${session.id}/review`}>查看批准教案</Link>}
      />
      <section className="record-context-band">
        <div><span>本次教学目标</span><strong>{session.approval?.goalSet.items[0]?.text ?? session.goalSet.items[0]?.text}</strong></div>
        <div><span>模拟事件</span><strong>{session.classRecord.events.length} 条</strong></div>
        <div><span>批准快照</span><strong>{session.classRecord.snapshotId.slice(0, 20)}…</strong></div>
      </section>
      <Notice variant="info" title="模拟与真实边界">
        本页没有真实围裙事件、音频、视频、EEG 或 fNIRS 数据。复盘草案仅依据下方模拟事件生成。
      </Notice>

      <div className="records-layout">
        <div className="records-main">
          <ClassTimeline session={session} />
          <section className="panel professional-note-panel">
            <div className="panel-header"><div><h2>专业观察记录</h2><p>教师人工填写的文本入口，不生成量表评分或诊断</p></div><ShieldCheck aria-hidden="true" /></div>
            <div className="panel-body">
              <div className="field">
                <label htmlFor="professional-note">专业观察（非诊断）</label>
                <textarea id="professional-note" className="tall" placeholder="记录实际观察到的情况、需要由专业人员进一步确认的问题……" value={session.professionalAssessment.note} onChange={(event) => update({ type: "professional/update", sessionId: session.id, note: event.target.value, historyKey: "professional-note" })} />
                <p className="field-hint">此文本仅保存在当前浏览器。正式量表、测量规则与角色权限属于后续工作。</p>
              </div>
            </div>
          </section>
        </div>
        <ReflectionPanel session={session} child={child} />
      </div>
    </div>
  );
}
