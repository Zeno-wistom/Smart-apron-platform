import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CircleCheck,
  CircleHelp,
  ClipboardCheck,
  FlaskConical,
  Hand,
  Lock,
  LockOpen,
  Pause,
  Play,
  Plus,
  Radio,
  Sparkles,
  StickyNote,
  Trash2,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { useRequests, useStore } from "../../app/store";
import { useAi } from "../../app/useAi";
import { Button, InlineError, Modal, Pending, SimTag, Tag, TextArea, cx, formatTime } from "../../components/ui";
import { ROLE_LABEL, uid } from "../../domain/fixtures";
import type { Activity, ChildProfile, ClassEvent, ClassSession, ReviewItemKind } from "../../domain/types";
import { simulateSession } from "../../services/mockAi";

export const KIND_META: Record<ReviewItemKind, { label: string; tone: "primary" | "neutral" | "ai" | "warn"; icon: LucideIcon; desc: string }> = {
  fact: { label: "事实", tone: "primary", icon: ClipboardCheck, desc: "来自已批准教案或教师亲自确认的信息" },
  simulated: { label: "模拟记录", tone: "neutral", icon: FlaskConical, desc: "来自模拟课堂事件，不代表真实儿童表现" },
  inference: { label: "AI 推断", tone: "ai", icon: Sparkles, desc: "AI 基于记录的推测，需教师判断" },
  unknown: { label: "未知", tone: "warn", icon: CircleHelp, desc: "记录中没有、需要教师补充的信息" },
};

const EV_ICON: Record<ClassEvent["kind"], LucideIcon> = { start: Play, cue: Radio, response: Hand, pause: Pause, note: StickyNote };

