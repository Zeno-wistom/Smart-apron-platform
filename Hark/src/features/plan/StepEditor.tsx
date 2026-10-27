import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCheck, Lock, LockOpen, RefreshCw, Sparkles, Trash2, TriangleAlert, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRequests, useStore } from "../../app/store";
import { useAi } from "../../app/useAi";
import { Button, InlineError, Modal, Pending, SimTag, SourceTag, StatusTag, Tag, TextArea, cx } from "../../components/ui";
import { ROLE_LABEL } from "../../domain/fixtures";
import { adoptRejection, stepHasContent, stepReadyToConfirm } from "../../domain/reducer";
import type { Activity, ChildProfile, Step, StepFields } from "../../domain/types";

const FIELD_LABEL: Record<Exclude<keyof StepFields, "minutes">, string> = {
  title: "环节标题",
  teacherScript: "教师引导语",
  childInteraction: "儿童互动",
  observe: "观察要点",
};
const FIELDS = Object.keys(FIELD_LABEL) as (keyof typeof FIELD_LABEL)[];

const ROLE_HINT: Record<Step["role"], string> = {
  warmup: "进入情境，建立注意，不要求表达。",
  model: "教师先示范目标行为，让“轮到谁”变得可预测。",
  practice: "核心练习：给儿童真正的表达机会，记录提示层级。",
  fade: "在儿童准备好时减少提示，观察是否仍能参与。",
  review: "平静收尾，回顾故事，为下次课留下线索。",
};

