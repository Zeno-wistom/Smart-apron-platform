import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, ChevronRight, History, Plus, UserRound } from "lucide-react";
import { Topbar } from "../../app/Shell";
import { useStore } from "../../app/store";
import { Button, Modal, Progress, Tag, TextInput, formatTime } from "../../components/ui";
import { activityPhase, planProgress } from "../../domain/checks";
import { newActivity } from "../../domain/fixtures";
import type { Activity, Stage } from "../../domain/types";

const PHASE_TONE = { planning: "primary", approved: "ok", transferred: "ok", recorded: "warn", reviewed: "neutral" } as const;

/** 活动的“下一步”：工作台与列表共用，教师不必猜从哪里继续。 */
export function nextAction(a: Activity): { label: string; stage: Stage } {
  const p = activityPhase(a);
  switch (p.key) {
    case "planning": {
      const d = a.draft;
      if (!d.goal.confirmed) return { label: "确认教学目标", stage: "plan" };
      if (d.steps.some((s) => s.status !== "confirmed" || s.needsReview)) return { label: "继续编排教学环节", stage: "plan" };
      if (!d.story?.confirmed || !d.story.apronConfirmed) return { label: "完成故事与围裙配置", stage: "story" };
      return { label: "审核并批准教案", stage: "review" };
    }
    case "approved":
      return { label: "模拟传输到围裙", stage: "review" };
    case "transferred":
      return { label: "生成模拟课堂记录", stage: "class" };
    case "recorded":
      return { label: "审核课后复盘", stage: "class" };
    default:
      return { label: "查看复盘与档案更新", stage: "class" };
  }
}

export function PhaseTag({ a }: { a: Activity }) {
  const p = activityPhase(a);
  return <Tag tone={PHASE_TONE[p.key]}>{p.label}</Tag>;
}

