import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronRight, Lock, PencilLine } from "lucide-react";
import { Topbar } from "../../app/Shell";
import { useActivity, useStore } from "../../app/store";
import { Button, Modal, cx } from "../../components/ui";
import { activityPhase, blockingIssues } from "../../domain/checks";
import type { Activity, Stage } from "../../domain/types";
import { PlanStage } from "../plan/PlanStage";
import { StoryStage } from "../story/StoryStage";
import { ReviewStage } from "../review/ReviewStage";
import { ClassStage } from "../class/ClassStage";
import { PhaseTag } from "../workbench/WorkbenchPage";

const STAGES: { key: Stage; label: string; hint: string; phase: "课前" | "课中 · 课后" }[] = [
  { key: "plan", label: "目标与环节", hint: "AI 辅助备课", phase: "课前" },
  { key: "story", label: "故事与围裙", hint: "互动与反馈", phase: "课前" },
  { key: "review", label: "审核与传输", hint: "批准版本", phase: "课前" },
  { key: "class", label: "课堂与复盘", hint: "记录与审核", phase: "课中 · 课后" },
];

function stageState(a: Activity, key: Stage): "done" | "todo" | "locked" {
  const d = a.draft;
  const approved = a.draftLocked && a.versions.length > 0;
  switch (key) {
    case "plan":
      return approved || (d.goal.confirmed && d.steps.every((s) => s.status === "confirmed" && !s.needsReview)) ? "done" : "todo";
    case "story":
      return approved || (d.story?.confirmed && d.story.apronConfirmed && !d.story.needsReview) ? "done" : "todo";
    case "review": {
      const v = a.versions[a.versions.length - 1];
      return approved && v && a.transfers.some((t) => t.versionId === v.id && t.ok) ? "done" : "todo";
    }
    case "class":
      return a.transfers.some((t) => t.ok) ? (a.sessions.some((s) => s.reflection?.status === "reviewed") ? "done" : "todo") : "locked";
  }
}

export function ActivityPage() {
  const { activityId, stage: raw } = useParams();
  const stage = (STAGES.find((s) => s.key === raw)?.key ?? null) as Stage | null;
  const { activity, child } = useActivity(activityId);
  const { dispatch, data } = useStore();
  const nav = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (activity && stage) dispatch({ type: "activity/stage", activityId: activity.id, stage });
  }, [activity?.id, stage, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activity || !child) {
    return data.activities.length ? <Navigate to="/" replace /> : <Navigate to="/" replace />;
  }
  if (!stage) return <Navigate to={`/activities/${activity.id}/${activity.lastStage ?? "plan"}`} replace />;

  const latest = activity.versions[activity.versions.length - 1];
  const phase = activityPhase(activity);
  const blockers = blockingIssues(activity.draft).length;

  return (
    <>
      <Topbar>
        <div className="crumbs">
          <Link to="/">教学工作台</Link>
          <ChevronRight className="ico" />
          <strong>{activity.title}</strong>
          <Button size="sm" variant="ghost" icon={PencilLine} aria-label="重命名活动" onClick={() => (setTitle(activity.title), setRenaming(true))} />
          <PhaseTag a={activity} />
        </div>
      </Topbar>

      <div className="stagebar">
        <div className="stagebar-child">
          <Link to={`/children/${child.id}`} className="child-chip" title="打开儿童档案">
            <span className="avatar xs" aria-hidden>
              {child.name.slice(-1)}
            </span>
            <span>{child.name}</span>
          </Link>
          {activity.draftLocked && latest ? (
            <span className="version-chip locked">
              <Lock className="ico" />
              v{latest.versionNo} 已批准
            </span>
          ) : (
            <span className="version-chip">
              草稿{activity.draft.basedOnVersionNo ? ` v${activity.versions.length + 1}（基于 v${activity.draft.basedOnVersionNo}）` : ""}
            </span>
          )}
        </div>
        <nav className="stages" aria-label="教学活动阶段">
          {STAGES.map((s, i) => {
            const st = stageState(activity, s.key);
            const current = s.key === stage;
            const showPhase = i === 0 || STAGES[i - 1].phase !== s.phase;
            return (
              <div key={s.key} className="stage-wrap">
                {showPhase && <span className="stage-phase">{s.phase}</span>}
                <button
                  type="button"
                  className={cx("stage", current && "current", st === "done" && "done", st === "locked" && "locked")}
                  aria-current={current ? "step" : undefined}
                  disabled={st === "locked"}
                  title={st === "locked" ? "完成一次成功的模拟传输后可用" : s.hint}
                  onClick={() => nav(`/activities/${activity.id}/${s.key}`)}
                >
                  <span className="stage-num">{st === "done" ? <Check className="ico" /> : i + 1}</span>
                  <span className="stage-label">{s.label}</span>
                  {s.key === "review" && !activity.draftLocked && blockers > 0 && stage !== "review" && <span className="stage-count num">{blockers}</span>}
                </button>
                {i < STAGES.length - 1 && <span className="stage-sep" aria-hidden />}
              </div>
            );
          })}
        </nav>
        <span className="sr-only">当前状态：{phase.label}</span>
      </div>

      {activity.draftLocked && stage !== "class" && stage !== "review" && <LockedBanner a={activity} />}

      {stage === "plan" && <PlanStage activity={activity} child={child} />}
      {stage === "story" && <StoryStage activity={activity} child={child} />}
      {stage === "review" && <ReviewStage activity={activity} child={child} />}
      {stage === "class" && <ClassStage activity={activity} child={child} />}

      <Modal
        open={renaming}
        title="重命名活动"
        onClose={() => setRenaming(false)}
        footer={
          <>
            <Button onClick={() => setRenaming(false)}>取消</Button>
            <Button
              variant="primary"
              disabled={!title.trim()}
              onClick={() => {
                dispatch({ type: "activity/rename", activityId: activity.id, title: title.trim() });
                setRenaming(false);
              }}
            >
              保存
            </Button>
          </>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor="rename">
            活动名称
          </label>
          <input id="rename" className="input" value={title} onChange={(e) => setTitle(e.target.value)} data-autofocus />
        </div>
      </Modal>
    </>
  );
}

export function LockedBanner({ a }: { a: Activity }) {
  const { dispatch, toast } = useStore();
  const v = a.versions[a.versions.length - 1];
  return (
    <div className="locked-banner" role="status">
      <Lock className="ico" />
      <span className="grow">
        教案 v{v?.versionNo} 已批准，内容只读。已传输和课堂记录始终引用 v{v?.versionNo}，继续修订会生成新的草稿，不会改动它们。
      </span>
      <Button
        size="sm"
        onClick={() => {
          dispatch({ type: "plan/revise", activityId: a.id });
          toast(`已基于 v${v?.versionNo} 创建可编辑草稿`, "success");
        }}
      >
        基于 v{v?.versionNo} 继续修订
      </Button>
    </div>
  );
}
