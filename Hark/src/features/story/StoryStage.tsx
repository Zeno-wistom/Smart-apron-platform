import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  CircleCheck,
  Eye,
  Hand,
  Lock,
  LockOpen,
  Pause,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
  Volume2,
  X,
} from "lucide-react";
import { useRequests, useStore } from "../../app/store";
import { useAi } from "../../app/useAi";
import { Button, InlineError, Modal, Pending, SimTag, SourceTag, Tag, TextArea, TextInput, cx } from "../../components/ui";
import { sceneConflicts } from "../../domain/checks";
import { cueById, feedbackCatalog, ROLE_LABEL, uid } from "../../domain/fixtures";
import type { Activity, ChildProfile, FeedbackCue, Scene, Story } from "../../domain/types";
import { KIND_LABEL } from "../plan/GoalEditor";

export function StoryStage({ activity, child }: { activity: Activity; child: ChildProfile }) {
  const d = activity.draft;
  const [params, setParams] = useSearchParams();
  const story = d.story;
  const raw = params.get("focus");
  const scene = useMemo(() => (raw?.startsWith("scene-") ? story?.scenes.find((s) => s.id === raw.slice(6)) : undefined), [raw, story]);
  const go = (f: "story" | string) => setParams({ focus: f === "story" ? "story" : `scene-${f}` });
  const stepsReady = d.goal.confirmed && d.steps.every((s) => s.status === "confirmed");
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    ref.current?.classList.remove("flash");
    void ref.current?.offsetWidth;
    ref.current?.classList.add("flash");
  }, [raw]);

  return (
    <div className="workspace">
      <StoryOutline activity={activity} current={scene?.id ?? "story"} onSelect={go} />
      <main className="editor" ref={ref} aria-label="当前编辑">
        {d.storyCandidate ? (
          <StoryCandidate activity={activity} />
        ) : !story ? (
          <StoryEmpty activity={activity} stepsReady={stepsReady} />
        ) : scene ? (
          <SceneEditor key={scene.id} activity={activity} scene={scene} onGo={go} />
        ) : (
          <StoryOverview activity={activity} child={child} onOpenScene={go} />
        )}
      </main>
      <CheckPanel activity={activity} onFocusScene={go} />
    </div>
  );
}

/* ---------------- 左栏 ---------------- */

