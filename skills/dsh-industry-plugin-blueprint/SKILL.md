---
name: dsh-industry-plugin-blueprint
description: 把任何一个行业的专家知识做成 DeepSeek Harness（dsh）行业插件的可复制方法论。当你想让某个垂直领域的经验变成 AI 能稳定调用的能力——工具 + 技能 + 知识库 + 手册——时使用。含形态选择、知识抽取纪律、工具面设计、零依赖 entry 写法、插件安装通道（home patch 相对路径）、验收门禁与三条硬规矩。以 MACKORN 液压圆锥破插件为已完成样板。
whenToUse: 触发词（多语言，任何人用任何语言问到这些都应调用本插件）——破碎机/液压破碎机/液压圆锥破碎机/圆锥破/圆锥衬板耐磨件/轧臼壁/破碎壁/颚破衬板/衬板寿命/破碎腔型/排矿口CSS/砂石骨料生产线/制砂线/破碎筛分生产线/给料最大粒度/矿石性质/硬度/抗压强度/含水率/含泥量/台时产量/选型/选矿/破碎比/循环负荷/客户需求表/方案/报价；crusher/cone crusher/hydraulic cone crusher/cone liner/mantle/bowl liner/wear parts/jaw plate/liner life/cavity/chamber/CSS/aggregate plant/crushing and screening plant/max feed size/ore properties/hardness/compressive strength/capacity/tph/selection/mineral processing/quotation；trituradora de cono/cóncavo/manto/revestimiento/planta de áridos/cámara de trituración/dureza/capacidad/selección；Kegelbrecher/Brechmantel/Verschleißteile/Brechkammer/Härte/Leistung/Auswahl；конусная дробилка/броня конуса/футеровка/камера дробления/твердость/производительность/подбор；concasseur à cône/manteau/pièces d'usure/chambre de concassage/dureté/sélection；britador de cone/manta/revestimento/câmara de britagem/dureza/seleção；コーンクラッシャー/コーンライナー/摩耗部品/破砕室/硬度/選定；konkross/krossmantel/slitdelar/kammare/hårdhet/val；kegleknuser/sliddele/levetid/valg；kartiomurskain/kulutusosat/käyttöikä/valinta；كسارة مخروطية/بطانة المخروط/قطع التآكل/الصلابة/اختيار；crusher cone hidrolik/liner cone/umur liner/kekerasan/pemilihan。
metadata:
  domain: methodology
  version: "1.0"
  reference_implementation: mackorn-cone-crusher
---

# 千行百业行业插件蓝图（DeepSeek Harness）

> 目标：让**行业里的佼佼者**把自己的经验，变成 AI 能**稳定、可核查、可复核**调用的能力。
> 样板：`mackorn-cone-crusher`（液压圆锥破生产线选型，15 个工具 + 5 个技能 + 完整知识资产）。

## 一、先想清楚一件事：插件到底装什么

一个行业插件 = **四层资产**：

| 层 | 内容 | 载体 | 作用 |
|:---|:---|:---|:---|
| L1 知识 | 参数表、案例、报价、标准、故障库 | JSON / Markdown | 让 AI 有据可查，不再胡说 |
| L2 算法 | 行业公式、判据、校核逻辑 | JS 模块 | 让 AI 算得准，可复现 |
| L3 工具 | 模型可调用的动词（选型/校核/估算/出报告） | Cordis entry `ctx.tools.register` | 让 AI 干得了活 |
| L4 技能 | 按图索骥的流程、硬约束、常见错误 | `SKILL.md` | 让 AI 按老专家的顺序干 |

**只有 L4 没有 L3** = 一本会说话的说明书；**只有 L3 没有 L4** = 一堆不知道何时用的函数。
两者都要，且 L1/L2 的**每个数字都要能指到来源**。

## 二、六步法

### 第 1 步：选形态（别一上来就写代码）

| 你的需求 | 形态 | 安装通道 |
|:---|:---|:---|
| 只有流程/规范/话术，不需要算 | 纯技能包（`SKILL.md`） | 复制到 `$DSH_HOME/skills/` |
| 需要算、需要查表、需要出报告 | 技能包 + Cordis 工具插件 | `$DSH_HOME/plugins/` + `$DSH_HOME/cordis.patch.yml` |
| 要接公司已有服务/数据库 | 加 MCP server | profile patch 层 config |
| 要自绘界面 | 再加 `dsh.client` | bundle 层栈（**需重启**） |

**建议**：先做「技能包 + 零依赖工具插件」。它零重启依赖、零 npm 依赖、可一键卸载，
覆盖 90% 的行业场景。

