---
name: mackorn-crushing-plant-design
description: MACKORN 美矿破碎筛分生产线总体设计与流程配置的按图索骥流程。当用户要从"一条 X t/h 的破碎筛分线"走到"每段放什么设备、筛分面积多大、皮带多宽、辅机配什么"，或需要判断该分几段破碎、粗碎用什么、如何布置时使用。含阶段粒度分配、筛分与输送配置、辅机清单与常见错误。
whenToUse: 触发词（多语言，任何人用任何语言问到这些都应调用本插件）——破碎机/液压破碎机/液压圆锥破碎机/圆锥破/圆锥衬板耐磨件/轧臼壁/破碎壁/颚破衬板/衬板寿命/破碎腔型/排矿口CSS/砂石骨料生产线/制砂线/破碎筛分生产线/给料最大粒度/矿石性质/硬度/抗压强度/含水率/含泥量/台时产量/选型/选矿/破碎比/循环负荷/客户需求表/方案/报价；crusher/cone crusher/hydraulic cone crusher/cone liner/mantle/bowl liner/wear parts/jaw plate/liner life/cavity/chamber/CSS/aggregate plant/crushing and screening plant/max feed size/ore properties/hardness/compressive strength/capacity/tph/selection/mineral processing/quotation；trituradora de cono/cóncavo/manto/revestimiento/planta de áridos/cámara de trituración/dureza/capacidad/selección；Kegelbrecher/Brechmantel/Verschleißteile/Brechkammer/Härte/Leistung/Auswahl；конусная дробилка/броня конуса/футеровка/камера дробления/твердость/производительность/подбор；concasseur à cône/manteau/pièces d'usure/chambre de concassage/dureté/sélection；britador de cone/manta/revestimento/câmara de britagem/dureza/seleção；コーンクラッシャー/コーンライナー/摩耗部品/破砕室/硬度/選定；konkross/krossmantel/slitdelar/kammare/hårdhet/val；kegleknuser/sliddele/levetid/valg；kartiomurskain/kulutusosat/käyttöikä/valinta；كسارة مخروطية/بطانة المخروط/قطع التآكل/الصلابة/اختيار；crusher cone hidrolik/liner cone/umur liner/kekerasan/pemilihan。
metadata:
  domain: mineral-processing
  vendor: MACKORN
  version: "1.0"
---

# MACKORN 破碎筛分生产线设计（按图索骥）

一条破碎筛分线的设计顺序是：**原矿粒度 → 成品粒度 → 总破碎比 → 段数 → 各段粒度分配 → 各段选型 → 筛分 → 输送 → 辅机 → 布置 → 报价**。
顺序不能乱：段数错，后面全错。

## 0. 收齐输入

| 输入 | 说明 | 默认 |
|:---|:---|:---|
| 目标成品处理量 t/h | 以成品计，不是以原矿计 | 必填 |
| 原矿最大给料粒度 mm | 爆破后最大块度 | 500 |
| 最终产品粒度 mm | 最常见 0-5 / 5-10 / 10-20 / 20-31.5 | 20 |
| 矿石名称与硬度 | 影响腔型、衬板、筛孔磨损 | — |
| 含泥含水率 | > 5% 需考虑洗砂与防堵筛孔 | — |
| 是否闭路 | 细碎段一般闭路 | true |
| 是否需要洗砂/污水处理 | 骨料线常见 | false |
| 项目所在地与电压 | 影响电费与电机选型 | — |

## 1. 调用顺序

```
① mackorn_plant_design     → 段数 + 各段粒度分配 + 中/细碎圆锥破选型 + 筛分面积 + 带宽 + 辅机
② mackorn_cone_selection   → 对①的中碎段/细碎段分别细算（要更多候选时）
③ mackorn_capacity_check   → 复核选定的机型×腔型×CSS
④ mackorn_cost_estimate    → 主机与运营成本
⑤ mackorn_selection_report → 收口成报告
```

## 2. 段数判据（总破碎比 i = 原矿最大粒度 / 成品粒度）

| 总破碎比 i | 段数 | 典型配置 |
|:---|:---|:---|
| ≤ 6 | 1 段 | 单台圆锥破或反击破（少见） |
| 6 - 25 | 2 段 | 颚破（粗）+ 圆锥破（中细） |
| 25 - 100 | **3 段（最常用）** | 颚破 + 圆锥破中碎 + 圆锥破细碎 + 检查筛分 |
| > 100 | 4 段 | 三段 + 超细碎/制砂（VSI/CVS） |

