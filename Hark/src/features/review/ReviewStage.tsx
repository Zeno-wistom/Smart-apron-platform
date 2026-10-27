import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CircleCheck, FileCheck, Link2, Lock, Plug, RotateCw, Send, TriangleAlert, Unplug } from "lucide-react";
import { useStore } from "../../app/store";
import { Button, Modal, SimTag, Tag, cx, formatTime } from "../../components/ui";
import { planIssues, type Issue } from "../../domain/checks";
import { uid } from "../../domain/fixtures";
import type { Activity, ChildProfile, PlanVersion } from "../../domain/types";
import { connectSimulated, transferSimulated } from "../../services/mockDevice";
import { LockedBanner } from "../activity/ActivityPage";
import { PlanDocument } from "./PlanDocument";

export function ReviewStage({ activity }: { activity: Activity; child: ChildProfile }) {
  const [params, setParams] = useSearchParams();
  const latest = activity.versions[activity.versions.length - 1];
  const viewing = activity.versions.find((v) => v.id === params.get("version")) ?? (activity.draftLocked ? latest : undefined);
  const issues = planIssues(activity.draft);

  return (
    <>
      {activity.draftLocked && <LockedBanner a={activity} />}
      <div className="review-layout">
        <main className="review-doc" aria-label="教案全文">
          <div className="review-doc-head">
            <div className="grow">
              <div className="eyebrow">{viewing ? "已批准版本 · 只读快照" : "当前草稿 · 待审核"}</div>
              <div className="row" style={{ marginTop: 2 }}>
                <h1>{activity.title}</h1>
                {viewing ? (
                  <Tag tone="ok" icon={Lock}>
                    v{viewing.versionNo}
                  </Tag>
                ) : (
                  <Tag tone="primary">草稿{activity.draft.basedOnVersionNo ? `（基于 v${activity.draft.basedOnVersionNo}）` : ""}</Tag>
                )}
              </div>
              {viewing && (
                <div className="small muted" style={{ marginTop: 4 }}>
                  批准于 {formatTime(viewing.approvedAt)} · 校验码 <span className="mono">{viewing.checksum}</span>
                </div>
              )}
            </div>
            {activity.versions.length > 0 && (
              <div className="version-switch" role="tablist" aria-label="切换版本">
                {!activity.draftLocked && (
                  <button role="tab" aria-selected={!viewing} className={cx("vs-btn", !viewing && "on")} onClick={() => setParams({})}>
                    草稿
                  </button>
                )}
                {activity.versions.map((v) => (
                  <button key={v.id} role="tab" aria-selected={viewing?.id === v.id} className={cx("vs-btn", viewing?.id === v.id && "on")} onClick={() => setParams({ version: v.id })}>
                    v{v.versionNo}
                  </button>
                ))}
              </div>
            )}
          </div>
          <PlanDocument plan={viewing ? viewing.snapshot : activity.draft} issueStepIds={viewing ? undefined : new Set(issues.flatMap((i) => (i.target.focus === "step" ? [i.target.stepId] : [])))} />
        </main>
        <aside className="review-side">
          {viewing ? <TransferPanel activity={activity} version={viewing} /> : <ApprovePanel activity={activity} issues={issues} />}
          <VersionHistory activity={activity} />
        </aside>
      </div>
    </>
  );
}

