import { ArrowRight, BookOpen, Check, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { Button } from "../../components/ui/Button";
import { Notice, SimulationBadge } from "../../components/ui/Feedback";
import { isApronStale, isSessionContentLocked, isStoryStale } from "../../domain/selectors";
import type { LessonSession } from "../../domain/types";
import type { StoryDraft } from "../../services/contracts";
import { storyFromDraft } from "../../services/mappers";
import { mockAi } from "../../services/mockAi";
import { ApronPanel } from "./ApronPanel";
import { StoryEditor } from "./StoryEditor";
import "./experience.css";

export function ExperiencePage() {
  const session = useOutletContext<LessonSession>();
  const { data, update } = useApp();
  const child = data.children.find((item) => item.id === session.childId)!;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [candidate, setCandidate] = useState<StoryDraft>();
  const requestRef = useRef(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const locked = isSessionContentLocked(session);
  const planningReady =
    session.goalSet.status === "confirmed" &&
    session.steps.length >= 3 &&
    session.steps.every((step) => step.status === "confirmed");
  const storyStale = isStoryStale(session);
  const apronStale = isApronStale(session);
  const storyHasMissingSteps = session.story.scenes.some(
    (scene) => !session.steps.some((step) => step.id === scene.stepId),
  );
  const experienceDone =
    session.story.status === "confirmed" &&
    session.apronConfig.status === "confirmed" &&
    !storyStale &&
    !apronStale;

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  async function generateStory() {
    if (!planningReady || locked) return;
    const requestId = ++requestRef.current;
    const baseRevision = session.planRevision;
    setLoading(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const draft = await mockAi.suggestStory({
        child,
        goalSet: session.goalSet,
        steps: session.steps,
        planRevision: session.planRevision,
      });
      if (requestId !== requestRef.current) return;
      if (sessionRef.current.planRevision !== baseRevision) {
        setNotice("生成期间教案已变化，故事候选已丢弃。请基于当前版本重新生成。 ");
        return;
      }
      if (session.story.scenes.length === 0) {
        update({ type: "story/apply", sessionId: session.id, story: storyFromDraft(draft) });
        setNotice("故事草案已生成，所有内容均可编辑；确认前不会影响最终教案。 ");
      } else {
        setCandidate(draft);
        setNotice("新的故事候选已生成。查看全文后，由你决定是否采用。 ");
      }
    } catch (reason: unknown) {
      if (requestId === requestRef.current) {
        setError(reason instanceof Error ? reason.message : "模拟故事生成失败，请重试。 ");
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }

  return (
    <div className="experience-page">
      <div className="workspace-toolbar">
        <div><h2>把教案变成可执行的故事</h2><p>先编辑并确认故事，再把每个故事提示点对应到模拟围裙的灯光或声音反馈。</p></div>
        <div className="button-row">
          <Button variant="primary" disabled={!planningReady || locked} loading={loading} icon={<Sparkles aria-hidden="true" />} onClick={generateStory}>
            {session.story.scenes.length === 0 ? "模拟生成故事" : "重新生成故事候选"}
          </Button>
          {experienceDone && <Link className="button button-secondary" to={`/sessions/${session.id}/review`}>下一步：审核教案<ArrowRight aria-hidden="true" /></Link>}
        </div>
      </div>

      {!planningReady && <Notice variant="warning" title="先完成教学环节">至少需要 3 个已确认环节，才能生成故事。<Link to={`/sessions/${session.id}/plan`}>返回 AI 备课</Link></Notice>}
      {locked && <Notice variant="success" title="课程内容已只读">本课程已完成模拟传输，故事和围裙配置保留为批准时的历史版本。</Notice>}
      {error && <Notice variant="error" title="故事生成未完成" actions={<Button onClick={generateStory}>重试</Button>}>{error}</Notice>}
      {notice && <Notice variant="info">{notice}</Notice>}
      {storyStale && (
        <Notice
          variant="warning"
          title="故事基于旧版教案"
          actions={
            <div className="button-row">
              <Button disabled={storyHasMissingSteps || locked} icon={<Check aria-hidden="true" />} onClick={() => update({ type: "story/rebase", sessionId: session.id })}>已核对，沿用故事</Button>
              <Button disabled={locked} icon={<RefreshCw aria-hidden="true" />} onClick={generateStory}>生成新候选</Button>
            </div>
          }
        >
          {storyHasMissingSteps ? "有场景引用了已删除环节，请生成并采用新候选。" : "教师原文已保留。可人工核对后沿用，也可生成新候选；系统不会自动覆盖。"}
        </Notice>
      )}

      {candidate && (
        <section className="panel story-candidate-panel">
          <div className="panel-header"><div><h2>{candidate.title}｜新候选</h2><p>{candidate.summary}</p></div><SimulationBadge label="模拟候选" /></div>
          <div className="panel-body">
            <details>
              <summary>查看候选全文（{candidate.scenes.length} 个场景）</summary>
              <div className="candidate-scene-list">{candidate.scenes.map((scene, index) => <article key={scene.id}><strong>{index + 1}. {scene.title}</strong><p>{scene.text}</p></article>)}</div>
            </details>
            <div className="candidate-review-actions">
              <p>采用会替换当前故事草案，但可继续使用撤销返回；围裙提示点 ID 会尽量保持稳定。</p>
              <div className="button-row"><Button onClick={() => setCandidate(undefined)}>保留当前故事</Button><Button variant="primary" onClick={() => { update({ type: "story/apply", sessionId: session.id, story: storyFromDraft(candidate) }); setCandidate(undefined); }}>采用此候选</Button></div>
            </div>
          </div>
        </section>
      )}

      <div className="experience-grid">
        <StoryEditor session={session} />
        <ApronPanel session={session} />
      </div>
      {experienceDone && <div className="next-stage"><div><strong>故事与反馈配置已确认</strong><p>下一步检查完整教案，批准后再进行模拟传输。</p></div><Link className="button button-primary" to={`/sessions/${session.id}/review`}>下一步：审核教案<ArrowRight aria-hidden="true" /></Link></div>}
      {session.story.scenes.length === 0 && planningReady && (
        <div className="experience-footnote"><BookOpen aria-hidden="true" />故事、角色与互动建议均由本地模板模拟生成；教师编辑和确认是真实本地功能。</div>
      )}
    </div>
  );
}
