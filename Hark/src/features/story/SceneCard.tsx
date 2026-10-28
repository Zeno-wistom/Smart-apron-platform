import {useState} from 'react';
import {useStore} from '../../app/store';
import {Button,TextArea,Modal} from '../../components/ui';
import {feedbackCatalog, cueById, uid} from '../../domain/fixtures';
import {sceneConflicts} from '../../domain/checks';
import {cueMatch} from '../../domain/cueMatch';
import type {Activity,Scene} from '../../domain/types';

export function SceneCard({activity,scene}:{activity:Activity;scene:Scene}){
 const {dispatch}=useStore(); const ro=activity.draftLocked;const story=activity.draft.story!;
 const [matching,setMatching]=useState(false);
 const unlock=()=>{if(story.confirmed)dispatch({type:'story/unlock',activityId:activity.id});if(story.apronConfirmed)dispatch({type:'apron/unlock',activityId:activity.id})};
 const edit=(patch:{narration?:string;title?:string;stepId?:string})=>{unlock();dispatch({type:'scene/edit',activityId:activity.id,sceneId:scene.id,patch})};
 const node=(patch:Partial<Scene['node']>)=>{unlock();dispatch({type:'scene/node',activityId:activity.id,sceneId:scene.id,patch})};
 const role=activity.draft.steps.find(s=>s.id===scene.stepId)?.role??'practice';
 const match=cueMatch(scene,role,activity.draft.constraints);
 const conflicts=sceneConflicts(scene,activity.draft.constraints);
 return <section className="scene-inline" aria-label="故事呈现与围裙提示">
 <details open><summary>故事呈现</summary><div className="stack">
 <TextArea id={`scene-title-${scene.id}`} label="场景标题" value={scene.title} onChange={title=>edit({title})} readOnly={ro} minRows={1}/>
 <TextArea id={`scene-narration-${scene.id}`} label="故事旁白" value={scene.narration} onChange={narration=>edit({narration})} readOnly={ro}/>
 <TextArea id={`scene-prompt-${scene.id}`} label="互动提示语" value={scene.node.prompt} onChange={prompt=>node({prompt})} readOnly={ro} minRows={1}/>
 <TextArea id={`scene-expected-${scene.id}`} label="期待回应" value={scene.node.expected} onChange={expected=>node({expected})} readOnly={ro} minRows={1}/>
 <label className="switch"><input type="checkbox" checked={scene.node.allowPause} disabled={ro} onChange={e=>node({allowPause:e.target.checked})}/>允许儿童随时暂停</label>
 </div></details>
 <details className="cue-editor" open={conflicts.length>0||undefined}><summary>围裙提示 · {scene.cueIds.length} 个{conflicts.length?` · ${conflicts.length} 项冲突`:' · 调整'}</summary>
 <p className="small muted">当前选择：{scene.cueIds.map(id=>cueById(id)?.name??`未知提示 ${id}`).join('、')||'暂无'}。最终配置在课前检查中统一审核。</p>
 {conflicts.map(c=><p className="notice notice-warn" role="alert" key={c}>{c}</p>)}
 {feedbackCatalog.map(c=><label className="cue-option" key={c.id}><input type="checkbox" disabled={ro} checked={scene.cueIds.includes(c.id)} onChange={()=>{unlock();dispatch({type:'apron/toggle',activityId:activity.id,sceneId:scene.id,cueId:c.id})}} data-testid={`cue-${c.id}`}/><span><b>{c.name}</b><span className="small muted"> · {c.trigger==='teacher'?'教师触发':'自动'} · {c.channel==='sound'?'声音':'视觉'}</span><p>{c.description}</p></span></label>)}
 {scene.cueIds.filter(id=>!cueById(id)).map(id=><Button key={id} disabled={ro} onClick={()=>{unlock();dispatch({type:'apron/toggle',activityId:activity.id,sceneId:scene.id,cueId:id})}}>移除未知提示 {id}</Button>)}
 {scene.suggestedCueIds&&<div className="notice"><span>旧版待处理建议：{scene.suggestedCueIds.map(id=>cueById(id)?.name??id).join('、')}</span><Button disabled={ro} onClick={()=>{unlock();dispatch({type:'apron/accept',activityId:activity.id,sceneId:scene.id})}}>采纳并替换当前提示</Button><Button disabled={ro} onClick={()=>dispatch({type:'apron/dismiss',activityId:activity.id,sceneId:scene.id})}>丢弃建议</Button></div>}
 {!ro&&<Button onClick={()=>setMatching(true)}>查看自动匹配建议</Button>}
 </details>
 {match.suppressed.length>0&&<details className="suppressed"><summary>因限制未采用 {match.suppressed.length} 条提示</summary>{match.suppressed.map(c=><p key={c.id}>{cueById(c.id)?.name}：{c.reason}</p>)}</details>}
 <Modal open={matching} title="替换围裙提示" onClose={()=>setMatching(false)} footer={<><Button onClick={()=>setMatching(false)}>保留当前</Button><Button variant="primary" onClick={()=>{unlock();dispatch({type:'apron/suggest',activityId:activity.id,suggestions:{[scene.id]:match.safe}});dispatch({type:'apron/accept',activityId:activity.id,sceneId:scene.id});setMatching(false)}}>采用建议</Button></>}>
 <p>当前：{scene.cueIds.map(id=>cueById(id)?.name??id).join('、')||'无'}</p><p>建议：{match.safe.map(id=>cueById(id)?.name).join('、')||'无'}</p><p>因限制未采用 {match.suppressed.length} 条，具体原因仍保留在环节中。</p>
 </Modal>
 </section>;
}

