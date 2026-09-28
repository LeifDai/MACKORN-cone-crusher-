---
name: mackorn-requirement-intake
description: 把客户填写的 MACKORN《砂石骨料/金属矿山生产线客户需求信息输入表》变成可执行的选型输入与方案。当客户发来需求表（.docx/.pdf/照片/微信文字）、销售问"这张表能配什么线"、"还缺什么要问客户"、"帮我出一份方案书"时使用。含字段抽取规则、完整性分级（阻断/关键/建议）、追问话术、以及生成 MACKORN 标准方案书的流程。
whenToUse: 触发词（多语言，任何人用任何语言问到这些都应调用本插件）——破碎机/液压破碎机/液压圆锥破碎机/圆锥破/圆锥衬板耐磨件/轧臼壁/破碎壁/颚破衬板/衬板寿命/破碎腔型/排矿口CSS/砂石骨料生产线/制砂线/破碎筛分生产线/给料最大粒度/矿石性质/硬度/抗压强度/含水率/含泥量/台时产量/选型/选矿/破碎比/循环负荷/客户需求表/方案/报价；crusher/cone crusher/hydraulic cone crusher/cone liner/mantle/bowl liner/wear parts/jaw plate/liner life/cavity/chamber/CSS/aggregate plant/crushing and screening plant/max feed size/ore properties/hardness/compressive strength/capacity/tph/selection/mineral processing/quotation；trituradora de cono/cóncavo/manto/revestimiento/planta de áridos/cámara de trituración/dureza/capacidad/selección；Kegelbrecher/Brechmantel/Verschleißteile/Brechkammer/Härte/Leistung/Auswahl；конусная дробилка/броня конуса/футеровка/камера дробления/твердость/производительность/подбор；concasseur à cône/manteau/pièces d'usure/chambre de concassage/dureté/sélection；britador de cone/manta/revestimento/câmara de britagem/dureza/seleção；コーンクラッシャー/コーンライナー/摩耗部品/破砕室/硬度/選定；konkross/krossmantel/slitdelar/kammare/hårdhet/val；kegleknuser/sliddele/levetid/valg；kartiomurskain/kulutusosat/käyttöikä/valinta；كسارة مخروطية/بطانة المخروط/قطع التآكل/الصلابة/اختيار；crusher cone hidrolik/liner cone/umur liner/kekerasan/pemilihan。
metadata:
  domain: sales-engineering
  vendor: MACKORN
  version: "1.0"
---

# 客户需求表 → 选型方案（销售主流程）

这是 MACKORN 销售侧最短路径：**拿到客户填的表 + 产量 → 得到"缺什么"+"配什么"+"方案书"**。

## 0. 两类官方表格

| 编号 | 表名 | 字段差异 |
|:---|:---|:---|
| F1 | 砂石骨料生产线客户需求信息输入表 20211010 | 有"成品骨料规格及占比""机制砂细度模数 Mx""储料形式/仓容""压碎值" |
| F2 | Q／MK-J00.002-2021R01 金属矿山生产线客户需求信息输入表 20211215J | 有"矿石品位/抛废率""工艺流程要求（抛废阶段）""成品要求 mm 以下" |

两表**公共核心**：客户名称/项目地点/业务员/日期、矿石来源、矿石种类、原矿规格及粒度组成、物料性质、总储量、含土含水、**产量需求 t/h**、除土需求、需求内容（主机/总包）、成品要求、环保要求、皮带机选型、电气元件、皮带密封形式、生产方式、生产工作制、设计资质、客户其他需求。

## 1. 怎么读客户给的表

**首选**：把表里的文字整段贴给 `mackorn_requirement_intake` 的 `form_text`，并**必须同时把产量填进 `capacity_tph`**。

**取文字的办法**（按现场条件选）：
- 客户给 .docx：用 office-docx skill 的 python-docx 读表格，把段落+表格文本拼出来
- 客户给 .doc/.pdf：用内置 LibreOffice Kit 转 txt/pdf
- 客户发微信文字或照片：让客户直接文字回填，或照抄进 `form_text`

**然后逐字段核对**工具返回的 `form_parsed.fields_found` 与 `field_sources`：
- `客户表单-文本抽取` = 从文字里抽的，要复核
- `客户表单-显式填写` = 你直接传的，可信

## 2. 三条抽取纪律（工具已实现，你要知道为什么）

