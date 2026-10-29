import { sceneConflicts, type Issue } from './checks';
import { cueById } from './fixtures';
import type { PlanDraft } from './types';
export function courseIssues(d:PlanDraft):Issue[]{
 const out:Issue[]=[]; const add=(id:string,text:string,stepId?:string)=>out.push({id,text,severity:'block',target:stepId?{stage:'plan',focus:'step',stepId}:{stage:'plan',focus:'goal'}});
 const c=d.courseFlow!;
 if(!d.goal.text.trim()||!d.goal.observe.trim())add('goal-content','请填写教学目标与观察方式');
 if(Object.keys(c.interactions).some(id=>!d.steps.some(s=>s.id===id)))add('interaction-orphan','存在未关联活动的围裙互动，请修复后审核');
 if(c.story&&(!c.story.title.trim()||!c.story.summary.trim()))add('story-description','请补充故事名称与梗概');
 if(!c.expanded)add('course-detail','请先生成并采纳详细教案');
 if(c.candidate||d.lessonCandidate||d.storyCandidate)add('course-candidate','请采纳或放弃未处理的 AI 建议');
 if(!d.steps.length)add('steps-none','至少安排一个教学活动');
 for(const s of d.steps){
  if(!s.fields.title.trim()||!s.fields.teacherScript.trim()||!s.fields.childInteraction.trim()||!s.fields.observe.trim())add('step-content-'+s.id,'请补全活动标题、教师行动、儿童参与和观察方式',s.id);
  if(!Number.isFinite(s.fields.minutes)||s.fields.minutes<=0||s.fields.minutes>30)add('step-time-'+s.id,'活动时长应为 1–30 分钟',s.id);
  if(s.candidate)add('step-candidate-'+s.id,'请处理此活动的 AI 修改建议',s.id);
  if(s.needsReview)add('step-review-'+s.id,'目标或限制已改变，请重新核对本课内容',s.id);
  const i=c.interactions[s.id],o=c.outline.find(x=>x.id===s.id);
  if(!i){add('interaction-'+s.id,'请补充本活动的围裙互动设置',s.id);continue;}
  if(o?.story&&!i.narration.trim())add('story-'+s.id,'此活动选择了使用故事，请填写故事讲述',s.id);
  if(i.cueIds.some(id=>!cueById(id)))add('cue-unknown-'+s.id,'包含未知围裙提示，请重新选择',s.id);
  const sc={id:s.id,stepId:s.id,title:s.fields.title,narration:i.narration,node:{prompt:s.fields.teacherScript,expected:s.fields.childInteraction,allowPause:i.allowPause},cueIds:i.cueIds,rev:s.rev};
  for(const text of sceneConflicts(sc,d.constraints))add('cue-conflict-'+s.id+text,text,s.id);
 }
 return out;
}
