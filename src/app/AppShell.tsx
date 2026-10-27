import {
  ClipboardClock,
  FlaskConical,
  LayoutDashboard,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ApronMark } from "../components/ApronMark";
import { DemoScenarioPanel } from "../components/DemoScenarioPanel";
import { Button } from "../components/ui/Button";
import { SaveIndicator } from "../components/ui/Feedback";

const navigation = [
  { to: "/", label: "教学工作台", icon: LayoutDashboard, end: true },
  { to: "/children", label: "儿童档案", icon: UsersRound, end: false },
  { to: "/records", label: "教学记录", icon: ClipboardClock, end: false },
];

function getContextTitle(pathname: string): string {
  if (pathname.startsWith("/sessions/")) return "课程工作区";
  if (pathname.startsWith("/children")) return "虚构儿童档案";
  if (pathname.startsWith("/records")) return "教学记录与复盘";
  return "教师工作区";
}

export function AppShell() {
  const location = useLocation();
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><ApronMark /></span>
          <div>
            <strong>智能围裙</strong>
            <span>教师数字平台</span>
          </div>
        </div>
        <nav className="main-nav" aria-label="主导航">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                aria-label={item.label}
                className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-demo-note">
          <FlaskConical aria-hidden="true" />
          <div>
            <strong>交互式原型</strong>
            <p>虚构数据 · 本地运行<br />无真实 AI 或硬件连接</p>
          </div>
        </div>
        <div className="sidebar-footer"><span>任老师课题组</span><span>V0.1</span></div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-context">
            <span>智能围裙数字平台</span>
            <strong>{getContextTitle(location.pathname)}</strong>
          </div>
          <div className="topbar-actions">
            <SaveIndicator />
            <Button variant="ghost" icon={<SlidersHorizontal aria-hidden="true" />} onClick={() => setDemoOpen(true)}>
              演示控制
            </Button>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <DemoScenarioPanel open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