export function StorylineView({activity}:{activity:Activity}){
 const {dispatch}=useStore();const d=activity.draft,st=d.story,ro=activity.draftLocked;
 const unlock=()=>{if(st?.confirmed)dispatch({type:'story/unlock',activityId:activity.id})};
 if(!st)return <p>暂无故事线。生成整课初稿后，可在此通读完整叙事。</p>;
 return <div className="storyline"><h2>完整故事线</h2><TextArea label="故事标题" value={st.title} readOnly={ro} minRows={1} onChange={title=>{unlock();dispatch({type:'story/edit',activityId:activity.id,patch:{title}})}}/>
 <TextArea label="故事梗概" value={st.summary} readOnly={ro} onChange={summary=>{unlock();dispatch({type:'story/edit',activityId:activity.id,patch:{summary}})}}/>
 <details><summary>角色 · {st.characters.map(c=>c.name).join('、')}</summary>{st.characters.map(c=><div className="character-row" key={c.id}><TextArea id={`character-name-${c.id}`} label="角色名称" minRows={1} readOnly={ro} value={c.name} onChange={name=>{unlock();dispatch({type:'character/upsert',activityId:activity.id,character:{...c,name}})}}/><TextArea id={`character-desc-${c.id}`} label="角色说明" readOnly={ro} value={c.description} onChange={description=>{unlock();dispatch({type:'character/upsert',activityId:activity.id,character:{...c,description}})}}/>{!ro&&<Button variant="ghost" onClick={()=>{unlock();dispatch({type:'character/remove',activityId:activity.id,id:c.id})}}>移除角色</Button>}</div>)}{!ro&&<Button onClick={()=>{unlock();dispatch({type:'character/upsert',activityId:activity.id,character:{id:uid('ch'),name:'新角色',description:''}})}}>添加角色</Button>}</details>
 <ol className="story-scenes">{d.steps.map((s,i)=>{const sc=st.scenes.find(sc=>sc.stepId===s.id);return <li key={s.id}><p className="eyebrow">第 {i+1} 幕 · {s.fields.title}</p><h3>{sc?.title||'缺少场景'}</h3><p>{sc?.narration}</p><p className="muted">{sc?.node.prompt} → {sc?.node.expected}</p></li>})}</ol>
 {st.scenes.filter(sc=>!d.steps.some(s=>s.id===sc.stepId)).map(sc=><div key={sc.id} className="notice notice-warn"><p>场景「{sc.title}」原环节已删除，请重新关联：</p><select className="input" aria-label={`重新关联 ${sc.title}`} value="" disabled={ro} onChange={e=>{unlock();dispatch({type:'scene/edit',activityId:activity.id,sceneId:sc.id,patch:{stepId:e.target.value}})}}><option value="">选择教学环节</option>{d.steps.map(s=><option key={s.id} value={s.id}>{s.fields.title}</option>)}</select></div>)}
 </div>;
}
