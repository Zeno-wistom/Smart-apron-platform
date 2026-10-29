import { describe,it,expect } from 'vitest';
import { initialData,newActivity,uid } from './fixtures';
import { reducer } from './reducer';
import { blockingIssues,checksum } from './checks';
import { preflightBlocks } from './preflight';
import { simulateSession } from '../services/mockAi';
import type { AppData,CourseOutlineItem } from './types';
function start(){const data=initialData(),a=newActivity(data.children[0],'C');a.draft.steps=[];a.draft.goal.text='轮流';a.draft.goal.observe='记录回应';a.draft.courseFlow={stage:'outline',outline:[],interactions:{},expanded:false};data.activities=[a];return data;}
function ready(){let data=start();const a=data.activities[0],id=a.id;const outline:CourseOutlineItem[]=[{id:'s',title:'练习',purpose:'轮流',minutes:4,story:false,role:'practice'}];data=reducer(data,{type:'course/outline',activityId:id,outline});const d=data.activities[0].draft;data=reducer(data,{type:'course/candidate',activityId:id,candidate:{kind:'detail',revision:d.revision,steps:d.steps.map(s=>({...s,status:'draft',fields:{title:'练习',teacherScript:'教师提示',childInteraction:'邀请回应',observe:'记录回应',minutes:4}})),interactions:{s:{cueIds:['cue-turn-card'],allowPause:true,narration:''}}}});return reducer(data,{type:'course/adopt',activityId:id});}
function approve(data:AppData){return reducer(data,{type:'plan/approve',activityId:data.activities[0].id,versionId:uid('v'),at:'now'});}
describe('方案 C additive contract',()=>{
 it('无故事环节独立反馈可批准，快照与课堂包含反馈',()=>{const data=ready();expect(data.activities[0].draft.story).toBeNull();expect(preflightBlocks(data.activities[0].draft)).toEqual([]);const a=approve(data).activities[0];expect(a.draftLocked).toBe(true);expect(simulateSession(a.versions[0]).events.some(e=>e.kind==='cue')).toBe(true);});
 it('未知反馈通过旧批准action也不能绕过',()=>{const data=ready();data.activities[0].draft.courseFlow!.interactions.s.cueIds=['unknown'];expect(approve(data).activities[0].draftLocked).toBe(false);});
 it('无故事自动声音冲突阻止批准',()=>{const data=ready();data.activities[0].draft.courseFlow!.interactions.s.cueIds=['cue-horn'];expect(blockingIssues(data.activities[0].draft).length).toBeGreaterThan(0);expect(approve(data).activities[0].draftLocked).toBe(false);});
 it('暂停冲突仍然阻断',()=>{const data=ready();data.activities[0].draft.courseFlow!.interactions.s.allowPause=false;expect(preflightBlocks(data.activities[0].draft).some(x=>x.text.includes('暂停'))).toBe(true);});
 it('安排候选尚未采纳不改正文，目标改变使其过期',()=>{let data=start();const id=data.activities[0].id;data=reducer(data,{type:'course/candidate',activityId:id,candidate:{kind:'outline',revision:1,outline:[{id:'s',title:'A',purpose:'B',minutes:4,story:false,role:'practice'}]}});expect(data.activities[0].draft.steps).toHaveLength(0);data=reducer(data,{type:'goal/edit',activityId:id,patch:{text:'新目标'}});expect(reducer(data,{type:'course/adopt',activityId:id})).toBe(data);});
 it('目标变化要求复核，不能直接批准',()=>{let data=ready();data=reducer(data,{type:'goal/edit',activityId:data.activities[0].id,patch:{text:'指认'}});expect(approve(data).activities[0].draftLocked).toBe(false);});
 it('新稿启用故事必须填写旁白',()=>{let data=ready();data=reducer(data,{type:'course/story-use',activityId:data.activities[0].id,stepId:'s',useStory:true});expect(preflightBlocks(data.activities[0].draft).some(x=>x.id==='story-s')).toBe(true);});
 it('继续修订与互动修改不污染批准快照',()=>{let data=approve(ready());const id=data.activities[0].id,v=data.activities[0].versions[0],sum=checksum(v.snapshot);data=reducer(data,{type:'plan/resume-editing',activityId:id});data=reducer(data,{type:'course/interaction',activityId:id,stepId:'s',patch:{cueIds:[]}});expect(checksum(data.activities[0].versions[0].snapshot)).toBe(sum);});
 it('旧稿仍需故事，不能被新规则放宽',()=>{const data=ready();delete data.activities[0].draft.courseFlow;expect(blockingIssues(data.activities[0].draft).some(x=>x.id==='story-none')).toBe(true);});
});
