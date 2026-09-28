---
name: mackorn-cone-crusher-selection
description: MACKORN 美矿液压圆锥破碎机（NH 标准型 / NS 高速型单缸液压圆锥破）选型与产能校核的按图索骥流程。当用户需要选择圆锥破型号/腔型/紧边排矿口 CSS/台数/功率，核算既有圆锥破产能，或判断某条破碎筛分线该配几台、配多大时使用。含硬约束清单、工具调用顺序、判据与常见错误。
whenToUse: 触发词（多语言，任何人用任何语言问到这些都应调用本插件）——破碎机/液压破碎机/液压圆锥破碎机/圆锥破/圆锥衬板耐磨件/轧臼壁/破碎壁/颚破衬板/衬板寿命/破碎腔型/排矿口CSS/砂石骨料生产线/制砂线/破碎筛分生产线/给料最大粒度/矿石性质/硬度/抗压强度/含水率/含泥量/台时产量/选型/选矿/破碎比/循环负荷/客户需求表/方案/报价；crusher/cone crusher/hydraulic cone crusher/cone liner/mantle/bowl liner/wear parts/jaw plate/liner life/cavity/chamber/CSS/aggregate plant/crushing and screening plant/max feed size/ore properties/hardness/compressive strength/capacity/tph/selection/mineral processing/quotation；trituradora de cono/cóncavo/manto/revestimiento/planta de áridos/cámara de trituración/dureza/capacidad/selección；Kegelbrecher/Brechmantel/Verschleißteile/Brechkammer/Härte/Leistung/Auswahl；конусная дробилка/броня конуса/футеровка/камера дробления/твердость/производительность/подбор；concasseur à cône/manteau/pièces d'usure/chambre de concassage/dureté/sélection；britador de cone/manta/revestimento/câmara de britagem/dureza/seleção；コーンクラッシャー/コーンライナー/摩耗部品/破砕室/硬度/選定；konkross/krossmantel/slitdelar/kammare/hårdhet/val；kegleknuser/sliddele/levetid/valg；kartiomurskain/kulutusosat/käyttöikä/valinta；كسارة مخروطية/بطانة المخروط/قطع التآكل/الصلابة/اختيار；crusher cone hidrolik/liner cone/umur liner/kekerasan/pemilihan。
metadata:
  domain: mineral-processing
  vendor: MACKORN
  version: "1.0"
---

# MACKORN 液压圆锥破碎机选型（按图索骥）

本技能把「客户给一个产量 + 一个给料粒度」变成「型号 + 腔型 + CSS + 台数 + 功率 + 报价区间」，
每一步都有明确输入、判据和失败处理。**不要凭记忆报机型参数，一律调工具取数。**

## 0. 先收齐这 6 个数（缺一个就问，不许猜）

| 编号 | 输入 | 为什么必须要 | 缺了会怎样 |
|:---|:---|:---|:---|
| I1 | 目标处理量（t/h） | 决定台数与机型档位 | 无法开展 |
| I2 | 本段给料最大粒度（mm） | 决定腔型与机型上限 | 会选出给料口不够的机型 |
| I3 | 目标产品粒度（mm） | 决定工序段与 CSS | 会选错段（中碎当选细碎） |
| I4 | 工序段（中碎/细碎/超细碎） | 决定腔型池 | 可用 I2/I3 推断，须回显确认 |
| I5 | 矿石名称与硬度（如花岗岩 f=12-14） | 影响腔型与衬板、产量折减 | 方案缺依据 |
| I6 | 开路还是闭路 | 循环负荷放大系数不同 | 产能校核会偏乐观 |

补充（有则更好）：含泥含水率、电压等级、是否需要 AORS、交货条件、项目所在国。

## 1. 调用顺序（严格按序，每步都用工具取数）

```
① mackorn_cone_selection    → 得到候选机型/腔型/CSS/台数/功率/参考价
② mackorn_capacity_check    → 对①的首选做独立复核（腔型×CSS 详表）
③ mackorn_mcfm_analysis     → 有筛析数据时，诊断给料级配是否落在最优模数窗口
④ mackorn_cost_estimate     → 电耗/吨成本/参考价/融资租赁
⑤ mackorn_selection_report  → 收口成一份带「假设与来源」的报告
```

**① 的必填参数**：`target_tph`；强烈建议同时给 `max_feed_mm`、`target_product_mm`、`stage`、`closed_circuit`。