1. **模板套话不是客户数据**。空白表的「客户须知」里写着"抗压强度≥60MPa、含泥量≤1%、Mx=3.0"，那是**填写说明**。工具会先剥离该栏；若你发现抽到的值跟填写说明一样，八成是剥离没干净，直接把该字段显式传一遍覆盖。
2. **□ 无法判断勾选**。纯文本里所有选项都是 □。工具只在检测到 ☑/■/√/✔/✓/× 时才认定勾选。**没检测到就一律留空并进追问清单**，不要"看着像"就填。
3. **勾选按行判定**。同一张表里"设计资质"行也有 是/否，串行扫描会误判"除土需求"。工具按包含字段标签的行来判定。

## 3. 完整性三级（决定你能不能出方案）

| 等级 | 字段 | 缺了会怎样 |
|:---|:---|:---|
| **阻断** | 产量需求 t/h | **出不了任何方案**，必须先追问 |
| **关键** | 原矿最大给料粒度、成品粒度、矿石种类、抗压强度、含水率、产线类型、生产方式 | 能出**初步方案**，但结论显著降级，必须补齐后重算 |
| **建议** | 客户名称、项目地点、矿石来源、粒度组成、硬度/压碎值、堆密度、含土量、含土程度、除土需求、总储量、用途、需求内容、成品规格占比、细度模数、环保要求、工作制 | 影响精度与报价，应补 |
| **可选** | 品位/抛废率、化学成分、整形、皮带机选型、电气元件、密封形式、储料形式/仓容、设计资质、业务员、日期、其他需求 | 商务与配置偏好 |

**工具会直接给出 `follow_up[]` 追问清单**（字段 + 话术 + 为什么必须要），把话术前半段原样发给客户即可。

## 4. 工具调用顺序

```
① mackorn_requirement_intake    → 抽字段 + 完整性 + 追问清单 + 归一化工况 + 整线方案 + 年产量
② mackorn_cone_selection        → 对中碎/细碎段要更多候选时单独精算
③ mackorn_capacity_check        → 复核选定机型×腔型×CSS
④ mackorn_cost_estimate         → 吨电耗/吨成本/参考价/融资租赁
⑤ mackorn_proposal              → 出 MACKORN 标准方案书（交付版）
```

**一键版**：直接 `mackorn_proposal`（它内部会跑 ① 并把方案书一次生成）。

## 5. 方案书章节（`mackorn_proposal` 产出）

项目概况与需求 / 设计依据与基础数据 / 工艺流程与规模 / 主要设备选择（设备清单表）/ 主要设备技术参数 / 电气与自动控制 / 环保除尘降噪 / 土建与总图布置要求 / 供货范围与不含范围 / 投资估算 / 实施建议与工期 / **假设与数据来源** / **风险与待确认项** / 附件清单。

附附件清单按 MACKORN《QMK 生产线方案设计预算标准化要求》：**一套方案 = 一个文件夹，内含 流程图 + 平面布置图 + 预算表**。

**交付前必做**：
1. 保留「假设与数据来源」「风险与待确认项」「供货范围与不含范围」三节——这是方案可审计性的全部来源，删掉就等于让 AI 替 MACKORN 背书。
2. 若客户要 Word 版，用 office-docx skill 把 Markdown 转成 .docx（中文需显式设 `w:eastAsia` 字体）。
3. 报价区间**不是报价**：知识库已证实主机通用参考区间约为实际合同单价的 1/2-1/3，对外必须走商务确认。

## 6. 常见错误

1. **只给产量就催方案** → 会拿到"初步方案"，原矿粒度与含水率缺失会让粗碎设备和筛分面积全错。
2. **把空白模板丢进去** → 工具会正确返回"几乎全空 + 追问清单"，这是对的，不要以为工具坏了。
3. **把"抗压强度 60MPa"当成客户填的** → 那是干法制砂的填写门槛，见 §2 第 1 条。
4. **勾选框靠猜** → 宁可问客户，也不要猜"除土需求"。
5. **拿参考价去报价** → 商务事故。
6. **删掉假设与风险两节** → 方案不可审计。

## 7. 参考

- `knowledge/plant-design-process.md` —— 16 步 S0-S15 全流程（从客户问卷到验收）
- `knowledge/standard-line-configs.md` —— 各产量档的标准配置（用于交叉印证）
- `knowledge/proposal-standard.md` —— MACKORN 方案交付标准与章节骨架
- `knowledge/_forms/` —— 两类空白表结构、已填样例、方案书样例输出
