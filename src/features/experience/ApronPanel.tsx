import { Cable, Check, Image, RefreshCw, UnlockKeyhole, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../../app/AppProvider";
import { Button } from "../../components/ui/Button";
import { Badge, EmptyState, Notice, SimulationBadge } from "../../components/ui/Feedback";
import { getUnmappedCueIds, isApronStale, isSessionContentLocked } from "../../domain/selectors";
import type { LessonSession } from "../../domain/types";
import { matchApronMappings } from "../../services/apronRules";
import type { DeviceCapability } from "../../services/contracts";
import { mockDevice } from "../../services/mockDevice";

export function ApronPanel({ session }: { session: LessonSession }) {
  const { update } = useApp();
  const [capabilities, setCapabilities] = useState<DeviceCapability[]>([]);
  const confirmed = session.apronConfig.status === "confirmed";
  const locked = isSessionContentLocked(session);
  const readOnly = confirmed || locked;
  const stale = isApronStale(session);
  const unmapped = getUnmappedCueIds(session);
  const cues = session.story.scenes.flatMap((scene) => scene.cues.map((cue) => ({ ...cue, sceneTitle: scene.title })));

  useEffect(() => {
    let active = true;
    mockDevice.getCapabilities().then((result) => {
      if (active) setCapabilities(result);
    });
    return () => { active = false; };
  }, []);

  const canConfirm =
    session.story.status === "confirmed" &&
    !stale &&
    unmapped.length === 0 &&
    cues.length > 0 &&
    !locked;

  return (
    <aside className="panel apron-panel">
      <div className="panel-header">
        <div><h2>围裙反馈配置</h2><p>本地规则匹配，教师最终确认</p></div>
        <SimulationBadge label="模拟设备" />
      </div>
      <div className="apron-panel-body">
        <Notice variant="info" title="不代表真实硬件能力">
          未定义真实音量、频率、通信协议或设备型号。成功配置只发生在本地网页。
        </Notice>
        {stale && <Notice variant="warning" title="配置基于旧版教案" actions={<Button disabled={unmapped.length > 0 || locked} onClick={() => update({ type: "apron/rebase", sessionId: session.id })}>核对并沿用配置</Button>}>原有映射仍保留，需核对后再批准。</Notice>}

        <section className="capability-section">
          <div className="section-heading compact"><h3>模拟模块目录</h3><Badge>{capabilities.length} 个</Badge></div>
          <div className="capability-list">
            {capabilities.map((capability) => {
              const Icon = capability.kind === "visual" ? Image : Volume2;
              return <div key={capability.id}><Icon aria-hidden="true" /><div><strong>{capability.name}</strong><p>{capability.description}</p></div></div>;
            })}
            {capabilities.length === 0 && <p className="small-text">正在读取本地模拟能力目录…</p>}
          </div>
        </section>

        <section className="mapping-section">
          <div className="section-heading compact">
            <div><h3>故事提示点映射</h3><p>{cues.length === 0 ? "确认故事后，将提示点匹配到模拟模块" : `${cues.length} 个提示点 · ${unmapped.length} 个待匹配`}</p></div>
            <Button disabled={locked || cues.length === 0} icon={<RefreshCw aria-hidden="true" />} onClick={() => update({ type: "apron/apply", sessionId: session.id, mappings: matchApronMappings(session.story) })}>{session.apronConfig.mappings.length ? "重新匹配" : "规则匹配"}</Button>
          </div>
          {session.apronConfig.mappings.length > 0 && !readOnly && <p className="small-text mapping-hint">重新匹配会替换当前映射，但不会修改故事或教学步骤。</p>}
          {cues.length === 0 ? (
            <EmptyState icon={<Cable aria-hidden="true" />} title="等待故事提示点" description="生成故事后，可将视觉或声音提示点匹配到模拟模块。" />
          ) : (
            <div className="mapping-list">
              {cues.map((cue) => {
                const current = session.apronConfig.mappings.find((item) => item.cueId === cue.id);
                const Icon = cue.kind === "visual" ? Image : Volume2;
                return (
                  <article className="mapping-item" key={cue.id}>
                    <div className="mapping-cue"><Icon aria-hidden="true" /><div><strong>{cue.label}</strong><span>{cue.sceneTitle}</span></div></div>
                    <div className="field">
                      <label htmlFor={`module-${cue.id}`}>模拟模块</label>
                      <select id={`module-${cue.id}`} disabled={readOnly} value={current?.moduleId ?? ""} onChange={(event) => update({ type: "apron/update", sessionId: session.id, cueId: cue.id, patch: { moduleId: event.target.value }, historyKey: `module-${cue.id}` })}>
                        <option value="">请选择模拟模块</option>
                        {capabilities.map((capability) => <option key={capability.id} value={capability.id}>{capability.name}</option>)}
                      </select>
                    </div>
                    <label className="checkbox-label"><input type="checkbox" disabled={readOnly} checked={current?.enabled ?? true} onChange={(event) => update({ type: "apron/update", sessionId: session.id, cueId: cue.id, patch: { enabled: event.target.checked } })} />启用此反馈</label>
                    {current === undefined && <span className="mapping-missing">尚未匹配</span>}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {confirmed && <Notice variant="success" title="反馈配置已确认">模拟传输时将使用批准快照中的配置。</Notice>}
        <div className="apron-confirm-footer">
          <span className="small-text">{cues.length === 0 ? "请先生成并确认故事，再匹配反馈" : unmapped.length ? `还有 ${unmapped.length} 个提示点未匹配` : session.story.status !== "confirmed" ? "请先确认故事" : "全部提示点已匹配"}</span>
          {confirmed ? <Button disabled={locked} icon={<UnlockKeyhole aria-hidden="true" />} onClick={() => update({ type: "apron/unlock", sessionId: session.id })}>返回修改配置</Button> : <Button full variant="primary" disabled={!canConfirm} icon={<Check aria-hidden="true" />} onClick={() => update({ type: "apron/confirm", sessionId: session.id })}>确认反馈配置</Button>}
        </div>
      </div>
    </aside>
  );
}
