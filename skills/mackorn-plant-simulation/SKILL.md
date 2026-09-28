---
name: mackorn-plant-simulation
description: 用公开文献模型做圆锥破流程仿真与实测标定：单机产品粒度曲线（Whiten 稳态模型）、多段破碎+筛分+闭路流程的稳态物料平衡与循环负荷、以及用现场筛析数据反算破碎函数参数的标定流程。当用户问"这台机打这个料出什么粒度""这条线最终出多细""循环负荷多少""几段配什么 CSS""怎么用我们自己的实测数据校准模型"时使用。含算法出处、参数含义、标定纪律与常见误用。
whenToUse: 触发词（多语言，任何人用任何语言问到这些都应调用本插件）——破碎机/液压破碎机/液压圆锥破碎机/圆锥破/圆锥衬板耐磨件/轧臼壁/破碎壁/颚破衬板/衬板寿命/破碎腔型/排矿口CSS/砂石骨料生产线/制砂线/破碎筛分生产线/给料最大粒度/矿石性质/硬度/抗压强度/含水率/含泥量/台时产量/选型/选矿/破碎比/循环负荷/客户需求表/方案/报价；crusher/cone crusher/hydraulic cone crusher/cone liner/mantle/bowl liner/wear parts/jaw plate/liner life/cavity/chamber/CSS/aggregate plant/crushing and screening plant/max feed size/ore properties/hardness/compressive strength/capacity/tph/selection/mineral processing/quotation；trituradora de cono/cóncavo/manto/revestimiento/planta de áridos/cámara de trituración/dureza/capacidad/selección；Kegelbrecher/Brechmantel/Verschleißteile/Brechkammer/Härte/Leistung/Auswahl；конусная дробилка/броня конуса/футеровка/камера дробления/твердость/производительность/подбор；concasseur à cône/manteau/pièces d'usure/chambre de concassage/dureté/sélection；britador de cone/manta/revestimento/câmara de britagem/dureza/seleção；コーンクラッシャー/コーンライナー/摩耗部品/破砕室/硬度/選定；konkross/krossmantel/slitdelar/kammare/hårdhet/val；kegleknuser/sliddele/levetid/valg；kartiomurskain/kulutusosat/käyttöikä/valinta；كسارة مخروطية/بطانة المخروط/قطع التآكل/الصلابة/اختيار；crusher cone hidrolik/liner cone/umur liner/kekerasan/pemilihan。
metadata:
  domain: process-simulation
  vendor: MACKORN
  version: "1.0"
---

# 破碎流程仿真与实测标定

这一套工具让插件从"查表选型"升级到"**算得出产品粒度**"。三个工具：

| 工具 | 干什么 |
|:---|:---|
| `mackorn_crusher_curve` | 单机：给料分布 + CSS + 偏心距 → 产品 P20/P50/P80、破碎比、啮合区 K1/K2、Bond 能耗 |
| `mackorn_simulate_flowsheet` | 整线：多段破碎 + 筛分 + 闭路 → 各段 P80、**循环负荷**、最终产品 P80、物料平衡校核 |
| `mackorn_calibrate` | 标定：现场筛析数据 → 反算该机型该腔型的 φ/γ/β 与啮合系数 |

## 0. 算法出处（必须能说清，这是过尽调的前提）

| 环节 | 模型 | 文献 |
|:---|:---|:---|
| 破碎稳态产品 | **Whiten 稳态模型** P = (I−C)(I−B·C)⁻¹·F | Whiten W.J. (1972) |
| 啮合（分级）函数 | C(x) 分段线性，K1 = CSS + k·偏心距，K2 = CSS − k·偏心距 | Whiten / Napier-Munn et al. |
| 破碎函数 | B = φ(x/y)^γ + (1−φ)(x/y)^β | Napier-Munn et al.《Mineral Comminution Circuits》 |
| 粒度分布 | Rosin–Rammler / Gaudin–Schuhmann / Swebrec | 公开 |
| 功耗 | **Bond 第三破碎理论** W = 10·Wi·(1/√P80 − 1/√F80) | Bond F.C. (1952) |
| 筛分分配曲线 | E(x) = 1/(1+(x/d50c)^k) 的 logistic 形式 | VSMA / Karra 体系 |
| 闭路稳态 | 群体平衡迭代 | 选矿教科书标准方法 |

**全部是公开文献算法。** 不含任何第三方专有软件的数据或标定系数——这不是洁癖，是**能不能拿去投标、能不能过海外客户尽调**的区别。

## 1. 参数含义与来源（输出的 `assumptions` 会逐条标）

