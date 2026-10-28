import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  CircleCheck,
  CloudAlert,
  FlaskConical,
  History,
  Info,
  LayoutDashboard,
  Loader2,
  RotateCcw,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import { useStore } from "./store";
import { Button, Modal, cx, formatClock } from "../components/ui";
import { simControls } from "../services/simControls";
import { useSyncExternalStore } from "react";

export function ApronMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="brand-mark">
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path d="M11 7h10l-1.2 4.5H22v13.5a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V11.5h2.2Z" fill="#F4EFE4" />
      <path d="M13 17h6" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="21.5" r="1.6" fill="#D49A3A" />
    </svg>
  );
}

const NAV = [
  { to: "/", label: "教学工作台", icon: LayoutDashboard, end: true },
  { to: "/children/child-xiaozhou", label: "儿童档案", icon: UserRound },
  { to: "/records", label: "教学记录", icon: History },
];

export function Shell({ children }: { children: ReactNode }) {
  const { loadStatus, corruptRaw, resetAll, toasts, dismissToast } = useStore();
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">跳至主要内容</a>
      <aside className="sidebar" aria-label="主导航">
        <Link to="/" className="brand" aria-label="智能围裙 教师平台 首页">
          <span className="nav-icon-box">
            <ApronMark />
          </span>
          <span className="brand-text">
            <span className="brand-name">智能围裙</span>
            <span className="brand-sub">教师数字平台</span>
          </span>
        </Link>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} aria-label={n.label} className={({ isActive }) => cx("nav-item", isActive && "active")}>
              <span className="nav-icon-box">
                <n.icon className="ico" aria-hidden />
              </span>
              <span className="nav-label">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <DemoControls />
        </div>
      </aside>
      <div className="main" id="main-content" tabIndex={-1}>
        {loadStatus === "corrupt" && <CorruptBanner raw={corruptRaw ?? ""} onReset={resetAll} />}
        {children}
      </div>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx("toast", `toast-${t.tone}`)}>
            {t.tone === "success" ? <CircleCheck className="ico" /> : t.tone === "info" ? <Info className="ico" /> : <TriangleAlert className="ico" />}
            <span className="grow">{t.text}</span>
            <Button variant="ghost" size="sm" icon={X} aria-label="关闭通知" onClick={() => dismissToast(t.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CorruptBanner({ raw, onReset }: { raw: string; onReset: () => void }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "smart-apron-hark-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="corrupt-banner" role="alert">
      <CloudAlert className="ico" />
      <span className="grow">本地保存的数据无法读取。为避免覆盖，自动保存已暂停。你可以先下载原始数据备份，再重置演示数据。</span>
      <Button size="sm" onClick={download}>
        下载原始数据
      </Button>
      <Button size="sm" variant="danger" onClick={onReset}>
        重置演示数据
      </Button>
    </div>
  );
}

/** 页面顶栏：面包屑/标题 + 保存状态 + 演示控制 */
export function Topbar({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-left">{children}</div>
      <div className="topbar-right">
        {right}
        <span className="prototype-label" title="AI、围裙与课堂均为本地模拟；儿童资料为虚构">原型模拟</span>
        <SaveIndicator />
      </div>
    </header>
  );
}

export function SaveIndicator() {
  const { save, saveNow } = useStore();
  if (save.kind === "pending")
    return (
      <span className="save-ind" role="status">
        <Loader2 className="ico spin" aria-hidden />
        保存中
      </span>
    );
  if (save.kind === "error")
    return (
      <span className="save-ind save-err" role="alert">
        <CloudAlert className="ico" aria-hidden />
        保存失败，内容仍在页面中
        <Button size="sm" variant="quiet" onClick={saveNow}>
          重试
        </Button>
      </span>
    );
  if (save.kind === "saved")
    return (
      <span className="save-ind" title="已自动保存到本机浏览器（localStorage: smart-apron:hark:v1）">
        <CircleCheck className="ico ok" aria-hidden />
        已保存 {formatClock(save.savedAt)}
      </span>
    );
  return <span className="save-ind">本机自动保存</span>;
}

function useSim() {
  return useSyncExternalStore(
    (fn) => simControls.subscribe(fn),
    () => JSON.stringify(simControls.state),
  );
}

function DemoControls() {
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const { resetAll, toast } = useStore();
  const raw = useSim();
  const st = JSON.parse(raw) as typeof simControls.state;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const armed = st.aiFail || st.transferFail;
  return (
    <div className="demo" ref={ref}>
      <Button
        size="sm"
        variant={armed ? "danger" : "ghost"}
        icon={FlaskConical}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="原型工具"
        onClick={() => setOpen((v) => !v)}
      >
        原型工具{armed ? " · 已设置失败" : ""}
      </Button>
      {open && (
        <div className="popover" role="dialog" aria-label="演示控制">
          <div className="stack">
            <div>
              <h3>演示控制</h3>
              <p className="small muted">用于演示异常处理。只影响下一次请求，触发后自动复原。</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={st.aiFail} onChange={(e) => simControls.setAiFail(e.target.checked)} />
              下一次模拟 AI 请求失败
            </label>
            <label className="switch">
              <input type="checkbox" checked={st.transferFail} onChange={(e) => simControls.setTransferFail(e.target.checked)} />
              下一次模拟传输失败
            </label>
            <hr className="divider" style={{ margin: "4px 0" }} />
            <Button size="sm" variant="danger" icon={RotateCcw} onClick={() => setConfirmReset(true)}>
              恢复初始演示数据
            </Button>
          </div>
        </div>
      )}
      <Modal
        open={confirmReset}
        title="恢复初始演示数据？"
        onClose={() => setConfirmReset(false)}
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>取消</Button>
            <Button
              variant="danger"
              onClick={() => {
                resetAll();
                setConfirmReset(false);
                setOpen(false);
                toast("已恢复初始演示数据", "success");
                window.location.hash = "#/";
              }}
            >
              清除并恢复
            </Button>
          </>
        }
      >
        <p>将删除本机 Hark 版本中的所有教学活动、版本、课堂记录与复盘，并恢复小舟的初始虚构档案。旧版本（根目录项目）的数据不受影响。</p>
      </Modal>
    </div>
  );
}
