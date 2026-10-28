import { useState, useRef } from "react";
import { useStore } from "../../app/store";
import { Button, InlineError } from "../../components/ui";
import { completeSteps, generateStory } from "../../services/mockAi";
import { cueMatch } from "../../domain/cueMatch";
import type { Activity, ChildProfile } from "../../domain/types";

export function LessonDraft({
  activity,
  child,
}: {
  activity: Activity;
  child: ChildProfile;
}) {
  const { dispatch, latest } = useStore();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [omitted, setOmitted] = useState<string[]>([]);
  const seq = useRef(0);
  const d = activity.draft,
    c = d.lessonCandidate,
    stale = c && c.revision !== d.revision;
  const generate = async () => {
    const request = ++seq.current;
    const initial = latest().activities.find((a) => a.id === activity.id)!;
    const source = initial.draft;
    setBusy(true);
    setError("");
    setOmitted([]);
    try {
      const empty = source.steps.filter(
        (s) => s.status === "empty" && !s.candidate,
      );
      const results = await completeSteps(
        {
          child,
          goalText: source.goal.text,
          goalObserve: source.goal.observe,
          constraints: source.constraints,
          notes: source.notes,
          steps: source.steps,
        },
        empty.map((s) => s.id),
      );
      const projected = source.steps.map((s) => {
        const r = results.find((r) => r.stepId === s.id);
        return r ? { ...s, fields: r.fields, status: "draft" as const } : s;
      });
      const story = source.story
        ? undefined
        : await generateStory(
            child,
            source.goal.text,
            projected,
            source.constraints,
          );
      if (story)
        for (const sc of story.scenes) {
          sc.cueIds = cueMatch(
            sc,
            projected.find((s) => s.id === sc.stepId)!.role,
            source.constraints,
          ).safe;
        }
      const now = latest().activities.find((a) => a.id === activity.id);
      if (request !== seq.current) return;
      if (!now || now.draftLocked || now.draft.revision !== source.revision)
        throw Error("生成期间内容已修改，结果已过期。请重新生成。");
      dispatch({
        type: "lesson/candidate",
        activityId: activity.id,
        candidate: {
          revision: source.revision,
          steps: results.map((r) => ({
            ...r,
            rev: source.steps.find((s) => s.id === r.stepId)!.rev,
          })),
          story,
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (request === seq.current) setBusy(false);
    }
  };
  const empty = d.steps.filter((s) => s.status === "empty").length;
  const canGenerate =
    !!d.goal.text.trim() &&
    !!d.goal.observe.trim() &&
    (empty > 0 || !d.story) &&
    !activity.draftLocked &&
    !c;
  if (activity.draftLocked) return null;
  if (!c && !busy && empty === 0 && d.story) return null;
  return (
    <section className="lesson-draft" aria-label="整课初稿">
      {!c ? (
        <div className="row">
          <div className="grow">
            <h2>
              {empty === d.steps.length ? "从目标生成整课初稿" : "补全空白"}
            </h2>
            <p className="small muted">
              {empty} 个空白环节{!d.story ? "及故事线" : ""}；已有教师内容保留。
            </p>
          </div>
          <Button
            variant="ai"
            loading={busy}
            disabled={!canGenerate}
            onClick={generate}
            data-testid="generate-lesson"
          >
            {empty === d.steps.length ? "生成整课初稿" : "补全空白"}
          </Button>
        </div>
      ) : (
        <>
          <div className="row">
            <h2 className="grow">整课候选稿</h2>
            <Button
              variant="ghost"
              onClick={() =>
                dispatch({ type: "lesson/discard", activityId: activity.id })
              }
            >
              丢弃候选
            </Button>
          </div>
          <p className="small muted">
            以下为新增内容；现有内容保持不变。可逐条取消，采纳所选后放弃未选内容。
          </p>
          {stale && (
            <p className="notice notice-warn" role="alert">
              内容已修改，此候选已过期。请丢弃并重新生成。
            </p>
          )}
          <details open>
            <summary>检查 {c.steps.length} 个环节的新增内容</summary>
            {c.steps.map((s) => (
              <article className="draft-change" key={s.stepId}>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={!omitted.includes(s.stepId)}
                    onChange={(e) =>
                      setOmitted((v) =>
                        e.target.checked
                          ? v.filter((id) => id !== s.stepId)
                          : [...v, s.stepId],
                      )
                    }
                  />
                  <b>新增 · {s.fields.title}</b>
                </label>
                <p>教师：{s.fields.teacherScript}</p>
                <p>儿童：{s.fields.childInteraction}</p>
                <p>
                  观察：{s.fields.observe} · {s.fields.minutes} 分钟
                </p>
              </article>
            ))}
          </details>
          {c.story && (
            <details open>
              <summary>故事线 · {c.story.title}</summary>
              <p>{c.story.summary}</p>
              {c.story.scenes.map((sc) => (
                <article key={sc.id} className="draft-change">
                  <h3>{sc.title}</h3>
                  <p>{sc.narration}</p>
                  <p>
                    {sc.node.prompt} → {sc.node.expected}
                  </p>
                  <p className="small muted">
                    {sc.cueIds.length} 个围裙提示 ·{" "}
                    {sc.node.allowPause ? "允许暂停" : "未设置暂停"}
                  </p>
                </article>
              ))}
            </details>
          )}
          <Button
            disabled={
              !!stale || (!c.story && omitted.length === c.steps.length)
            }
            onClick={() => {
              const ids = c.steps
                .filter((s) => !omitted.includes(s.stepId))
                .map((s) => s.stepId);
              dispatch({
                type: "lesson/adopt",
                activityId: activity.id,
                candidate: c,
                stepIds: ids,
                includeStory: !!c.story && omitted.length === 0,
              });
            }}
            data-testid="adopt-lesson"
          >
            {omitted.length ? "采纳所选环节，放弃其余" : "采纳整课初稿"}
          </Button>
          {omitted.length > 0 && c.story && (
            <p className="small muted">
              部分采纳时暂不写入故事，补齐环节后可重新生成连贯故事。
            </p>
          )}
        </>
      )}
      {!d.goal.text.trim() || !d.goal.observe.trim() ? (
        <p className="small muted">先填写教学目标与记录方式。</p>
      ) : null}
      {error && <InlineError text={error} onRetry={generate} />}
    </section>
  );
}
