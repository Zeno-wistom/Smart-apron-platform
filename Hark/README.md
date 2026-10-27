# 智能围裙 · 教师数字平台（Hark 独立版本）

澳门大学任老师课题组「智能围裙」教师数字平台的 P0 交互原型 —— **Hark 独立版本**。
与仓库根目录的 Codex 版本完全隔离，用于并行对比。

> 全部为虚构演示数据。AI、围裙连接与传输、课堂事件均为**模拟**，界面中有「模拟」标记。
> 不接入真实大模型、真实围裙或真实儿童资料，不生成诊断或疗效结论。

## 本地运行

需要 Node.js 20+。所有命令都在 `Hark/` 目录执行，不依赖根目录的 `node_modules`：

```bash
cd Hark
npm install
npm run dev        # http://localhost:5174/
```

Windows PowerShell 如拦截 `npm.ps1`，改用 `npm.cmd install` / `npm.cmd run dev`。

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务，默认端口 **5174**（根目录项目使用 5173） |
| `npm run build` | TypeScript 检查 + 生产构建（输出到 `Hark/dist/`） |
| `npm run preview` | 预览生产构建，端口 4174 |
| `npm test` | 业务规则单元测试（Vitest） |
| `npm run e2e` | 端到端验收（需先 `npm run dev`；需要本机 Chromium，见下） |

端到端脚本使用 Playwright 驱动本机 Chromium：`CHROMIUM=/path/to/chrome npm run e2e`。
默认路径为 `/usr/bin/chromium`。可加 `SHOTS=1` 把截图保存到 `tests/e2e/artifacts/`（已被 git 忽略）。

## 隔离约定

- 本地存储键：`smart-apron:hark:v1`（与旧版本互不影响）。
- 依赖、缓存（`node_modules/.vite`）与构建产物（`dist/`）都在 `Hark/` 内。
- 不修改仓库根目录的任何文件。

## 推荐演示路径（约 5 分钟）

工作台「新建教学活动」→ 目标与环节：AI 推荐目标 → 使用并确认 → 逐个「生成本环节建议」→ 采纳 / 换一个 / 确认 →
左栏「一键补全」→ 逐个采纳确认 → 故事与围裙：生成故事候选 → 采纳并编辑 → 「按限制匹配全部场景」→ 确认故事与反馈 →
审核与传输：批准 v1 → 连接模拟围裙 → 传输（可在「演示控制」中设置失败后重试）→ 课堂与复盘：生成模拟课堂记录 →
生成复盘草稿 → 编辑、填写教师总结 → 完成审核 → 写入儿童档案 → 在儿童档案中查看新观察及其来源版本。

异常演示：顶栏「演示控制」可设置「下一次 AI 请求失败」「下一次传输失败」；修改已确认的目标可看到下游「需复核」；
在 AI 生成期间修改该环节，旧结果不会覆盖你的修改；在场景中勾选「船笛音效（自动）」可看到与限制冲突的提示。

## 目录

```
Hark/
  src/
    domain/     数据模型、业务规则（reducer）、审核检查、虚构案例、规则单元测试
    services/   模拟 AI、模拟设备、本地存储、演示控制
    app/        状态与自动保存、异步请求编排、应用外壳
    features/   workbench · child · records · activity · plan · story · review · class
    components/ 统一的按钮、标签、表单、对话框
    styles/     设计令牌与样式
  tests/e2e/    浏览器端到端验收脚本
  docs/         设计规范与开发进度（PROGRESS.md）
```

详见 [docs/PROGRESS.md](docs/PROGRESS.md) 与 [docs/DESIGN.md](docs/DESIGN.md)。
