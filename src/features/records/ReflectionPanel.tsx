import { Check, ClipboardCheck, FileCheck2, Link2, Sparkles, UserCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { Button } from "../../components/ui/Button";
import { Badge, EmptyState, Notice, SimulationBadge } from "../../components/ui/Feedback";
import { createId } from "../../domain/fixtures";
import { formatDateTime } from "../../domain/selectors";
import type { ChildProfile, LessonSession } from "../../domain/types";
import { reflectionFromDraft } from "../../services/mappers";
import { mockAi } from "../../services/mockAi";

export function ReflectionPanel({ session, child }: { session: LessonSession; child: ChildProfile }) {
  const { data, update } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const reflection = session.reflection;
  const record = session.classRecord!;
  const history = data.profileHistory.find((entry) => entry.sessionId === session.id);

  async function generateReflection() {
    setLoading(true);
    setError(undefined);
    try {
      const draft = await mockAi.draftReflection({ child, session, record });
      update({ type: "reflection/apply", sessionId: session.id, reflection: reflectionFromDraft(draft, session.id) });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "模拟复盘生成失败，请重试。 ");
    } finally {
      setLoading(false);
    }
  }

  function updateProfile() {
    if (!reflection || reflection.status !== "reviewed") return;
    update({
      type: "profile-history/create",
      sessionId: session.id,
      entry: {
        id: createId("history"),
        childId: child.id,
        sessionId: session.id,
        reflectionId: reflection.id,
        summary: `${session.title}｜模拟课堂复盘已审核`,
        createdAt: new Date().toISOString(),
      },
      skipHistory: true,
    });
  }

  return (
    <aside className="panel reflection-panel">
      <div className="panel-header">
        <div><h2>AI 教学复盘</h2><p>根据模拟事件生成草案，教师修改并审核后可更新档案</p></div>
        {reflection?.status === "reviewed" ? <Badge variant="success">已审核</Badge> : <SimulationBadge label="模拟 AI" />}
      </div>
      <div className="reflection-body">
        <Notice variant="warning" title="不作诊断或疗效判断">
          复盘只能引用本次模拟事件。审核表示教师已阅读并修订，不等于专业评估。
        </Notice>
        {error && <Notice variant="error" title="复盘生成未完成" actions={<Button onClick={generateReflection}>重试</Button>}>{error}</Notice>}

        {!reflection ? (
          <EmptyState
            icon={<Sparkles aria-hidden="true" />}
            title="生成一份有证据的复盘草案"
            description="本地模板会引用本次模拟事件，不会补写不存在的过程。"
            action={<Button variant="primary" loading={loading} onClick={generateReflection}>模拟生成复盘草案</Button>}
          />
        ) : (
          <>
            <section className="evidence-section">
              <div className="section-heading compact"><h3>引用的模拟事件</h3><Badge>{reflection.evidenceEventIds.length} 条</Badge></div>
              <div className="evidence-list">
                {reflection.evidenceEventIds.map((eventId) => {
                  const event = record.events.find((item) => item.id === eventId);
                  return event ? <div key={eventId}><Link2 aria-hidden="true" /><span>{event.elapsed}</span><p>{event.summary.replace("模拟：", "")}</p></div> : null;
                })}
              </div>
            </section>

            <div className="field">
              <label htmlFor="reflection-observations">过程观察草案</label>
              <textarea id="reflection-observations" className="tall" readOnly={reflection.status === "reviewed"} value={reflection.observations} onChange={(event) => update({ type: "reflection/update", sessionId: session.id, patch: { observations: event.target.value }, historyKey: "reflection-observations" })} />
            </div>
            <div className="field">
              <label htmlFor="reflection-suggestions">后续教学建议</label>
              <textarea id="reflection-suggestions" readOnly={reflection.status === "reviewed"} value={reflection.suggestions} onChange={(event) => update({ type: "reflection/update", sessionId: session.id, patch: { suggestions: event.target.value }, historyKey: "reflection-suggestions" })} />
            </div>

            {reflection.status === "draft" ? (
              <Button full variant="primary" disabled={!reflection.observations.trim()} icon={<UserCheck aria-hidden="true" />} onClick={() => update({ type: "reflection/review", sessionId: session.id, reviewedAt: new Date().toISOString(), skipHistory: true })}>教师审核复盘</Button>
            ) : (
              <div className="reviewed-box">
                <FileCheck2 aria-hidden="true" />
                <div><strong>教师已审核</strong><p>{formatDateTime(reflection.reviewedAt)} · 可显式更新虚构档案</p></div>
              </div>
            )}

            {reflection.status === "reviewed" && !history && (
              <>
                <Button full variant="primary" icon={<Check aria-hidden="true" />} onClick={updateProfile}>经审核更新儿童档案</Button>
                <Button full variant="ghost" onClick={() => update({ type: "reflection/unlock", sessionId: session.id })}>返回修改复盘</Button>
              </>
            )}
            {history && (
              <Notice variant="success" title="虚构档案已更新" actions={<Link className="button button-secondary" to={`/children/${child.id}`}><ClipboardCheck aria-hidden="true" />查看档案历史</Link>}>
                已创建一条可追溯到本课程与复盘的本地历史记录。
              </Notice>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
