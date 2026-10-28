import {useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Plus, Trash2, ArrowLeft, ArrowRight} from 'lucide-react';
import {useStore} from '../../app/store';
import {Button, Modal, TextArea} from '../../components/ui';
import {ROLE_LABEL} from '../../domain/fixtures';
import type {Activity,ChildProfile,StepFields} from '../../domain/types';
import {GoalEditor} from './GoalEditor';
import {LessonDraft} from './LessonDraft';
import {StepEditor} from './StepEditor';
import {SceneCard,StorylineView} from '../story/SceneCard';

export function PreparationWorkspace({activity,child}:{activity:Activity;child:ChildProfile}){
 const [params,setParams]=useSearchParams();const {dispatch,latest}=useStore();const d=activity.draft;
 const [reference,setReference]=useState(false),[storyline,setStoryline]=useState(false),[affected,setAffected]=useState<number|null>(null),[removing,setRemoving]=useState(false);
 const raw=params.get('focus');const selected=raw?.startsWith('step-')?d.steps.find(s=>s.id===raw.slice(5)):undefined;
 const index=selected?d.steps.indexOf(selected):-1;
 const go=(id:string)=>setParams({focus:id==='goal'?'goal':`step-${id}`});
 useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});},[selected?.id]);
 useEffect(()=>{if(params.get('panel')==='story')setStoryline(true);},[params]);
 const needs=d.steps.filter(s=>s.needsReview);
 const openEdit=()=>{if(d.goal.confirmed||d.steps.some(s=>s.status==='confirmed')||d.story?.confirmed||d.story?.apronConfirmed)dispatch({type:'plan/resume-editing',activityId:activity.id})};
 const edit=(patch:Partial<StepFields>)=>{if(!selected)return;openEdit();dispatch({type:'step/edit',activityId:activity.id,stepId:selected.id,patch})};
 return <div className="preparation-workspace">
 <aside className="step-rail" aria-label="环节轨道"><p className="eyebrow">本课结构</p><button className={!selected?'on':''} onClick={()=>go('goal')}>教学目标<span>{d.goal.text?'已填写':'待填写'}</span></button><ol>{d.steps.map((s,i)=><li key={s.id}><button className={selected?.id===s.id?'on':''} onClick={()=>go(s.id)} data-testid={`rail-step-${i+1}`}><b>{i+1}</b><span className="grow">{s.fields.title||ROLE_LABEL[s.role]}<small>{ROLE_LABEL[s.role]} · {s.fields.minutes} 分钟</small></span><span className="rail-state" aria-label={s.needsReview?'需复核':s.candidate?'候选待处理':s.status==='empty'?'待填写':'有内容'}>{s.needsReview?'!':s.candidate?'?':s.status==='empty'?'○':'·'}</span></button></li>)}</ol>
 {!activity.draftLocked&&<Button variant="ghost" icon={Plus} onClick={()=>{const before=new Set(d.steps.map(s=>s.id));dispatch({type:'step/add',activityId:activity.id,afterStepId:selected?.id});const added=latest().activities.find(a=>a.id===activity.id)!.draft.steps.find(s=>!before.has(s.id));if(added)go(added.id)}}>添加环节</Button>}
 <div className="rail-tools"><Button variant="ghost" onClick={()=>setStoryline(true)}>完整故事线</Button><Button variant="ghost" onClick={()=>setReference(true)}>儿童与教学参考</Button></div>
 </aside>
 <main className="lesson-paper" aria-label="备课正文">
 {(needs.length>0||d.story?.needsReview)&&<div className="notice notice-warn"><div className="grow">上游内容有变更，{needs.length} 个环节{d.story?.needsReview?'与故事线':''}需重新核对。</div><Button onClick={()=>setAffected(d.revision)}>查看受影响内容</Button></div>}
 <LessonDraft activity={activity} child={child}/>
 {!selected?<GoalEditor integrated activity={activity} child={child} onNext={()=>go(d.steps[0].id)}/>:<>
 <header className="step-heading"><p className="eyebrow">{ROLE_LABEL[selected.role]} · 第 {index+1} / {d.steps.length} 节</p><div className="row"><h1 className="grow">{selected.fields.title||'编排教学环节'}</h1>{!activity.draftLocked&&d.steps.length>1&&<Button variant="ghost" icon={Trash2} aria-label="删除此环节" onClick={()=>setRemoving(true)}/>}</div></header>
 <section className="teaching-fields"><h2>教师做什么</h2><div className="stack">{(['title','teacherScript','childInteraction','observe'] as const).map(f=><TextArea key={f} id={`step-${f}`} label={{title:'环节标题',teacherScript:'教师引导语',childInteraction:'儿童互动',observe:'观察要点'}[f]} value={selected.fields[f]} onChange={v=>edit({[f]:v})} readOnly={activity.draftLocked} minRows={f==='title'?1:2}/>)}<div className="field"><label className="field-label" htmlFor="step-minutes">预计时长（分钟）</label><input id="step-minutes" className="input" type="number" min={1} max={30} value={selected.fields.minutes} readOnly={activity.draftLocked} onChange={e=>edit({minutes:Number(e.target.value)})}/></div></div></section>
 <details className="single-rewrite"><summary>需要另一种写法？</summary><StepEditor integrated activity={activity} child={child} step={selected} index={index} onGo={go}/></details>
 {d.story?.scenes.filter(sc=>sc.stepId===selected.id).map(sc=><SceneCard key={sc.id} activity={activity} scene={sc}/>)}
 {d.story&&!d.story.scenes.some(sc=>sc.stepId===selected.id)&&<p className="notice notice-warn">此环节暂无故事场景，请在完整故事线中补充关联场景。</p>}
 <footer className="lesson-nav"><Button variant="ghost" icon={ArrowLeft} onClick={()=>go(index>0?d.steps[index-1].id:'goal')}>上一节</Button><span className="grow"/>{d.steps[index+1]&&<Button variant="ghost" iconRight={ArrowRight} onClick={()=>go(d.steps[index+1].id)}>下一节</Button>}</footer>
 </>}
 </main>
 <Modal drawer width={420} open={reference} title="儿童与教学参考" onClose={()=>setReference(false)}><h2>{child.name} · {child.ageLabel}</h2><p>{child.summary}</p><h3>沟通特点</h3>{child.communication.map(s=><p key={s}>{s}</p>)}<h3>感官限制</h3>{d.constraints.map(c=><p key={c.id}>{c.text}</p>)}<h3>教学目标</h3><p>{d.goal.text}</p><h3>教师备注</h3><p>{d.notes||'暂无'}</p></Modal>
 <Modal width={960} open={storyline} title="故事线与角色" onClose={()=>{setStoryline(false);if(params.get('panel')==='story'){const next=new URLSearchParams(params);next.delete('panel');setParams(next,{replace:true})}}}><StorylineView activity={activity}/></Modal>
 <Modal width={900} open={affected!==null} title="核对受影响的教学内容" onClose={()=>setAffected(null)} footer={<><Button onClick={()=>setAffected(null)}>返回修改</Button><Button variant="primary" disabled={affected!==d.revision} onClick={()=>{dispatch({type:'plan/review-related',activityId:activity.id,expectedRevision:affected!});setAffected(null)}}>以上内容仍适用于当前目标与限制</Button></>}>
 <h3>当前目标</h3><p>{d.goal.text}</p><p>{d.goal.observe}</p>{d.constraints.map(c=><p key={c.id}>{c.text}</p>)}
 {needs.map(s=><article className="draft-change" key={s.id}><h3>{s.fields.title}</h3><p>{s.needsReview}</p><p>{s.fields.teacherScript}</p><p>{s.fields.childInteraction}</p><p>观察：{s.fields.observe}</p>{d.story?.scenes.filter(sc=>sc.stepId===s.id).map(sc=><p key={sc.id}>故事：{sc.narration} · {sc.node.prompt}</p>)}</article>)}
 {d.story&&<StorylineView activity={{...activity,draftLocked:true}}/>}
 {affected!==d.revision&&<p role="alert">核对期间内容已变化，请关闭后重新检查。</p>}
 </Modal>
 <Modal open={removing} title="删除此教学环节？" onClose={()=>setRemoving(false)} footer={<><Button onClick={()=>setRemoving(false)}>取消</Button><Button variant="danger" onClick={()=>{if(selected){dispatch({type:'step/remove',activityId:activity.id,stepId:selected.id});go('goal')}setRemoving(false)}}>删除</Button></>}><p>删除「{selected?.fields.title}」；故事中的关联场景仍保留，需重新关联。批准历史不变。</p></Modal>
 </div>;
}
