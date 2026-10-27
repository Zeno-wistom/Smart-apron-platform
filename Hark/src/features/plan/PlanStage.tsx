import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CircleDashed, Lock, PencilLine, Plus, Sparkles, Target, TriangleAlert, Wand2 } from "lucide-react";
import { useRequests, useStore } from "../../app/store";
import { useAi } from "../../app/useAi";
import { Button, Progress, SimTag, cx } from "../../components/ui";
import { adoptRejection } from "../../domain/reducer";
import { planProgress } from "../../domain/checks";
import { ROLE_LABEL } from "../../domain/fixtures";
import type { Activity, ChildProfile, Step } from "../../domain/types";
import { GoalEditor } from "./GoalEditor";
import { StepEditor } from "./StepEditor";
import { ContextPanel } from "./ContextPanel";

export type Focus = { kind: "goal" } | { kind: "step"; step: Step; index: number };

export function PlanStage({ activity, child }: { activity: Activity; child: ChildProfile }) {
  const [params, setParams] = useSearchParams();
  const d = activity.draft;
  const raw = params.get("focus");

  const focus: Focus = useMemo(() => {
    if (raw?.startsWith("step-")) {
      const id = raw.slice(5);
      const index = d.steps.findIndex((s) => s.id === id);
      if (index >= 0) return { kind: "step", step: d.steps[index], index };
    }
    if (raw === "goal" || raw === "constraints" || !d.goal.confirmed) return { kind: "goal" };
    const index = Math.max(0, d.steps.findIndex((s) => s.status !== "confirmed" || s.needsReview));
    return { kind: "step", step: d.steps[index], index };
  }, [raw, d.steps, d.goal.confirmed]);

  const go = (f: "goal" | string) => setParams({ focus: f === "goal" ? "goal" : `step-${f}` }, { replace: false });

  const editorRef = useRef<HTMLDivElement>(null);
  const focusKey = focus.kind === "goal" ? "goal" : focus.step.id;
  useEffect(() => {
    editorRef.current?.classList.remove("flash");
    void editorRef.current?.offsetWidth;
    editorRef.current?.classList.add("flash");
  }, [focusKey]);

  return (
    <div className="workspace">
      <Outline activity={activity} focus={focus} onSelect={go} />
      <main className="editor" ref={editorRef} aria-label="当前编辑">
        <BatchPreview activity={activity} />
        {focus.kind === "goal" ? (
          <GoalEditor activity={activity} child={child} onNext={() => go(d.steps[0].id)} />
        ) : (
          <StepEditor key={focus.step.id} activity={activity} child={child} step={focus.step} index={focus.index} onGo={go} />
        )}
      </main>
      <ContextPanel activity={activity} child={child} focus={focus} onEditGoal={() => go("goal")} />
    </div>
  );
}

