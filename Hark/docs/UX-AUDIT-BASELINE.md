# UX baseline · Phase 0

基线：origin/hark/independent-v01，24b5b8d7d2cc9348db50c9e301e1c1364bd4c454；2026-10-28 Windows / Microsoft Edge。

实际运行：npm ci（0 vulnerabilities）、npm test（16/16）、npm run build（通过）、npm run e2e（69/69）。e2e 通过 CHROMIUM 指向本机 Edge；截图路径改用 fileURLToPath 适配 Windows，不改变业务。

浏览器截图：docs/ux/before/；1440×900、1366×768、1024×768、390×844，工作台/备课/故事/审核/课堂，另含完整流程截图、候选/冲突/复盘/损坏存储。原流程检查了 AI 失败、传输失败重试、候选过期、锁定、目标变更复核。截图样本使用原流程实际生成并持久化的数据 tests/e2e/legacy-envelope.json。

布局实际测量见 before/metrics.json；正文窄、108px 活动 chrome、小字号属运行证据。原流程 console 错误 0，无外部请求。并未进行真实教师测试、真实硬件验证或 Safari 测试。

领域 SHA256（后续只增加桥接能力，旧 action/检查不放宽）：
- reducer.ts F96143038161669A3D2D406F544940E88E09EE2DC36D7FD5743ED164DED11292
- checks.ts EE48E678A27BD8AAFAAD36E77EFF2B049DF705817B411B84F53152FC4E43C23F
- types.ts 87743898DFB4BE62B7E2CB039D4A9563010907B35D381D0909AF64E04164C0DD

旧测试清单保留于 src/domain/rules.test.ts（16 项）；旧浏览器脚本随 Phase 0 提交保留，可在该提交重现。新信息架构将另写浏览器旅程，不能继续要求旧按钮存在。
