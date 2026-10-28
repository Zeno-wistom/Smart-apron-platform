import {useEffect,useState} from 'react';
import {Link,Navigate,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {Topbar} from '../../app/Shell';
import {useActivity,useStore} from '../../app/store';
import {Button,Modal} from '../../components/ui';
import {preflightBlocks} from '../../domain/preflight';
import type {Activity} from '../../domain/types';
import {PreparationWorkspace} from '../plan/PreparationWorkspace';
import {PreflightDrawer} from '../review/PreflightDrawer';
import {PlanDocument} from '../review/PlanDocument';
import {ClassStage} from '../class/ClassStage';

export function ActivityPage(){
 const {activityId,stage:raw}=useParams();const {activity,child}=useActivity(activityId);const {dispatch}=useStore();const nav=useNavigate();const [params]=useSearchParams();
 const [preflight,setPreflight]=useState(false),[documentOpen,setDocumentOpen]=useState(false),[versionId,setVersionId]=useState('draft');
 const mode=raw==='class'?'class':'plan';
 useEffect(()=>{
 if(!activity)return;
 if(raw==='story'||raw==='review'){
 const next=new URLSearchParams(params);
 if(raw==='review'){if(next.get('version')){setVersionId(next.get('version')!);setDocumentOpen(true)}else setPreflight(true);}
 if(raw==='story'){
 const focus=next.get('focus');const sc=activity.draft.story?.scenes.find(s=>s.id===focus?.replace(/^scene-/,''));
 if(sc)next.set('focus',`step-${sc.stepId}`);else next.set('panel','story');
 }
 nav(`/activities/${activity.id}/plan?${next}`,{replace:true});
 }
 },[activity?.id,raw]);
 useEffect(()=>{if(activity)dispatch({type:'activity/stage',activityId:activity.id,stage:mode})},[activity?.id,mode,dispatch]);
 if(!activity||!child)return <Navigate to="/" replace/>;
 const d=activity.draft,latest=activity.versions.at(-1),blocks=activity.draftLocked?0:preflightBlocks(d).length;
 const version=activity.versions.find(v=>v.id===versionId);
 return <>
 <Topbar right={<>
 <nav className="mode-switch" aria-label="教学活动模式"><button aria-current={mode==='plan'?'page':undefined} onClick={()=>nav(`/activities/${activity.id}/plan`)}>备课</button><button aria-current={mode==='class'?'page':undefined} onClick={()=>nav(`/activities/${activity.id}/class`)}>课堂与复盘</button></nav>
 {mode==='plan'&&<Button variant="primary" onClick={()=>setPreflight(true)} data-testid="open-preflight">课前检查{blocks?` · 待处理 ${blocks} 项`:''}</Button>}
 </>}>
 <Link className="activity-back" to="/" aria-label="返回教学工作台">工作台 /</Link><input className="activity-title" aria-label="活动名称" value={activity.title} onChange={e=>dispatch({type:'activity/rename',activityId:activity.id,title:e.target.value})}/>
 </Topbar>
 <div className="activity-meta"><Link to={`/children/${child.id}`}>{child.name}</Link><span>{activity.draftLocked?`已批准 v${latest?.versionNo}`:d.basedOnVersionNo?`修订中 · 基于 v${d.basedOnVersionNo}`:'备课中'}</span><Button size="sm" variant="ghost" onClick={()=>setDocumentOpen(true)}>完整教案与历史版本</Button>
 {activity.draftLocked&&<Button size="sm" onClick={()=>dispatch({type:'plan/resume-editing',activityId:activity.id})}>继续修订</Button>}</div>
 {mode==='plan'?<PreparationWorkspace key={activity.id} activity={activity} child={child}/>:<ClassStage activity={activity} child={child}/>}
 <PreflightDrawer activity={activity} open={preflight} onClose={()=>setPreflight(false)} onDocument={()=>setDocumentOpen(true)}/>
 <Modal width={1000} open={documentOpen} title="完整教案与历史版本" onClose={()=>setDocumentOpen(false)}>
 <div className="document-tools"><label htmlFor="document-version">查看版本</label><select className="input" id="document-version" value={versionId} onChange={e=>setVersionId(e.target.value)}><option value="draft">{activity.draftLocked?'当前批准内容':'当前草稿'}</option>{activity.versions.map(v=><option value={v.id} key={v.id}>v{v.versionNo} · 批准快照</option>)}</select><Button onClick={()=>window.print()}>打印</Button></div>
 <PlanDocument plan={version?.snapshot??d}/>
 </Modal>
 </>;
}
/** Legacy component retained for unmapped source imports; new activity route uses the unified workspace. */
export function LockedBanner({a}:{a:Activity}){const {dispatch}=useStore();return <div className="locked-banner">v{a.versions.at(-1)?.versionNo} 已批准<Button onClick={()=>dispatch({type:'plan/resume-editing',activityId:a.id})}>继续修订</Button></div>}