function StoryOutline({ activity, current, onSelect }: { activity: Activity; current: string; onSelect: (f: string) => void }) {
  const d = activity.draft;
  const st = d.story;
  return (
    <aside className="outline" aria-label="故事结构">
      <div className="outline-head">
        <h2>故事结构</h2>
      </div>
      <button type="button" className={cx("ol-item", current === "story" && "on")} onClick={() => onSelect("story")}>
        <span className={cx("ol-badge", st?.confirmed ? "s-confirmed" : st ? "s-draft" : "s-empty", st?.needsReview && "s-review")}>
          <BookOpen className="ico" />
        </span>
        <span className="ol-text">
          <span className="ol-title">{st ? `《${st.title}》` : "故事概览"}</span>
          <span className="ol-sub">{st ? `${st.characters.length} 个角色 · ${st.scenes.length} 个场景` : "尚未创建"}</span>
        </span>
        {st?.confirmed ? (
          <span className="ol-state ok">
            <Lock className="ico" />
          </span>
        ) : null}
      </button>
      {st && (
        <>
          <div className="ol-group">
            <span className="eyebrow">场景 · 对应教学环节</span>
          </div>
          <ol className="ol-steps">
            {st.scenes.map((sc) => {
              const idx = d.steps.findIndex((s) => s.id === sc.stepId);
              const conflicts = sceneConflicts(sc, d.constraints);
              const ok = sc.cueIds.length > 0 && conflicts.length === 0 && !sc.suggestedCueIds;
              return (
                <li key={sc.id}>
                  <button type="button" className={cx("ol-item", current === sc.id && "on")} onClick={() => onSelect(sc.id)} data-testid="ol-scene">
                    <span className={cx("ol-badge", idx < 0 ? "s-review" : "s-draft")}>{idx >= 0 ? idx + 1 : "!"}</span>
                    <span className="ol-text">
                      <span className="ol-title">{sc.title}</span>
                      <span className="ol-sub">{idx >= 0 ? `环节 ${idx + 1} · ${ROLE_LABEL[d.steps[idx].role]}` : "关联环节已删除"}</span>
                    </span>
                    {conflicts.length > 0 ? (
                      <span className="ol-state warn" title={conflicts[0]}>
                        <TriangleAlert className="ico" />
                      </span>
                    ) : sc.suggestedCueIds ? (
                      <span className="ol-state ai" title="有反馈建议待处理">
                        <span className="ai-dot" />
                      </span>
                    ) : ok ? (
                      <span className="ol-state ok" title="反馈配置满足限制">
                        <CircleCheck className="ico" />
                      </span>
                    ) : (
                      <span className="ol-state faint" title="未配置反馈">
                        <Volume2 className="ico" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </aside>
  );
}

/* ---------------- 空状态 & 候选 ---------------- */

function StoryEmpty({ activity, stepsReady }: { activity: Activity; stepsReady: boolean }) {
  const ai = useAi(activity.id);
  const { pending, errors, clearError } = useRequests();
  const key = `story:${activity.id}`;
  const d = activity.draft;
  return (
    <div className="editor-inner">
      <header className="editor-head">
        <div className="grow">
          <div className="eyebrow">故事与互动</div>
          <h1>为这节课编一个故事</h1>
        </div>
      </header>
      {!stepsReady ? (
        <div className="notice notice-warn">
          <TriangleAlert className="ico" />
          <span className="grow">请先确认教学目标和全部教学环节。故事的每个场景都会对应一个已确认的环节。</span>
          <Link to={`/activities/${activity.id}/plan`} className="btn btn-secondary btn-sm">
            <span className="btn-label">返回备课</span>
          </Link>
        </div>
      ) : (
        <div className="ai-zone">
          <div className="ai-zone-head">
            <Sparkles className="ico ai-ink" />
            <h3 className="grow">生成故事候选</h3>
            <SimTag />
          </div>
          <p className="small muted">
            将根据目标「{d.goal.text}」、{d.steps.length} 个已确认环节与限制，生成角色和逐场景故事。生成结果先作为候选，由你采纳。
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            <Button variant="ai" icon={Sparkles} loading={!!pending[key]} onClick={() => ai.generateStory()} data-testid="gen-story">
              生成故事候选
            </Button>
            {pending[key] && <Pending label="正在编写故事候选" />}
          </div>
          {errors[key] && (
            <div style={{ marginTop: 12 }}>
              <InlineError text={errors[key]!} onRetry={() => ai.generateStory()} onClose={() => clearError(key)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StoryCandidate({ activity }: { activity: Activity }) {
  const { dispatch } = useStore();
  const ai = useAi(activity.id);
  const { pending } = useRequests();
  const c = activity.draft.storyCandidate!;
  const existing = activity.draft.story;
  const [confirm, setConfirm] = useState(false);
  const adopt = () => {
    dispatch({ type: "story/adopt", activityId: activity.id });
    setConfirm(false);
  };
  return (
    <div className="editor-inner">
      <header className="editor-head">
        <div className="grow">
          <div className="eyebrow">AI 故事候选 · 尚未写入</div>
          <div className="row" style={{ marginTop: 2 }}>
            <h1>《{c.story.title}》</h1>
            <SimTag />
          </div>
        </div>
      </header>
      <div className="candidate">
        <div className="candidate-head">
          <Sparkles className="ico ai-ink" />
          <h3 className="grow">{c.story.summary}</h3>
        </div>
        <div className="cand-story">
          <div className="small muted">角色：{c.story.characters.map((ch) => ch.name).join("、")}</div>
          <ol className="storyboard">
            {c.story.scenes.map((sc, i) => (
              <li key={sc.id}>
                <span className="sb-num">{i + 1}</span>
                <div className="grow">
                  <b>{sc.title}</b>
                  <p>{sc.narration}</p>
                  <p className="small node-line">
                    <Hand className="ico" /> 互动节点：{sc.node.prompt}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="candidate-actions">
          <Button variant="primary" size="sm" icon={CheckCheck} onClick={() => (existing ? setConfirm(true) : adopt())} data-testid="adopt-story">
            {existing ? "采纳并替换现有故事" : "采纳为故事草稿"}
          </Button>
          <Button size="sm" icon={RefreshCw} loading={!!pending[`story:${activity.id}`]} onClick={() => ai.generateStory()}>
            换一个
          </Button>
          <Button size="sm" variant="ghost" icon={X} onClick={() => dispatch({ type: "story/discard", activityId: activity.id })}>
            丢弃
          </Button>
        </div>
      </div>
      <Modal
        open={confirm}
        title="替换现有故事？"
        onClose={() => setConfirm(false)}
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>保留现有故事</Button>
            <Button variant="primary" onClick={adopt}>
              替换
            </Button>
          </>
        }
      >
        <p>你对《{existing?.title}》的修改和反馈配置会被候选替换。</p>
      </Modal>
    </div>
  );
}

/* ---------------- 概览 ---------------- */

function StoryOverview({ activity, child, onOpenScene }: { activity: Activity; child: ChildProfile; onOpenScene: (id: string) => void }) {
  const { dispatch } = useStore();
  const ai = useAi(activity.id);
  const { pending, errors, clearError } = useRequests();
  const st = activity.draft.story!;
  const ro = activity.draftLocked || st.confirmed;
  const id = activity.id;
  const steps = activity.draft.steps;
  const key = `story:${id}`;
  return (
    <div className="editor-inner">
      <header className="editor-head">
        <div className="grow">
          <div className="eyebrow">正在编辑 · 故事概览</div>
          <div className="row" style={{ marginTop: 2 }}>
            <h1>《{st.title}》</h1>
            {st.needsReview ? <Tag tone="warn" icon={TriangleAlert}>需复核</Tag> : st.confirmed ? <Tag tone="ok" icon={Lock}>已确认</Tag> : <Tag tone="primary">草稿</Tag>}
            <SourceTag source={st.source} />
          </div>
        </div>
      </header>

      {st.needsReview && !activity.draftLocked && (
        <div className="notice notice-warn">
          <TriangleAlert className="ico" />
          <span className="grow">需复核：{st.needsReview}。</span>
          <Button size="sm" onClick={() => dispatch({ type: "story/reviewed", activityId: id })} data-testid="story-reviewed">
            已检查，仍适用
          </Button>
          <Button size="sm" variant="ai" icon={Sparkles} loading={!!pending[key]} disabled={st.confirmed} onClick={() => ai.generateStory()}>
            重新生成候选
          </Button>
        </div>
      )}
      {errors[key] && <InlineError text={errors[key]!} onRetry={() => ai.generateStory()} onClose={() => clearError(key)} />}

      <section className="ed-section">
        <div className="stack">
          <TextInput label="故事名称" id="story-title" value={st.title} onChange={(v) => dispatch({ type: "story/edit", activityId: id, patch: { title: v } })} readOnly={ro} />
          <TextArea label="故事梗概" id="story-summary" value={st.summary} onChange={(v) => dispatch({ type: "story/edit", activityId: id, patch: { summary: v } })} readOnly={ro} minRows={2} />
        </div>
      </section>

      <section className="ed-section">
        <div className="section-title">
          <h2>角色</h2>
          {!ro && (
            <Button size="sm" variant="ghost" icon={Plus} onClick={() => dispatch({ type: "character/upsert", activityId: id, character: { id: uid("ch"), name: "新角色", description: "" } })}>
              添加角色
            </Button>
          )}
        </div>
        <ul className="characters">
          {st.characters.map((ch) => (
            <li key={ch.id} className="character">
              <input
                className="input ch-name"
                aria-label="角色名"
                value={ch.name}
                readOnly={ro}
                onChange={(e) => dispatch({ type: "character/upsert", activityId: id, character: { ...ch, name: e.target.value } })}
              />
              <input
                className="input grow"
                aria-label={`${ch.name} 的描述`}
                value={ch.description}
                placeholder="角色特点"
                readOnly={ro}
                onChange={(e) => dispatch({ type: "character/upsert", activityId: id, character: { ...ch, description: e.target.value } })}
              />
              {!ro && <Button size="sm" variant="ghost" icon={Trash2} aria-label={`删除角色 ${ch.name}`} onClick={() => dispatch({ type: "character/remove", activityId: id, id: ch.id })} />}
            </li>
          ))}
        </ul>
      </section>

      <section className="ed-section">
        <div className="section-title">
          <Eye className="ico muted" />
          <h2>故事预览</h2>
          <span className="small muted">按课堂顺序，点击场景进入编辑</span>
        </div>
        <ol className="storyboard">
          {st.scenes.map((sc, i) => {
            const idx = steps.findIndex((s) => s.id === sc.stepId);
            return (
              <li key={sc.id}>
                <button type="button" className="sb-card" onClick={() => onOpenScene(sc.id)}>
                  <span className="sb-num">{i + 1}</span>
                  <span className="grow">
                    <span className="row" style={{ gap: 6 }}>
                      <b>{sc.title}</b>
                      <span className="small muted">· 环节 {idx + 1}</span>
                    </span>
                    <span className="sb-text">{sc.narration}</span>
                    <span className="small node-line">
                      <Hand className="ico" /> {sc.node.prompt || "（未设置互动节点）"}
                    </span>
                    {sc.cueIds.length > 0 && (
                      <span className="row row-wrap" style={{ gap: 4, marginTop: 6 }}>
                        {sc.cueIds.map((c) => (
                          <CueChip key={c} cue={cueById(c)!} />
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="small muted" style={{ marginTop: 8 }}>
          素材为文字描述占位，P0 不生成真实图像或音频。角色与场景内容仅用于{child.name}的虚构演示。
        </p>
      </section>
      <StoryFooter activity={activity} onNext={() => st.scenes[0] && onOpenScene(st.scenes[0].id)} nextLabel="编辑第 1 个场景" />
    </div>
  );
}

function StoryFooter({ activity, onPrev, prevLabel, onNext, nextLabel }: { activity: Activity; onPrev?: () => void; prevLabel?: string; onNext?: () => void; nextLabel?: string }) {
  const nav = useNavigate();
  const st = activity.draft.story;
  const ready = st?.confirmed && st.apronConfirmed && !st.needsReview;
  return (
    <footer className="editor-foot">
      {onPrev ? (
        <Button variant="ghost" icon={ArrowLeft} onClick={onPrev}>
          {prevLabel}
        </Button>
      ) : (
        <Button variant="ghost" icon={ArrowLeft} onClick={() => nav(`/activities/${activity.id}/plan`)}>
          目标与环节
        </Button>
      )}
      <span className="grow" />
      {ready ? (
        <Button variant="primary" iconRight={ArrowRight} onClick={() => nav(`/activities/${activity.id}/review`)} data-testid="goto-review">
          前往审核与传输
        </Button>
      ) : (
        onNext && (
          <Button variant="secondary" iconRight={ArrowRight} onClick={onNext}>
            {nextLabel}
          </Button>
        )
      )}
    </footer>
  );
}

/* ---------------- 场景编辑 ---------------- */

function SceneEditor({ activity, scene, onGo }: { activity: Activity; scene: Scene; onGo: (f: string) => void }) {
  const { dispatch } = useStore();
  const d = activity.draft;
  const st = d.story!;
  const id = activity.id;
  const roStory = activity.draftLocked || st.confirmed;
  const roApron = activity.draftLocked || st.apronConfirmed;
  const idx = st.scenes.findIndex((s) => s.id === scene.id);
  const step = d.steps.find((s) => s.id === scene.stepId);
  const conflicts = sceneConflicts(scene, d.constraints);
  const prev = st.scenes[idx - 1];
  const next = st.scenes[idx + 1];

  return (
    <div className="editor-inner">
      <header className="editor-head">
        <div className="grow">
          <div className="eyebrow">
            正在编辑 · 场景 {idx + 1} / {st.scenes.length}
          </div>
          <div className="row" style={{ marginTop: 2 }}>
            <h1 className="ed-title">{scene.title}</h1>
            {st.confirmed ? <Tag tone="ok" icon={Lock}>故事已确认</Tag> : <Tag tone="primary">草稿</Tag>}
          </div>
        </div>
      </header>

      <section className="ed-section">
        <div className="section-title">
          <h2>场景内容</h2>
          {st.confirmed && !activity.draftLocked && <span className="small muted">故事已确认，需在右侧解除确认后修改</span>}
        </div>
        <div className="stack">
          <div className="scene-link">
            <div className="field grow">
              <label className="field-label" htmlFor="scene-step">
                对应教学环节
              </label>
              <select id="scene-step" className="input" value={scene.stepId} disabled={roStory} onChange={(e) => dispatch({ type: "scene/edit", activityId: id, sceneId: scene.id, patch: { stepId: e.target.value } })}>
                {!step && <option value={scene.stepId}>（已删除的环节）</option>}
                {d.steps.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    环节 {i + 1} · {ROLE_LABEL[s.role]} · {s.fields.title || "未命名"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {step && (
            <div className="linked-step small">
              <span className="muted">该环节的儿童互动：</span>
              {step.fields.childInteraction}
            </div>
          )}
          <TextInput label="场景标题" id="scene-title" value={scene.title} readOnly={roStory} onChange={(v) => dispatch({ type: "scene/edit", activityId: id, sceneId: scene.id, patch: { title: v } })} />
          <TextArea label="旁白 / 教师讲述" id="scene-narration" value={scene.narration} readOnly={roStory} onChange={(v) => dispatch({ type: "scene/edit", activityId: id, sceneId: scene.id, patch: { narration: v } })} minRows={2} />
        </div>
      </section>

      <section className="ed-section node-section">
        <div className="section-title">
          <Hand className="ico primary-ink" />
          <h2>关键互动节点</h2>
        </div>
        <div className="stack">
          <TextInput label="教师提示语" id="node-prompt" value={scene.node.prompt} readOnly={roStory} onChange={(v) => dispatch({ type: "scene/node", activityId: id, sceneId: scene.id, patch: { prompt: v } })} />
          <TextInput label="期待的儿童回应" id="node-expected" value={scene.node.expected} readOnly={roStory} onChange={(v) => dispatch({ type: "scene/node", activityId: id, sceneId: scene.id, patch: { expected: v } })} />
          <label className="switch">
            <input type="checkbox" checked={scene.node.allowPause} disabled={roStory} onChange={(e) => dispatch({ type: "scene/node", activityId: id, sceneId: scene.id, patch: { allowPause: e.target.checked } })} data-testid="allow-pause" />
            <Pause className="ico" />
            允许儿童在此暂停，教师等待后再继续
          </label>
        </div>
      </section>

      <section className="ed-section apron-section">
        <div className="section-title">
          <h2>围裙反馈</h2>
          <SimTag>模拟配置</SimTag>
          {st.apronConfirmed && <Tag tone="ok" icon={Lock}>已确认</Tag>}
        </div>
        <p className="small muted" style={{ marginBottom: 12 }}>
          在互动节点由教师触发的提示。这里只描述教学意图，不代表真实围裙的模块、型号或参数。
        </p>
        {scene.suggestedCueIds && <SuggestionBar activity={activity} scene={scene} />}
        <div className="cue-groups">
          {(["visual", "sound"] as const).map((ch) => (
            <div key={ch} className="cue-group">
              <div className="eyebrow row" style={{ gap: 6 }}>
                {ch === "visual" ? <Eye className="ico" /> : <Volume2 className="ico" />}
                {ch === "visual" ? "视觉提示" : "声音提示"}
              </div>
              <ul className="cues">
                {feedbackCatalog
                  .filter((c) => c.channel === ch)
                  .map((cue) => {
                    const on = scene.cueIds.includes(cue.id);
                    const bad = on && conflicts.some((x) => x.includes(cue.name));
                    return (
                      <li key={cue.id}>
                        <label className={cx("cue", on && "on", bad && "bad", roApron && "ro")}>
                          <input type="checkbox" checked={on} disabled={roApron} onChange={() => dispatch({ type: "apron/toggle", activityId: id, sceneId: scene.id, cueId: cue.id })} data-testid={`cue-${cue.id}`} />
                          <span className="grow">
                            <span className="cue-name">{cue.name}</span>
                            <span className="small muted">{cue.description}</span>
                          </span>
                          <span className="cue-meta">
                            <Tag tone={cue.trigger === "auto" ? "warn" : "neutral"}>{cue.trigger === "auto" ? "自动" : "教师触发"}</Tag>
                          </span>
                        </label>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
        {conflicts.length > 0 ? (
          <div className="notice notice-warn" role="alert" style={{ marginTop: 12 }}>
            <TriangleAlert className="ico" />
            <ul className="plain">
              {conflicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : scene.cueIds.length > 0 ? (
          <div className="notice notice-ok" style={{ marginTop: 12 }}>
            <CircleCheck className="ico" />
            <span>此场景的反馈满足已知限制。</span>
          </div>
        ) : null}
      </section>

      <StoryFooter
        activity={activity}
        onPrev={() => (prev ? onGo(prev.id) : onGo("story"))}
        prevLabel={prev ? `场景 ${idx}` : "故事概览"}
        onNext={next ? () => onGo(next.id) : () => onGo("story")}
        nextLabel={next ? `场景 ${idx + 2}` : "返回故事概览"}
      />
    </div>
  );
}

function SuggestionBar({ activity, scene }: { activity: Activity; scene: Scene }) {
  const { dispatch } = useStore();
  const s = scene.suggestedCueIds!;
  const same = s.length === scene.cueIds.length && s.every((x) => scene.cueIds.includes(x));
  return (
    <div className="suggestion" data-testid="cue-suggestion">
      <Sparkles className="ico ai-ink" />
      <div className="grow">
        <div className="small">
          <b>模拟匹配建议：</b>
          {s.length ? s.map((c) => cueById(c)?.name).join("、") : "不使用反馈"}
        </div>
        {!same && scene.cueIds.length > 0 && <div className="small muted">采纳将替换当前选择：{scene.cueIds.map((c) => cueById(c)?.name).join("、")}</div>}
      </div>
      <Button size="sm" variant="primary" icon={Check} onClick={() => dispatch({ type: "apron/accept", activityId: activity.id, sceneId: scene.id })}>
        采纳
      </Button>
      <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "apron/dismiss", activityId: activity.id, sceneId: scene.id })}>
        忽略
      </Button>
    </div>
  );
}

function CueChip({ cue }: { cue: FeedbackCue }) {
  return (
    <Tag tone={cue.trigger === "auto" ? "warn" : "neutral"} icon={cue.channel === "visual" ? Eye : Volume2}>
      {cue.name}
    </Tag>
  );
}

/* ---------------- 右栏：检查与确认 ---------------- */

function CheckPanel({ activity, onFocusScene }: { activity: Activity; onFocusScene: (id: string) => void }) {
  const { dispatch } = useStore();
  const ai = useAi(activity.id);
  const { pending, errors, clearError } = useRequests();
  const d = activity.draft;
  const st: Story | null = d.story;
  const id = activity.id;
  const locked = activity.draftLocked;
  const key = `apron:${id}`;
  const conflicted = st?.scenes.filter((s) => sceneConflicts(s, d.constraints).length > 0) ?? [];
  const unset = st?.scenes.filter((s) => s.cueIds.length === 0) ?? [];
  const suggestions = st?.scenes.filter((s) => s.suggestedCueIds) ?? [];
  const storyBlock = st && (st.needsReview || st.scenes.some((s) => !s.node.prompt.trim() || !s.narration.trim()));

  return (
    <aside className="context" aria-label="检查与确认">
      <div className="ctx-head">
        <span className="eyebrow">检查与确认</span>
      </div>

      <div className="check-card">
        <div className="row">
          <BookOpen className="ico muted" />
          <h3 className="grow">故事内容</h3>
          {st?.confirmed ? <Tag tone="ok" icon={Lock}>已确认</Tag> : st ? <Tag tone="primary">草稿</Tag> : <Tag>未创建</Tag>}
        </div>
        {st && !locked && (
          <div style={{ marginTop: 10 }}>
            {st.confirmed ? (
              <Button size="sm" icon={LockOpen} onClick={() => dispatch({ type: "story/unlock", activityId: id })}>
                解除确认以修改
              </Button>
            ) : (
              <>
                {storyBlock && <p className="small warn-ink" style={{ marginBottom: 8 }}>{st.needsReview ? "故事需先复核" : "每个场景需有旁白和互动提示语"}</p>}
                <Button size="sm" variant="primary" icon={Check} disabled={!!storyBlock} onClick={() => dispatch({ type: "story/confirm", activityId: id })} data-testid="confirm-story">
                  确认故事
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="check-card">
        <div className="row">
          <Volume2 className="ico muted" />
          <h3 className="grow">围裙反馈</h3>
          {st?.apronConfirmed ? <Tag tone="ok" icon={Lock}>已确认</Tag> : <SimTag />}
        </div>
        {st && (
          <>
            <ul className="check-list">
              {st.scenes.map((sc, i) => {
                const c = sceneConflicts(sc, d.constraints);
                return (
                  <li key={sc.id}>
                    <button type="button" className="check-row" onClick={() => onFocusScene(sc.id)}>
                      {c.length ? <TriangleAlert className="ico warn-ink" /> : sc.cueIds.length ? <CircleCheck className="ico ok-ink" /> : <Volume2 className="ico faint" />}
                      <span className="grow">
                        场景 {i + 1}
                        <span className="muted"> · {c.length ? "与限制冲突" : sc.suggestedCueIds ? "有建议待处理" : sc.cueIds.length ? `${sc.cueIds.length} 个提示` : "未配置"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {!locked && !st.apronConfirmed && (
              <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                <Button size="sm" variant="ai" icon={Sparkles} sim loading={!!pending[key]} onClick={() => ai.suggestCues()} data-testid="match-cues">
                  按限制匹配全部场景
                </Button>
                {errors[key] && <InlineError text={errors[key]!} onRetry={() => ai.suggestCues()} onClose={() => clearError(key)} />}
                {suggestions.length > 0 && (
                  <Button
                    size="sm"
                    icon={CheckCheck}
                    onClick={() => suggestions.forEach((s) => dispatch({ type: "apron/accept", activityId: id, sceneId: s.id }))}
                    data-testid="accept-all-cues"
                  >
                    采纳全部 {suggestions.length} 条建议
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="primary"
                  icon={Check}
                  disabled={conflicted.length > 0 || suggestions.length > 0}
                  onClick={() => dispatch({ type: "apron/confirm", activityId: id })}
                  data-testid="confirm-apron"
                >
                  确认反馈配置
                </Button>
                {(conflicted.length > 0 || unset.length > 0) && (
                  <p className="small muted">
                    {conflicted.length > 0 && `${conflicted.length} 个场景存在冲突，需修改后才能确认。`}
                    {unset.length > 0 && `${unset.length} 个场景未配置反馈（允许，但会在审核中提示）。`}
                  </p>
                )}
              </div>
            )}
            {!locked && st.apronConfirmed && (
              <Button size="sm" icon={LockOpen} style={{ marginTop: 10 }} onClick={() => dispatch({ type: "apron/unlock", activityId: id })}>
                解除确认以修改
              </Button>
            )}
          </>
        )}
      </div>

      <div className="ctx-block">
        <h3>本课限制</h3>
        <ul className="ctx-constraints">
          {d.constraints.map((c) => (
            <li key={c.id}>
              <Tag tone={c.kind === "free" ? "neutral" : "warn"}>{KIND_LABEL[c.kind]}</Tag>
              <span className="small">{c.text}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="small muted">当前未连接任何真实围裙。硬件能力确认后，此处才会显示真实模块。</p>
    </aside>
  );
}
