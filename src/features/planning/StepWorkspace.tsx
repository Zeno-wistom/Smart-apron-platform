import {
  ArrowRight,
  Check,
  CircleCheck,
  CircleDashed,
  ListPlus,
  LockKeyhole,
  Plus,
  Sparkles,
  Undo2,
  WandSparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { Button } from "../../components/ui/Button";
import { Badge, EmptyState, Notice, SimulationBadge } from "../../components/ui/Feedback";
import { createId, DEMO_STEP_COUNT } from "../../domain/fixtures";
import { isSessionContentLocked } from "../../domain/selectors";
import type { LessonSession } from "../../domain/types";
import type { GenerationContext, StepSuggestion } from "../../services/contracts";
import { stepFromSuggestion } from "../../services/mappers";
import { mockAi } from "../../services/mockAi";
import { StepEditor } from "./StepEditor";

type GenerationKind = "next" | "complete" | "regenerate";

export function StepWorkspace({ session }: { session: LessonSession }) {
  const { data, update, undo, canUndo } = useApp();
  const child = data.children.find((item) => item.id === session.childId)!;
  const [selectedStepId, setSelectedStepId] = useState<string>();
  const [loadingKind, setLoadingKind] = useState<GenerationKind>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [candidate, setCandidate] = useState<{ stepId: string; suggestion: StepSuggestion }>();
  const requestRef = useRef(0);
  const sessionRef = useRef(session);
  const lastOperationRef = useRef<GenerationKind>("next");
  sessionRef.current = session;

  const locked = isSessionContentLocked(session);
  const selectedStep = session.steps.find((step) => step.id === selectedStepId) ?? session.steps[0];
  const planningDone =
    session.steps.length >= 3 && session.steps.every((step) => step.status === "confirmed");

  useEffect(() => {
    if (session.steps.length === 0) {
      setSelectedStepId(undefined);
      return;
    }
    if (!session.steps.some((step) => step.id === selectedStepId)) {
      setSelectedStepId(session.steps[0].id);
    }
  }, [session.steps, selectedStepId]);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  function makeContext(): GenerationContext {
    return {
      child,
      goalSet: session.goalSet,
      steps: session.steps,
      planRevision: session.planRevision,
    };
  }

  function responseIsCurrent(requestId: number, baseRevision: number): boolean {
    if (requestId !== requestRef.current) return false;
    if (sessionRef.current.planRevision !== baseRevision) {
      setNotice("生成期间教案发生变化，本次结果已作为过期候选丢弃。教师当前内容未受影响。 ");
      return false;
    }
    return true;
  }

  async function runGeneration(kind: GenerationKind) {
    if (locked) return;
    const requestId = ++requestRef.current;
    const baseRevision = session.planRevision;
    const targetStepId = selectedStep?.id;
    lastOperationRef.current = kind;
    setLoadingKind(kind);
    setError(undefined);
    setNotice(undefined);
    setInfo(undefined);
    try {
      if (kind === "next") {
        const suggestion = await mockAi.generateNextStep(makeContext());
        if (!responseIsCurrent(requestId, baseRevision)) return;
        const step = stepFromSuggestion(suggestion);
        update({ type: "steps/append", sessionId: session.id, steps: [step] });
        setSelectedStepId(step.id);
        setInfo("已添加一个模拟草案。请编辑并确认后，再生成下一步。 ");
      }
      if (kind === "complete") {
        const suggestions = await mockAi.completeRemainingSteps(makeContext());
        if (!responseIsCurrent(requestId, baseRevision)) return;
        const additions = suggestions.map(stepFromSuggestion);
        if (additions.length === 0) {
          setInfo("当前没有需要补全的模拟环节，已有内容未改变。 ");
        } else {
          update({ type: "steps/append", sessionId: session.id, steps: additions });
          setSelectedStepId(additions[0].id);
          setInfo(`已补全 ${additions.length} 个草案；原有草案和已确认步骤均未改动。`);
        }
      }
      if (kind === "regenerate") {
        const target = session.steps.find((step) => step.id === targetStepId);
        if (!target) throw new Error("请先选择要重新生成的环节。 ");
        const suggestion = await mockAi.regenerateStep(makeContext(), target);
        if (!responseIsCurrent(requestId, baseRevision)) return;
        setCandidate({ stepId: target.id, suggestion });
        setInfo("备选建议已生成。只有点击“采用候选”才会替换当前草案。 ");
      }
    } catch (reason: unknown) {
      if (requestId === requestRef.current) {
        setError(reason instanceof Error ? reason.message : "模拟生成失败，请重试。 ");
      }
    } finally {
      if (requestId === requestRef.current) setLoadingKind(undefined);
    }
  }

  function addCustomStep() {
    const step = {
      id: createId("step"),
      title: "",
      teacherInstruction: "",
      interaction: "",
      note: "",
      status: "draft" as const,
      source: "custom" as const,
    };
    update({ type: "steps/append", sessionId: session.id, steps: [step] });
    setSelectedStepId(step.id);
  }

  return (
    <div className="step-workspace-wrap">
      <div className="workspace-toolbar">
        <div>
          <h2>教学环节编排</h2>
          <p>逐个编辑并确认教学环节。至少确认 3 个环节后，可进入故事配置。</p>
        </div>
        <div className="button-row">
          <Button variant="ghost" disabled={!canUndo(session.id)} icon={<Undo2 aria-hidden="true" />} onClick={() => undo(session.id)}>撤销</Button>
          {planningDone && <Link className="button button-primary" to={`/sessions/${session.id}/experience`}>下一步：故事与围裙<ArrowRight aria-hidden="true" /></Link>}
        </div>
      </div>

      {error && <Notice variant="error" title="本次模拟生成未完成" actions={<Button onClick={() => runGeneration(lastOperationRef.current)}>重试当前操作</Button>}>{error}</Notice>}
      {notice && <Notice variant="warning" title="已保护教师当前内容">{notice}</Notice>}
      {info && <Notice variant="success">{info}</Notice>}

      <div className="planning-workspace">
        <aside className="panel step-list-panel">
          <div className="panel-header">
            <div><h2>教学步骤</h2><p>{session.steps.length === 0 ? "还没有环节，先生成或手动添加" : `共 ${session.steps.length} 个环节，已确认 ${session.steps.filter((step) => step.status === "confirmed").length} 个`}</p></div>
            <Badge>{session.steps.length === 0 ? "尚未开始" : session.steps.every((step) => step.status === "confirmed") ? "全部已确认" : `${session.steps.filter((step) => step.status !== "confirmed").length} 个待确认`}</Badge>
          </div>
          <div className="step-list" aria-label="教学步骤列表">
            {session.steps.map((step, index) => (
              <button
                type="button"
                key={step.id}
                className={selectedStep?.id === step.id ? "step-list-item active" : "step-list-item"}
                onClick={() => setSelectedStepId(step.id)}
              >
                <span className="step-list-number">{index + 1}</span>
                <span className="step-list-copy"><strong>{step.title || "未命名环节"}</strong><small>{step.status === "confirmed" ? "已确认" : "草案"}</small></span>
                {step.status === "confirmed" ? <CircleCheck aria-label="已确认" /> : <CircleDashed aria-label="草案" />}
              </button>
            ))}
            {session.steps.length === 0 && <p className="step-list-empty">还没有教学环节。可生成、补全或手动添加。</p>}
          </div>
          <div className="step-list-actions">
            <Button full variant="primary" disabled={locked || session.steps.length >= DEMO_STEP_COUNT} loading={loadingKind === "next"} icon={<Sparkles aria-hidden="true" />} onClick={() => runGeneration("next")}>生成下一步</Button>
            <p className="generation-hint">一键补全只添加缺少的草案，不覆盖已有草案或已确认环节；每个草案仍需教师确认。</p>
            <Button full disabled={locked || session.steps.length >= DEMO_STEP_COUNT} loading={loadingKind === "complete"} icon={<WandSparkles aria-hidden="true" />} onClick={() => runGeneration("complete")}>一键补全剩余</Button>
            <Button full variant="ghost" disabled={locked} icon={<Plus aria-hidden="true" />} onClick={addCustomStep}>手动添加环节</Button>
          </div>
        </aside>

        <div className="step-editor-slot">
            {candidate && candidate.stepId === selectedStep?.id && (
              <article className="candidate-card" aria-label="当前环节的模拟候选">
                <div className="context-section-title"><SimulationBadge label="模拟候选" /><span>不自动覆盖</span></div>
                <h3>候选建议：{candidate.suggestion.title}</h3>
                <p><strong>教师指令：</strong>{candidate.suggestion.teacherInstruction}</p>
                <p><strong>儿童互动与围裙提示：</strong>{candidate.suggestion.interaction || "未提供"}</p>
                <p><strong>教师备注：</strong>{candidate.suggestion.note || "未提供"}</p>
                <p>采用后会替换此环节草案的以上内容；也可以放弃候选，保留当前草案。</p>
                <div className="candidate-actions">
                  <Button variant="primary" icon={<Check aria-hidden="true" />} onClick={() => {
                    update({
                      type: "step/adopt",
                      sessionId: session.id,
                      stepId: candidate.stepId,
                      replacement: stepFromSuggestion(candidate.suggestion),
                    });
                    setSelectedStepId(candidate.stepId);
                    setCandidate(undefined);
                  }}>采用候选</Button>
                  <Button onClick={() => setCandidate(undefined)}>放弃</Button>
                </div>
              </article>
            )}


          {selectedStep ? (
            <StepEditor
              session={session}
              step={selectedStep}
              index={session.steps.findIndex((step) => step.id === selectedStep.id)}
              total={session.steps.length}
              regenerating={loadingKind === "regenerate"}
              onRegenerate={() => runGeneration("regenerate")}
            />
          ) : (
            <section className="panel">
              <EmptyState
                icon={<ListPlus aria-hidden="true" />}
                title="从第一个教学环节开始"
                description="模拟 AI 会携带当前目标、限制和教师备注；生成后可编辑，确认后才锁定。"
                action={<Button variant="primary" loading={loadingKind === "next"} onClick={() => runGeneration("next")}>生成第一个环节</Button>}
              />
            </section>
          )}
        </div>

        <aside className="panel planning-context-panel">
          <div className="panel-header">
            <div><h2>目标与限制</h2><p>所有模拟生成的只读上下文</p></div>
            <LockKeyhole aria-label="已锁定" />
          </div>
          <div className="planning-context-body">
            <section>
              <div className="context-section-title"><h3>已确认教学目标</h3><Badge variant="success">教师已确认</Badge></div>
              <ol className="context-goal-list">{session.goalSet.items.map((goal) => <li key={goal.id}>{goal.text}</li>)}</ol>
            </section>
            <section>
              <h3>儿童限制</h3>
              <ul className="quiet-list">{session.goalSet.constraints.filter((item) => item.text.trim()).map((item) => <li key={item.id}>{item.text}</li>)}</ul>
            </section>
            <section><h3>教师备注</h3><p className="context-note">{session.goalSet.teacherNotes || "未填写备注"}</p></section>
            <Button full disabled={locked} onClick={() => update({ type: "goals/unlock", sessionId: session.id })}>返回修改目标</Button>


            {!candidate && (
              <div className="ai-boundary-note">
                <SimulationBadge label="模拟 AI" />
                <p>每次生成都会携带当前目标、限制、步骤和教案版本。慢响应或失败不会覆盖教师的新编辑。</p>
              </div>
            )}
          </div>
        </aside>
      </div>
      {planningDone && <div className="next-stage"><div><strong>教学环节已确认</strong><p>接下来为这些环节编写故事，并设置模拟围裙反馈。</p></div><Link className="button button-primary" to={`/sessions/${session.id}/experience`}>下一步：故事与围裙<ArrowRight aria-hidden="true" /></Link></div>}
    </div>
  );
}
