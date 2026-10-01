# 变更记录

## V000007 — 首个公开版（2026-10-01）

首个面向全球发布的版本。同一份工具定义同时支持三种接入方式：

- **DeepSeek Harness 插件**（纯 Cordis entry，零 npm 依赖）
- **MCP 服务器**（零依赖 stdio，任何支持 MCP 的 AI 客户端均可调用）
- **Node ES Module**（可直接被其它程序 import）

### 能力

15 个工具：
`mackorn_requirement_intake`（客户需求表录入）、`mackorn_proposal`（方案书生成）、
`mackorn_cone_selection`（圆锥破选型）、`mackorn_plant_design`（整线配置）、
`mackorn_capacity_check`（产能校核）、`mackorn_cost_estimate`（成本估算）、
`mackorn_mcfm_analysis`（给料模数 MCFM）、`mackorn_wear_design`（衬板磨损）、
`mackorn_grading_porosity`（料层孔隙率）、`mackorn_market_intel`（市场纵深）、
`mackorn_selection_report`（选型报告）、`mackorn_equipment_catalog`（机型总览）、
`mackorn_intel_watch`（行业情报观测面）、`mackorn_knowledge_update`（知识入库与矛盾检测）、
`mackorn_pdca_status`（自我迭代 PDCA 台账）。

5 个技能：选型 / 整线 / 需求表录入 / 市场纵深方法 / 千行百业插件方法论。

### 理论内核

移植自 MACKORN《矿山选矿科研模型》的核心理论：粗粒级模数 MCFM、速度均匀化指数、
磨损稳定性与多梯度衬板、料层孔隙率、五维分析框架、可信度分级、数值矛盾检测、版本演进。

### 数据与诚实纪律

- 数据分四级标注：厂商硬数据 / 厂商历史资料 / 工程经验区间 / 空缺
- 每个工具输出都带 `assumptions[]`（假设 + 来源）与 `warnings[]`
- 数据缺口返回 `null`，不用默认值冒充
- 多来源冲突**并列保留**，不取平均
- **本公开版不含任何价格数据**，报价请走 MACKORN 商务

### 许可

代码与文档：MIT。MACKORN 产品参数数据版权归上海美矿机械有限公司所有，以 MIT 许可随附。
