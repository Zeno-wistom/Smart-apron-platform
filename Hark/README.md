# 智能围裙 · Hark UX 受控重构

从 PR #1 的 Hark 版本独立迭代。教师使用「备课 / 课堂与复盘」两个模式；领域模型、候选保护、批准快照、版本引用与复盘审核继续保留。

AI、围裙与课堂均为本地模拟，儿童资料虚构。没有真实 AI 服务或硬件连接。

## 本地预览（PowerShell）

在当前 worktree 的 `Hark` 目录执行：

```powershell
npm ci
npm run dev -- --host 127.0.0.1
```

打开 [新版网页](http://127.0.0.1:5184/)。固定端口 5184，已占用时明确失败，不会自动切到其他 checkout。

## 验证

```powershell
npm test
npm run build
npm run e2e
```

`e2e` 自动启动隔离的 5194 测试服务，完成后关闭；无需先启动开发服务。Windows 默认驱动已安装的 Edge；其他系统默认使用 Playwright Chromium。可通过 `$env:CHROMIUM='浏览器可执行文件路径'` 指定本机浏览器，或 `$env:E2E_PORT='其他空闲端口'` 指定测试端口。其他系统需先准备对应 Playwright 浏览器，本轮只在 Windows/Edge 实测。

`npm run preview -- --host 127.0.0.1` 在 build 后使用 4174 端口。原版流程脚本 `tests/e2e/flow.mjs` 仅用于基线提交，不再是新版验收入口。

## 演示路径

新建活动 → 填目标与观察方式 → 生成整课初稿 → 阅读并采纳 → 按环节编辑教学内容/故事/提示 → 课前检查、勾选审核并准备上课 → 课堂与复盘 → 结束模拟课堂并生成复盘 → 填教师总结、核对观察 → 完成并写入档案。

参考资料、完整故事线、完整教案与历史版本均按需打开。主导航底部「原型工具」可设置下一次 AI 或传输失败。修改目标后可集中复核受影响内容；冲突提示仍会阻断。编辑可撤销/重做，批准历史不可被撤销。

## 数据与证据

存储键仍为 `smart-apron:hark:v1`，`schemaVersion: 1`。旧数据无需迁移；新增可选整课候选字段，批准历史结构不变。同一浏览器不同 localhost 端口的数据按 origin 隔离；旧版数据兼容使用原版实际产生的 fixture 验证，预览不会自动读取另一个端口。

- [实施与验收报告](docs/UX-REFACTOR-REPORT.md)
- [旧新版截图对照](docs/ux/comparison.html)
- [体验规范](docs/DESIGN.md)
- [阶段进度](docs/PROGRESS.md)
- [原版基线](docs/UX-AUDIT-BASELINE.md)

所有修改在 `Hark/` 内。根目录 Codex 版本与原 Hark PR #1 保留。
