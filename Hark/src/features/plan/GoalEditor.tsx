import { useState } from "react";
import { ArrowRight, Check, Lock, LockOpen, Plus, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { useRequests, useStore } from "../../app/store";
import { useAi } from "../../app/useAi";
import { Button, InlineError, Modal, Pending, SimTag, SourceTag, Tag, TextArea, cx } from "../../components/ui";
import { uid } from "../../domain/fixtures";
import type { Activity, ChildProfile, ConstraintKind, GoalOption } from "../../domain/types";

export const KIND_LABEL: Record<ConstraintKind, string> = {
  "no-sudden-sound": "声音",
  "allow-pause": "暂停",
  "no-flash": "视觉",
  "no-touch": "触碰",
  free: "其他",
};
const KIND_DEFAULT: Record<ConstraintKind, string> = {
  "no-sudden-sound": "避免突然的大音量",
  "allow-pause": "允许儿童随时暂停",
  "no-flash": "避免闪烁的视觉效果",
  "no-touch": "避免身体引导或触碰",
  free: "",
};

export function GoalEditor({ activity, child, onNext }: { activity: Activity; child: ChildProfile; onNext: () => void }) {
  const { dispatch } = useStore();
  const { pending, errors, clearError } = useRequests();
  const ai = useAi(activity.id);
  const d = activity.draft;
  const g = d.goal;
  const locked = activity.draftLocked;
  const goalLocked = locked || g.confirmed;
  const [hint, setHint] = useState("");
  const [replace, setReplace] = useState<GoalOption | null>(null);
  const key = `goals:${activity.id}`;
  const reviewCount = d.steps.filter((s) => s.needsReview).length;

  const pickOption = (o: GoalOption) => {
    if ((g.source === "teacher" || g.source === "ai-edited") && (g.text.trim() || g.observe.trim()) && (g.text !== o.text || g.observe !== o.observe)) setReplace(o);
    else apply(o);
  };
  const apply = (o: GoalOption) => {
    dispatch({ type: "goal/edit", activityId: activity.id, patch: { text: o.text, observe: o.observe }, source: "ai" });
    setReplace(null);
  };

  const id = activity.id;
  return (
    <div className="editor-inner">
      <header className="editor-head">
        <div className="grow">
          <div className="eyebrow">正在编辑</div>
          <div className="row" style={{ marginTop: 2 }}>
            <h1>目标与限制</h1>
            {g.confirmed ? (
              <Tag tone="ok" icon={Lock}>
                已确认
              </Tag>
            ) : g.text ? (
              <Tag tone="primary">草稿</Tag>
            ) : (
              <Tag>空白</Tag>
            )}
            {g.text && <SourceTag source={g.source} />}
          </div>
        </div>
      </header>

      {/* 1. 目标 */}
      <section className="ed-section" id="goal">
        <div className="section-title">
          <h2>本课教学目标</h2>
          {g.confirmed && !locked && (
            <Button size="sm" variant="ghost" icon={LockOpen} onClick={() => dispatch({ type: "goal/unlock", activityId: id })}>
              解除确认以修改
            </Button>
          )}
        </div>
        {g.confirmed && d.steps.some((s) => s.status !== "empty") && !locked && (
          <p className="small muted" style={{ marginBottom: 12 }}>
            修改目标后，已编写的环节会标记为“需复核”，原内容保留。
          </p>
        )}
        <div className="stack">
          <TextArea
            id="goal-text"
            label="目标（可观察的行为）"
            value={g.text}
            onChange={(v) => dispatch({ type: "goal/edit", activityId: id, patch: { text: v } })}
            readOnly={goalLocked}
            placeholder="例如：在视觉提示下练习轮流表达"
            minRows={1}
          />
          <TextArea
            id="goal-observe"
            label="观察与记录方式"
            value={g.observe}
            onChange={(v) => dispatch({ type: "goal/edit", activityId: id, patch: { observe: v } })}
            readOnly={goalLocked}
            placeholder="例如：每轮记录独立回应 / 提示后回应 / 未观察到"
            minRows={1}
            hint="课后复盘会按这里的方式整理记录。"
          />
        </div>
        {reviewCount > 0 && (
          <div className="notice notice-warn" style={{ marginTop: 12 }}>
            <TriangleAlert className="ico" />
            <span>目标或限制已修改，{reviewCount} 个环节需要复核。确认目标后，在左侧逐个查看。</span>
          </div>
        )}
      </section>

      {/* 2. AI 推荐（贴近目标输入） */}
      {!goalLocked && (
        <section className="ai-zone" aria-label="AI 推荐目标">
          <div className="ai-zone-head">
            <Sparkles className="ico ai-ink" />
            <h3 className="grow">AI 推荐目标</h3>
            <SimTag />
          </div>
          <p className="small muted">根据{child.name}的档案与当前限制整理。可输入关注点，让建议更贴近你的想法。</p>
          <div className="row" style={{ marginTop: 10 }}>
            <input
              className="input grow"
              aria-label="关注点（可选）"
              placeholder="关注点（可选），如：表达请求、指认角色"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ai.recommendGoals(hint)}
            />
            <Button variant="ai" icon={Sparkles} loading={!!pending[key]} onClick={() => ai.recommendGoals(hint)} data-testid="recommend-goals">
              {d.goalOptions.length ? "重新推荐" : "推荐目标"}
            </Button>
          </div>
          {pending[key] && (
            <div style={{ marginTop: 12 }}>
              <Pending label="正在整理目标建议" />
            </div>
          )}
          {errors[key] && (
            <div style={{ marginTop: 12 }}>
              <InlineError text={errors[key]!} onRetry={() => ai.recommendGoals(hint)} onClose={() => clearError(key)} />
            </div>
          )}
          {d.goalOptions.length > 0 && (
            <ul className="options">
              {d.goalOptions.map((o) => {
                const current = o.text === g.text;
                return (
                  <li key={o.id}>
                    <button type="button" className={cx("option", "option-select", current && "on")} aria-pressed={current} onClick={() => pickOption(o)}>
                      <span className="grow"><span className="option-title">{o.text}</span><span className="small muted option-detail">{o.rationale}</span><span className="small option-observe option-detail">记录：{o.observe}</span></span>
                      <span className="option-choice">{current ? "已选择 ✓" : "选择"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* 3. 限制 */}
      <ConstraintEditor activity={activity} />

      {/* 4. 备注 */}
      <section className="ed-section">
        <div className="section-title">
          <h2>教师备注</h2>
        </div>
        <TextArea
          id="plan-notes"
          label="教师备注"
          hideLabel
          value={d.notes}
          onChange={(v) => dispatch({ type: "notes/edit", activityId: id, notes: v })}
          readOnly={locked}
          placeholder="例如：先用手势指向轮流卡，再说“轮到你”"
          hint="AI 生成环节时会参考备注。修改备注不会触发复核。"
        />
      </section>

      <footer className="editor-foot">
        <span className="small muted grow">
          {g.confirmed ? "目标已确认。接下来逐个编排教学环节。" : "确认目标后，才能生成教学环节。"}
        </span>
        {!g.confirmed ? (
          <Button variant="primary" icon={Check} disabled={!g.text.trim() || locked} onClick={() => { dispatch({ type: "goal/confirm", activityId: id }); onNext(); }} data-testid="confirm-goal">
            确认目标并进入教学环节
          </Button>
        ) : (
          <Button variant="primary" iconRight={ArrowRight} onClick={onNext} data-testid="goto-steps">
            {reviewCount > 0 ? "去复核环节" : "开始编排环节"}
          </Button>
        )}
      </footer>

      <Modal
        open={!!replace}
        title="替换当前目标？"
        onClose={() => setReplace(null)}
        footer={
          <>
            <Button onClick={() => setReplace(null)}>保留我的目标</Button>
            <Button variant="primary" onClick={() => replace && apply(replace)}>
              替换
            </Button>
          </>
        }
      >
        <div className="compare">
          <div>
            <div className="eyebrow">当前</div>
            <p>{g.text}</p>
          </div>
          <div>
            <div className="eyebrow ai-ink">AI 建议</div>
            <p>{replace?.text}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ConstraintEditor({ activity }: { activity: Activity }) {
  const { dispatch } = useStore();
  const d = activity.draft;
  const locked = activity.draftLocked;
  const [kind, setKind] = useState<ConstraintKind>("free");
  const [text, setText] = useState("");
  const id = activity.id;
  const add = () => {
    const t = text.trim() || KIND_DEFAULT[kind];
    if (!t) return;
    dispatch({ type: "constraint/add", activityId: id, constraint: { id: uid("con"), kind, text: t } });
    setText("");
    setKind("free");
  };
  return (
    <section className="ed-section" id="constraints">
      <div className="section-title">
        <h2>限制条件</h2>
        <span className="small muted">来自档案，可修改</span>
      </div>
      <ul className="constraints">
        {d.constraints.map((c) => (
          <li key={c.id} className="constraint">
            <Tag tone={c.kind === "free" ? "neutral" : "warn"}>{KIND_LABEL[c.kind]}</Tag>
            <input
              className="input grow"
              aria-label={`限制：${KIND_LABEL[c.kind]}`}
              defaultValue={c.text}
              readOnly={locked}
              onBlur={(e) => e.target.value.trim() && dispatch({ type: "constraint/edit", activityId: id, id: c.id, text: e.target.value.trim() })}
            />
            {!locked && <Button size="sm" variant="ghost" icon={Trash2} aria-label={`删除限制 ${c.text}`} onClick={() => dispatch({ type: "constraint/remove", activityId: id, id: c.id })} />}
          </li>
        ))}
      </ul>
      {!locked && (
        <div className="constraint-add">
          <select className="input" aria-label="限制类型" value={kind} onChange={(e) => setKind(e.target.value as ConstraintKind)} style={{ width: 132 }}>
            {(Object.keys(KIND_LABEL) as ConstraintKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
                {k !== "free" ? "（可自动检查）" : ""}
              </option>
            ))}
          </select>
          <input
            className="input grow"
            aria-label="限制内容"
            placeholder={KIND_DEFAULT[kind] || "输入限制，如：单次课不超过 25 分钟"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button icon={Plus} onClick={add} disabled={kind === "free" && !text.trim()}>
            添加
          </Button>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 8 }}>
        “声音、暂停、视觉”类限制会在配置围裙反馈时自动检查；“其他”类限制由你在审核时人工确认。
      </p>
    </section>
  );
}