export function StepEditor({
  activity,
  step,
  index,
  onGo,
}: {
  activity: Activity;
  child: ChildProfile;
  step: Step;
  index: number;
  onGo: (f: string) => void;
}) {
  const { dispatch } = useStore();
  const { pending, errors, clearError, cancel } = useRequests();
  const ai = useAi(activity.id);
  const nav = useNavigate();
  const d = activity.draft;
  const id = activity.id;
  const locked = activity.draftLocked;
  const confirmed = step.status === "confirmed";
  const readOnly = locked || confirmed;
  const key = `step:${step.id}`;
  const busy = pending[key];
  const completing = pending[`complete:${id}`] && step.status === "empty" && !step.candidate;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const prev = d.steps[index - 1];
  const next = d.steps[index + 1];
  const nextOpen = d.steps.find((s, i) => i !== index && (s.status !== "confirmed" || s.needsReview || s.candidate));
  const allDone = d.steps.every((s) => s.status === "confirmed" && !s.needsReview);
  const edit = (patch: Partial<StepFields>) => dispatch({ type: "step/edit", activityId: id, stepId: step.id, patch });

  const goalReady = d.goal.confirmed;
  const canGenerate = goalReady && !readOnly && !busy && !completing;

  const confirmAndNext = () => {
    dispatch({ type: "step/confirm", activityId: id, stepId: step.id });
    const target = d.steps.find((s, i) => i > index && (s.status !== "confirmed" || s.needsReview)) ?? d.steps.find((s, i) => i < index && (s.status !== "confirmed" || s.needsReview));
    if (target) onGo(target.id);
  };

  return (
    <div className="editor-inner">
      <header className="editor-head">
        <div className="grow">
          <div className="eyebrow">
            正在编辑 · 第 {index + 1} / {d.steps.length} 环节 · {ROLE_LABEL[step.role]}
          </div>
          <div className="row" style={{ marginTop: 2 }}>
            <h1 className="ed-title">{step.fields.title || `${ROLE_LABEL[step.role]}环节`}</h1>
            <StatusTag status={step.status} review={!!step.needsReview} />
            {step.status !== "empty" && <SourceTag source={step.source} />}
          </div>
        </div>
        <div className="row">
          {!readOnly && d.steps.length > 1 && <Button variant="ghost" size="sm" icon={Trash2} aria-label="删除此环节" onClick={() => setConfirmDelete(true)} />}
        </div>
      </header>
      <p className="role-hint small muted">{ROLE_HINT[step.role]}</p>

      {step.needsReview && (
        <div className="notice notice-warn" role="status">
          <TriangleAlert className="ico" />
          <span className="grow">
            需复核：{step.needsReview}。本环节基于修改前的目标或限制编写，原内容已保留。
          </span>
          {!locked && (
            <Button size="sm" onClick={() => dispatch({ type: "step/reviewed", activityId: id, stepId: step.id })} data-testid="mark-reviewed">
              内容仍适用
            </Button>
          )}
        </div>
      )}

      {confirmed && !locked && (
        <div className="notice notice-ok">
          <Lock className="ico" />
          <span className="grow">已确认并锁定。AI 不会修改已确认内容。</span>
          <Button size="sm" icon={LockOpen} onClick={() => dispatch({ type: "step/unlock", activityId: id, stepId: step.id })} data-testid="unlock-step">
            解除确认以修改
          </Button>
        </div>
      )}

      <section className={cx("ed-section step-fields", step.candidate && "has-candidate")}>
        <div className="stack">
          {FIELDS.map((f) => (
            <TextArea
              key={f}
              id={`step-${f}`}
              label={FIELD_LABEL[f]}
              value={step.fields[f]}
              onChange={(v) => edit({ [f]: v })}
              readOnly={readOnly}
              minRows={f === "title" ? 1 : 2}
              placeholder={f === "title" ? "简短命名这个环节" : ""}
            />
          ))}
          <div className="field minutes">
            <label className="field-label" htmlFor="step-minutes">
              预计时长
            </label>
            <div className="row">
              <input
                id="step-minutes"
                type="number"
                min={1}
                max={30}
                className="input num"
                style={{ width: 88 }}
                value={step.fields.minutes}
                readOnly={readOnly}
                onChange={(e) => edit({ minutes: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })}
              />
              <span className="small muted">分钟</span>
            </div>
          </div>
        </div>

        {/* AI 区：紧贴正在编辑的字段 */}
        <div className="ai-slot">
          {busy || completing ? (
            <div className="ai-zone compact">
              <Pending label={completing ? "一键补全生成中" : busy!.label} />
              {busy && (
                <Button size="sm" variant="ghost" onClick={() => cancel(key)}>
                  取消
                </Button>
              )}
            </div>
          ) : errors[key] ? (
            <InlineError text={errors[key]!} onRetry={() => ai.generateStep(step.id, step.candidate ? "regenerate" : "generate")} onClose={() => clearError(key)} />
          ) : step.candidate ? (
            <CandidateCard activity={activity} step={step} onRegenerate={() => ai.generateStep(step.id, "regenerate")} />
          ) : !readOnly ? (
            <div className="ai-bar">
              <Sparkles className="ico ai-ink" />
              <span className="grow small">
                {!goalReady
                  ? "确认教学目标后，AI 可以根据目标、限制和前后环节给出建议。"
                  : stepHasContent(step.fields)
                    ? "需要另一种写法？AI 会给出候选，你对比后再决定是否替换。"
                    : "根据本课目标、限制、备注和上一环节生成建议。"}
              </span>
              <Button variant="ai" size="sm" icon={Sparkles} sim disabled={!canGenerate} onClick={() => ai.generateStep(step.id, "generate")} data-testid="gen-step">
                {stepHasContent(step.fields) ? "生成改写建议" : "生成本环节建议"}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <footer className="editor-foot">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => (prev ? onGo(prev.id) : onGo("goal"))}>
          {prev ? `第 ${index} 环节` : "目标与限制"}
        </Button>
        <span className="grow" />
        {!readOnly && (
          <Button
            variant="primary"
            icon={Check}
            disabled={!stepReadyToConfirm(step) || !!step.candidate || step.status !== "draft"}
            title={step.candidate ? "请先处理 AI 候选" : !stepReadyToConfirm(step) ? "请填写标题、教师引导语和儿童互动" : ""}
            onClick={confirmAndNext}
            data-testid="confirm-step"
          >
            {nextOpen ? "确认，前往下一项" : "确认本环节"}
          </Button>
        )}
        {readOnly && allDone ? (
          <Button variant="primary" iconRight={ArrowRight} onClick={() => nav(`/activities/${id}/story`)} data-testid="goto-story">
            前往故事与围裙
          </Button>
        ) : readOnly && nextOpen ? (
          <Button variant="primary" iconRight={ArrowRight} onClick={() => onGo(nextOpen.id)}>
            下一个待处理环节
          </Button>
        ) : (
          next && (
            <Button variant="secondary" iconRight={ArrowRight} onClick={() => onGo(next.id)}>
              第 {index + 2} 环节
            </Button>
          )
        )}
      </footer>

      <Modal
        open={confirmDelete}
        title="删除这个环节？"
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>取消</Button>
            <Button
              variant="danger"
              onClick={() => {
                dispatch({ type: "step/remove", activityId: id, stepId: step.id });
                setConfirmDelete(false);
                onGo((prev ?? next)!.id);
              }}
            >
              删除
            </Button>
          </>
        }
      >
        <p>环节「{step.fields.title || ROLE_LABEL[step.role]}」及其候选会被删除。如果故事中有关联场景，故事会标记为需复核。</p>
      </Modal>
    </div>
  );
}