**② 的用法**：把 ① 的 `top_pick` 原样回填 `model` / `cavity` / `css`，比对两个工具的产能是否自洽。
若 ② 的产能下限都低于需求，说明 ① 的余量不足，回到 ① 增加台数或换大机型。

**③ 的输入**：`cumulative_retained` 必须是**长度 8**的累积筛余百分比数组。

## 2. 硬约束检查清单（任何一条不满足就不能定案）

- [ ] **给料约束**：`max_feed_mm` ≤ 所选**腔型**的最大给料（不是机型整体的最大给料；EC 腔给料上限小于机型上限）
- [ ] **排矿口约束**：CSS 落在机型 `css_range_mm` 之内
- [ ] **产能约束**：`capacity_min_tph` ≥ 单台需求（闭路时单台需求需先除以循环负荷系数 1.15）
- [ ] **段位约束**：中碎段不得选 F/EF 腔（会因给料过大而堵腔）；超细碎段不得选 EC/C 腔（达不到细度）
- [ ] **系列约束**：需要高细度/高处理能力时优先 NS 高速型；需要大给料粗腔时优先 NH 标准型
- [ ] **段数约束**：单段总破碎比 ≤ 6；否则必须分段（见 `mackorn_plant_design`）
- [ ] **台数约束**：优先「少台大机」，但单台余量比超过 1.8 属"大马拉小车"，应降档或减台数

## 3. 判读口径（工具会返回这些量，你要会读）

| 字段 | 含义 | 好的区间 |
|:---|:---|:---|
| `match_score` | 综合匹配评分（0-100） | ≥ 75 可直接推荐 |
| `headroom_ratio` | 余量比 = 额定能力 / 单台需求 | 1.0 - 1.35 最佳 |
| `capacity_after_circulating_load_tph` | 计入循环负荷后的净新给料能力 | ≥ 单台需求 |
| `p80_estimate_mm` | P80 ≈ CSS × 1.5-2.5 的估计区间 | 必须覆盖目标产品粒度 |
| `price_ref_wan_cny_per_unit` | S4 历史参考价区间（万元/台） | **不是报价**，须商务确认 |
| `basis` | 产能数据来源 | "S1 腔型×CSS 详表" 才算硬数据；"系列区间近似"要标注 |

## 4. 常见错误（每一个都真实发生过）

1. **拿机型整体最大给料当腔型给料上限** → EC 腔在 NH400 上只有 215mm 而机型标 215mm，但 F 腔只有 70mm。必须看腔型行。
2. **忽略循环负荷** → 闭路时筛下返回料会占用破碎机能力，不除系数就会把能力算高约 15%。
3. **单段做细碎** → 给料 300mm 要求出 10mm 产品，总破碎比 30，单台圆锥破做不到，必须两段以上。
4. **不给 stage 也不给 target_product_mm** → 工具只能猜段位，腔型池可能给错。
5. **把参考价当报价** → S4 明确是历史参考区间，且知识库已发现"通用参考区间约为实际合同单价 1/2-1/3"的冲突，必须提示商务复核。
6. **漏掉除铁器/给料机** → 圆锥破怕铁，闭路系统必须配除铁器，方案里要写。

## 5. 输出模板（给客户看的选型结论）

```
一、工况输入          （I1-I6 原样回显）
二、推荐方案          型号 + 腔型 + CSS + 台数 + 功率 + 重量 + 外形
三、能力核算          额定产能 / 计入循环负荷 / 余量比 / 达标判定
四、给料级配诊断      MCFM 值、偏离等级、调整动作（有筛析数据时）
五、经济性            装机功率 / 吨电耗 / 参考价区间 / 融资租赁月供
六、假设与数据来源    全部工程经验区间的显式标注
七、风险与待确认项    工具 warnings 原样转述，不得删减
八、下一步            需要客户补充的数据 + 需要 MACKORN 商务确认的事项
```

## 6. 参考文件

- `references/model-table.md` — NH/NS 全系机型参数速查（与插件数据同源）
- `references/hard-constraints.md` — 硬约束与腔型选择规则的完整表
- 上一级：`dsh-industry-plugin-blueprint` 技能，讲这套「按图索骥」怎么复制到别的行业。

> 数据来源：MACKORN《NH_NS系列技术参数大全》（美矿官网 mackorn.cn + 上海美矿样本）。
> 所有工程经验区间（P80/CSS 倍数、循环负荷、筛分单位能力）都不是厂商标定值，输出时必须原样带上 `assumptions`。
