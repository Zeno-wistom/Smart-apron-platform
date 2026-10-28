import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useId,
  type ButtonHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import {
  CircleCheck,
  CircleDashed,
  FlaskConical,
  Loader2,
  Lock,
  PencilLine,
  Sparkles,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Source, StepStatus } from "../domain/types";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------------- Button ---------------- */

type Variant = "primary" | "secondary" | "ghost" | "ai" | "danger" | "quiet";
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  /** 在按钮内显示「模拟」标记 */
  sim?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "secondary", size = "md", icon: Icon, iconRight: IconR, loading, sim, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx("btn", `btn-${variant}`, `btn-${size}`, !children && "btn-icon", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="ico spin" aria-hidden /> : Icon ? <Icon className="ico" aria-hidden /> : null}
      {children && <span className="btn-label">{children}</span>}
      {sim && <span className="btn-sim">模拟</span>}
      {IconR && !loading && <IconR className="ico" aria-hidden />}
    </button>
  );
});

/* ---------------- Tags & status ---------------- */

export function SimTag({ children = "模拟", title }: { children?: ReactNode; title?: string }) {
  return (
    <span className="tag tag-sim" title={title ?? "模拟功能：未连接真实 AI 或设备"}>
      <FlaskConical className="ico" aria-hidden />
      {children}
    </span>
  );
}

export function Tag({ tone = "neutral", icon: Icon, children, title }: { tone?: "neutral" | "ok" | "warn" | "ai" | "primary" | "danger"; icon?: LucideIcon; children: ReactNode; title?: string }) {
  return (
    <span className={cx("tag", `tag-${tone}`)} title={title}>
      {Icon && <Icon className="ico" aria-hidden />}
      {children}
    </span>
  );
}

export function SourceTag({ source }: { source: Source }) {
  if (source === "teacher") return <Tag icon={PencilLine}>教师编写</Tag>;
  if (source === "ai") return <Tag tone="ai" icon={Sparkles}>AI 建议·已采纳</Tag>;
  return <Tag tone="ai" icon={PencilLine}>AI 建议·教师修改</Tag>;
}

export const STEP_STATUS: Record<StepStatus, { label: string; icon: LucideIcon; tone: "neutral" | "ok" | "primary" }> = {
  empty: { label: "空白", icon: CircleDashed, tone: "neutral" },
  draft: { label: "草稿", icon: PencilLine, tone: "primary" },
  confirmed: { label: "已确认", icon: Lock, tone: "ok" },
};

export function StatusTag({ status, review }: { status: StepStatus; review?: boolean }) {
  if (review) return <Tag tone="warn" icon={TriangleAlert}>需复核</Tag>;
  const s = STEP_STATUS[status];
  return (
    <Tag tone={s.tone} icon={s.icon}>
      {s.label}
    </Tag>
  );
}

export function Done({ children }: { children: ReactNode }) {
  return (
    <Tag tone="ok" icon={CircleCheck}>
      {children}
    </Tag>
  );
}

/* ---------------- Form ---------------- */

interface AreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  label: string;
  hint?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
  highlight?: boolean;
  hideLabel?: boolean;
}

/** 自动增高的文本域，带可见标签 */
export function TextArea({ label, hint, value, onChange, minRows = 2, highlight, hideLabel, id, className, ...rest }: AreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fid = id ?? `f-${label}`;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <div className={cx("field", highlight && "field-highlight", className)}>
      <label htmlFor={fid} className={cx("field-label", hideLabel && "sr-only")}>
        {label}
      </label>
      <textarea
        ref={ref}
        id={fid}
        rows={minRows}
        className="input textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  hideLabel,
  id,
  className,
  ...rest
}: { label: string; value: string; onChange: (v: string) => void; hideLabel?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const fid = id ?? `f-${label}`;
  return (
    <div className={cx("field", className)}>
      <label htmlFor={fid} className={cx("field-label", hideLabel && "sr-only")}>
        {label}
      </label>
      <input id={fid} className="input" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 480,
  drawer = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  drawer?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const wasInert = root?.inert;
    if (root) root.inert = true;
    const t = window.setTimeout(() => {
      (panel.current?.querySelector<HTMLElement>("[data-autofocus], input:not(:disabled), textarea:not(:disabled), button") ?? panel.current)?.focus();
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); }
      if (e.key !== 'Tab') return;
      const items = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])].filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (!first) { e.preventDefault(); panel.current?.focus(); }
      else if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      if (root) root.inert = wasInert ?? false;
      document.body.style.overflow = oldOverflow;
      prev?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className={cx('modal-backdrop', drawer && 'drawer-backdrop')} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} tabIndex={-1} className={cx('modal', drawer && 'drawer')} role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ width }}>
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" size="sm" icon={X} aria-label="关闭" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Misc ---------------- */

export function Pending({ label }: { label: string }) {
  return (
    <div className="pending" role="status">
      <Loader2 className="ico spin" aria-hidden />
      <span>{label}</span>
      <SimTag />
    </div>
  );
}

export function InlineError({ text, onRetry, onClose }: { text: string; onRetry?: () => void; onClose?: () => void }) {
  return (
    <div className="inline-error" role="alert">
      <TriangleAlert className="ico" aria-hidden />
      <span className="grow">{text}</span>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          重试
        </Button>
      )}
      {onClose && <Button size="sm" variant="ghost" icon={X} aria-label="关闭提示" onClick={onClose} />}
    </div>
  );
}

export function Progress({ done, total, label }: { done: number; total: number; label?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="progress" aria-label={label ?? "进度"} role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
      <div className="progress-bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function formatTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatClock(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