function CandidateCard({ activity, step, onRegenerate }: { activity: Activity; step: Step; onRegenerate: () => void }) {
  const { dispatch } = useStore();
  const c = step.candidate!;
  const why = adoptRejection(activity.draft, activity.draftLocked, step);
  const hasCurrent = stepHasContent(step.fields);
  const replaced = FIELDS.filter((f) => step.fields[f].trim() && step.fields[f] !== c.fields[f]);
  const id = activity.id;
  const kindLabel = c.kind === "complete" ? "一键补全候选" : c.kind === "regenerate" ? "重新生成的候选" : "AI 候选";

  return (
    <div className="candidate" role="region" aria-label="AI 候选" data-testid="candidate">
      <div className="candidate-head">
        <Sparkles className="ico ai-ink" />
        <h3 className="grow">
          {kindLabel}
          <span className="small muted"> · 尚未写入，采纳后成为草稿</span>
        </h3>
        <SimTag />
      </div>
      <dl className="cand-fields">
        {FIELDS.map((f) => (
          <div key={f} className={cx("cand-row", replaced.includes(f) && "replaces")}>
            <dt>
              {FIELD_LABEL[f]}
              {replaced.includes(f) && <Tag tone="warn">将替换</Tag>}
            </dt>
            <dd>{c.fields[f]}</dd>
          </div>
        ))}
        <div className="cand-row">
          <dt>预计时长</dt>
          <dd>{c.fields.minutes} 分钟</dd>
        </div>
      </dl>
      {why ? (
        <div className="notice notice-warn" style={{ margin: "0 14px 12px" }}>
          <TriangleAlert className="ico" />
          <span>不能采纳：{why}。</span>
        </div>
      ) : (
        hasCurrent &&
        replaced.length > 0 && (
          <p className="small muted cand-note">采纳将替换你当前的 {replaced.length} 处内容。你仍可在采纳后继续修改。</p>
        )
      )}
      <div className="candidate-actions">
        <Button variant="primary" size="sm" icon={CheckCheck} disabled={!!why} onClick={() => dispatch({ type: "step/adopt", activityId: id, stepId: step.id })} data-testid="adopt">
          {hasCurrent ? "采纳并替换" : "采纳为草稿"}
        </Button>
        <Button size="sm" icon={RefreshCw} onClick={onRegenerate} data-testid="regenerate">
          换一个
        </Button>
        <Button size="sm" variant="ghost" icon={X} onClick={() => dispatch({ type: "step/discard", activityId: id, stepId: step.id })} data-testid="discard">
          丢弃
        </Button>
      </div>
    </div>
  );
}