export function WorkbenchPage() {
  const { data, dispatch } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const child = data.children[0];
  const [title, setTitle] = useState("轮流表达 · 小船找灯塔");
  const [childId, setChildId] = useState(child.id);

  const sorted = [...data.activities].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const resume = sorted.find((a) => activityPhase(a).key !== "reviewed");
  const reviewedCount = child.observations.filter((o) => o.origin.kind === "review").length;

  const create = () => {
    const c = data.children.find((x) => x.id === childId)!;
    const act = newActivity(c, title);
    dispatch({ type: "activity/create", activity: act });
    setOpen(false);
    nav(`/activities/${act.id}/plan?focus=goal`);
  };

  return (
    <>
      <Topbar>
        <div className="crumbs">
          <strong>教学工作台</strong>
        </div>
      </Topbar>
      <div className="page">
        <div className="page-head">
          <div className="grow">
            <h1>你好，老师</h1>
            <p>从儿童档案出发备课，经你审核后再交给围裙。AI 只提供可修改的建议。</p>
          </div>
          <Button variant="primary" size="lg" icon={Plus} onClick={() => setOpen(true)}>
            新建教学活动
          </Button>
        </div>

        <div className="wb-grid">
          <div className="stack" style={{ gap: "var(--s6)" }}>
            {resume ? (
              <ResumeCard a={resume} />
            ) : (
              <div className="panel empty">
                <BookOpen className="ico" />
                <h3>还没有教学活动</h3>
                <p>新建一个活动，系统会带入{child.name}档案中的感官限制。</p>
                <Button variant="primary" icon={Plus} onClick={() => setOpen(true)} style={{ marginTop: 8 }}>
                  新建教学活动
                </Button>
              </div>
            )}

            <section>
              <div className="section-title">
                <h2>最近的教学活动</h2>
                <span className="muted small">{sorted.length} 个</span>
              </div>
              {sorted.length === 0 ? (
                <p className="muted small">创建后会显示在这里。</p>
              ) : (
                <div className="panel list">
                  {sorted.map((a) => {
                    const p = planProgress(a.draft);
                    const n = nextAction(a);
                    const c = data.children.find((x) => x.id === a.childId);
                    return (
                      <Link key={a.id} to={`/activities/${a.id}/${n.stage}`} className="list-row">
                        <div className="grow">
                          <div className="row">
                            <span className="list-title">{a.title}</span>
                            <PhaseTag a={a} />
                          </div>
                          <div className="small muted">
                            {c?.name} · 更新于 {formatTime(a.updatedAt)}
                            {a.versions.length > 0 && ` · ${a.versions.length} 个批准版本`}
                          </div>
                        </div>
                        <div className="list-progress">
                          <span className="small muted num">
                            备课 {p.done}/{p.total}
                          </span>
                          <Progress done={p.done} total={p.total} />
                        </div>
                        <span className="list-next">
                          {n.label}
                          <ChevronRight className="ico" />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="stack" style={{ gap: "var(--s4)" }}>
            <div className="panel panel-pad child-card">
              <div className="row" style={{ gap: 12 }}>
                <div className="avatar" aria-hidden>
                  {child.name.slice(-1)}
                </div>
                <div className="grow">
                  <div className="row">
                    <h2>{child.name}</h2>
                    <Tag>虚构案例</Tag>
                  </div>
                  <div className="small muted">{child.ageLabel}</div>
                </div>
              </div>
              <dl className="kv" style={{ marginTop: 16 }}>
                <dt>沟通</dt>
                <dd>{child.communication[1]}</dd>
                <dt>感官</dt>
                <dd>{child.sensory[0]}</dd>
                <dt>观察记录</dt>
                <dd className="num">
                  {child.observations.length} 条{reviewedCount > 0 && `（${reviewedCount} 条来自复盘）`}
                </dd>
              </dl>
              <div className="row" style={{ marginTop: 16 }}>
                <Link to={`/children/${child.id}`} className="btn btn-secondary btn-sm">
                  <UserRound className="ico" />
                  <span className="btn-label">儿童档案</span>
                </Link>
                <Link to="/records" className="btn btn-ghost btn-sm">
                  <History className="ico" />
                  <span className="btn-label">教学记录</span>
                </Link>
              </div>
            </div>
            <div className="panel panel-pad flow-card">
              <h3>一次完整的教学闭环</h3>
              <ol className="flow">
                <li>
                  <b>课前</b>目标 → 环节 → 故事 → 围裙反馈 → 批准版本
                </li>
                <li>
                  <b>课中</b>教师与儿童使用实体围裙（本原型为模拟记录）
                </li>
                <li>
                  <b>课后</b>复盘草稿 → 教师审核 → 更新档案
                </li>
              </ol>
            </div>
          </aside>
        </div>
      </div>

      <Modal
        open={open}
        title="新建教学活动"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>取消</Button>
            <Button variant="primary" iconRight={ArrowRight} onClick={create} disabled={!title.trim()}>
              创建并开始备课
            </Button>
          </>
        }
      >
        <div className="field">
          <span className="field-label">儿童</span>
          <div className="choice-list" role="radiogroup" aria-label="选择儿童">
            {data.children.map((c) => (
              <label key={c.id} className={`choice ${childId === c.id ? "on" : ""}`}>
                <input type="radio" name="child" checked={childId === c.id} onChange={() => setChildId(c.id)} />
                <span className="avatar sm" aria-hidden>
                  {c.name.slice(-1)}
                </span>
                <span className="grow">
                  <b>{c.name}</b>
                  <span className="small muted"> · {c.ageLabel}</span>
                </span>
                <Tag>虚构</Tag>
              </label>
            ))}
          </div>
        </div>
        <TextInput label="活动名称" value={title} onChange={setTitle} data-autofocus />
        <p className="small muted">将自动带入档案中的感官限制（避免突然的大音量、允许暂停），你可以在备课时修改。</p>
      </Modal>
    </>
  );
}

function ResumeCard({ a }: { a: Activity }) {
  const p = planProgress(a.draft);
  const n = nextAction(a);
  const phase = activityPhase(a);
  return (
    <div className="panel resume">
      <div className="resume-body">
        <div className="eyebrow">{phase.key === "planning" ? "继续未完成的草稿" : "继续当前活动"}</div>
        <div className="row" style={{ marginTop: 6 }}>
          <h2 className="resume-title">{a.title}</h2>
          <PhaseTag a={a} />
        </div>
        <div className="resume-meta small muted">
          目标：{a.draft.goal.text || "尚未填写"} · 更新于 {formatTime(a.updatedAt)}
        </div>
        <div className="resume-progress">
          <Progress done={p.done} total={p.total} label="备课进度" />
          <span className="small muted num">
            备课 {p.done}/{p.total} 项已确认
          </span>
        </div>
      </div>
      <div className="resume-action">
        <span className="small muted">下一步</span>
        <Link to={`/activities/${a.id}/${n.stage}`} className="btn btn-primary btn-md">
          <span className="btn-label">{n.label}</span>
          <ArrowRight className="ico" />
        </Link>
      </div>
    </div>
  );
}
