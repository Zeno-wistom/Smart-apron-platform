import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Action } from '../../domain/reducer';
import { useStore } from '../../app/store';
import { Button, TextArea } from '../../components/ui';
import { uid, feedbackCatalog, cueById } from '../../domain/fixtures';
import { courseIssues } from '../../domain/courseChecks';
import type { Activity, ChildProfile, CourseFlow, CourseOutlineItem } from '../../domain/types';
import { completeSteps, generateStory } from '../../services/mockAi';
import { simControls } from '../../services/simControls';
import { prepareLesson } from '../../services/prepareLesson';
import { GoalEditor } from './GoalEditor';
import { StepEditor } from './StepEditor';
import './course.css';
const phases:CourseFlow['stage'][]=['goal','outline','document','review'];
type LocalAction = Action extends infer T ? T extends {activityId:string} ? Omit<T,'activityId'> : never : never;
const labels=['确定目标','安排整堂课','完善教案','审核完成'];
export function CoursePage({activity:a,child}:{activity:Activity;child:ChildProfile}){
 const store=useStore(), {dispatch}=store,d=a.draft,c=d.courseFlow!;
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState<string>(),[view,setView]=useState('lesson'),[checked,setChecked]=useState<number>(),[savedApproval,setSavedApproval]=useState(false);
 const stage=c.stage,locked=a.draftLocked;
 const send=(action:LocalAction)=>dispatch({...action,activityId:a.id} as Action);
 const go=(s:CourseFlow['stage'])=>{send({type:'course/stage',stage:s});setSelected(undefined);setError('');window.scrollTo(0,0);};
 const issues=courseIssues(d),candidate=c.candidate;
 const generate=async(kind:'outline'|'detail')=>{
  if(busy)return;setBusy(true);setError('');const revision=d.revision;
  try{
   let result:NonNullable<CourseFlow['candidate']>;
   if(kind==='outline'){
    await new Promise(r=>setTimeout(r,simControls.latency(600)));if(simControls.consumeAiFailure())throw Error('本次 AI 建议未生成，请重试或自己编排。');
    const outline:CourseOutlineItem[]=[['认识活动','熟悉本课材料与情境','warmup',true],['一起练习','围绕目标进行互动练习','practice',true],['回顾与结束','回顾经历并结束本次活动','review',false]].map(([title,purpose,role,story])=>({id:uid('step'),title:String(title),purpose:String(purpose)+'；本课目标：'+d.goal.text+(d.notes?'；教师要求：'+d.notes:''),role:role as CourseOutlineItem['role'],story:Boolean(story),minutes:5}));
    result={revision,kind,outline};
   }else{
    if(!c.outline.length||c.outline.some(o=>!o.title.trim()||!o.purpose.trim()||o.minutes<=0||o.minutes>30))throw Error('请补充每个活动的标题、目的及 1–30 分钟的预计时长。');
    const generated=await completeSteps({child,goalText:d.goal.text,goalObserve:d.goal.observe,constraints:d.constraints,notes:d.notes,steps:d.steps},d.steps.map(s=>s.id));
    const steps=d.steps.map(s=>{const o=c.outline.find(x=>x.id===s.id)!;const g=generated.find(x=>x.stepId===s.id)!;return {...s,fields:{...g.fields,title:o.title,minutes:o.minutes,teacherScript:o.story?o.purpose+'。'+g.fields.teacherScript:o.purpose+'。教师先说明活动，给儿童充分等待时间，根据回应调整提示。'+(d.notes?'本课备注：'+d.notes:''),childInteraction:o.story?g.fields.childInteraction:'邀请儿童参与“'+o.title+'”，允许通过已有沟通方式回应或暂停。',observe:o.story?g.fields.observe:d.goal.observe},status:'draft' as const,source:'ai' as const,basedOnGoalRev:d.goal.rev,rev:s.rev+1};});
    const storySteps=steps.filter(s=>c.outline.find(o=>o.id===s.id)?.story);
    const story=storySteps.length?await generateStory(child,d.goal.text,storySteps,d.constraints):undefined;
    const interactions=Object.fromEntries(c.outline.map((o)=>[o.id,{cueIds:['cue-turn-card'],allowPause:true,narration:story?.scenes.find(sc=>sc.stepId===o.id)?.narration||''}]));
    result={revision,kind,steps,interactions,story:story?{title:story.title,summary:story.summary,characters:story.characters}:undefined};
   }
   const now=store.latest().activities.find(x=>x.id===a.id);if(!now||now.draftLocked||now.draft.revision!==revision)throw Error('你刚修改了内容，本次建议已过期，请重新生成。');
   send({type:'course/candidate',candidate:result});
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 };
 const outline=(items:CourseOutlineItem[])=>send({type:'course/outline',outline:items});
 const updateOutline=(id:string,patch:Partial<CourseOutlineItem>)=>outline(c.outline.map(o=>o.id===id?{...o,...patch}:o));
 const approve=()=>{
  if(checked!==d.revision||issues.length)return;
  send({type:'plan/approve-ready',expectedRevision:d.revision,versionId:uid('ver'),at:new Date().toISOString()});
  const now=store.latest().activities.find(x=>x.id===a.id);if(!now?.draftLocked){setError('教案已变化，请重新审核。');return;}
  if(store.saveNow()){setSavedApproval(true);setError('');}else setError('批准教案尚未保存成功，请重试保存；不会开始传输。');
 };
 const transfer=async()=>{setBusy(true);setError('');try{await prepareLesson({latest:store.latest,dispatch,persist:store.saveNow},a.id,d.revision);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const completed=locked&&(savedApproval||store.save.kind==='saved');
 const transferred=a.transfers.some(t=>t.ok&&t.versionId===a.versions.at(-1)?.id);
 const current=d.steps.find(s=>s.id===selected);
 return <main className="course-page">
  <nav className="course-phases" aria-label="备课任务">{phases.map((p,i)=><button key={p} disabled={locked||(p!=='goal'&&!d.goal.text.trim())||((p==='document'||p==='review')&&!c.expanded)} aria-current={stage===p?'step':undefined} onClick={()=>go(p)}>{i+1}. {labels[i]}</button>)}</nav>
  <div className="course-context"><strong>{child.name}（虚构）</strong><span>{d.goal.text||'先确定这堂课希望练习什么'}</span><details><summary>儿童资料与本课限制（参考）</summary><p>{child.summary}</p>{child.communication.map(x=><p key={x}>{x}</p>)}{d.constraints.map(x=><p key={x.id}>{x.text}</p>)}<p>AI、围裙与课堂均为本地模拟。正式研究对故事使用的要求仍待核实。</p></details></div>
  {error&&<p role="alert" className="notice notice-warn">{error}</p>}
  {locked?<section className="course-paper"><h1>{completed?'教案已完成':'教案批准后尚未保存成功'}</h1><p>本次审核版本 v{a.versions.at(-1)?.versionNo} 已保留。{transferred?'模拟传输成功，可以进入模拟课堂。':'围裙尚未完成模拟传输。'}</p>{!completed?<Button onClick={()=>{if(store.saveNow()){setSavedApproval(true);setError('');}}}>重试保存批准教案</Button>:<Button variant="primary" loading={busy} disabled={transferred} onClick={transfer}>{transferred?'模拟传输成功':'模拟传输至围裙'}</Button>}<p>传输失败可重试，不需要重新批准。历史版本与课堂引用保持不变。</p><CourseDocument activity={a}/></section>:<>
  {stage==='goal'&&<section className="course-paper"><GoalEditor integrated activity={a} child={child} onNext={()=>go('outline')}/><footer className="course-actions"><span>目标与观察方式填写后，下一步是安排整堂课。</span><Button variant="primary" onClick={()=>{if(!d.goal.text.trim()||!d.goal.observe.trim()){setError('请填写教学目标与观察方式。');return;}go('outline');}}>根据这些目标安排课程</Button></footer></section>}
  {stage==='outline'&&<section className="course-paper course-arrangement"><h1>这堂课准备怎样进行？</h1><p>先决定活动顺序、目的和故事使用位置，再展开详细内容。活动数量由你决定。</p>{c.expanded?<><p>本课已经展开。原安排保留为参考，请在完整教案中修改具体内容。</p><Button onClick={()=>go('document')}>返回完整教案</Button></>:<>
   {!candidate&&<div className="course-actions"><Button icon={Sparkles} variant="ai" loading={busy} onClick={()=>generate('outline')}>AI 建议简短安排</Button><Button onClick={()=>outline([...c.outline,{id:uid('step'),title:'新活动',purpose:'',minutes:5,story:false,role:'practice'}])}>自己添加活动</Button></div>}
   {candidate?.kind==='outline'&&<section className="course-suggestion"><h2>AI 安排建议 · 尚未采纳</h2>{c.outline.length>0&&<p>采用后将替换当前简短安排；尚未展开详细教案。</p>}{candidate.outline!.map((o,i)=><p key={o.id}>{i+1}. {o.title} · {o.purpose} · {o.minutes} 分钟 · {o.story?'融入连续故事':'不使用故事，仍可使用围裙'}</p>)}<Button disabled={candidate.revision!==d.revision} onClick={()=>send({type:'course/adopt'})}>采用这个安排，继续调整</Button><Button onClick={()=>send({type:'course/discard'})}>放弃建议</Button>{candidate.revision!==d.revision&&<p>内容已变化，请放弃旧建议后重新生成。</p>}</section>}
   {c.outline.map((o,i)=><article className="course-outline" key={o.id}><h2>活动 {i+1}</h2><TextArea minRows={1} id={`outline-title-${o.id}`} label="活动名称" value={o.title} onChange={title=>updateOutline(o.id,{title})}/><TextArea minRows={1} id={`outline-purpose-${o.id}`} label="活动目的" value={o.purpose} onChange={purpose=>updateOutline(o.id,{purpose})}/><label>预计分钟 <input type="number" min="1" max="30" value={o.minutes} onChange={e=>updateOutline(o.id,{minutes:Number(e.target.value)})}/></label><label><input type="checkbox" checked={o.story} onChange={e=>updateOutline(o.id,{story:e.target.checked})}/>在这里使用故事（可延续上一活动）</label><p>无故事活动同样可以使用视觉、声音及暂停设置。</p><Button disabled={!i} onClick={()=>{const items=[...c.outline];[items[i-1],items[i]]=[items[i],items[i-1]];outline(items);}}>上移活动</Button><Button disabled={c.outline.length===1} onClick={()=>outline(c.outline.filter(x=>x.id!==o.id))}>删除活动</Button></article>)}
   {candidate?.kind==='detail'&&<section className="course-suggestion"><h2>详细教案建议 · 尚未加入正文</h2>{candidate.story&&<><h3>故事《{candidate.story.title}》</h3><p>{candidate.story.summary}</p><p>角色：{candidate.story.characters.map(x=>x.name).join('、')}</p></>}{candidate.steps!.map(s=><article key={s.id}><h3>{s.fields.title}</h3><p>{s.fields.teacherScript}</p><p>儿童参与：{s.fields.childInteraction}</p><p>观察：{s.fields.observe}</p><p>故事：{candidate.interactions![s.id].narration||'本环节不使用故事'}</p><p>围裙：教师触发轮流图卡，允许暂停（模拟）</p></article>)}<Button variant="primary" disabled={candidate.revision!==d.revision} onClick={()=>{send({type:'course/adopt'});window.scrollTo(0,0);}}>使用这份初稿，开始修改</Button><Button onClick={()=>send({type:'course/discard'})}>放弃这份建议</Button>{candidate.revision!==d.revision&&<p>安排或目标已变化，请放弃旧建议并重新生成。</p>}</section>}
   {c.outline.length>0&&!candidate&&<footer className="course-actions"><Button onClick={()=>go('goal')}>返回目标</Button><Button variant="primary" loading={busy} onClick={()=>generate('detail')}>按这个安排生成教案</Button></footer>}
  </>}</section>}
  {stage==='document'&&<section className="course-paper"><h1>{current?'编辑：'+current.fields.title:'整堂课的教案'}</h1><p>初稿已加入教案，仍需你审阅；编辑自动保存，不要求逐节锁定。</p>{d.steps.some(s=>s.needsReview)&&<div className="notice notice-warn"><p>目标或限制已变化，请通读本课并核对所有互动配置。内容保留。</p><Button onClick={()=>send({type:'plan/review-related',expectedRevision:d.revision})}>我已核对，以上内容仍适用</Button></div>}
   {current?<><Button onClick={()=>setSelected(undefined)}>返回整课查看</Button><h2>教师行动与儿童参与</h2><div className="course-suggestion"><h3>✦ AI 帮我调整当前环节</h3><StepEditor integrated activity={a} child={child} step={current} index={d.steps.indexOf(current)} onGo={setSelected}/></div>{(['title','teacherScript','childInteraction','observe'] as const).map((f,i)=><TextArea key={f} label={['活动名称','教师引导','儿童参与','观察方式'][i]} value={current.fields[f]} onChange={v=>send({type:'step/edit',stepId:current.id,patch:{[f]:v}})}/>)}<label>预计时长（分钟）<input type="number" min="1" max="30" value={current.fields.minutes} onChange={e=>send({type:'step/edit',stepId:current.id,patch:{minutes:Number(e.target.value)}})}/></label><InteractionEditor activity={a} stepId={current.id}/><footer className="course-actions"><Button variant="primary" onClick={()=>setSelected(undefined)}>返回整课查看</Button>{d.steps[d.steps.indexOf(current)+1]&&<Button onClick={()=>setSelected(d.steps[d.steps.indexOf(current)+1].id)}>下一环节：{d.steps[d.steps.indexOf(current)+1].fields.title}</Button>}</footer></>:<><div className="course-actions">{[['lesson','通读教案'],['story','通读故事'],['apron','查看围裙互动']].map(([v,label])=><Button key={v} onClick={()=>setView(v)} aria-pressed={view===v}>{label}</Button>)}</div>{view==='story'&&c.story&&<><TextArea label="故事名称" value={c.story.title} onChange={title=>send({type:'course/story',title,summary:c.story!.summary})}/><TextArea label="故事梗概" value={c.story.summary} onChange={summary=>send({type:'course/story',title:c.story!.title,summary})}/></>}<CourseDocument activity={a} view={view} edit={setSelected}/><footer className="course-actions"><Button onClick={()=>go('goal')}>修改目标与限制</Button><Button variant="primary" onClick={()=>go('review')}>检查并完成备课</Button></footer></>}
  </section>}
  {stage==='review'&&<section className="course-paper"><h1>审核并完成备课</h1><p>请核对目标、整课内容、故事使用和所有围裙互动。程序只检查已知规则，自由文本要求需人工判断。</p>{issues.map((x,i)=><div className="notice notice-warn" key={x.id}>{x.text}<Button onClick={()=>{go(x.target.focus==='goal'?'goal':'document');if(x.target.focus==='step')setSelected(x.target.stepId);}}>查看并处理 {i+1}</Button></div>)}<CourseDocument activity={a}/><label className="course-ack"><input type="checkbox" checked={checked===d.revision} onChange={e=>setChecked(e.target.checked?d.revision:undefined)}/>我已核对教案、儿童限制及围裙互动，同意使用本次审核版本。</label><footer className="course-actions"><Button onClick={()=>go('document')}>返回修改</Button><Button variant="primary" disabled={issues.length>0||checked!==d.revision} onClick={approve}>确认教案，完成备课</Button></footer></section>}
  </>}
 </main>;
}
function InteractionEditor({activity:a,stepId}:{activity:Activity;stepId:string}){
 const {dispatch}=useStore(),c=a.draft.courseFlow!,i=c.interactions[stepId],o=c.outline.find(o=>o.id===stepId);if(!i)return null;
 const change=(patch:Partial<typeof i>)=>dispatch({type:'course/interaction',activityId:a.id,stepId,patch});
 return <section className="course-outline"><h2>故事与围裙互动</h2><label><input type="checkbox" checked={!!o?.story} onChange={e=>dispatch({type:'course/story-use',activityId:a.id,stepId,useStory:e.target.checked})}/>本活动使用故事（关闭会保留原文，通读与审核不使用它）</label>{o?.story?<TextArea label="故事讲述" value={i.narration} onChange={narration=>change({narration})}/>:<p>本活动不使用故事；围裙互动独立可用。</p>}<h3>在这个活动中，围裙会做什么？（模拟）</h3>{i.cueIds.filter(id=>!cueById(id)).map(id=><Button key={id} onClick={()=>change({cueIds:i.cueIds.filter(x=>x!==id)})}>移除未知提示 {id}</Button>)}{feedbackCatalog.map(cue=><label className="course-cue" key={cue.id}><input type="checkbox" checked={i.cueIds.includes(cue.id)} onChange={()=>change({cueIds:i.cueIds.includes(cue.id)?i.cueIds.filter(x=>x!==cue.id):[...i.cueIds,cue.id]})}/>{cue.name} · {cue.channel==='sound'?'声音':'视觉'} · {cue.trigger==='auto'?'自动触发':'教师触发'}</label>)}<label><input type="checkbox" checked={i.allowPause} onChange={e=>change({allowPause:e.target.checked})}/>允许儿童暂停，教师等待后继续</label>{courseIssues(a.draft).filter(x=>x.target.focus==='step'&&x.target.stepId===stepId&&x.id.startsWith('cue')).map(x=><p className="notice notice-warn" key={x.id}>需要处理：{x.text}</p>)}<p className="small muted">AI 初稿使用教师触发的视觉提示，未自动加入声音。是否满足本课其他要求，请教师核对。</p></section>;
}
export function CourseDocument({activity:a,view='lesson',edit}:{activity:Activity;view?:string;edit?:(id:string)=>void}){
 const d=a.draft,c=d.courseFlow!;return <div><p><strong>目标：</strong>{d.goal.text}</p><p>观察方式：{d.goal.observe}</p><p>{d.steps.length} 个活动 · 约 {d.steps.reduce((n,s)=>n+s.fields.minutes,0)} 分钟 · {c.outline.filter(o=>o.story).length} 个活动融入故事</p>{d.constraints.map(x=><p key={x.id}>本课要求：{x.text}</p>)}{c.story&&view!=='apron'&&<section className="course-outline"><h2>故事《{c.story.title}》</h2><p>{c.story.summary}</p><p>角色：{c.story.characters.map(x=>x.name).join('、')}</p></section>}{d.steps.map((s,index)=>{const i=c.interactions[s.id];return <article className="course-outline" key={s.id}><h2>{index+1}. {s.fields.title} <small>{s.fields.minutes} 分钟</small></h2>{view==='lesson'&&<><p><strong>教师：</strong>{s.fields.teacherScript}</p><p><strong>儿童参与：</strong>{s.fields.childInteraction}</p><p><strong>观察：</strong>{s.fields.observe}</p></>}{view!=='apron'&&<p><strong>故事：</strong>{c.outline.find(o=>o.id===s.id)?.story?(i?.narration||'故事待补充'):'本活动不使用故事'}</p>}{view!=='story'&&<p><strong>围裙（模拟）：</strong>{i?.cueIds.map(id=>{const q=cueById(id);return q?`${q.name}（${q.trigger==='teacher'?'教师触发':'自动'}）`:'未知提示';}).join('、')||'不使用反馈'} · {i?.allowPause?'允许暂停':'未允许暂停'}</p>}{edit&&<Button onClick={()=>edit(s.id)}>编辑这个环节</Button>}</article>;})}</div>;
}