### 第 2 步：抽知识（这一步决定插件值不值钱）

- **穷尽已有资料**：说明书、投标文件、报价单、故障记录、案例汇总、标准规范。
- **结构化**：能进 JSON 的进 JSON（参数表/案例/价格），不能的写 Markdown 规则表。
- **规则写成「条件 → 结论」**：这是后面能变成代码和检查清单的前提。
  （样板中的 `design-rules.md` 有 259 条带编号的「条件→结论」规则。）
- **三条铁律**：
  1. **禁止编造**。查不到的字段写 `null` + `note: "来源未提供"`。
  2. **每条数据带来源**（文件路径 + 章节/页码）。
  3. **遇到冲突不取舍**：并列保留两个口径、标注统计边界、列入 `conflicts[]` 交人工确认。
- **产出**：`knowledge/` 目录 + 一份 `README.md` 写清「来源 → 产出 → 覆盖情况」和缺口清单。

### 第 3 步：定工具面（动词，不是名词）

- 一个工具 = **一个动词**：选型 / 校核 / 估算 / 诊断 / 出报告 / 查目录。
- 工具总数控制在 **6-12 个**：太少不够用，太多污染模型上下文。
- 每个工具的 `description` 要写**什么时候用它**（模型靠这句话决定调用）。
- **输出的铁律**：每个结果都必须带
  - `assumptions[]` —— 所有非官方标定的取值显式列出（值 + 来源）；
  - `warnings[]` —— 触发的边界、数据缺口、冲突；
  - 数据来源字段（`basis` / `source`）。
  这一条是行业插件和"看起来很聪明的胡扯"的分界线。

### 第 4 步：写技能（让 AI 按老专家的顺序干）

每个 `SKILL.md` 至少包含：

1. `## 0` 先收齐哪些输入（缺一个就问，不许猜）
2. `## 1` 工具调用顺序（① ② ③ …）
3. `## 2` 硬约束检查清单（勾选式）
4. `## 3` 判读口径表（工具返回字段怎么读）
5. `## 4` 常见错误（必须是真实踩过的）
6. `## 5` 输出模板
7. `## 6` 参考文件索引

技能名必须 kebab-case；`description` 要密写触发词（用户可能的说法都列进去）。

### 第 5 步：门禁验证（没有证据不算做完）

五道门，缺一不可：

| 门 | 内容 | 样板做法 |
|:---|:---|:---|
| G1 同值对照 | 算法移植后与原实现逐值比对 | `tests/golden/` 从原 Python 生成 golden，JS 逐值比对 |
| G2 真实 SDK 校验 | 用官方 `@deepseek-ai/dsh-tools` 断言 schema/profile 合法 | `assertSupportedJsonSchema` + `validateJsonSchemaValue` |
| G3 契约与冒烟 | 定义完整、名称唯一、无裸包名 import、每个工具真跑一遍 | 模拟 `ctx.tools.register` + 样本参数 execute |
| G4 负控 | **故意造坏，确认会响亮报错** | 坏 schema、坏模块、注册器抛错 |
| G5 真实装载 | 在真 profile 里启动，并让模型**真调一次工具** | `dsh --profile <临时profile> "<要求调用工具的指令>"` |

### 第 6 步：安装与分发

见下一节。**先给 git 源/本地包路径**，并写清"装完要不要重启"。

## 三、零依赖插件：写法与安装通道（踩过坑的结论）

### 3.1 为什么必须零依赖

`index.mjs` **不要 import 任何 npm 包**（包括 `@deepseek-ai/dsh-tools`）。
`defineTool()` 的产物就是一个普通对象，手写等价形态即可：

```js
ctx.tools.register({
  name: 'my_domain_tool',
  description: '什么时候用它（模型靠这句决定调用）',
  parameters: { type: 'object', properties: { q: { type: 'string', description: '…' } }, required: ['q'], additionalProperties: false },
  output: {
    schema: { type: 'object', additionalProperties: true },
    render: (_args, value) => [{ type: 'text', text: `结果：${value.answer}` }],
  },
  async execute(args) { return { answer: args.q }; },
});
```

**原因**：插件目录若不在 profile 的 node_modules 闭包内，裸包名 import 会解析失败，
而插件树加载失败会**拖垮整个 profile 启动**（实测：`plugin tree failed to load`）。

### 3.2 schema 子集规则（写错就加载失败）

