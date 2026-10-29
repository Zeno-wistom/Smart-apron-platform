import type { AppData, CourseFlow, CourseOutlineItem, CourseInteraction } from './types';
import { emptyStep } from './fixtures';
export type CourseAction =
 | {type:'course/stage';activityId:string;stage:CourseFlow['stage']}
 | {type:'course/outline';activityId:string;outline:CourseOutlineItem[]}
 | {type:'course/interaction';activityId:string;stepId:string;patch:Partial<CourseInteraction>}
 | {type:'course/candidate';activityId:string;candidate:NonNullable<CourseFlow['candidate']>}
 | {type:'course/story-use';activityId:string;stepId:string;useStory:boolean}
 | {type:'course/story';activityId:string;title:string;summary:string}
 | {type:'course/adopt'|'course/discard';activityId:string};
export function courseReducer(data:AppData, action:CourseAction):AppData {
 const original=data.activities.find(a=>a.id===action.activityId);
 if(!original?.draft.courseFlow || original.draftLocked)return data;
 const a=structuredClone(original),d=a.draft,c=d.courseFlow!;
 if(action.type==='course/stage'){c.stage=action.stage;}
 else if(action.type==='course/candidate'){
  if(action.candidate.revision!==d.revision || c.candidate)return data;
  c.candidate=structuredClone(action.candidate);
 } else if(action.type==='course/discard'){c.candidate=undefined;}
 else if(action.type==='course/adopt'){
  const v=c.candidate;if(!v||v.revision!==d.revision)return data;
  if(v.kind==='outline') {if(c.expanded||!v.outline?.length||new Set(v.outline.map(o=>o.id)).size!==v.outline.length)return data;c.outline=v.outline;d.steps=v.outline.map(o=>({...emptyStep(o.role),id:o.id,fields:{title:o.title,teacherScript:'',childInteraction:'',observe:'',minutes:o.minutes}}));}
  else {if(c.expanded||!v.steps||!v.interactions||v.steps.length!==d.steps.length||new Set(v.steps.map(s=>s.id)).size!==d.steps.length||d.steps.some(s=>s.status!=='empty'||s.fields.teacherScript.trim()||s.fields.childInteraction.trim()||s.fields.observe.trim())||v.steps.some(s=>!d.steps.some(old=>old.id===s.id)||!v.interactions![s.id]))return data;d.steps=v.steps;c.interactions=v.interactions;c.story=v.story;c.expanded=true;c.stage='document';}
  c.candidate=undefined;d.revision++;
 }else if(action.type==='course/outline'){
  if(c.expanded||!action.outline.length||new Set(action.outline.map(x=>x.id)).size!==action.outline.length)return data;
  c.outline=action.outline;d.steps=c.outline.map(o=>({...emptyStep(o.role),id:o.id,fields:{title:o.title,teacherScript:'',childInteraction:'',observe:'',minutes:o.minutes}}));d.revision++;
 }else if(action.type==='course/story-use'){
  if(!c.outline.some(o=>o.id===action.stepId))return data;c.outline=c.outline.map(o=>o.id===action.stepId?{...o,story:action.useStory}:o);d.revision++;
 }else if(action.type==='course/story'){
  if(!c.story)return data;c.story={...c.story,title:action.title,summary:action.summary};d.revision++;
 }else if(action.type==='course/interaction'){
  if(!d.steps.some(s=>s.id===action.stepId)||!c.interactions[action.stepId])return data;
  c.interactions[action.stepId]={...c.interactions[action.stepId],...action.patch};d.revision++;
 }
 a.updatedAt=new Date().toISOString();return {...data,activities:data.activities.map(x=>x.id===a.id?a:x)};
}