function ApprovePanel({ activity, issues }: { activity: Activity; issues: Issue[] }) {
  const nav = useNavigate();
  const { dispatch, toast } = useStore();
  const [open, setOpen] = useState(false);
  const blocks = issues.filter((i) => i.severity === "block");
  const warns = issues.filter((i) => i.severity === "warn");
  const goTo = (i: Issue) => {
    const t = i.target;
    if (t.stage === "plan") nav(`/activities/${activity.id}/plan?focus=${t.focus === "step" ? `step-${t.stepId}` : "goal"}`);
    else nav(`/activities/${activity.id}/story?focus=${t.focus === "scene" ? `scene-${t.sceneId}` : "story"}`);
  };
  const nextNo = activity.versions.length + 1;
  return (
    <div className="side-card">
      <div className="row">
        <FileCheck className="ico muted" />
        <h2 className="grow">审核清单</h2>
        {blocks.length === 0 ? <Tag tone="ok" icon={CircleCheck}>可批准</Tag> : <Tag tone="warn">{blocks.length} 项待处理</Tag>}
      </div>
      {issues.length === 0 ? (
        <p className="small muted" style={{ marginTop: 10 }}>
          目标、环节、故事与反馈都已确认，且没有发现与限制冲突的配置。
        </p>
      ) : (
        <ul className="issues" data-testid="issues">
          {[...blocks, ...warns].map((i) => (
            <li key={i.id} className={cx("issue", i.severity)}>
              <TriangleAlert className="ico" />
              <span className="grow">{i.text}</span>
              <Button size="sm" variant="quiet" onClick={() => goTo(i)}>
                去修改
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="small muted" style={{ marginTop: 12 }}>
        “其他”类限制无法自动检查，请在左侧全文中人工确认。
      </p>
      <Button variant="primary" icon={Lock} disabled={blocks.length > 0} onClick={() => setOpen(true)} style={{ marginTop: 12, width: "100%" }} data-testid="approve">
        批准并保存为 v{nextNo}
      </Button>
      <Modal
        open={open}
        title={`批准教案 v${nextNo}？`}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>再看看</Button>
            <Button
              variant="primary"
              icon={Lock}
              onClick={() => {
                dispatch({ type: "plan/approve", activityId: activity.id, versionId: uid("ver"), at: new Date().toISOString() });
                setOpen(false);
                toast(`已批准并保存 v${nextNo}，内容已锁定`, "success");
              }}
              data-testid="approve-confirm"
            >
              确认批准
            </Button>
          </>
        }
      >
        <p>批准后将保存一份不可修改的教案快照 v{nextNo}。之后的传输、课堂记录与复盘都引用这个版本。</p>
        <p className="small muted">如需调整，可以“基于 v{nextNo} 继续修订”，生成新的草稿；v{nextNo} 本身不会改变。</p>
        {warns.length > 0 && (
          <div className="notice notice-warn">
            <TriangleAlert className="ico" />
            <span>仍有 {warns.length} 条提醒（不阻止批准）。</span>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TransferPanel({ activity, version }: { activity: Activity; version: PlanVersion }) {
  const { dispatch, toast } = useStore();
  const nav = useNavigate();
  const [conn, setConn] = useState<"off" | "connecting" | "on">("off");
  const [sending, setSending] = useState(false);
  const attempts = activity.transfers.filter((t) => t.versionId === version.id).slice().reverse();
  const success = attempts.find((t) => t.ok);
  const last = attempts[0];
  const isLatest = activity.versions[activity.versions.length - 1]?.id === version.id;

  const connect = async () => {
    setConn("connecting");
    await connectSimulated();
    setConn("on");
  };
  const send = async () => {
    setSending(true);
    const attempt = await transferSimulated(version);
    dispatch({ type: "transfer/record", activityId: activity.id, attempt });
    setSending(false);
    toast(attempt.ok ? `v${version.versionNo} 模拟传输完成` : "模拟传输失败，可重试", attempt.ok ? "success" : "error");
  };

  return (
    <div className="side-card">
      <div className="row">
        <Send className="ico muted" />
        <h2 className="grow">传输到围裙</h2>
        <SimTag />
      </div>
      <p className="small muted" style={{ marginTop: 6 }}>
        真实围裙接口尚未确认。这里模拟连接与传输流程，不会向任何设备发送数据。
      </p>

      <div className="device">
        <span className={cx("device-dot", conn)} aria-hidden />
        <span className="grow small">
          {conn === "on" ? "模拟围裙 · 已连接（模拟）" : conn === "connecting" ? "正在连接模拟围裙…" : "未连接"}
        </span>
        {conn === "on" ? (
          <Button size="sm" variant="ghost" icon={Unplug} onClick={() => setConn("off")}>
            断开
          </Button>
        ) : (
          <Button size="sm" icon={Plug} loading={conn === "connecting"} onClick={connect} sim data-testid="connect">
            连接
          </Button>
        )}
      </div>

      <Button
        variant="primary"
        icon={last && !last.ok ? RotateCw : Send}
        disabled={conn !== "on" || sending}
        loading={sending}
        onClick={send}
        style={{ width: "100%", marginTop: 12 }}
        data-testid="transfer"
        sim
      >
        {sending ? "传输中…" : last && !last.ok ? `重试传输 v${version.versionNo}` : success ? `再次传输 v${version.versionNo}` : `传输 v${version.versionNo}`}
      </Button>

      {last && !last.ok && (
        <div className="notice notice-warn" role="alert" style={{ marginTop: 12 }}>
          <TriangleAlert className="ico" />
          <span>{last.message}</span>
        </div>
      )}

      {success?.receipt && (
        <div className="receipt" data-testid="receipt">
          <div className="row">
            <CircleCheck className="ico ok-ink" />
            <b className="grow">模拟回执</b>
            <SimTag />
          </div>
          <dl className="kv" style={{ marginTop: 8 }}>
            <dt>回执号</dt>
            <dd className="mono">{success.receipt.receiptId}</dd>
            <dt>教案版本</dt>
            <dd>v{success.versionNo}</dd>
            <dt>校验码</dt>
            <dd className="mono">{success.receipt.checksum}</dd>
            <dt>内容</dt>
            <dd>
              {success.receipt.stepCount} 个环节 · {success.receipt.sceneCount} 个场景
            </dd>
            <dt>时间</dt>
            <dd>{formatTime(success.at)}</dd>
          </dl>
        </div>
      )}

      {attempts.length > 0 && (
        <details className="attempts">
          <summary className="small">传输记录（{attempts.length} 次）</summary>
          <ul>
            {attempts.map((t) => (
              <li key={t.id} className="small">
                {t.ok ? <CircleCheck className="ico ok-ink" /> : <TriangleAlert className="ico warn-ink" />}
                <span className="grow">{t.ok ? "成功" : "失败"}</span>
                <span className="muted num">{formatTime(t.at)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {success && isLatest && (
        <Button variant="secondary" iconRight={ArrowRight} style={{ width: "100%", marginTop: 12 }} onClick={() => nav(`/activities/${activity.id}/class`)} data-testid="goto-class">
          前往课堂与复盘
        </Button>
      )}
    </div>
  );
}

function VersionHistory({ activity }: { activity: Activity }) {
  if (activity.versions.length === 0) return null;
  return (
    <div className="side-card">
      <div className="row">
        <Link2 className="ico muted" />
        <h2 className="grow">版本关联</h2>
      </div>
      <ul className="versions">
        {[...activity.versions].reverse().map((v) => {
          const tx = activity.transfers.filter((t) => t.versionId === v.id && t.ok).length;
          const ses = activity.sessions.filter((s) => s.versionId === v.id).length;
          return (
            <li key={v.id}>
              <Tag tone="ok" icon={Lock}>
                v{v.versionNo}
              </Tag>
              <span className="grow small muted">{formatTime(v.approvedAt)}</span>
              <span className="small">
                传输 {tx} · 课堂 {ses}
              </span>
            </li>
          );
        })}
      </ul>
      {!activity.draftLocked && <p className="small muted">当前草稿修订中，以上版本保持不变。</p>}
    </div>
  );
}
