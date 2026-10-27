import { ArrowDown, ArrowUp, Check, LockKeyhole, RefreshCw, Trash2, UnlockKeyhole } from "lucide-react";
import { useState } from "react";
import { useApp } from "../../app/AppProvider";
import { Button } from "../../components/ui/Button";
import { Badge, Notice } from "../../components/ui/Feedback";
import { Modal } from "../../components/ui/Modal";
import type { LessonSession, LessonStep } from "../../domain/types";

export function StepEditor({
  session,
  step,
  index,
  total,
  onRegenerate,
  regenerating,
}: {
  session: LessonSession;
  step: LessonStep;
  index: number;
  total: number;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const { update } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmed = step.status === "confirmed";
  const locked = session.transmission.status === "success";
  const readOnly = confirmed || locked;

  return (
    <section className="panel step-editor-panel">
      <div className="panel-header step-editor-header">
        <div>
          <div className="step-editor-kicker">环节 {index + 1} / {total}</div>
          <h2>{confirmed ? "已确认教学环节" : "编辑当前教学环节"}</h2>
        </div>
        <Badge variant={confirmed ? "success" : "info"} icon={confirmed ? <LockKeyhole aria-hidden="true" /> : undefined}>
          {confirmed ? "已确认锁定" : step.source === "custom" ? "教师草案" : "模拟 AI 草案"}
        </Badge>
      </div>
      <div className="panel-body form-stack">
        {confirmed && (
          <Notice variant="success" title="此环节已锁定">
            模拟生成不会覆盖它。需要调整时，请先显式点击“返回修改”。
          </Notice>
        )}
        <div className="step-editor-toolbar">
          <div className="button-row">
            <button className="icon-button" type="button" disabled={locked || index === 0} title="上移环节" aria-label="上移环节" onClick={() => update({ type: "step/move", sessionId: session.id, stepId: step.id, direction: -1 })}><ArrowUp aria-hidden="true" /></button>
            <button className="icon-button" type="button" disabled={locked || index === total - 1} title="下移环节" aria-label="下移环节" onClick={() => update({ type: "step/move", sessionId: session.id, stepId: step.id, direction: 1 })}><ArrowDown aria-hidden="true" /></button>
          </div>
          <div className="button-row">
            <Button variant="ghost" disabled={readOnly} loading={regenerating} icon={<RefreshCw aria-hidden="true" />} onClick={onRegenerate}>重新生成候选</Button>
            <Button variant="ghost" disabled={locked} icon={<Trash2 aria-hidden="true" />} onClick={() => setConfirmDelete(true)}>删除</Button>
          </div>
        </div>

        <div className="field">
          <label htmlFor={`step-title-${step.id}`}>环节名称</label>
          <input id={`step-title-${step.id}`} readOnly={readOnly} value={step.title} onChange={(event) => update({ type: "step/update", sessionId: session.id, stepId: step.id, patch: { title: event.target.value }, historyKey: `step-title-${step.id}` })} />
        </div>
        <div className="field">
          <label htmlFor={`step-instruction-${step.id}`}>教师指令</label>
          <textarea id={`step-instruction-${step.id}`} className="tall" readOnly={readOnly} value={step.teacherInstruction} onChange={(event) => update({ type: "step/update", sessionId: session.id, stepId: step.id, patch: { teacherInstruction: event.target.value }, historyKey: `step-instruction-${step.id}` })} />
          <p className="field-hint">写清楚教师实际要做什么、如何等待以及如何调整提示。</p>
        </div>
        <div className="field">
          <label htmlFor={`step-interaction-${step.id}`}>儿童互动与围裙提示建议</label>
          <textarea id={`step-interaction-${step.id}`} readOnly={readOnly} value={step.interaction} onChange={(event) => update({ type: "step/update", sessionId: session.id, stepId: step.id, patch: { interaction: event.target.value }, historyKey: `step-interaction-${step.id}` })} />
        </div>
        <div className="field">
          <label htmlFor={`step-note-${step.id}`}>教师备注</label>
          <textarea id={`step-note-${step.id}`} readOnly={readOnly} value={step.note} onChange={(event) => update({ type: "step/update", sessionId: session.id, stepId: step.id, patch: { note: event.target.value }, historyKey: `step-note-${step.id}` })} />
        </div>

        <div className="step-editor-footer">
          <span className="small-text">{confirmed ? "修改后，故事与围裙配置需要重新核对。" : "确认前请检查目标、限制和互动方式。"}</span>
          {confirmed ? (
            <Button disabled={locked} icon={<UnlockKeyhole aria-hidden="true" />} onClick={() => update({ type: "step/unlock", sessionId: session.id, stepId: step.id })}>返回修改</Button>
          ) : (
            <Button variant="primary" disabled={locked || !step.title.trim() || !step.teacherInstruction.trim()} icon={<Check aria-hidden="true" />} onClick={() => update({ type: "step/confirm", sessionId: session.id, stepId: step.id })}>确认此环节</Button>
          )}
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="删除这个教学环节？"
        description="删除是教师主动修改，不是 AI 操作。"
        footer={<><Button onClick={() => setConfirmDelete(false)}>取消</Button><Button variant="danger" onClick={() => { update({ type: "step/delete", sessionId: session.id, stepId: step.id }); setConfirmDelete(false); }}>确认删除环节</Button></>}
      >
        <p>故事原文会保留，但与该环节有关的下游内容会被标记为待核对，不能直接进入最终批准。</p>
      </Modal>
    </section>
  );
}
