import { BookOpen, Check, Image, Lightbulb, LockKeyhole, Ship, UnlockKeyhole, Volume2 } from "lucide-react";
import { useApp } from "../../app/AppProvider";
import { Button } from "../../components/ui/Button";
import { Badge, EmptyState, Notice } from "../../components/ui/Feedback";
import { isSessionContentLocked, isStoryStale } from "../../domain/selectors";
import type { LessonSession } from "../../domain/types";

export function StoryEditor({ session }: { session: LessonSession }) {
  const { update } = useApp();
  const story = session.story;
  const confirmed = story.status === "confirmed";
  const locked = isSessionContentLocked(session);
  const readOnly = confirmed || locked;
  const stale = isStoryStale(session);

  if (story.scenes.length === 0) {
    return (
      <section className="panel story-editor-panel">
        <EmptyState icon={<BookOpen aria-hidden="true" />} title="故事还没有生成" description="完成并确认教学环节后，点击上方“模拟生成故事”。生成的场景会与步骤逐一关联。" />
      </section>
    );
  }

  return (
    <section className="panel story-editor-panel">
      <div className="panel-header">
        <div><h2>故事与角色互动</h2><p>{story.scenes.length} 个场景 · 每个场景关联一个教学环节</p></div>
        <Badge variant={confirmed ? "success" : "info"} icon={confirmed ? <LockKeyhole aria-hidden="true" /> : undefined}>{confirmed ? "已确认" : "可编辑草案"}</Badge>
      </div>
      <div className="story-cover">
        <div className="story-cover-art" aria-label="小船与灯塔的本地图形占位">
          <Ship aria-hidden="true" /><span /><Lightbulb aria-hidden="true" />
        </div>
        <div><Badge>本地视觉占位</Badge><p>不使用未经授权的 PPVT 或儿童素材，也未调用图像生成。</p></div>
      </div>
      <div className="panel-body form-stack">
        <div className="field">
          <label htmlFor="story-title">故事名称</label>
          <input id="story-title" readOnly={readOnly} value={story.title} onChange={(event) => update({ type: "story/update", sessionId: session.id, patch: { title: event.target.value }, historyKey: "story-title" })} />
        </div>
        <div className="field">
          <label htmlFor="story-summary">故事摘要</label>
          <textarea id="story-summary" readOnly={readOnly} value={story.summary} onChange={(event) => update({ type: "story/update", sessionId: session.id, patch: { summary: event.target.value }, historyKey: "story-summary" })} />
        </div>

        <div className="story-scenes">
          {story.scenes.map((scene, index) => {
            const step = session.steps.find((item) => item.id === scene.stepId);
            return (
              <section className="story-scene" key={scene.id}>
                <header><span>{index + 1}</span><div><h3>{step?.title ?? "已移除的环节"}</h3><p>场景关联：{step ? "有效" : "需要重新生成"}</p></div></header>
                <div className="form-stack">
                  <div className="field"><label htmlFor={`scene-title-${scene.id}`}>场景标题</label><input id={`scene-title-${scene.id}`} readOnly={readOnly} value={scene.title} onChange={(event) => update({ type: "scene/update", sessionId: session.id, sceneId: scene.id, patch: { title: event.target.value }, historyKey: `scene-title-${scene.id}` })} /></div>
                  <div className="field"><label htmlFor={`scene-text-${scene.id}`}>故事文本</label><textarea id={`scene-text-${scene.id}`} readOnly={readOnly} value={scene.text} onChange={(event) => update({ type: "scene/update", sessionId: session.id, sceneId: scene.id, patch: { text: event.target.value }, historyKey: `scene-text-${scene.id}` })} /></div>
                  <div className="field"><label htmlFor={`scene-characters-${scene.id}`}>角色</label><input id={`scene-characters-${scene.id}`} readOnly={readOnly} value={scene.characters} onChange={(event) => update({ type: "scene/update", sessionId: session.id, sceneId: scene.id, patch: { characters: event.target.value }, historyKey: `scene-characters-${scene.id}` })} /></div>
                  <div className="field"><label htmlFor={`scene-interaction-${scene.id}`}>互动建议</label><textarea id={`scene-interaction-${scene.id}`} readOnly={readOnly} value={scene.interaction} onChange={(event) => update({ type: "scene/update", sessionId: session.id, sceneId: scene.id, patch: { interaction: event.target.value }, historyKey: `scene-interaction-${scene.id}` })} /></div>
                  <div className="cue-list">
                    {scene.cues.map((cue) => {
                      const Icon = cue.kind === "visual" ? Image : Volume2;
                      return <div className="cue-item" key={cue.id}><Icon aria-hidden="true" /><div><strong>{cue.label}</strong><p>{cue.description}</p></div><Badge>素材占位</Badge></div>;
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {confirmed && <Notice variant="success">故事已确认。返回修改后，需要重新确认才能批准完整教案。</Notice>}
        <div className="story-editor-footer">
          <span className="small-text">教案版本：{story.basedOnPlanRevision} / 当前 {session.planRevision}</span>
          {confirmed ? <Button disabled={locked} icon={<UnlockKeyhole aria-hidden="true" />} onClick={() => update({ type: "story/unlock", sessionId: session.id })}>返回修改故事</Button> : <Button variant="primary" disabled={locked || stale || !story.title.trim()} icon={<Check aria-hidden="true" />} onClick={() => update({ type: "story/confirm", sessionId: session.id })}>确认故事与互动</Button>}
        </div>
      </div>
    </section>
  );
}