export function ClassStage({ activity, child }: { activity: Activity; child: ChildProfile }) {
  const [params, setParams] = useSearchParams();
  const { dispatch, toast } = useStore();
  const sessions = activity.sessions;
  const session = sessions.find((s) => s.id === params.get("session")) ?? sessions[sessions.length - 1];
  const transferred = activity.versions.filter((v) => activity.transfers.some((t) => t.versionId === v.id && t.ok));
  const latestTransferred = transferred[transferred.length - 1];
  const [hl, setHl] = useState<string[]>([]);

  const create = () => {
    if (!latestTransferred) return;
    const s = simulateSession(latestTransferred);
    dispatch({ type: "session/create", activityId: activity.id, session: s });
    setParams({ session: s.id });
    toast(`已生成模拟课堂记录（教案 v${latestTransferred.versionNo}）`, "success");
  };

  if (!latestTransferred) {
    return (
      <div className="page">
        <div className="panel empty">
          <Lock className="ico" />
          <h3>尚无可用于课堂的教案版本</h3>
          <p>批准教案并完成一次模拟传输后，才能生成课堂记录。</p>
          <Link to={`/activities/${activity.id}/review`} className="btn btn-primary btn-md" style={{ marginTop: 8 }}>
            <span className="btn-label">前往审核与传输</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="class-layout">
      <div className="class-head">
        <div className="grow">
          <div className="eyebrow">课中 · 课后</div>
          <h1>课堂记录与复盘</h1>
        </div>
        {sessions.length > 0 && (
          <div className="version-switch" role="tablist" aria-label="选择课堂">
            {sessions.map((s, i) => (
              <button key={s.id} role="tab" aria-selected={session?.id === s.id} className={cx("vs-btn", session?.id === s.id && "on")} onClick={() => setParams({ session: s.id })}>
                第 {i + 1} 次 · v{s.versionNo}
              </button>
            ))}
          </div>
        )}
        <Button icon={Plus} sim onClick={create} data-testid="create-session">
          生成模拟课堂记录（v{latestTransferred.versionNo}）
        </Button>
      </div>

      {!session ? (
        <div className="panel empty">
          <Radio className="ico" />
          <h3>课堂由教师和儿童通过实体围裙进行</h3>
          <p>本原型不采集真实课堂数据。生成一份基于 v{latestTransferred.versionNo} 的模拟记录，用于演示课后复盘流程。</p>
          <Button variant="primary" icon={Plus} sim onClick={create} style={{ marginTop: 8 }}>
            生成模拟课堂记录
          </Button>
        </div>
      ) : (
        <div className="class-grid">
          <Timeline activity={activity} session={session} highlight={hl} />
          <ReflectionPanel activity={activity} child={child} session={session} onEvidence={setHl} />
        </div>
      )}
    </div>
  );
}

function Timeline({ activity, session, highlight }: { activity: Activity; session: ClassSession; highlight: string[] }) {
  const v = activity.versions.find((x) => x.id === session.versionId)!;
  return (
    <section className="panel timeline" aria-label="课堂事件">
      <div className="tl-head">
        <h2 className="grow">课堂事件</h2>
        <SimTag>模拟记录</SimTag>
      </div>
      <div className="small muted tl-meta">
        关联教案 <Tag tone="ok" icon={Lock}>v{v.versionNo}</Tag> · 生成于 {formatTime(session.createdAt)} · {session.events.length} 条事件
      </div>
      <ol className="tl-steps">
        {v.snapshot.steps.map((s, i) => {
          const evs = session.events.filter((e) => e.stepId === s.id);
          return (
            <li key={s.id} className="tl-step">
              <div className="tl-step-head">
                <span className="doc-num">{i + 1}</span>
                <b className="grow">{s.fields.title}</b>
                <span className="small muted">{ROLE_LABEL[s.role]}</span>
              </div>
              <ul className="tl-events">
                {evs.map((e) => {
                  const Icon = EV_ICON[e.kind];
                  return (
                    <li key={e.id} id={`ev-${e.id}`} className={cx("tl-ev", `ev-${e.kind}`, highlight.includes(e.id) && "hl")}>
                      <span className="tl-time mono">{e.t}</span>
                      <Icon className="ico" />
                      <span className="grow">{e.text}</span>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ReflectionPanel({ activity, child, session, onEvidence }: { activity: Activity; child: ChildProfile; session: ClassSession; onEvidence: (ids: string[]) => void }) {
  const { dispatch, data, toast } = useStore();
  const ai = useAi(activity.id);
  const { pending, errors, clearError } = useRequests();
  const [applyOpen, setApplyOpen] = useState(false);
  const r = session.reflection;
  const key = `reflect:${session.id}`;
  const id = activity.id;
  const sid = session.id;
  const ro = r?.status === "reviewed";
  const applied = r?.appliedObservationId ? data.children.find((c) => c.id === child.id)?.observations.find((o) => o.id === r.appliedObservationId) : undefined;

  const showEvidence = (ids: string[]) => {
    onEvidence(ids);
    if (ids[0]) document.getElementById(`ev-${ids[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="panel reflection" aria-label="课后复盘">
      <div className="tl-head">
        <h2 className="grow">课后复盘</h2>
        {r ? ro ? <Tag tone="ok" icon={Lock}>已审核</Tag> : <Tag tone="warn">草稿 · 待教师审核</Tag> : null}
      </div>

      {!r ? (
        <div className="ai-zone" style={{ margin: 16 }}>
          <div className="ai-zone-head">
            <Sparkles className="ico ai-ink" />
            <h3 className="grow">生成复盘草稿</h3>
            <SimTag />
          </div>
          <p className="small muted">根据 v{session.versionNo} 教案与本次模拟事件整理。每一条都会标明来源，你可以修改、删除或补充。</p>
          <div className="row" style={{ marginTop: 12 }}>
            <Button variant="ai" icon={Sparkles} loading={!!pending[key]} onClick={() => ai.draftReflection(sid)} data-testid="gen-reflection">
              生成复盘草稿
            </Button>
            {pending[key] && <Pending label="正在整理复盘草稿" />}
          </div>
          {errors[key] && (
            <div style={{ marginTop: 12 }}>
              <InlineError text={errors[key]!} onRetry={() => ai.draftReflection(sid)} onClose={() => clearError(key)} />
            </div>
          )}
        </div>
      ) : (
        <div className="refl-body">
          <ul className="legend" aria-label="来源说明">
            {(Object.keys(KIND_META) as ReviewItemKind[]).map((k) => (
              <li key={k} title={KIND_META[k].desc}>
                <Tag tone={KIND_META[k].tone} icon={KIND_META[k].icon}>
                  {KIND_META[k].label}
                </Tag>
                <span className="small muted">{KIND_META[k].desc}</span>
              </li>
            ))}
          </ul>

          <ol className="refl-items">
            {r.items.map((it) => {
              const m = KIND_META[it.kind];
              return (
                <li key={it.id} className={cx("refl-item", `k-${it.kind}`)} data-testid="refl-item">
                  <div className="row refl-item-head">
                    {ro ? (
                      <Tag tone={m.tone} icon={m.icon}>
                        {m.label}
                      </Tag>
                    ) : (
                      <select className="input kind-select" aria-label="来源类型" value={it.kind} onChange={(e) => dispatch({ type: "reflection/item-kind", activityId: id, sessionId: sid, itemId: it.id, kind: e.target.value as ReviewItemKind })}>
                        {(Object.keys(KIND_META) as ReviewItemKind[]).map((k) => (
                          <option key={k} value={k}>
                            {KIND_META[k].label}
                          </option>
                        ))}
                      </select>
                    )}
                    {it.edited && <span className="small muted">教师已修改</span>}
                    <span className="grow" />
                    {it.evidence.length > 0 && (
                      <Button size="sm" variant="quiet" onMouseEnter={() => onEvidence(it.evidence)} onMouseLeave={() => onEvidence([])} onClick={() => showEvidence(it.evidence)}>
                        {it.evidence.length} 条依据
                      </Button>
                    )}
                    {!ro && <Button size="sm" variant="ghost" icon={Trash2} aria-label="删除此条" onClick={() => dispatch({ type: "reflection/item-remove", activityId: id, sessionId: sid, itemId: it.id })} />}
                  </div>
                  <TextArea label="内容" hideLabel id={`ri-${it.id}`} value={it.text} readOnly={ro} minRows={1} onChange={(v) => dispatch({ type: "reflection/item", activityId: id, sessionId: sid, itemId: it.id, text: v })} />
                </li>
              );
            })}
          </ol>
          {!ro && (
            <Button
              size="sm"
              variant="ghost"
              icon={Plus}
              onClick={() => dispatch({ type: "reflection/item-add", activityId: id, sessionId: sid, item: { id: uid("ri"), kind: "fact", text: "", evidence: [], edited: true } })}
            >
              添加一条教师补充
            </Button>
          )}

          <hr className="divider" />
          <TextArea
            id="teacher-summary"
            label="教师总结（必填）"
            value={r.teacherSummary}
            readOnly={ro}
            minRows={2}
            placeholder="用你自己的话总结本次课。审核后才会保存为正式复盘。"
            onChange={(v) => dispatch({ type: "reflection/field", activityId: id, sessionId: sid, patch: { teacherSummary: v } })}
          />
          <TextArea
            id="proposed-observation"
            label="拟写入儿童档案的观察"
            value={r.proposedObservation}
            readOnly={ro}
            minRows={2}
            hint="审核完成后，需再次确认才会写入档案。"
            onChange={(v) => dispatch({ type: "reflection/field", activityId: id, sessionId: sid, patch: { proposedObservation: v } })}
          />

          {!ro ? (
            <div className="refl-foot">
              <span className="small muted grow">{r.teacherSummary.trim() ? "确认来源标注无误后完成审核。" : "填写教师总结后可完成审核。"}</span>
              <Button
                variant="primary"
                icon={UserRoundCheck}
                disabled={!r.teacherSummary.trim()}
                onClick={() => {
                  dispatch({ type: "reflection/review", activityId: id, sessionId: sid, at: new Date().toISOString() });
                  toast("复盘已审核", "success");
                }}
                data-testid="review-reflection"
              >
                完成审核
              </Button>
            </div>
          ) : (
            <div className="refl-foot column">
              <div className="row" style={{ width: "100%" }}>
                <span className="small muted grow">审核于 {formatTime(r.reviewedAt)}</span>
                <Button size="sm" variant="ghost" icon={LockOpen} onClick={() => dispatch({ type: "reflection/reopen", activityId: id, sessionId: sid })}>
                  重新编辑
                </Button>
              </div>
              {applied ? (
                <div className="notice notice-ok" style={{ width: "100%" }}>
                  <CircleCheck className="ico" />
                  <span className="grow">已写入{child.name}的档案（每次课堂只写入一次）。</span>
                  <Link to={`/children/${child.id}`} className="btn btn-secondary btn-sm" data-testid="view-profile">
                    <span className="btn-label">查看档案</span>
                  </Link>
                </div>
              ) : (
                <Button variant="primary" icon={UserRoundCheck} disabled={!r.proposedObservation.trim()} onClick={() => setApplyOpen(true)} style={{ width: "100%" }} data-testid="apply-profile">
                  将观察写入儿童档案
                </Button>
              )}
            </div>
          )}

          <div className="future small">
            <b>专业评估</b>
            <span className="muted"> · 后续功能，暂不提供量表、诊断或疗效结论。</span>
          </div>
        </div>
      )}

      <Modal
        open={applyOpen}
        title={`写入${child.name}的档案？`}
        onClose={() => setApplyOpen(false)}
        footer={
          <>
            <Button onClick={() => setApplyOpen(false)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                dispatch({ type: "profile/apply", activityId: id, sessionId: sid, observationId: uid("obs"), at: new Date().toISOString() });
                setApplyOpen(false);
                toast(`已写入${child.name}的档案`, "success");
              }}
              data-testid="apply-confirm"
            >
              确认写入
            </Button>
          </>
        }
      >
        <blockquote className="quote">{r?.proposedObservation}</blockquote>
        <p className="small muted">将作为“经复盘审核的观察”追加到档案，并标注来源 v{session.versionNo} 的这次课堂。原有观察不会被修改。</p>
      </Modal>
    </section>
  );
}
