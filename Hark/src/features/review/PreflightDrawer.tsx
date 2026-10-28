import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../app/store";
import { Button, Modal, InlineError } from "../../components/ui";
import {
  preflightIssues,
  issueGroup,
  PREFLIGHT_GROUPS,
} from "../../domain/preflight";
import type { IssueTarget } from "../../domain/checks";
import type { Activity } from "../../domain/types";
import { cueById } from "../../domain/fixtures";
import { cueMatch } from "../../domain/cueMatch";
import { prepareLesson } from "../../services/prepareLesson";

export function PreflightDrawer({
  activity,
  open,
  onClose,
  onDocument,
}: {
  activity: Activity;
  open: boolean;
  onClose: () => void;
  onDocument: () => void;
}) {
  const store = useStore(),
    nav = useNavigate();
  const d = activity.draft;
  const [checked, setChecked] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const running = useRef(false);
  const issues = preflightIssues(d),
    blocks = issues.filter((i) => i.severity === "block");
  const version = activity.versions.at(-1),
    success =
      activity.draftLocked &&
      [...activity.transfers]
        .reverse()
        .find((t) => t.versionId === version?.id && t.ok);
  const acknowledged = checked === d.revision;
  const fix = (t: IssueTarget) => {
    onClose();
    let focus =
      t.stage === "plan"
        ? t.focus === "step"
          ? `step-${t.stepId}`
          : t.focus
        : "goal";
    if (t.stage === "story" && t.sceneId) {
      const sc = d.story?.scenes.find((sc) => sc.id === t.sceneId);
      if (sc) focus = `step-${sc.stepId}`;
    }
    nav(
      `/activities/${activity.id}/plan?focus=${focus}${t.stage === "story" && t.focus === "story" ? "&panel=story" : ""}`,
    );
    // Focus the repaired section after the overlay releases its focus trap.
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(
        focus.startsWith("step-")
          ? "#step-title"
          : focus === "constraints"
            ? "#constraints input"
            : "#goal-text",
      );
      target?.focus();
      target?.scrollIntoView({ block: "center" });
    }, 60);
  };
  const prepare = async () => {
    if (
      running.current ||
      !acknowledged ||
      (!activity.draftLocked && blocks.length)
    )
      return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await prepareLesson(
        {
          latest: store.latest,
          dispatch: store.dispatch,
          persist: store.saveNow,
        },
        activity.id,
        d.revision,
      );
      store.toast("已准备好上课 · 模拟传输完成", "success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      drawer
      width={560}
      open={open}
      title="课前检查"
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <div className="preflight-footer">
          {success ? (
            <>
              <p className="notice notice-ok" data-testid="receipt">
                已传输 v{version?.versionNo} · {success.receipt?.receiptId}
              </p>
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  nav(`/activities/${activity.id}/class`);
                }}
              >
                进入课堂与复盘
              </Button>
            </>
          ) : (
            <>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  disabled={busy}
                  onChange={(e) =>
                    setChecked(e.target.checked ? d.revision : null)
                  }
                />
                我已核对教案、完整故事和所有围裙提示，同意按此快照准备上课。
              </label>
              {blocks.length > 0 && !activity.draftLocked && (
                <p className="warn-ink">
                  先处理 {blocks.length} 项阻断问题，再准备上课。
                </p>
              )}
              <Button
                variant="primary"
                disabled={
                  !acknowledged || (!activity.draftLocked && blocks.length > 0)
                }
                loading={busy}
                onClick={prepare}
                data-testid="prepare-lesson"
              >
                {busy
                  ? "正在保存并模拟传输…"
                  : activity.draftLocked
                    ? `重试准备上课 · v${version?.versionNo}`
                    : `批准 v${activity.versions.length + 1} 并准备上课`}
              </Button>
            </>
          )}
          {error && <InlineError text={error} onRetry={prepare} />}
        </div>
      }
    >
      <p className="small muted">
        这是本课的最终知情审核。AI、围裙和课堂均为本地模拟；不会发送到真实设备。
      </p>
      <Button
        variant="ghost"
        onClick={() => {
          onClose();
          onDocument();
        }}
      >
        查看完整教案与历史版本
      </Button>
      {PREFLIGHT_GROUPS.map((group, index) => (
        <section className="preflight-group" key={group}>
          <h3>
            {index + 1}. {group}
          </h3>
          {index === 0 && (
            <>
              <p>{d.goal.text || "尚未填写目标"}</p>
              <p className="muted">{d.goal.observe}</p>
            </>
          )}
          {index === 1 && (
            <p>
              {d.steps.length} 个环节 · 共{" "}
              {d.steps.reduce((n, s) => n + s.fields.minutes, 0)} 分钟
            </p>
          )}
          {index === 2 && (
            <p>
              {d.story?.title || "尚无故事"} · {d.story?.scenes.length ?? 0} 幕{" "}
              <Button
                variant="quiet"
                size="sm"
                onClick={() => fix({ stage: "story", focus: "story" })}
              >
                通读完整故事线
              </Button>
            </p>
          )}
          {index === 3 && (
            <>
              <p>
                {d.constraints.map((c) => c.text).join("；") ||
                  "未设置限制，请人工核对"}
              </p>
              {d.story?.scenes.map((sc) => {
                const match = cueMatch(
                  sc,
                  d.steps.find((s) => s.id === sc.stepId)?.role ?? "practice",
                  d.constraints,
                );
                return (
                  <div className="preflight-cues" key={sc.id}>
                    <b>{sc.title}</b>
                    <p>
                      {sc.cueIds
                        .map((id) => {
                          const cue = cueById(id);
                          return cue
                            ? `${cue.name}（${cue.channel === "sound" ? "声音" : "视觉"}，${cue.trigger === "auto" ? "自动" : "教师触发"}）`
                            : `未知提示 ${id}`;
                        })
                        .join("、") || "无提示"}
                      ；{sc.node.allowPause ? "允许暂停" : "不允许暂停"}
                    </p>
                    {match.suppressed.length > 0 && (
                      <details>
                        <summary>
                          因限制未采用 {match.suppressed.length} 条
                        </summary>
                        {match.suppressed.map((c) => (
                          <p key={c.id}>
                            {cueById(c.id)?.name}：{c.reason}
                          </p>
                        ))}
                      </details>
                    )}
                  </div>
                );
              })}
            </>
          )}
          {index === 4 && (
            <p>
              将冻结为 v
              {activity.draftLocked
                ? version?.versionNo
                : activity.versions.length + 1}
              ，包含目标、限制、{d.steps.length} 个环节与{" "}
              {d.story?.scenes.length ?? 0}{" "}
              个场景。批准快照保存成功后才开始模拟传输。
            </p>
          )}
          {issues
            .filter((i) => issueGroup(i.id) === index)
            .map((i) => (
              <div
                className={
                  i.severity === "block" ? "check-issue block" : "check-issue"
                }
                key={i.id}
              >
                <span>
                  {i.severity === "block" ? "待处理" : "提醒"}：{i.text}
                </span>
                <Button size="sm" onClick={() => fix(i.target)}>
                  去修复
                </Button>
              </div>
            ))}
        </section>
      ))}
    </Modal>
  );
}