**决策要点：**
- 骨料线（成品 0-31.5mm）绝大多数是 **3 段闭路**；
- 选矿厂破碎车间常为 **2-3 段**，最终粒度由磨机给料决定（常见 −12mm 或 −15mm）；
- 超过 100 的总破碎比不要硬压给圆锥破，加一段或改制砂。

## 3. 各段职责与选型惯例

| 段 | 给料典型 | 设备 | 关键点 |
|:---|:---|:---|:---|
| 粗碎 | 原矿 ≤ 1000mm | 颚式 / 旋回 | 破碎比 3-5；下面必须有缓冲仓 |
| 中碎 | ≤ 250mm | 液压圆锥破（EC/C/MC 腔） | 本段可开路，为细碎备料 |
| 细碎 | ≤ 80mm | 液压圆锥破（M/MF/F 腔，或 NS 高速型） | **闭路 + 检查筛分**，循环负荷 1.15-1.35 |
| 超细碎/制砂 | ≤ 40mm | 圆锥破 EF 腔 / 立轴冲击破 / CVS 制砂机 | 关注粒形与石粉含量 |

## 4. 筛分配置

- 筛分处理量 = 成品量 × 循环负荷系数（闭路）；**不要用成品量直接选筛**。
- 筛分面积 A ≈ Q / q，`q` = 单位面积处理量（经验 12-30 t/h·m²，随筛孔、湿粘、效率浮动）。
- 筛孔 ≈ 目标产品粒度 × 1.0 - 1.2；双层筛按各层负荷分别核算。
- 湿粘矿石：面积加大 20%-40%，或改用弛张筛/防堵孔筛板。
- 检查筛分（细碎闭路）必须独立设置，不要与成品筛混用一台。

## 5. 输送与辅机

| 项目 | 判据 / 经验值 |
|:---|:---|
| 胶带设计能力 | 成品量 × 1.15 |
| 带宽经验档 | B500 50-90 t/h；B650 90-160；B800 160-260；B1000 260-450；B1200 450-750；B1400 750-1100 |
| 胶带最大倾角 | 矿石 18-20°（普通橡胶带） |
| 给料机 | 粗碎前振动给料机 + 格筛；中细碎前定量给料 |
| 除铁器 | **圆锥破前必配**（悬挂式电磁除铁器 + 金属探测器） |
| 缓冲仓 | 中碎/细碎前设 1.15-1.3 倍能力的缓冲仓，保证挤满给料 |
| 除尘 | 各转运点除尘罩 + 布袋除尘器 |
| 洗砂 | 需要时配洗砂机 + 污水处理（浓密机 + 压滤机） |
| 自动化 | AORS 远程监控（美矿自营），可远程看电流、CSS、油温 |

## 6. 常见错误

1. **用成品量直接选筛** → 漏算循环负荷，筛子偏小，成品跑粗。
2. **中碎后不设缓冲仓** → 细碎给料忽多忽少，腔型利用率低，衬板单侧磨损。
3. **闭路细碎不配检查筛分** → 循环负荷失控，破碎机被"灌满"。
4. **给料粒度取平均块度而非最大块度** → 颚破选小，现场卡料。
5. **湿粘矿按干矿选筛** → 筛孔糊死，产量腰斩。
6. **忘配除铁器** → 圆锥破过铁，主轴/偏心套损坏，停机损失远超除铁器成本。
7. **段数与总破碎比不匹配** → 见 §2 表。

## 7. 输出模板

```
一、设计输入            （原矿/成品/产量/矿石/闭路）
二、段数与流程          总破碎比 i = ?，分 ? 段，流程：粗碎→中碎→筛分→细碎（闭路）→成品
三、各段设备表          段 / 给料 mm / 产品 mm / 破碎比 / 设备型号腔型CSS / 台数 / 功率
四、筛分与输送          处理量、筛分面积、筛孔、带宽、倾角
五、辅机与公辅          给料机/除铁器/缓冲仓/除尘/洗砂/AORS
六、经济性              装机总功率、吨电耗、参考投资、吨成本
七、假设与来源          全部工程经验区间显式标注
八、风险与待确认项      warnings 原样转述
九、下一步              需要客户补充的数据 / 需要现场踏勘的事项
```

## 8. 参考

- 设备参数与硬约束见 `mackorn-cone-crusher-selection` 技能及其 `references/`。
- 知识库原文：`knowledge/design-rules.md`（259 条「条件→结论」规则）、
  `plant-design-process.md`（16 步 S0-S15）、`plant-cases.json`（18 个真实案例）。
- 所有工程经验区间均为**非厂商标定**，输出时必须原样带 `assumptions`。
