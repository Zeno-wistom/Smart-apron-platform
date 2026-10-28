import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {reducer,type Action} from './reducer';
import {initialData,newActivity,seedChild} from './fixtures';
import {blockingIssues,checksum,sceneConflicts} from './checks';
import {preflightBlocks,preflightReady} from './preflight';
import {cueMatch} from './cueMatch';
import type {PlanDraft,AppData} from './types';
import {composeStep,generateStory,simulateSession} from '../services/mockAi';
import {simControls} from '../services/simControls';
import {prepareLesson} from '../services/prepareLesson';
import {load} from '../services/storage';
simControls.speed=0;
async function ready(){
 let data=initialData();const a=newActivity(seedChild,'新流程');data=reducer(data,{type:'activity/create',activity:a});
 const dispatch=(action:Action)=>{data=reducer(data,action)};
 const get=()=>data.activities[0];
 dispatch({type:'goal/edit',activityId:a.id,patch:{text:'在视觉提示下练习轮流表达',observe:'记录回应与提示层级'}});
 for(const s of get().draft.steps)dispatch({type:'step/edit',activityId:a.id,stepId:s.id,patch:composeStep({child:seedChild,goalText:get().draft.goal.text,goalObserve:get().draft.goal.observe,constraints:get().draft.constraints,notes:'',steps:get().draft.steps,stepId:s.id,variant:0})});
 const d=get().draft,story=await generateStory(seedChild,d.goal.text,d.steps,d.constraints);
 for(const sc of story.scenes)sc.cueIds=cueMatch(sc,d.steps.find(s=>s.id===sc.stepId)!.role,d.constraints).safe;
 data={...data,activities:[{...get(),draft:{...d,story}}]};
 const approve=()=>dispatch({type:'plan/approve-ready',activityId:a.id,versionId:'v1',at:'2026-10-28T00:00:00Z',expectedRevision:get().draft.revision});
 return {get,dispatch,latest:()=>data,approve,id:a.id,replace:(d:PlanDraft)=>{data={...data,activities:[{...get(),draft:d}]}}};
}
describe('集中课前检查的业务桥接',()=>{
 it('一次确认后调用原批准规则并生成深拷贝快照',async()=>{const t=await ready();expect(blockingIssues(t.get().draft).length).toBeGreaterThan(0);expect(preflightReady(t.get().draft)).toBe(true);t.approve();const a=t.get();expect(a.draftLocked).toBe(true);expect(a.versions).toHaveLength(1);expect(blockingIssues(a.draft)).toEqual([]);expect(a.versions[0].snapshot).not.toBe(a.draft);expect(a.versions[0].checksum).toBe(checksum(a.versions[0].snapshot));});
 const blockers:[string,(d:PlanDraft)=>void][]=[
 ['空目标',d=>{d.goal.text=''}],['空观察方式',d=>{d.goal.observe=''}],['空环节',d=>{d.steps[0].status='empty'}],['缺引导语',d=>{d.steps[0].fields.teacherScript=''}],['缺儿童互动',d=>{d.steps[0].fields.childInteraction=''}],['缺观察点',d=>{d.steps[0].fields.observe=''}],['无效时长',d=>{d.steps[0].fields.minutes=NaN}],['目标变更复核',d=>{d.steps[0].needsReview='目标已变'}],['故事待复核',d=>{d.story!.needsReview='环节已改'}],['未处理环节候选',d=>{const s=d.steps[0];s.candidate={kind:'generate',requestId:'pending',fields:s.fields,basedOnGoalRev:d.goal.rev,basedOnStepRev:s.rev,createdAt:'',variant:0}}],['未处理故事候选',d=>{d.storyCandidate={story:d.story!,requestId:'pending',basedOnSig:'old',createdAt:''}}],['未处理整课候选',d=>{d.lessonCandidate={revision:d.revision,steps:[]}}],['未处理围裙建议',d=>{d.story!.scenes[0].suggestedCueIds=['cue-turn-card']}],['声音冲突',d=>{d.story!.scenes[0].cueIds.push('cue-horn')}],['不允许暂停',d=>{d.story!.scenes[0].node.allowPause=false}],['未知提示',d=>{d.story!.scenes[0].cueIds.push('missing')}],['缺旁白',d=>{d.story!.scenes[0].narration=''}],['缺互动',d=>{d.story!.scenes[0].node.prompt=''}],['缺故事场景',d=>{d.story!.scenes.pop()}],['孤立场景',d=>{d.story!.scenes[0].stepId='deleted'}],['无教学环节',d=>{d.steps=[]}],
 ];
 for(const [label,change]of blockers)it(`${label}仍阻断，不能先确认后绕过`,async()=>{const t=await ready();const draft=structuredClone(t.get().draft);change(draft);t.replace(draft);expect(preflightBlocks(draft).length).toBeGreaterThan(0);const before=t.latest();t.approve();expect(t.latest()).toBe(before)});
 it('检查后修改 revision 时拒绝批准',async()=>{const t=await ready();t.dispatch({type:'plan/approve-ready',activityId:t.id,versionId:'v1',at:'',expectedRevision:-1});expect(t.get().versions).toHaveLength(0)});
 it('继续修订解锁当前稿，历史快照/传输/课堂不变',async()=>{const t=await ready();t.approve();const v=structuredClone(t.get().versions[0]);t.dispatch({type:'transfer/record',activityId:t.id,attempt:{id:'tx',versionId:v.id,versionNo:1,ok:true,at:'',message:'',simulated:true}});const session=simulateSession(v);t.dispatch({type:'session/create',activityId:t.id,session});t.dispatch({type:'plan/resume-editing',activityId:t.id});t.dispatch({type:'step/edit',activityId:t.id,stepId:t.get().draft.steps[0].id,patch:{title:'v2 新标题'}});expect(t.get().versions[0]).toEqual(v);expect(t.get().draft.goal.confirmed).toBe(false);expect(t.get().sessions[0].versionId).toBe(v.id);expect(t.get().transfers[0].versionId).toBe(v.id)});
 it('批量复核需要当前 revision，且不能消除孤立场景',async()=>{const t=await ready();t.dispatch({type:'goal/edit',activityId:t.id,patch:{text:'新目标'}});const d=structuredClone(t.get().draft);d.story!.scenes[0].stepId='missing';t.replace(d);t.dispatch({type:'plan/review-related',activityId:t.id,expectedRevision:d.revision});expect(t.get().draft.story!.needsReview).toBeTruthy();expect(t.get().draft.steps[0].needsReview).toBeTruthy()});
 it('限制抑制可追溯，安全 cue 不放宽 sceneConflicts',async()=>{const t=await ready(),d=t.get().draft,sc=d.story!.scenes[0];const result=cueMatch(sc,'warmup',d.constraints);expect(result.suppressed.some(s=>s.id==='cue-horn')).toBe(true);expect(sceneConflicts({...sc,cueIds:result.safe},d.constraints)).toEqual([])});
 it('旧 schemaVersion=1 数据/批准快照/复盘原样恢复',()=>{const env=JSON.parse(readFileSync(new URL('../../tests/e2e/legacy-envelope.json',import.meta.url),'utf8'));const result=load({getItem:()=>JSON.stringify(env)});expect(result.status).toBe('restored');expect(result.data).toEqual(env.data);const a=result.data.activities[0];expect(a.versions[0].checksum).toBe(checksum(a.versions[0].snapshot));expect(a.sessions[0].versionId).toBe(a.versions[0].id)});
});
describe('整课候选保护',()=>{
 it('到达不写正文；源修改后不能采纳，也不能批准',async()=>{const t=await ready();const d=structuredClone(t.get().draft);d.story=null;d.steps[0].status='empty';d.steps[0].fields={title:'',teacherScript:'',childInteraction:'',observe:'',minutes:5};t.replace(d);const s=d.steps[0];const c={revision:d.revision,steps:[{stepId:s.id,rev:s.rev,fields:{title:'候选',teacherScript:'引导',childInteraction:'互动',observe:'观察',minutes:5}}]};t.dispatch({type:'lesson/candidate',activityId:t.id,candidate:c});expect(t.get().draft.steps[0].fields.title).toBe('');t.dispatch({type:'notes/edit',activityId:t.id,notes:'新内容'});t.dispatch({type:'lesson/adopt',activityId:t.id,candidate:c,stepIds:[s.id],includeStory:false});expect(t.get().draft.steps[0].fields.title).toBe('');expect(preflightReady(t.get().draft)).toBe(false)});
 it('新候选不得覆盖教师草稿',async()=>{const t=await ready();const d=t.get().draft,s=d.steps[0],c={revision:d.revision,steps:[{stepId:s.id,rev:s.rev,fields:{...s.fields,title:'不应覆盖'}}]};t.dispatch({type:'lesson/candidate',activityId:t.id,candidate:c});t.dispatch({type:'lesson/adopt',activityId:t.id,candidate:c,stepIds:[s.id],includeStory:false});expect(t.get().draft.steps[0].fields.title).toBe(s.fields.title)});
});
describe('先持久化批准快照，再模拟传输',()=>{
 it('保存失败时连接与传输均不可达，恢复后复用同一批准版本',async()=>{const t=await ready();let saves=0,connects=0,transfers=0;const ctx={latest:t.latest,dispatch:t.dispatch,persist:()=>++saves>1,connect:async()=>{connects++;return {ok:true as const,label:'模拟'}},transfer:async(v:AppData['activities'][number]['versions'][number])=>{transfers++;expect(t.get().draftLocked).toBe(true);expect(saves).toBeGreaterThan(1);return {id:'tx',versionId:v.id,versionNo:v.versionNo,at:'',ok:true,message:'ok',simulated:true as const,receipt:{receiptId:'SIM',checksum:v.checksum,stepCount:5,sceneCount:5}}}};
 await expect(prepareLesson(ctx,t.id,t.get().draft.revision)).rejects.toThrow(/尚未保存/);expect(connects).toBe(0);expect(transfers).toBe(0);expect(t.get().versions).toHaveLength(1);
 await prepareLesson(ctx,t.id,t.get().draft.revision);expect(t.get().versions).toHaveLength(1);expect(transfers).toBe(1);await prepareLesson(ctx,t.id,t.get().draft.revision);expect(transfers).toBe(1);
 });
 it('传输失败后重试不重复批准',async()=>{const t=await ready();let calls=0;const transfer=async(v:AppData['activities'][number]['versions'][number])=>({id:`tx${++calls}`,versionId:v.id,versionNo:v.versionNo,at:'',ok:false,message:'中断',simulated:true as const});const ctx={latest:t.latest,dispatch:t.dispatch,persist:()=>true,connect:async()=>({ok:true as const,label:''}),transfer};for(let i=0;i<2;i++)await expect(prepareLesson(ctx,t.id,t.get().draft.revision)).rejects.toThrow('中断');expect(t.get().versions).toHaveLength(1);expect(t.get().transfers).toHaveLength(2)});
 it('被篡改的批准版本不得开始传输',async()=>{const t=await ready();t.approve();t.get().versions[0].snapshot.goal.text='篡改';await expect(prepareLesson({latest:t.latest,dispatch:t.dispatch,persist:()=>true},t.id,t.get().draft.revision)).rejects.toThrow(/校验失败/)});
});
