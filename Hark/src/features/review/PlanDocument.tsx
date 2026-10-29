import { Eye, Hand, Pause, Volume2 } from "lucide-react";
import { Tag } from "../../components/ui";
import { cueById, ROLE_LABEL } from "../../domain/fixtures";
import type { PlanDraft } from "../../domain/types";
import { KIND_LABEL } from "../plan/GoalEditor";

/** 教案完整阅读视图：用于审核、版本查看与课堂对照。 */
export function PlanDocument({ plan, issueStepIds = new Set<string>() }: { plan: Omit<PlanDraft, "goalOptions" | "storyCandidate">; issueStepIds?: Set<string> }) {
  const total = plan.steps.reduce((n, s) => n + (s.fields.minutes || 0), 0);
  return (
    <article className="doc">
      <section className="doc-sec">
        <div className="doc-label">教学目标</div>
        <p className="doc-goal">{plan.goal.text || <span className="muted">（未填写）</span>}</p>
        {plan.goal.observe && <p className="small muted">记录方式：{plan.goal.observe}</p>}
      </section>
      <section className="doc-sec doc-two">
        <div>
          <div className="doc-label">限制条件</div>
          <ul className="doc-list">
            {plan.constraints.map((c) => (
              <li key={c.id}>
                <Tag tone={c.kind === "free" ? "neutral" : "warn"}>{KIND_LABEL[c.kind]}</Tag> {c.text}
              </li>
            ))}
            {plan.constraints.length === 0 && <li className="muted">无</li>}
          </ul>
        </div>
        <div>
          <div className="doc-label">教师备注</div>
          <p className="small">{plan.notes || <span className="muted">无</span>}</p>
        </div>
      </section>
      <section className="doc-sec">
        <div className="doc-label">
          教学环节 · {plan.steps.length} 个 · 约 {total} 分钟
        </div>
        <ol className="doc-steps">
          {plan.steps.map((s, i) => {
            const interaction = plan.courseFlow?.interactions[s.id];
            const sc = plan.story?.scenes.find((x) => x.stepId === s.id);
            return (
              <li key={s.id} id={`doc-${s.id}`} className={issueStepIds.has(s.id) ? "has-issue" : ""}>
                <div className="doc-step-head">
                  <span className="doc-num">{i + 1}</span>
                  <b className="grow">{s.fields.title || <span className="muted">（空白环节）</span>}</b>
                  <span className="small muted">
                    {ROLE_LABEL[s.role]} · {s.fields.minutes} 分钟
                  </span>
                </div>
                {s.status !== "empty" && (
                  <dl className="doc-kv">
                    <dt>教师引导</dt>
                    <dd>{s.fields.teacherScript}</dd>
                    <dt>儿童互动</dt>
                    <dd>{s.fields.childInteraction}</dd>
                    {s.fields.observe && (
                      <>
                        <dt>观察要点</dt>
                        <dd>{s.fields.observe}</dd>
                      </>
                    )}
                    {interaction && <><dt>故事讲述</dt><dd>{plan.courseFlow?.outline.find(o=>o.id===s.id)?.story ? interaction.narration : '本活动不使用故事'}</dd><dt>围裙互动（模拟）</dt><dd>{interaction.cueIds.map(id=>{const c=cueById(id);return c?`${c.name}（${c.trigger==='teacher'?'教师触发':'自动'}）`:'未知提示';}).join('、')||'不使用反馈'} · {interaction.allowPause?'允许暂停':'未允许暂停'}</dd></>}
                    {sc && (
                      <>
                        <dt>故事场景</dt>
                        <dd>
                          <div>{sc.narration}</div>
                          <div className="small node-line">
                            <Hand className="ico" />
                            {sc.node.prompt}
                            {sc.node.allowPause && (
                              <Tag icon={Pause}>可暂停</Tag>
                            )}
                          </div>
                          {sc.cueIds.length > 0 && (
                            <div className="row row-wrap" style={{ gap: 4, marginTop: 4 }}>
                              {sc.cueIds.map((c) => {
                                const cue = cueById(c);
                                return cue ? (
                                  <Tag key={c} tone={cue.trigger === "auto" ? "warn" : "neutral"} icon={cue.channel === "visual" ? Eye : Volume2}>
                                    {cue.name}
                                  </Tag>
                                ) : null;
                              })}
                            </div>
                          )}
                        </dd>
                      </>
                    )}
                  </dl>
                )}
              </li>
            );
          })}
        </ol>
      </section>
      {plan.courseFlow?.story && <section className="doc-sec"><div className="doc-label">故事《{plan.courseFlow.story.title}》</div><p>{plan.courseFlow.story.summary}</p></section>}
      {plan.story && (
        <section className="doc-sec">
          <div className="doc-label">故事《{plan.story.title}》</div>
          <p className="small">{plan.story.summary}</p>
          <p className="small muted" style={{ marginTop: 4 }}>
            角色：{plan.story.characters.map((c) => `${c.name}（${c.description || "—"}）`).join("；")}
          </p>
        </section>
      )}
    </article>
  );
}
