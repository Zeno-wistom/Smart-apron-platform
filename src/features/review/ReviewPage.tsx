import { ArrowRight, Cable, Check, CheckCircle2, ClipboardCheck, FileClock, Send } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { Button } from "../../components/ui/Button";
import { Badge, Notice, SimulationBadge } from "../../components/ui/Feedback";
import { createId } from "../../domain/fixtures";
import { getApprovalBlockers, hasCurrentApproval, isSessionContentLocked } from "../../domain/selectors";
import type { LessonSession } from "../../domain/types";
import { createSimulatedClassRecord } from "../../services/mockClassroom";
import { mockDevice } from "../../services/mockDevice";
import { LessonSummary } from "./LessonSummary";
import "./review.css";

export function ReviewPage() {
  const session = useOutletContext<LessonSession>();
  const { update } = useApp();
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const blockers = getApprovalBlockers(session);
  const approved = hasCurrentApproval(session);
  const approvalStale = Boolean(session.approval && !approved);
  const locked = isSessionContentLocked(session);
  const transferError = error ?? (session.transmission.status === "failure" ? session.transmission.message : undefined);

  function approveLesson() {
    update({
      type: "session/approve",
      sessionId: session.id,
      snapshotId: createId("snapshot"),
      approvedAt: new Date().toISOString(),
      skipHistory: true,
    });
    setConnected(false);
    setError(undefined);
    setNotice("本版教案已批准并生成独立快照。接下来仅为模拟设备流程。 ");
  }

  async function connectDevice() {
    if (!approved || locked) return;
    const baseRevision = session.planRevision;
    setConnecting(true);
    setError(undefined);
    const result = await mockDevice.connect();
    if (sessionRef.current.planRevision !== baseRevision) {
      setError("连接期间教案已变化，请重新批准后再操作。 ");
      setConnecting(false);
      return;
    }
    setConnected(result.ok);
    setNotice(result.message);
    setConnecting(false);
  }

  async function transferLesson() {
    if (!session.approval || !approved || locked) return;
    const baseRevision = session.planRevision;
    const approvalId = session.approval.id;
    setTransferring(true);
    setError(undefined);
    setNotice(undefined);
    const result = await mockDevice.transfer(session.approval);
    if (
      sessionRef.current.planRevision !== baseRevision ||
      sessionRef.current.approval?.id !== approvalId
    ) {
      setError("传输期间教案版本已变化，本次结果未应用。请重新审核。 ");
      setTransferring(false);
      return;
    }
    update({
      type: "transmission/result",
      sessionId: session.id,
      status: result.ok ? "success" : "failure",
      message: result.message,
      skipHistory: true,
    });
    if (result.ok) setNotice(result.message);
    else setError(result.message);
    setTransferring(false);
  }

  function createRecord() {
    try {
      const record = createSimulatedClassRecord(session);
      update({ type: "class-record/create", sessionId: session.id, record, skipHistory: true });
      navigate(`/records/${session.id}`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "无法生成模拟课堂记录。 ");
    }
  }

  return (
    <div className="review-page">
      <div className="workspace-toolbar">
        <div><h2>审核并完成课前最后一步</h2><p>先核对完整教案并批准当前版本，然后连接模拟围裙并模拟传输。</p></div>
        <SimulationBadge label="无真实硬件通信" />
      </div>
      {approvalStale && <Notice variant="warning" title="教案在批准后发生过修改">原批准快照保留但已失效。请检查当前内容并重新批准。</Notice>}
      {notice && <Notice variant="success">{notice}</Notice>}
      {locked && <Notice variant="success" title="模拟传输已完成">课程内容已只读。下一步可生成明确标注的模拟课堂记录。</Notice>}

      <div className="review-layout">
        <LessonSummary session={session} />
        <aside className="review-side">
          <section className="panel approval-panel">
            <div className="panel-header"><div><h2>批准检查</h2><p>教案版本 {session.planRevision}</p></div>{approved ? <Badge variant="success">已批准</Badge> : <Badge>待批准</Badge>}</div>
            <div className="panel-body">
              {approved ? (
                <div className="approval-success"><CheckCircle2 aria-hidden="true" /><div><strong>当前版本满足批准条件</strong><p>快照：{session.approval?.id.slice(0, 24)}…</p></div></div>
              ) : blockers.length > 0 ? (
                <div className="blocker-list"><strong>还需完成 {blockers.length} 项</strong><ul>{blockers.map((item) => <li key={item}>{item}</li>)}</ul></div>
              ) : (
                <div className="approval-success"><ClipboardCheck aria-hidden="true" /><div><strong>可以批准本版教案</strong><p>批准会保留目标、步骤、故事和配置的独立快照。</p></div></div>
              )}
              {!approved && <Button full variant="primary" disabled={blockers.length > 0 || locked} icon={<Check aria-hidden="true" />} onClick={approveLesson}>批准本版教案</Button>}
              {!locked && <Link className="review-edit-link" to={`/sessions/${session.id}/plan`}>返回备课修改</Link>}
            </div>
          </section>

          <section className="panel device-panel">
            <div className="panel-header"><div><h2>模拟设备与传输</h2><p>仅验证界面流程和状态变化</p></div><SimulationBadge /></div>
            <div className="panel-body form-stack">
              <div className="simulated-device-card"><Cable aria-hidden="true" /><div><strong>模拟围裙</strong><p>{locked ? "模拟传输完成" : connected ? "模拟连接就绪" : "尚未进入模拟连接状态"}</p></div><span className={connected || locked ? "device-dot online" : "device-dot"} /></div>
              {transferError && <Notice variant="error" title="模拟传输未完成">{transferError}</Notice>}
              {session.transmission.status === "success" && <Notice variant="success" title="模拟回执">{session.transmission.message}</Notice>}

              {approved && !locked && !connected && <Button full loading={connecting} icon={<Cable aria-hidden="true" />} onClick={connectDevice}>连接模拟围裙</Button>}
              {approved && !locked && connected && <Button full variant="primary" loading={transferring} icon={<Send aria-hidden="true" />} onClick={transferLesson}>{session.transmission.status === "failure" ? "重试模拟传输" : "模拟传输本版教案"}</Button>}
              {!approved && <Button full disabled>批准后进入模拟传输</Button>}
              {session.transmission.attempts > 0 && !locked && <p className="small-text">已尝试 {session.transmission.attempts} 次；失败不会清除批准教案。</p>}

              {locked && !session.classRecord && <Button full variant="primary" icon={<FileClock aria-hidden="true" />} onClick={createRecord}>生成本次模拟课堂记录</Button>}
              {session.classRecord && <Link className="button button-primary button-full" to={`/records/${session.id}`}>查看模拟课堂记录<ArrowRight aria-hidden="true" /></Link>}
              <p className="device-boundary">不连接蓝牙、串口或真实围裙，不采集音频、视频、EEG 或 fNIRS。</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
