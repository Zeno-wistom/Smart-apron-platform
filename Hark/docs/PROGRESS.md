# Hark UX 受控重构 · 开发进度

更新：2026-10-28（Asia/Shanghai）。工作分支 `codex/hark-ux-refactor`，基于最新 `hark/independent-v01` @ `24b5b8d`。原 Hark PR #1 与根目录项目未修改。

| 阶段 | 完成内容 | 实际验证 |
|---|---|---|
| Phase 0 | 原版浏览器基线、历史 schema v1 样本、领域文件 hash | 16 单测、build、69 原版 E2E 全通过，四断点截图 |
| Phase 1 | 工作台去重、直接创建、视觉 token、导航名称、共享弹窗焦点管理 | 16 旧单测、build；直接创建/去重/inert/Esc/焦点归还浏览器检查通过 |
| Phase 2 | 两模式、轨道+纸面+参考抽屉、故事内联/整体预览、整课候选与单节差异 | 四断点无溢出；1366px 正文 760px，参考抽屉不改变正文宽度 |
| Phase 3 | 五组课前检查、集中批准桥接、先持久化快照再传输、失败重试 | 新旧领域回归、浏览器保存失败/传输失败重试/同一版本绑定通过 |
| Phase 4 | cue 安全筛选/抑制可见/教师替换审核；课堂复盘一体化、归档预览 | 14 项课堂浏览器检查通过，既有审核/幂等保护保留 |
| Phase 5 | 编辑撤销边界、自动隔离测试服务、旧数据/路由/异常/键盘/axe、文档与截图 | 57 单测、build；新版浏览器 58 项断言、12 axe 样本均通过 |

Phase 2–3 为同一个完整可运行的集成提交；实际顺序是先接好统一编辑与候选，再接最终批准和持久化编排。各步骤均运行相关领域/构建/浏览器验证，旧规则文件保持不变。

## 本轮证据

- Windows 原生 PowerShell、Node 24.19.0、Microsoft Edge，由 Playwright 驱动；不沿用旧 Linux 报告结论。
- 基线报告：[UX-AUDIT-BASELINE.md](UX-AUDIT-BASELINE.md)。布局测量/截图：[ux/before](ux/before)。基线服务 5174 另有相同干净提交 `24b5b8d` 的 checkout；核对 HEAD 和 clean status 后确认源码一致。
- 新版独立预览 5184，`strictPort: true`；E2E 自启 5194 严格端口测试服务并关闭，避免测到其他 checkout。
- 新版结果：[ux/after](ux/after)；详细改动、链路、限制见 [UX-REFACTOR-REPORT.md](UX-REFACTOR-REPORT.md)。
- 本轮添加的唯一依赖是开发检查工具 `@axe-core/playwright`；未添加生产依赖；安装时关闭生命周期脚本，npm audit 0 vulnerabilities。

## 尚未验证

真实教师试用、真实 AI/硬件/儿童数据、Safari/Firefox、真实浏览器 200% zoom 和打印机输出未验证。683×384 只是 1366×768 的 200% 等效布局宽度检查，不能替代实际缩放验收。撤销历史不跨刷新持久化；旧 schema v1 未保留过往目标全文时，只能使用现存批准版本作对照。

原始开发记录可在基线 `24b5b8d:Hark/docs/PROGRESS.md` 查看；此前 14/65 等旧报告数字不作为本次验收结果。