function Outline({ activity, focus, onSelect }: { activity: Activity; focus: Focus; onSelect: (f: string) => void }) {
  const d = activity.draft;
  const { pending } = useRequests();
  const { dispatch, latest } = useStore();
  const ai = useAi(activity.id);
  const nav = useNavigate();
  const p = planProgress(d);
  const empties = d.steps.filter((s) => s.status === "empty" && !s.candidate);
  const drafts = d.steps.filter((s) => s.status === "draft").length;
  const confirmed = d.steps.filter((s) => s.status === "confirmed").length;
  const completing = pending[`complete:${activity.id}`];
  const locked = activity.draftLocked;
  const goalState = d.goal.confirmed ? "confirmed" : d.goal.text.trim() ? "draft" : "empty";
  const allStepsDone = d.goal.confirmed && d.steps.every((s) => s.status === "confirmed" && !s.needsReview);
  const pendingCandidates = d.steps.filter((s) => s.candidate).length;

  return (
    <aside className="outline" aria-label="教案大纲">
      <div className="outline-head">
        <div className="row">
          <h2 className="grow">教案大纲</h2>
          <span className="small muted num" title="已确认：目标、各环节、故事、围裙反馈">
            {p.done}/{p.total}
          </span>
        </div>
        <Progress done={p.done} total={p.total} label="备课进度" />
      </div>

      <button type="button" className={cx("ol-item", focus.kind === "goal" && "on")} onClick={() => onSelect("goal")} aria-current={focus.kind === "goal" ? "true" : undefined}>
        <span className={cx("ol-badge", `s-${goalState}`)}>
          <Target className="ico" />
        </span>
        <span className="ol-text">
          <span className="ol-title">目标与限制</span>
          <span className="ol-sub">{d.goal.text || "尚未设定目标"}</span>
        </span>
        <OlState status={goalState} />
      </button>

      <div className="ol-group">
        <span className="eyebrow">教学环节</span>
      </div>
      <ol className="ol-steps">
        {d.steps.map((s, i) => {
          const on = focus.kind === "step" && focus.step.id === s.id;
          const busy = pending[`step:${s.id}`] || (completing && s.status === "empty" && !s.candidate);
          return (
            <li key={s.id}>
              <button type="button" className={cx("ol-item", on && "on")} onClick={() => onSelect(s.id)} aria-current={on ? "true" : undefined} data-testid={`ol-step-${i + 1}`}>
                <span className={cx("ol-badge", `s-${s.status}`, s.needsReview && "s-review")}>{i + 1}</span>
                <span className="ol-text">
                  <span className="ol-title">{s.fields.title || <span className="muted">空白 · 待编排</span>}</span>
                  <span className="ol-sub">
                    {ROLE_LABEL[s.role]}
                    {s.fields.minutes ? ` · ${s.fields.minutes} 分钟` : ""}
                  </span>
                </span>
                {busy ? (
                  <span className="ol-state ai" title="AI 生成中（模拟）">
                    <Sparkles className="ico spin-slow" />
                  </span>
                ) : s.candidate ? (
                  <span className="ol-state ai" title="有 AI 候选待审核">
                    <span className="ai-dot" />
                  </span>
                ) : s.needsReview ? (
                  <span className="ol-state warn" title={`需复核：${s.needsReview}`}>
                    <TriangleAlert className="ico" />
                  </span>
                ) : (
                  <OlState status={s.status} />
                )}
              </button>
            </li>
          );
        })}
      </ol>
      {!locked && (
        <Button
          variant="ghost"
          size="sm"
          icon={Plus}
          className="ol-add"
          onClick={() => {
            // 新环节插在“回顾”之前
            const lastStep = d.steps[d.steps.length - 1];
            const afterId = lastStep.role === "review" && d.steps.length > 1 ? d.steps[d.steps.length - 2].id : lastStep.id;
            const beforeIds = new Set(d.steps.map((s) => s.id));
            dispatch({ type: "step/add", activityId: activity.id, afterStepId: afterId });
            const added = latest().activities.find((a) => a.id === activity.id)?.draft.steps.find((s) => !beforeIds.has(s.id));
            if (added) onSelect(added.id);
          }}
        >
          添加环节
        </Button>
      )}

      {!locked && (
        <div className={cx("complete-box", completing && "busy")}>
          <div className="row">
            <Wand2 className="ico ai-ink" />
            <h3 className="grow">一键补全</h3>
            <SimTag />
          </div>
          {!d.goal.confirmed ? (
            <p className="small muted">确认教学目标后可用。</p>
          ) : empties.length === 0 ? (
            <p className="small muted">{pendingCandidates > 0 ? `有 ${pendingCandidates} 个候选待你审核。` : "没有空白环节需要补全。"}</p>
          ) : (
            <p className="small impact" data-testid="complete-impact">
              为 <b>{empties.length}</b> 个空白环节生成候选。
              {(drafts > 0 || confirmed > 0) && (
                <>
                  保留你的 {drafts > 0 && <b>{drafts} 个草稿</b>}
                  {drafts > 0 && confirmed > 0 && "、"}
                  {confirmed > 0 && <b>{confirmed} 个已确认</b>}，
                </>
              )}
              候选可集中预览并采纳为草稿，不会直接确认。
            </p>
          )}
          <Button
            variant="ai"
            size="sm"
            icon={Sparkles}
            loading={!!completing}
            disabled={!d.goal.confirmed || empties.length === 0}
            onClick={() => ai.completeRemaining()}
            data-testid="complete-btn"
          >
            {completing ? "生成中…" : "补全空白环节"}
          </Button>
        </div>
      )}

      {allStepsDone && (
        <Button variant="primary" iconRight={ArrowRight} className="ol-next" onClick={() => nav(`/activities/${activity.id}/story`)}>
          下一步：故事与围裙
        </Button>
      )}
    </aside>
  );
}

function OlState({ status }: { status: "empty" | "draft" | "confirmed" }) {
  if (status === "confirmed")
    return (
      <span className="ol-state ok" title="已确认">
        <Lock className="ico" />
      </span>
    );
  if (status === "draft")
    return (
      <span className="ol-state" title="草稿">
        <PencilLine className="ico" />
      </span>
    );
  return (
    <span className="ol-state faint" title="空白">
      <CircleDashed className="ico" />
    </span>
  );
}

function BatchPreview({ activity }: { activity: Activity }) {
  const { dispatch } = useStore();
  const candidates = activity.draft.steps.filter((step) => step.candidate?.kind === "complete");
  if (!candidates.length) return null;
  const valid = candidates.filter((step) => !adoptRejection(activity.draft, activity.draftLocked, step));
  return <section className="batch-preview" aria-label="一键补全候选预览"><div className="row"><h2 className="grow">一键补全候选 · {candidates.length} 个</h2><SimTag /></div>
    <p className="small muted">请先检查建议；采纳后仍是草稿，需要教师逐项确认。</p>
    <details><summary>查看全部候选内容</summary>{candidates.map((step) => <article key={step.id}><strong>{step.candidate!.fields.title}</strong><p>{step.candidate!.fields.teacherScript}</p><p>{step.candidate!.fields.childInteraction}</p><p>{step.candidate!.fields.observe}</p><p>{step.candidate!.fields.minutes} 分钟</p>{adoptRejection(activity.draft, activity.draftLocked, step) && <p className="warn-ink">不可采纳：{adoptRejection(activity.draft, activity.draftLocked, step)}</p>}</article>)}</details>
    <Button variant="ai" disabled={!valid.length} onClick={() => dispatch({type:"step/adopt-complete",activityId:activity.id})} data-testid="adopt-all-steps">采纳 {valid.length} 个有效候选为草稿</Button>
    {valid.length !== candidates.length && <p className="small warn-ink">{candidates.length - valid.length} 个候选已过期或有冲突，请逐项处理。</p>}
  </section>;
}
