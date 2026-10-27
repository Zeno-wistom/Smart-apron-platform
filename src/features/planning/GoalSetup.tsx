import { Check, Lightbulb, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../../app/AppProvider";
import { Button } from "../../components/ui/Button";
import { EmptyState, Notice, SimulationBadge } from "../../components/ui/Feedback";
import { createId } from "../../domain/fixtures";
import type { LessonSession } from "../../domain/types";
import type { GoalSuggestion } from "../../services/contracts";
import { goalFromSuggestion } from "../../services/mappers";
import { mockAi } from "../../services/mockAi";

export function GoalSetup({ session }: { session: LessonSession }) {
  const { data, update } = useApp();
  const child = data.children.find((item) => item.id === session.childId)!;
  const [customGoal, setCustomGoal] = useState("");
  const [suggestions, setSuggestions] = useState<GoalSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [staleNotice, setStaleNotice] = useState<string>();
  const requestRef = useRef(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  async function recommendGoals() {
    const requestId = ++requestRef.current;
    const baseRevision = session.planRevision;
    setLoading(true);
    setError(undefined);
    setStaleNotice(undefined);
    try {
      const result = await mockAi.recommendGoals({ child, goalSet: session.goalSet });
      if (requestId !== requestRef.current) return;
      if (sessionRef.current.planRevision !== baseRevision) {
        setStaleNotice("目标或限制在生成期间发生变化，本次候选已丢弃，请重新生成。 ");
        return;
      }
      setSuggestions(result);
    } catch (reason: unknown) {
      if (requestId === requestRef.current) {
        setError(reason instanceof Error ? reason.message : "模拟生成失败，请重试。 ");
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }

  function addCustomGoal() {
    if (!customGoal.trim()) return;
    update({
      type: "goals/add",
      sessionId: session.id,
      goal: { id: createId("goal"), text: customGoal.trim(), source: "custom" },
    });
    setCustomGoal("");
  }

  return (
    <div className="goal-layout">
      <section className="panel goal-editor">
        <div className="panel-header">
          <div><h2>先确定这节课为什么而教</h2><p>目标、限制和备注确认后，才会成为后续模拟生成的只读上下文。</p></div>
          <span className="goal-count">{session.goalSet.items.length} 个目标</span>
        </div>
        <div className="panel-body form-stack">
          <div className="field">
            <span className="field-label">教学目标</span>
            <p className="field-hint">可从右侧模拟建议加入，也可以直接自定义。建议使用可观察的表述。</p>
            <div className="goal-editor-list">
              {session.goalSet.items.map((goal, index) => (
                <div className="goal-edit-item" key={goal.id}>
                  <span>{index + 1}</span>
                  <input
                    aria-label={`教学目标 ${index + 1}`}
                    value={goal.text}
                    onChange={(event) => update({
                      type: "goals/update",
                      sessionId: session.id,
                      goalId: goal.id,
                      text: event.target.value,
                      historyKey: `goal-${goal.id}`,
                    })}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`删除教学目标 ${index + 1}`}
                    onClick={() => update({ type: "goals/remove", sessionId: session.id, goalId: goal.id })}
                  ><Trash2 aria-hidden="true" /></button>
                </div>
              ))}
            </div>
            <div className="custom-goal-row">
              <input
                aria-label="自定义教学目标"
                placeholder="例如：在视觉提示下完成两次轮流表达"
                value={customGoal}
                onChange={(event) => setCustomGoal(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addCustomGoal();
                }}
              />
              <Button icon={<Plus aria-hidden="true" />} disabled={!customGoal.trim()} onClick={addCustomGoal}>添加目标</Button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="goal-constraints">儿童限制与教学边界</label>
            <textarea
              id="goal-constraints"
              value={session.goalSet.constraints.map((item) => item.text).join("\n")}
              onChange={(event) => update({
                type: "goals/update-details",
                sessionId: session.id,
                constraintText: event.target.value,
                historyKey: "goal-constraints",
              })}
            />
            <p className="field-hint">每行一条。确认后，后续模拟生成必须继承，不能由 AI 删除。</p>
          </div>

          <div className="field">
            <label htmlFor="goal-notes">教师备注</label>
            <textarea
              id="goal-notes"
              value={session.goalSet.teacherNotes}
              onChange={(event) => update({
                type: "goals/update-details",
                sessionId: session.id,
                teacherNotes: event.target.value,
                historyKey: "goal-notes",
              })}
            />
          </div>

          <Notice variant="info" title="教师拥有最终决定权">
            确认只锁定当前版本。之后仍可点击“返回修改目标”显式解锁；任何修改都会让下游内容进入待核对状态。
          </Notice>
          <div className="goal-confirm-row">
            <span className="small-text">下一步：逐步编排教学环节</span>
            <Button
              variant="primary"
              icon={<Check aria-hidden="true" />}
              disabled={!session.goalSet.items.some((goal) => goal.text.trim())}
              onClick={() => update({ type: "goals/confirm", sessionId: session.id })}
            >确认目标与限制</Button>
          </div>
        </div>
      </section>

      <aside className="panel goal-ai-panel">
        <div className="panel-header">
          <div><h2>教学目标建议</h2><p>基于小舟的虚构档案与教师上下文</p></div>
          <SimulationBadge label="模拟 AI" />
        </div>
        <div className="goal-ai-body">
          {error && <Notice variant="error" title="生成未完成" actions={<Button onClick={recommendGoals}>重试</Button>}>{error}</Notice>}
          {staleNotice && <Notice variant="warning">{staleNotice}</Notice>}
          {suggestions.length === 0 && !loading ? (
            <EmptyState
              icon={<Lightbulb aria-hidden="true" />}
              title="获取三个目标候选"
              description="结果来自本地固定模板，不调用真实模型。你可以加入、修改或忽略。"
              action={<Button variant="primary" icon={<Sparkles aria-hidden="true" />} onClick={recommendGoals}>模拟推荐教学目标</Button>}
            />
          ) : (
            <div className="goal-suggestions" aria-busy={loading}>
              {suggestions.map((suggestion) => {
                const added = session.goalSet.items.some((goal) => goal.text === suggestion.text);
                return (
                  <article key={suggestion.id}>
                    <div className="suggestion-label"><SimulationBadge /><span>候选目标</span></div>
                    <h3>{suggestion.text}</h3>
                    <p>{suggestion.rationale}</p>
                    <Button
                      full
                      disabled={added}
                      icon={added ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                      onClick={() => update({ type: "goals/add", sessionId: session.id, goal: goalFromSuggestion(suggestion) })}
                    >{added ? "已加入目标" : "加入并编辑"}</Button>
                  </article>
                );
              })}
              <Button loading={loading} onClick={recommendGoals}>重新获取候选</Button>
            </div>
          )}
          {loading && suggestions.length === 0 && (
            <div className="loading-block" role="status"><span className="skeleton" /><span className="skeleton" /><p>正在根据虚构档案生成模拟建议…</p></div>
          )}
        </div>
      </aside>
    </div>
  );
}