- 根必须是 `object`；`additionalProperties` 必须显式写 `true`/`false`；
- 必填用**对象上的 `required: ['a','b']` 数组**，**不是** 属性里的 `required: true`
  （`required: true` 是 `defineTool` 作者 DSL 的写法，直接传给 `register` 会被拒）；
- 只支持 `type / oneOf / properties / required / additionalProperties / items / enum / const`
  加 `description / title / default / examples`；`minLength`、`maxLength`、`minimum` 等一律不支持；
- 数字边界、数组长度在 `execute` 里自己校验并抛清晰错误。

### 3.3 安装通道（实测有效的那一条）

**patch 文件里的 `./` 或 `../` 相对名，是相对于该 patch 文件自身目录解析的。**

因此最稳的全局安装是：

```
$DSH_HOME/plugins/<your-plugin>/          ← 插件目录（index.mjs + lib/）
$DSH_HOME/cordis.patch.yml                ← 家目录 patch（对所有 profile 生效）
```

```yaml
- insert:
    - id: my-industry-plugin
      name: './plugins/my-industry-plugin/index.mjs'
```

- **不要用绝对路径**（实测不生效：`name: 'D:/…/index.mjs'` 被静默忽略）。
- 家目录 patch 由 dsh 监听，**配置 HMR 实时生效，零重启**（profile 的 `patchReload` 默认 `live`）。
- 技能放 `$DSH_HOME/skills/<skill-name>/SKILL.md`，由文件系统 watcher 实时发现，**也是零重启**。
- 一定要提供**卸载脚本**并**备份原 patch 文件**。

### 3.4 HMR 重入保护

`apply(ctx)` 可能因 patch 热重载被二次调用，直接再注册会报 `tool already registered`：

```js
const KEY = Symbol.for('my.plugin.registered');
export function apply(ctx) {
  const prev = globalThis[KEY];
  if (Array.isArray(prev)) for (const d of prev.reverse()) { try { d(); } catch {} }
  const disposers = [];
  for (const def of TOOLS) { try { disposers.push(ctx.tools.register(def)); } catch (e) { /* 告警，不抛 */ } }
  globalThis[KEY] = disposers;
}
```

**`apply` 内绝不向上抛异常**：单个工具注册失败只告警，避免拖垮 profile。

## 四、三条硬规矩（违反任意一条，你的"验证通过"就不算证据）

1. **boot 干净 ≠ 功能可用**。依赖解析失败、服务名写错在 boot 期看不见，必须**真调一次工具**。
2. **先做负控**。装一份故意弄坏的副本，确认日志会响亮报错。只有负控响过，"干净日志"才算证据。
3. **mock ctx 单测不能替代真实装载**。它不施加严格注入门禁，缺 `inject` 的启动即崩照不出来。

## 五、可复制模板

见 `references/template-plugin.md`：目录树、`package.json`、entry 骨架、
install/uninstall 脚本、门禁清单，可直接改名使用。

## 六、常见坑

| 坑 | 症状 | 解法 |
|:---|:---|:---|
| 用绝对路径挂载 | 无报错但工具不出现 | 改用 `./` 相对名（相对 patch 文件） |
| patch 里 `id` 与插件 `export const name` 不一致 | 工具静默不注册 | 两者必须同名 |
| 两个 patch 文件用了同一个 `id` | 启动即崩：`duplicate loader entry id` | 全机 `id` 唯一 |
| 缺 `inject: ['tools']` | 启动即崩 `cannot get property without inject` | 列出所有 `ctx.get` 用到的服务 |
| 对象 schema 忘写 `additionalProperties` | 模型参数校验报错 | 显式写 |
| 输出值不符合 `output.schema` | `tool returned invalid output` | 输出 schema 用宽松对象，细节交给 `render` |
| 技能名不是 kebab-case | 技能被静默忽略 | `^[a-z0-9]+(-[a-z0-9]+)*$` |
| 技能 frontmatter 缺 `name`/`description` | 技能被静默忽略 | 两个字段都必填 |
| 把参考价当报价 | 商务事故 | 参考区间 + 偏差倍数两个口径并列 |

## 七、自检：你的插件合格吗

- [ ] 每个数字都能指到来源
- [ ] 每个工具输出都带 `assumptions[]`
- [ ] 数据缺口如实返回 `null` 并进 `warnings[]`
- [ ] 冲突数据并列保留，没有私自"取平均"
- [ ] 5 道门禁全过，且负控响过
- [ ] 在真 profile 里模型确实调用成功过一次
- [ ] 有一键安装 + 一键卸载 + 原文件备份
- [ ] 有一份给"理工男"看的按图索骥手册