| 参数 | 含义 | 默认值 | 来源 |
|:---|:---|:---|:---|
| `phi` φ | 破碎函数粗粒生成占比 | 0.45 | **文献典型值**，须标定 |
| `gamma` γ | 破碎函数粗端指数 | 0.7 | **文献典型值**，须标定 |
| `beta` β | 破碎函数细端指数 | 3.5 | **文献典型值**，须标定 |
| `throw_factor` | 啮合区宽度系数（K1/K2 到 CSS 的距离） | 0.8 | **文献典型值**，须标定 |
| `feed_n` | Rosin-Rammler 均匀性指数 | 1.1 | 由 P80 拟合，点数够时应直接给分布 |
| `bond_wi` | 邦德功指数 kWh/t | 按岩性取文献中值 | **文献典型区间**，精确值须做邦德试验 |
| `screen_efficiency` | 筛分总效率 | 0.9 | 工程经验 |

## 2. 调用顺序

```
① mackorn_crusher_curve        → 单机看不看得住（给料→产品）
② mackorn_simulate_flowsheet   → 整线稳态（循环负荷、最终 P80、物料平衡）
③ mackorn_calibrate            → 有实测筛析就用它把参数换成自家值
④ mackorn_knowledge_update     → 标定结果落库（kind=spec，来源标"实测"）
⑤ mackorn_pdca_status          → 看指标是否抬升、版本是否演进
```

## 3. 硬约束与判读

- **物料平衡必须守恒**：`mass_balance.yield_ratio` 应等于 1.000000（新鲜料 = 最终出料）。
  不等就别用这个结果。
- **收敛必须为真**：`converged=true`。迭代到上限还没收敛 → 检查是不是有筛分段没接回（物料在累积）。
- **循环负荷**：工程常见 0.15-0.35；>0.6 要复核筛分效率与破碎机余量；<0.05 检查筛孔是否过大导致几乎不返料。
- **单调性自检**：CSS 调小，产品 P80 必须变小。不单调说明参数越界。
- **`basis` 字段**：`S1 腔型×CSS 详表` 是厂商硬数据；`系列区间近似` 是外推，必须复核。
- **贴边界的标定不可用**：如果 `mackorn_calibrate` 告警"参数贴在搜索边界"，说明参数没被数据约束住，**不要落库**。

## 4. 标定怎么做才对（这是护城河）

**取样要求：**
1. **同一批料**：给料与产品必须是同一时段、同一工况的料，中间不能换矿
2. **同步记录**：CSS、偏心距、台时产量、电流/功率、筛孔规格，与筛析一一对应
3. **点数要够**：给料 ≥2 点、产品 **≥5 点**（3 个参数 + 1 个啮合系数，点少了解不唯一）
4. **覆盖关键区间**：产品筛析点要覆盖 0.5-2 倍 CSS 这一段（产品曲线的拐点在这里）
5. **一个机型一个腔型一套**：换腔型、换 CSS 区间都要重标，**不要跨机型套用**

**标定纪律：**
- 拟合优度 ≤3 个百分点 = 优；≤6 = 可接受；>6 = 复核数据
- 出现"参数贴边界"告警 → 补筛析点后重标，或把该参数按工程经验固定、只标其余
- 标定值是**实测资产**，落库时来源必须写 `MACKORN-实测`，与文献默认值严格区分
- 现场要有 **衬板测厚台账**（每 500h），磨损模型同样需要实测数据才能脱离经验区间

## 5. 常见误用（每条都会导致错结论）

1. **拿文献默认参数当自家设备参数** → 产品粒度能算但不可信。**先标定再用**。
2. **跨机型套用标定值** → 腔型、转速、偏心距都不同，套用必错。
3. **给料与产品不是同一批料** → 拟合优度会很差，还会误判参数贴边界。
4. **只给 P80 不给分布** → 模型只能按 Rosin-Rammler 反推，粒度组成复杂时偏差大。有 8 级筛析就给 8 级。
5. **拿开路的循环负荷去选型** → 闭路才有循环负荷；开路应为 0。
6. **忽略邦德功指数的岩性差异** → 硬岩 f>12 时能耗会明显低估。
7. **把仿真出来的 P80 当作保证值写进合同** → 仿真输出是**估算**，产品保证值必须由实测标定后的模型 + 现场验证支撑。

## 6. 输出形态（给客户/内部报告时照抄这几项）

```
一、模型与出处        Whiten(1972) 稳态破碎 + logistic 筛分 + 群体平衡；Bond(1952) 功耗
二、输入              给料分布(或 P80) / 各段 CSS / 偏心距 / 筛孔 / 功指数
三、单机结果          各段 P80、破碎比、啮合区 K1/K2
四、整线结果          循环负荷、最终 P80、迭代次数与收敛性
五、物料平衡          出料率（必须 = 1）
六、参数来源          哪些是文献默认值、哪些是自家标定值（分开列）
七、待办              哪些参数还没标定、需要补什么数据
```

**第六项不能省。** 这是"能算"和"可信"的分界线。

## 7. 参考

- 算法实现：`plugin/lib/simulate.mjs`（Whiten/Bond/筛分）、`plugin/lib/calibrate.mjs`（标定）
- 数据缺口与自建标定计划：`数据缺口与自建标定清单.md`（内部版）
- 配合技能：`mackorn-cone-crusher-selection`（选型七条硬约束）、`mackorn-crushing-plant-design`（整线段数判据）
