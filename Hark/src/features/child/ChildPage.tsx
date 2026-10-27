import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ChevronRight, Ear, Eye, Lock, MessageCircle, NotebookPen, Sparkle } from "lucide-react";
import { Topbar } from "../../app/Shell";
import { useStore } from "../../app/store";
import { Button, Tag, TextArea, formatTime } from "../../components/ui";
import { PhaseTag, nextAction } from "../workbench/WorkbenchPage";

export function ChildPage() {
  const { childId } = useParams();
  const { data, dispatch, toast } = useStore();
  const child = data.children.find((c) => c.id === childId) ?? data.children[0];
  const [notes, setNotes] = useState(child.teacherNotes);
  useEffect(() => setNotes(child.teacherNotes), [child.teacherNotes]);
  const acts = data.activities.filter((a) => a.childId === child.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const dirty = notes !== child.teacherNotes;
  const obs = [...child.observations].reverse();

  return (
    <>
      <Topbar>
        <div className="crumbs">
          <span>儿童档案</span>
          <ChevronRight className="ico" />
          <strong>{child.name}</strong>
        </div>
      </Topbar>
      <div className="page">
        <div className="page-head">
          <div className="avatar lg" aria-hidden>
            {child.name.slice(-1)}
          </div>
          <div className="grow">
            <div className="row">
              <h1>{child.name}</h1>
              <Tag>虚构演示档案</Tag>
            </div>
            <p>
              {child.ageLabel} · {child.summary}
            </p>
          </div>
        </div>

        <div className="child-grid">
          <div className="stack" style={{ gap: "var(--s4)" }}>
            <div className="panel panel-pad profile-facts">
              <Fact icon={MessageCircle} title="沟通方式" items={child.communication} />
              <Fact icon={Sparkle} title="教学偏好" items={child.preferences} />
              <Fact icon={Ear} title="感官限制" items={child.sensory} tone="warn" note="新建活动时会自动带入为限制条件" />
            </div>

            <div className="panel panel-pad">
              <div className="section-title">
                <NotebookPen className="ico muted" />
                <h2>教师备注</h2>
                {dirty && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setNotes(child.teacherNotes)}>
                      撤销
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        dispatch({ type: "child/notes", childId: child.id, notes });
                        toast("教师备注已保存", "success");
                      }}
                    >
                      保存备注
                    </Button>
                  </>
                )}
              </div>
              <TextArea label="教师备注" hideLabel value={notes} onChange={setNotes} minRows={3} hint="仅教师可见。修改不会自动更新已有教案，新建活动时可参考。" />
            </div>

            <div className="panel panel-pad">
              <div className="section-title">
                <Eye className="ico muted" />
                <h2>已审核的教师观察</h2>
                <span className="small muted">{child.observations.length} 条</span>
              </div>
              <ol className="obs-list">
                {obs.map((o) => {
                  const act = o.origin.kind === "review" ? data.activities.find((a) => a.id === (o.origin as { activityId: string }).activityId) : undefined;
                  return (
                    <li key={o.id} className="obs" data-testid="observation">
                      <div className="obs-dot" aria-hidden />
                      <div className="grow">
                        <p>{o.text}</p>
                        <div className="small muted row row-wrap" style={{ marginTop: 4 }}>
                          <span>{formatTime(o.createdAt)}</span>
                          {o.origin.kind === "review" ? (
                            <>
                              <Tag tone="ok" icon={Lock}>
                                经复盘审核 · v{o.origin.versionNo}
                              </Tag>
                              {act && <Link to={`/activities/${act.id}/class?session=${o.origin.sessionId}`}>来自「{act.title}」</Link>}
                            </>
                          ) : (
                            <Tag>初始档案</Tag>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="small muted" style={{ marginTop: 12 }}>
                观察只能在课后复盘经教师审核后写入，AI 不会直接修改档案。
              </p>
            </div>
          </div>

          <aside className="stack" style={{ gap: "var(--s4)" }}>
            <div className="panel panel-pad">
              <div className="section-title">
                <h2>相关教学活动</h2>
              </div>
              {acts.length === 0 ? (
                <p className="small muted">暂无。可在教学工作台新建。</p>
              ) : (
                <div className="mini-list">
                  {acts.map((a) => {
                    const n = nextAction(a);
                    return (
                      <Link key={a.id} to={`/activities/${a.id}/${n.stage}`} className="mini-row">
                        <div className="grow">
                          <div className="mini-title">{a.title}</div>
                          <div className="small muted">
                            {a.versions.length} 个版本 · {a.sessions.length} 次课堂
                          </div>
                        </div>
                        <PhaseTag a={a} />
                      </Link>
                    );
                  })}
                </div>
              )}
              <Link to="/records" className="btn btn-quiet btn-sm" style={{ marginTop: 12 }}>
                <span className="btn-label">查看全部教学记录</span>
                <ArrowRight className="ico" />
              </Link>
            </div>
            <div className="panel panel-pad future">
              <h3>专业评估</h3>
              <p className="small muted">后续功能。量表、专业审核与采集协议尚未确认，本原型不生成诊断或疗效结论。</p>
              <Button size="sm" disabled style={{ marginTop: 10 }}>
                尚未开放
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function Fact({ icon: Icon, title, items, tone, note }: { icon: typeof Eye; title: string; items: string[]; tone?: "warn"; note?: string }) {
  return (
    <section className="fact">
      <div className="fact-head">
        <Icon className={`ico ${tone === "warn" ? "warn-ink" : "muted"}`} />
        <h3>{title}</h3>
      </div>
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      {note && <p className="small muted">{note}</p>}
    </section>
  );
}
