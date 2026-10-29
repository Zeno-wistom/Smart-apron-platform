import { Link, useNavigate } from "react-router-dom";
import { Plus, ArrowRight } from "lucide-react";
import { Topbar } from "../../app/Shell";
import { useStore } from "../../app/store";
import { Button, Tag, formatTime } from "../../components/ui";
import { activityPhase } from "../../domain/checks";
import { newActivity } from "../../domain/fixtures";
import type { Activity, Stage } from "../../domain/types";

export function nextAction(a: Activity): { label: string; stage: Stage } {
  const phase = activityPhase(a).key;
  if(a.draft.courseFlow && phase === "approved") return {label:"查看完成的教案与模拟传输",stage:"plan"};
  if (phase === "planning") return { label: "继续备课", stage: "plan" };
  if (phase === "approved") return { label: "准备上课", stage: "review" };
  return {
    label: phase === "reviewed" ? "查看复盘" : "课堂与复盘",
    stage: "class",
  };
}
export function PhaseTag({ a }: { a: Activity }) {
  return <Tag>{activityPhase(a).label}</Tag>;
}
export function WorkbenchPage() {
  const { data, dispatch } = useStore();
  const nav = useNavigate();
  const sorted = [...data.activities].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const resume = sorted.find((a) => activityPhase(a).key !== "reviewed");
  const recent = sorted.filter((a) => a.id !== resume?.id);
  const create = () => {
    const a = newActivity(data.children[0], "未命名活动");
    a.draft.steps=[];
    a.draft.courseFlow={stage:"goal",outline:[],interactions:{},expanded:false};
    dispatch({ type: "activity/create", activity: a });
    nav(`/activities/${a.id}/plan?focus=goal`);
  };
  return (
    <>
      <Topbar>
        <span className="muted">教师备课桌面</span>
      </Topbar>
      <main className="page workbench">
        <div className="page-head">
          <div className="grow">
            <p className="eyebrow">从一个教学目标开始</p>
            <h1>教学工作台</h1>
          </div>
          <Button variant="primary" icon={Plus} onClick={create}>
            准备一堂课
          </Button>
        </div>
        {resume ? (
          <section className="resume-paper">
            <p className="eyebrow">继续上次的教学活动</p>
            <h2>{resume.title}</h2>
            <p className="muted">
              {data.children.find((c) => c.id === resume.childId)?.name} ·{" "}
              {activityPhase(resume).label}
            </p>
            <p>{resume.draft.goal.text || "先写下本课希望观察到的行为。"}</p>
            <Link
              className="resume-link"
              to={`/activities/${resume.id}/${nextAction(resume).stage}`}
            >
              {nextAction(resume).label}
              <ArrowRight className="ico" />
            </Link>
          </section>
        ) : (
          <section className="resume-paper empty">
            <h2>从目标开始，完成一份可以上课的教案</h2>
            <p>为{data.children[0].name}备课：确定目标 → 安排整堂课 → 完善教案 → 审核完成。AI 与围裙均为模拟。</p>
          </section>
        )}
        <section className="recent-lessons">
          <h2>最近的教学活动</h2>
          {recent.length ? (
            recent.map((a) => (
              <Link
                className="lesson-row"
                key={a.id}
                to={`/activities/${a.id}/${nextAction(a).stage}`}
              >
                <strong>{a.title}</strong>
                <span>{activityPhase(a).label}</span>
                <span className="muted">{formatTime(a.updatedAt)}</span>
                <ArrowRight className="ico" />
              </Link>
            ))
          ) : (
            <p className="muted">其他教学活动会显示在这里。</p>
          )}
        </section>
      </main>
    </>
  );
}
