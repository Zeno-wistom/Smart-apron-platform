import { ApronMark } from "./components/ApronMark";
import { Database, RotateCcw } from "lucide-react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { useApp } from "./app/AppProvider";
import { SessionLayout } from "./app/SessionLayout";
import { Button } from "./components/ui/Button";
import { Notice } from "./components/ui/Feedback";
import { PageHeader } from "./components/ui/PageHeader";
import { ChildrenPage } from "./features/children/ChildrenPage";
import { ExperiencePage } from "./features/experience/ExperiencePage";
import { PlanningPage } from "./features/planning/PlanningPage";
import { RecordsPage } from "./features/records/RecordsPage";
import { ReviewPage } from "./features/review/ReviewPage";
import { WorkbenchPage } from "./features/workbench/WorkbenchPage";

function StartupScreen() {
  return (
    <div className="startup-screen">
      <span className="brand-mark"><ApronMark /></span>
      <h1>智能围裙</h1>
      <p>正在读取本地虚构演示数据…</p>
      <span className="startup-loader" aria-label="正在加载" />
    </div>
  );
}

function RecoveryScreen({ message }: { message?: string }) {
  const { resetDemoData } = useApp();
  return (
    <div className="startup-screen recovery-screen">
      <span className="brand-mark"><Database aria-hidden="true" /></span>
      <h1>本地演示数据需要恢复</h1>
      <Notice variant="warning" title="没有自动覆盖原数据">
        {message || "本地数据结构无法读取。"} 你可以选择恢复为初始虚构演示数据。
      </Notice>
      <Button variant="primary" icon={<RotateCcw aria-hidden="true" />} onClick={() => void resetDemoData()}>恢复初始虚构数据</Button>
      <p>此操作只重置本原型的 localStorage，不影响其他文件或真实资料。</p>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div>
      <PageHeader title="页面不存在" description="当前地址没有对应的教师工作区页面。" />
      <Link className="button button-primary" to="/">返回教学工作台</Link>
    </div>
  );
}

export default function App() {
  const { loadStatus, loadError } = useApp();
  if (loadStatus === "loading") return <StartupScreen />;
  if (loadStatus === "error") return <RecoveryScreen message={loadError} />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<WorkbenchPage />} />
        <Route path="children" element={<ChildrenPage />} />
        <Route path="children/:childId" element={<ChildrenPage />} />
        <Route path="sessions/:sessionId" element={<SessionLayout />}>
          <Route index element={<Navigate to="plan" replace />} />
          <Route path="plan" element={<PlanningPage />} />
          <Route path="experience" element={<ExperiencePage />} />
          <Route path="review" element={<ReviewPage />} />
        </Route>
        <Route path="records" element={<RecordsPage />} />
        <Route path="records/:sessionId" element={<RecordsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
