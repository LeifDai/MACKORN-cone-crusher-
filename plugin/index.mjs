/**
 * MACKORN 液压圆锥破碎机生产线选型 · DeepSeek Harness 插件（Cordis entry）
 * ============================================================================
 * 形态：纯 Cordis 插件（无 `dsh.bundle`），经 `$DSH_HOME/cordis.patch.yml`
 *       或 profile `cordis.patch.yml` 的 insert 行挂载（配置 HMR 实时生效）。
 *
 * 关键工程决策（必须在文档中保持诚实）：
 *   1. **零外部依赖**：本文件不 import 任何 `@deepseek-ai/*` 包。工具定义以
 *      `defineTool()` 的编译产物形态手写（raw JSON Schema + execute + render），
 *      由装配环境注入的 `ctx.tools` 完成注册。理由：绝对路径挂载的插件目录
 *      不在 profile 的 node_modules 闭包内，裸包名解析会失败（会拖垮整个
 *      profile 启动）。零依赖使 `$DSH_HOME/plugins/` 下的绝对路径挂载成为
 *      最安全的安装通道。
 *   2. **HMR 重入保护**：`apply()` 可能因用户 patch 文件热重载被二次调用。
 *      第一次注册的 disposer 记在 `globalThis[Symbol.for(...)]` 上，重入时先
 *      释放再注册，避免 "tool already registered"。
 *   3. **加载期绝不抛错**：单个工具注册失败只告警并跳过，不能让 profile 树加载失败。
 *
 * @module mackorn-cone-crusher
 */

import {
  analyzeMcfm, selectConeCrusher, checkCapacity, sizePlant, estimateCost,
  analyzeWear, analyzeGrading, marketIntel, buildSelectionReport, ENGINEERING_RULES,
} from './lib/engine.mjs';
import { intakeRequirement, FORM_FIELDS } from './lib/intake.mjs';
import { buildProposal } from './lib/proposal.mjs';
import { crusherCurve, flowsheet } from './lib/sim-adapter.mjs';
import { calibrateBreakage } from './lib/calibrate.mjs';
import { contactBlockCN, contactBlockEN, COMPANY, CONTACTS, WECHAT_QR, PARTNER_PROGRAM, triggerCoverageReport, TRIGGER_KEYWORDS } from './lib/contact.mjs';
import { contactBlockLang, normalizeLang, languageCoverage } from './lib/contact-i18n.mjs';
import {
  intelBrief, ingestKnowledge, evolutionStatus, recordPdca,
} from './lib/evolve.mjs';
import { ALL_MODELS, CAVITY_TYPES, SOURCES, NH_SERIES, NS_SERIES } from './lib/data.mjs';
import { PRICE_DISCLAIMER } from './lib/data-market.mjs';

export const name = 'mackorn-cone-crusher';
export const inject = ['tools'];

const REGISTRY_KEY = Symbol.for('mackorn.cone-crusher.disposers');
const MODEL_ENUM = ALL_MODELS.map((m) => m.model);
const CAVITY_ENUM = CAVITY_TYPES.map((c) => c.code);

/* --------------------------------------------------------------------------
 * 小工具：raw JSON Schema 构造（严格贴合 dsh-tools 的 schema 子集）
 * ------------------------------------------------------------------------ */

const S = {
  string: (description, extra = {}) => ({ type: 'string', description, ...extra }),
  number: (description, extra = {}) => ({ type: 'number', description, ...extra }),
  integer: (description, extra = {}) => ({ type: 'integer', description, ...extra }),
  boolean: (description, extra = {}) => ({ type: 'boolean', description, ...extra }),
  arrayOfNumbers: (description, extra = {}) => ({ type: 'array', description, items: { type: 'number' }, ...extra }),
  stringEnum: (description, values, extra = {}) => ({ type: 'string', description, enum: values, ...extra }),
};

const obj = (properties, required = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
});

/** 宽松对象输出模式：只要求可无损 JSON 化，具体结构由 render 呈现。 */
const ANY_OBJECT = { type: 'object', additionalProperties: true };

const text = (value) => [{ type: 'text', text: value }];

const mdTable = (headers, rows) => {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `|${headers.map(() => ':---|').join('')}`;
  const body = rows
    .map((r) => `| ${r.map((c) => (c === null || c === undefined ? '-' : String(c))).join(' | ')} |`)
    .join('\n');
  return `${head}\n${sep}\n${body}`;
};

const jsonBlock = (value, label = '原始结果 JSON') =>
  `\n\n<details><summary>${label}</summary>\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n\n</details>`;

const assumptionBlock = (assumptions = [], warnings = []) => {
  const parts = [];
  if (assumptions.length) {
    parts.push('**假设与来源**\n\n' + mdTable(['假设', '来源'], assumptions.map((a) => [a.assumption, a.source])));
  }
  if (warnings.length) parts.push('**风险与待确认项**\n\n' + warnings.map((w) => `- ⚠️ ${w}`).join('\n'));
  return parts.length ? `\n\n---\n\n${parts.join('\n\n')}` : '';
};

/* --------------------------------------------------------------------------
 * 工具 1：MCFM 粒度分布诊断
 * ------------------------------------------------------------------------ */

const toolMcfm = {
  name: 'mackorn_mcfm_analysis',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) 计算 MACKORN 粗粒级给料模数 MCFM（M=(A1+…+A7−7A8)/(100−A8)），判定是否落在工程最优窗口 4.0-4.5，并给出"均匀布料 → 速度均匀化 → 磨损稳定 → 模数恒定"的杠杆调整建议。用于诊断破碎腔给料级配是否稳定、是否应先改布料而不是换设备。当用户提到给料级配、筛余、模数、离析、布料、细碎台时产量偏低时调用。',
  parameters: obj(
    {
      cumulative_retained: S.arrayOfNumbers(
        '长度必须为 8 的累积筛余百分比数组，依次对应 最大给料/60/40/20/10/5/2.5mm 与 80% 通过粒级（A1..A8，单位 %）。',
      ),
      feed_top_mm: S.number('给料最大粒度 mm，用于上下文校验。'),
      target_product_mm: S.number('目标最终产品粒度 mm。'),
      ore_note: S.string('矿石名称/硬度/含泥量等备注，原样回显。'),
    },
    ['cumulative_retained'],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_args, v) => text(
      [
        `## MCFM 粗粒级模数诊断`,
        ``,
        `- **模数 M = ${v.mcfm ?? '未计算'}**（工程最优窗口 ${v.optimal_range.join(' - ')}）`,
        v.deviation ? `- 判定：**${v.deviation.level}**，偏离度 ${v.deviation.deviation}` : '',
        v.advice ? `- 工程含义：${v.advice.meaning}` : '',
        v.advice ? `- 建议动作：**${v.advice.action}**（优先级 ${v.advice.priority}）` : '',
        ``,
        `### 杠杆链（按顺序检查，不要跳步）`,
        mdTable(['步', '杠杆', '度量', '目标'], v.leverage_chain.map((s) => [s.step, s.lever, s.metric, s.target])),
        assumptionBlock(v.assumptions, v.warnings),
        jsonBlock(v),
      ]
        .filter((line) => line !== '')
        .join('\n'),
    ),
  },
  async execute(args) {
    return analyzeMcfm({
      cumulativeRetained: args.cumulative_retained,
      feedTopMm: args.feed_top_mm,
      targetProductMm: args.target_product_mm,
      oreNote: args.ore_note,
    });
  },
};

/* --------------------------------------------------------------------------
 * 工具 2：液压圆锥破碎机选型
 * ------------------------------------------------------------------------ */

const toolSelection = {
  name: 'mackorn_cone_selection',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) MACKORN 液压圆锥破碎机选型主工具：按目标处理量 t/h、给料最大粒度、目标产品粒度与工序（中碎/细碎/超细碎）从 NH 标准型与 NS 高速型单缸液压圆锥破中选出机型 + 腔型 + 紧边排矿口 CSS + 台数，给出候选排序、P80 估计、参考价区间与达标判定。数据源为 MACKORN《NH_NS系列技术参数大全》。当用户问"选什么型号/几台/多大功率/什么腔型/CSS 定多少"时调用。',
  parameters: obj(
    {
      target_tph: S.number('目标处理量 t/h（必填，正数）。'),
      max_feed_mm: S.number('进入本段破碎机的最大给料粒度 mm。'),
      target_product_mm: S.number('目标最终产品粒度 mm（用于推断工序段与细度可行性）。'),
      stage: S.stringEnum('工序段；auto 由给料/产品粒度自动推断。', ['auto', '中碎', '细碎', '超细碎'], { default: 'auto' }),
      ore: S.string('矿石名称与硬度备注（如"花岗岩 f=12-14"）。'),
      units: S.integer('指定并联台数；不填则自动按目标产量推算。'),
      closed_circuit: S.boolean('是否与筛分构成闭路（默认 true）。闭路会按循环负荷放大系数校核。', { default: true }),
    },
    ['target_tph'],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_args, v) => {
      const head = v.top_pick
        ? `## 液压圆锥破选型结论\n\n**首选：${v.top_pick.model} · ${v.top_pick.cavity} 腔 · CSS ${v.top_pick.css_mm} mm · ${v.top_pick.power_kw} kW · ${v.recommended_units} 台**\n\n- 系列：${v.top_pick.series}\n- 单台需求 ${v.per_unit_tph} t/h；单台额定能力 ${v.top_pick.capacity_tph.join('-')} t/h（计入循环负荷后 ${v.top_pick.capacity_after_circulating_load_tph} t/h）\n- P80 估计 ${v.top_pick.p80_estimate_mm.join('-')} mm；余量比 ${v.top_pick.headroom_ratio}；达标：${v.top_pick.capacity_ok ? '是' : '**否**'}\n- 参考价 ${v.top_pick.price_ref_wan_cny_per_unit ? v.top_pick.price_ref_wan_cny_per_unit.join('-') + ' 万元/台' : '待商务确认'}`
        : '## 液压圆锥破选型结论\n\n**没有任何机型/腔型组合满足给定约束。**';
      return text(
        [
          head,
          '',
          '### 候选排序（前 8）',
          mdTable(
            ['评分', '机型', '系列', '腔型', 'CSS', 'P80 估计', '产能 t/h', '计入循环负荷', '功率 kW', '参考价', '达标'],
            v.candidates.map((c) => [
              c.match_score, c.model, c.series, c.cavity, c.css_mm,
              c.p80_estimate_mm.join('-'), c.capacity_tph.join('-'), c.capacity_after_circulating_load_tph,
              c.power_kw, c.price_ref_wan_cny_per_unit ? c.price_ref_wan_cny_per_unit.join('-') : '-',
              c.capacity_ok ? '是' : '否',
            ]),
          ),
          '',
          `> 腔型建议池：${v.recommended_cavity_pool.join(' / ')}`,
          assumptionBlock(v.assumptions, v.warnings),
          jsonBlock(v),
        ].join('\n'),
      );
    },
  },
  async execute(args) {
    return selectConeCrusher({
      targetTph: args.target_tph,
      maxFeedMm: args.max_feed_mm,
      targetProductMm: args.target_product_mm,
      stage: args.stage,
      ore: args.ore,
      units: args.units,
      closedCircuit: args.closed_circuit,
    });
  },
};

/* --------------------------------------------------------------------------
 * 工具 3：产能校核
 * ------------------------------------------------------------------------ */

const toolCapacity = {
  name: 'mackorn_capacity_check',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) 给定 MACKORN 机型 + 腔型 + 紧边排矿口 CSS，从《NH_NS系列技术参数大全》腔型×CSS 详表查出生产能力区间 t/h（无详表的机型按系列区间外推并标注为近似），同时返回排矿口范围合规性、最大给料限制、外形尺寸与重量。用于复核既有设备能力或验证选型结论。',
  parameters: obj(
    {
      model: S.stringEnum('机型型号。', MODEL_ENUM),
      cavity: S.stringEnum('腔型代码。', CAVITY_ENUM),
      css: S.number('紧边排矿口 CSS，mm。'),
    },
    ['model', 'css'],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_args, v) => text(
      [
        `## 产能校核 · ${v.model} ${v.cavity ?? ''}腔 @ CSS ${v.css} mm`,
        '',
        `- 生产能力：**${v.capacity_min_tph} - ${v.capacity_rated_tph} t/h**`,
        `- 依据：${v.basis}`,
        `- 机型排矿口范围：${v.css_range_mm.join('-')} mm；最大给料 ${v.max_feed_mm} mm；功率 ${v.power_kw} kW；重量 ${(v.weight_kg / 1000).toFixed(1)} t`,
        v.cavity_note ? `- 腔型特性：${v.cavity_note}` : '',
        v.dimensions_mm ? `- 外形：机架外径 ${v.dimensions_mm.A} mm，总长 ${v.dimensions_mm.K_totalLength} mm，全高 ${v.dimensions_mm.B ?? '来源标注需核实'}` : '',
        assumptionBlock(v.assumptions, v.warnings),
        jsonBlock(v),
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  },
  async execute(args) {
    return checkCapacity({ model: args.model, cavity: args.cavity, css: args.css });
  },
};

/* --------------------------------------------------------------------------
 * 工具 4：破碎筛分生产线配置
 * ------------------------------------------------------------------------ */

const toolPlant = {
  name: 'mackorn_plant_design',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) MACKORN 破碎筛分生产线总体配置：按原矿最大粒度与目标产品粒度计算总破碎比、推荐破碎段数、各段给料/产品/破碎比分配，并对中碎段与细碎段各做一次液压圆锥破选型，同时给出筛分面积、输送带带宽、辅机（给料机/除铁器/除尘/洗砂/AORS）配置建议。用于从"客户要一条 X t/h 的线"走到"每段放什么设备"。',
  parameters: obj(
    {
      target_tph: S.number('目标成品处理量 t/h（必填）。'),
      max_feed_mm: S.number('原矿最大给料粒度 mm（默认 500）。', { default: 500 }),
      target_product_mm: S.number('最终产品粒度 mm（默认 20）。', { default: 20 }),
      ore: S.string('矿石名称/硬度/含泥量备注。'),
      closed_circuit: S.boolean('细碎段是否闭路（默认 true）。', { default: true }),
      washing: S.boolean('是否需要洗砂/污水处理系统（默认 false）。', { default: false }),
    },
    ['target_tph'],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_args, v) => text(
      [
        `## 破碎筛分生产线配置 · ${v.request.targetTph} t/h`,
        '',
        `- 给料 ${v.request.maxFeedMm} mm → 产品 ${v.request.productMm} mm，总破碎比 **${v.total_reduction_ratio}**`,
        `- 推荐段数：**${v.recommended_stages} 段**（${v.stages_guide_note ?? ''}）`,
        '',
        '### 分段计划',
        mdTable(['段', '工序', '给料 mm', '产品 mm', '破碎比', '职责'], v.stage_plan.map((s) => [s.index, s.stage, s.feed_mm, s.product_mm, s.reduction_ratio, s.duty])),
        '',
        '### 液压圆锥破选型',
        v.cone_crusher_coarse_side ? `- 中碎段首选：**${v.cone_crusher_coarse_side.model} ${v.cone_crusher_coarse_side.cavity} 腔 @ CSS ${v.cone_crusher_coarse_side.css_mm} mm，${v.cone_crusher_coarse_side.capacity_tph.join('-')} t/h，${v.cone_crusher_coarse_side.power_kw} kW，${v.cone_crusher_coarse_side.units} 台**（单台需求 ${v.cone_crusher_coarse_side.per_unit_tph} t/h；依据：${v.cone_crusher_coarse_side.basis}）` : '- 中碎段：无满足项',
        v.cone_crusher_fine_side ? `- 细碎段首选：**${v.cone_crusher_fine_side.model} ${v.cone_crusher_fine_side.cavity} 腔 @ CSS ${v.cone_crusher_fine_side.css_mm} mm，${v.cone_crusher_fine_side.capacity_tph.join('-')} t/h，${v.cone_crusher_fine_side.power_kw} kW，${v.cone_crusher_fine_side.units} 台**（单台需求 ${v.cone_crusher_fine_side.per_unit_tph} t/h；依据：${v.cone_crusher_fine_side.basis}）` : '',
        v.cone_crusher_coarse_side || v.cone_crusher_fine_side ? '' : '',
        '> 硬数据/近似值判定：`依据 = S1 腔型×CSS 详表` 为厂商硬数据；`系列区间近似` 须经 MACKORN 技术复核。',
        '',
        '### 筛分与输送',
        `- 筛分处理量 ${v.screening.throughput_tph} t/h；建议筛分面积 **${v.screening.optimistic_m2} - ${v.screening.conservative_m2} m²**（效率 ${v.screening.efficiency_range.join('-')}）`,
        `- 输送设计能力 ${v.conveying.design_throughput_tph} t/h；建议带宽 **${v.conveying.recommended_width_mm ?? '待核算'} mm**，最大倾角 ${v.conveying.max_incline_deg.join('-')}°`,
        '',
        '### 辅机',
        mdTable(['项', '配置'], Object.entries(v.auxiliary).map(([k, val]) => [k, Array.isArray(val) ? val.join('-') : val])),
        assumptionBlock(v.assumptions, v.warnings),
        jsonBlock(v),
      ]
        .filter((line) => line !== '')
        .join('\n'),
    ),
  },
  async execute(args) {
    return sizePlant({
      targetTph: args.target_tph,
      maxFeedMm: args.max_feed_mm,
      targetProductMm: args.target_product_mm,
      ore: args.ore,
      closedCircuit: args.closed_circuit,
      washing: args.washing,
    });
  },
};

/* --------------------------------------------------------------------------
 * 工具 5：投资与运营成本
 * ------------------------------------------------------------------------ */

const toolCost = {
  name: 'mackorn_cost_estimate',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) MACKORN 液压圆锥破投资与运营成本估算：按机型与台数算装机功率、年电耗、年电费、吨电耗与吨电费；按项目实际电价/年运行小时/负荷率/衬板寿命与衬板价算衬板吨成本；给出 S4 历史报价区间、液压站分档报价、备件参考价、报价影响因素与融资租赁月供测算。明确列出未含范围（土建/钢构/电气/安装/运输/税费）。',
  parameters: obj(
    {
      model: S.stringEnum('机型型号。', MODEL_ENUM),
      units: S.integer('台数（默认 1）。', { default: 1 }),
      tph: S.number('该机型对应处理量 t/h，用于吨成本换算。'),
      hours_per_year: S.integer('年运行小时数。'),
      electricity_price: S.number('电价 元/kWh。'),
      load_factor: S.number('负荷率 0-1。'),
      liner_life_hours: S.number('衬板寿命 h（项目实测值，用于算衬板吨成本）。'),
      liner_cost_per_set: S.number('单套衬板价格 元/套。'),
      unit_price_wan_cny: S.number('实际商务单价 万元/台（有则优先于参考区间）。'),
      annual_rate: S.number('融资租赁年利率（小数，如 0.06）；不填则不做月供测算。'),
      term_years: S.integer('融资租赁年限。'),
    },
    ['model'],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_args, v) => text(
      [
        `## 成本估算 · ${v.unit.model} × ${v.unit.units} 台（装机 ${v.unit.installed_kw} kW）`,
        '',
        '### CAPEX',
        v.capex.quoted_total_cny ? `- 商务单价合计：**${v.capex.quoted_total_cny.toLocaleString()} 元**` : `- 商务单价：未提供，使用参考区间`,
        v.capex.reference_band_cny ? `- 参考区间：**${v.capex.reference_band_cny[0].toLocaleString()} - ${v.capex.reference_band_cny[1].toLocaleString()} 元**（${v.capex.reference_band_note}）` : '',
        `- 不含：${v.capex.excluded_scope.join('、')}`,
        '',
        '### OPEX',
        `- 年电耗 ${v.opex.energy_kwh_per_year.toLocaleString()} kWh；年电费 **${v.opex.energy_cny_per_year.toLocaleString()} 元**`,
        `- 吨电耗 ${v.opex.energy_kwh_per_ton ?? '-'} kWh/t；吨电费 ${v.opex.energy_cny_per_ton ?? '-'} 元/t`,
        `- 衬板吨成本 ${v.opex.liner_cny_per_ton ?? '未计算（缺衬板寿命/价格）'} 元/t`,
        `- **综合吨成本（电+衬板）${v.opex.cost_per_ton_cny ?? '-'} 元/t**（不含 ${v.opex.excludes.join('、')}）`,
        v.financing ? `\n### 融资租赁\n- 首付 ${v.financing.down_payment_cny.toLocaleString()} 元；贷款 ${v.financing.loan_cny.toLocaleString()} 元；${v.financing.term_years} 年\n- 月供 **${v.financing.monthly_payment_cny.toLocaleString()} 元**` : '',
        '',
        '### 液压站分档报价',
        mdTable(['配置', '参考价（万元）'], v.capex.hydraulic_station_options.map((o) => [o.tier, o.priceWanCny.join('-')])),
        '',
        '### 备件参考价',
        mdTable(['备件', '参考价', '备注'], v.spare_parts_reference.map((s) => [s.name, s.priceRange, s.note])),
        assumptionBlock(v.assumptions, v.warnings),
        jsonBlock(v),
      ]
        .filter((line) => line !== '')
        .join('\n'),
    ),
  },
  async execute(args) {
    return estimateCost({
      model: args.model,
      units: args.units,
      tph: args.tph,
      hoursPerYear: args.hours_per_year,
      electricityPriceCnyPerKwh: args.electricity_price,
      loadFactor: args.load_factor,
      linerLifeHours: args.liner_life_hours,
      linerCostCnyPerSet: args.liner_cost_per_set,
      unitPriceWanCny: args.unit_price_wan_cny,
      annualRate: args.annual_rate,
      termYears: args.term_years,
    });
  },
};

/* --------------------------------------------------------------------------
 * 工具 6：衬板磨损与多梯度设计
 * ------------------------------------------------------------------------ */

const toolWear = {
  name: 'mackorn_wear_design',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) 沿破碎腔高度离散截面评估衬板磨损均匀度（均匀度 = 1 − σ/μ，均等化条件 dW/dt ≈ const），给出多梯度分区硬度设计 H_i = H_base × k^i，并给出磨损均匀度提升量。可输入现场实测磨损速率（各截面测厚差值）；不输入则用合成示例曲线演示方法（输出会明确标注为合成数据）。',
  parameters: obj(
    {
      sections: S.integer('沿腔高离散截面数（3-12，默认 5）。', { default: 5 }),
      wear_rates: S.arrayOfNumbers('各截面实测磨损速率（mm/1000h 或任意一致单位），长度应等于截面数。'),
      base_hardness: S.number('基础分区硬度 HB（默认 58）。', { default: 58 }),
      gradient_factor: S.number('硬度梯度因子（默认 1.12）。', { default: 1.12 }),
    },
    [],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_args, v) => text(
      [
        `## 衬板磨损均匀度与多梯度设计（${v.sections} 个截面）`,
        '',
        `- 设计前均匀度 ${v.uniformity_before.uniformity}（CV ${v.uniformity_before.cv}，最大/最小比 ${v.uniformity_before.max_min_ratio ?? '-'}）`,
        `- 多梯度设计后均匀度 **${v.uniformity_after_gradient_design.uniformity}**（提升 ${v.improvement.uniformity_gain}）`,
        `- 分区硬度：${v.liner_hardness_schedule.join(' / ')} HB（基础 ${v.hardness_params.base}，梯度 ${v.hardness_params.gradient_factor}）`,
        '',
        '### 建议',
        ...v.recommendations.map((r) => `- ${r}`),
        assumptionBlock(v.assumptions, v.warnings),
        jsonBlock(v),
      ].join('\n'),
    ),
  },
  async execute(args) {
    return analyzeWear({
      sections: args.sections,
      wearRates: args.wear_rates,
      baseHardness: args.base_hardness,
      gradientFactor: args.gradient_factor,
    });
  },
};

/* --------------------------------------------------------------------------
 * 工具 7：孔隙率与粒级配比
 * ------------------------------------------------------------------------ */

const toolGrading = {
  name: 'mackorn_grading_porosity',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) 按粗/中/细三组分配比计算料层孔隙率 φ（经验模型 φ = 0.42 − 0.30·min(中料占比,0.35) + 0.15·max(0, 细料占比 − 0.30)），与最优配比窗口（粗 50% / 中 30% / 细 20%，最优孔隙率 0.28）对比，判断料层密度是否足以维持模数恒定。',
  parameters: obj(
    {
      coarse_frac: S.number('粗骨料占比（可为任意一致单位，内部归一化）。'),
      mid_frac: S.number('中间粒级占比（关键充填相）。'),
      fine_frac: S.number('细颗粒占比。'),
    },
    ['coarse_frac', 'mid_frac', 'fine_frac'],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_args, v) => text(
      [
        `## 料层孔隙率与粒级配比`,
        '',
        `- 归一化配比：粗 ${v.input_normalized.coarse} / 中 ${v.input_normalized.mid} / 细 ${v.input_normalized.fine}`,
        `- 孔隙率 **φ = ${v.porosity}**（最优参考 ${v.optimal_porosity_reference}，差距 ${v.gap_to_optimal}）`,
        `- 判定：${v.verdict}`,
        assumptionBlock(v.assumptions, v.warnings),
        jsonBlock(v),
      ].join('\n'),
    ),
  },
  async execute(args) {
    return analyzeGrading({ coarseFrac: args.coarse_frac, midFrac: args.mid_frac, fineFrac: args.fine_frac });
  },
};

/* --------------------------------------------------------------------------
 * 工具 8：市场纵深
 * ------------------------------------------------------------------------ */

const scoreSchema = obj(
  {
    score: S.number('1-5 分。'),
    weight: S.number('权重（默认 1）。'),
    evidence: { type: 'array', description: '支撑该评分的证据（报告名/页码/报价单编号等）。', items: { type: 'string' } },
  },
  ['score'],
);

const toolMarket = {
  name: 'mackorn_market_intel',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) MACKORN 液压圆锥破市场纵深分析：返回"行业/技术/时效/经济/可操作"五维评估框架与打分口径、破碎效率核心杠杆链、竞品对标矩阵（美卓 HP / 山特维克 CS / 特雷克斯 / 克虏伯）、美矿优势与差距、客户痛点应对话术、报价影响因素与价格参考区间。若用户提供各维度 1-5 分与权重，则直接输出五维加权得分与推进结论。',
  parameters: obj(
    {
      focus: S.string('分析焦点（区域市场/客户类型/竞品品牌等）。'),
      scores: obj(
        {
          industry: scoreSchema,
          technology: scoreSchema,
          timeliness: scoreSchema,
          economics: scoreSchema,
          operability: scoreSchema,
        },
        [],
      ),
    },
    [],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_args, v) => {
      const lines = ['## 市场纵深分析' + (v.focus ? ` · ${v.focus}` : ''), ''];
      if (v.scoring) {
        lines.push(
          `### 五维加权得分：**${v.scoring.weighted_score} / 5**`,
          `结论：**${v.scoring.verdict}**`,
          '',
          mdTable(['维度', '得分', '权重', '证据'], v.scoring.dimensions.map((d) => [d.name, d.score, d.weight, d.evidence.join('; ') || '-'])),
          '',
        );
      } else {
        lines.push('> 未提供各维度评分，以下为评估框架（请按 evidence 取证后再打分）。', '');
      }
      lines.push(
        '### 五维评估框架',
        mdTable(['维度', '要回答的问题', '打分口径'], v.framework.map((d) => [d.name, d.question, d.scoreRule])),
        '',
        '### 破碎效率核心杠杆链',
        mdTable(['步', '杠杆', '度量', '目标'], v.leverage_chain.map((s) => [s.step, s.lever, s.metric, s.target])),
        '',
        '### 竞品对标矩阵',
        mdTable(['维度', ...v.competitors.matrix.columns.map((c) => c.brand)], v.competitors.matrix.dimensions.map((dim, i) => [dim, ...v.competitors.matrix.columns.map((c) => c.values[i])])),
        '',
        '### 美矿优势 / 差距',
        mdTable(['优势', '说明'], v.mackorn.advantages.map((a) => [a.item, a.detail])),
        '',
        mdTable(['差距', '说明'], v.mackorn.gaps.map((a) => [a.item, a.detail])),
        '',
        '### 客户痛点应对',
        mdTable(['痛点', '应对'], v.pain_point_playbook.map((p) => [p.pain, p.answer])),
        assumptionBlock(v.assumptions, v.warnings),
        jsonBlock(v),
      );
      return text(lines.join('\n'));
    },
  },
  async execute(args) {
    return marketIntel({ focus: args.focus, scores: args.scores });
  },
};

/* --------------------------------------------------------------------------
 * 工具 9：选型报告（按图索骥的一键收口）
 * ------------------------------------------------------------------------ */

const toolReport = {
  name: 'mackorn_selection_report',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) MACKORN 液压圆锥破生产线选型报告一键生成：把生产线配置、圆锥破选型、MCFM 诊断、成本估算、衬板设计串成一份 Markdown 报告，并自动汇总全部"假设与来源"和"风险与待确认项"。当用户要"出一份方案/选型书/报告"时调用，可先单独跑前几个工具确认参数再收口。',
  parameters: obj(
    {
      title: S.string('报告标题。'),
      project: S.string('项目名称。'),
      target_tph: S.number('目标处理量 t/h（必填，用于生产线配置与选型）。'),
      max_feed_mm: S.number('原矿/本段最大给料粒度 mm。'),
      target_product_mm: S.number('最终产品粒度 mm。'),
      stage: S.stringEnum('圆锥破工序段。', ['auto', '中碎', '细碎', '超细碎'], { default: 'auto' }),
      ore: S.string('矿石名称/硬度备注。'),
      closed_circuit: S.boolean('是否闭路（默认 true）。', { default: true }),
      cumulative_retained: S.arrayOfNumbers('长度 8 的累积筛余百分比数组，用于 MCFM 诊断（可选）。'),
      include_cost: S.boolean('是否纳入成本估算（默认 true）。', { default: true }),
      cost_model: S.stringEnum('成本估算所用机型。', MODEL_ENUM),
      cost_units: S.integer('成本估算台数。'),
      cost_tph: S.number('成本估算对应处理量 t/h。'),
      electricity_price: S.number('电价 元/kWh。'),
      hours_per_year: S.integer('年运行小时数。'),
      include_wear: S.boolean('是否纳入衬板磨损设计（默认 false）。', { default: false }),
      wear_rates: S.arrayOfNumbers('各截面实测磨损速率（可选）。'),
    },
    ['target_tph'],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_args, v) => text(v.markdown),
  },
  async execute(args) {
    const costInput = args.include_cost === false ? null : (args.cost_model
      ? {
        model: args.cost_model,
        units: args.cost_units,
        tph: args.cost_tph ?? args.target_tph,
        electricityPriceCnyPerKwh: args.electricity_price,
        hoursPerYear: args.hours_per_year,
      }
      : null);
    const res = buildSelectionReport({
      title: args.title,
      project: args.project,
      targetTph: args.target_tph,
      maxFeedMm: args.max_feed_mm,
      targetProductMm: args.target_product_mm,
      stage: args.stage,
      ore: args.ore,
      closedCircuit: args.closed_circuit,
      cumulativeRetained: args.cumulative_retained,
      costInput,
      wearInput: args.include_wear ? { wearRates: args.wear_rates } : null,
    });
    // 只把报告正文与清单写回会话，避免把大对象整体冗余进会话日志
    return { markdown: res.markdown, assumptions: res.assumptions, warnings: res.warnings };
  },
};

/* --------------------------------------------------------------------------
 * 附：参考信息工具（机型总览，便于模型自查枚举值）
 * ------------------------------------------------------------------------ */

const toolCatalog = {
  name: 'mackorn_equipment_catalog',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) 列出 MACKORN 液压圆锥破全部可选机型与腔型枚举值：NH 标准型 9 个型号、NS 高速型 4 个型号的基本参数（最大给料/排矿口范围/功率/重量/产能），以及 9 种腔型代码的含义与适用场景。当选型工具报"未知机型"或需要向用户展示可选范围时调用。',
  parameters: obj({}, []),
  output: {
    schema: ANY_OBJECT,
    render: (_args, v) => text(
      [
        '## MACKORN 液压圆锥破机型总览',
        '',
        '### NH 系列（标准型单缸液压圆锥破）',
        mdTable(['型号', '最大给料 mm', '排矿口 mm', '功率 kW', '重量 t', '产能 t/h'], v.nh.map((m) => [m.model, m.maxFeedMm, `${m.cssMin}-${m.cssMax}`, m.powerKw, (m.weightKg / 1000).toFixed(1), m.capacityTph.join('-')])),
        '',
        '### NS 系列（高速型单缸液压圆锥破）',
        mdTable(['型号', '最大给料 mm', '排矿口 mm', '功率 kW', '重量 t', '产能 t/h'], v.ns.map((m) => [m.model, m.maxFeedMm, `${m.cssMin}-${m.cssMax}`, m.powerKw, (m.weightKg / 1000).toFixed(1), m.capacityTph.join('-')])),
        '',
        '### 腔型代码',
        mdTable(['代码', '名称', '适用场景', '最大给料 mm'], v.cavities.map((c) => [c.code, c.name, c.use, c.feedMaxMm])),
        '',
        `> 数据来源：${v.sources.S1}`,
      ].join('\n'),
    ),
  },
  async execute() {
    return {
      nh: NH_SERIES,
      ns: NS_SERIES,
      cavities: CAVITY_TYPES,
      sources: SOURCES,
      engineering_rules: ENGINEERING_RULES,
      price_disclaimer: PRICE_DISCLAIMER,
    };
  },
};

/* --------------------------------------------------------------------------
 * 工具 11：客户需求表录入与一键选型（销售入口）
 * ------------------------------------------------------------------------ */

const toolIntake = {
  name: 'mackorn_requirement_intake',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) 【销售主入口】把 MACKORN《砂石骨料/金属矿山生产线客户需求信息输入表》的内容 + 客户要求的产量，一次性变成「还缺什么要问客户」+「该配什么设备」的完整解答。两种用法可混用：①把表里的文字（或 Word 转出的文本）整段贴进 form_text，自动抽取数值字段；②逐项填结构化字段。工具会：抽取并逐字段标注来源 → 检查必填/建议字段缺失并生成追问话术 → 归一化工况 → 调用整线配置与液压圆锥破选型 → 核算年产量与矿山服务年限 → 给出除土/湿法/除尘/制砂/整形等派生建议。当客户发来需求表、或销售问"这张表能不能配线"，以及任何时候缺参数需要知道"还要问客户什么"时调用。',
  parameters: obj(
    {
      capacity_tph: S.number('客户要求的成品产量 t/h（必填）。若表里已填，请从表中抽取后填入此处。'),
      form_text: S.string('客户需求表的文字内容（Word 转文本或直接粘贴）。工具会自动抽取最大给料粒度、产量、含土量、含水率、抗压强度、成品粒度、工作制等数值字段。'),
      line_type: S.stringEnum('产线类型。', ['砂石骨料', '金属矿山']),
      client_name: S.string('客户名称。'),
      project_location: S.string('项目地点。'),
      salesperson: S.string('业务员。'),
      date: S.string('日期。'),
      ore_source: S.stringEnum('矿石来源。', ['自有矿山', '外购原材料']),
      ore_type: S.string('矿石种类（花岗岩/玄武岩/石灰石/铁矿石…）。'),
      max_feed_mm: S.number('原矿最大给料粒度 mm。'),
      size_distribution: obj({
        p0_60: S.number('0-60mm 占比 %。'),
        p60_100: S.number('60-100mm 占比 %。'),
        p100_300: S.number('100-300mm 占比 %。'),
        p_gt300: S.number('大于 300mm 占比 %。'),
      }),
      compressive_strength_mpa: S.number('矿石抗压强度 MPa。'),
      hardness_note: S.string('矿石硬度 / 压碎值备注。'),
      bulk_density_t_m3: S.number('堆密度 t/m³。'),
      grade_note: S.string('矿石品位 / 抛废率（金属矿山）。'),
      chemical_note: S.string('化学成分 CaO/SiO2/MgO（骨料）。'),
      total_reserve_t: S.number('矿山总储量 吨。'),
      ore_use: S.string('产品主要用途（建筑骨料/高钙石/水泥原料/机制砂）。'),
      soil_content_pct: S.number('原矿含土量 %。'),
      soil_level: S.stringEnum('含土程度。', ['含土较少', '含土较多', '含土较多且为粘性土质']),
      moisture_pct: S.number('原矿含水率 %。'),
      soil_removal_needed: S.boolean('是否需要除土。'),
      scope: S.stringEnum('需求内容。', ['主机设备', '总包生产线']),
      product_mm: S.number('成品粒度要求（mm 以下）。'),
      product_specs: { type: 'array', description: '成品骨料规格清单，如 ["0-5mm","5-10mm","10-20mm","20-31.5mm"]。', items: { type: 'string' } },
      sand_fineness_modulus: S.number('机制砂细度模数 Mx。'),
      shaping_needed: S.boolean('是否需要整形。'),
      dust_limit_mgm3: S.number('环保要求 mg/m³（10/20/30）。'),
      belt_type: S.stringEnum('皮带机选型。', ['TD75', 'DTII', '满足使用']),
      electrical_origin: S.stringEnum('电气元件及软启动。', ['国产', '进口']),
      belt_sealing: S.string('皮带机密封形式（通廊整体密封/胶带机一体化廊道）。'),
      storage_type: S.stringEnum('储料形式。', ['地仓', '筒仓', '堆棚']),
      storage_capacity_t: S.number('储料仓容 吨。'),
      production_method: S.stringEnum('生产方式。', ['干法', '湿法']),
      hours_per_day: S.integer('每天工作小时（8/12/16/20）。'),
      days_per_year: S.integer('每年工作天数。'),
      design_qualification: S.string('设计资质/图审要求。'),
      other_requirements: S.string('客户其他需求（原样回显）。'),
    },
    ['capacity_tph'],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_args, v) => {
      const c = v.client;
      const lines = [];
      lines.push(`# 客户需求录入与选型结论`);
      lines.push('');
      lines.push(`- 客户：${c.name ?? '（未提供）'}　地点：${c.location ?? '（未提供）'}　业务员：${c.salesperson ?? '-'}　日期：${c.date ?? '-'}`);
      lines.push(`- 产量需求：**${v.requirement.capacity_tph ?? '—'} t/h**　矿石：${v.requirement.ore_type ?? '未提供'}　最大给料：${v.requirement.max_feed_mm ?? '—'} mm　成品：${v.requirement.product_mm ?? '按 20mm 暂算'} mm`);
      lines.push('');

      const ms = v.completeness.missing_summary;
      lines.push('## 一、表单完整性');
      lines.push('');
      lines.push(`- ${ms.阻断.length ? `**阻断缺失：${ms.阻断.join('、')}**` : '阻断字段：齐备'}`);
      lines.push(`- 关键缺失：${ms.关键.length ? `**${ms.关键.join('、')}**` : '无'}`);
      lines.push(`- 建议补充：${ms.建议.length ? ms.建议.join('、') : '无'}`);
      if (ms.可选.length) lines.push(`- 可选项未填（不影响选型）：${ms.可选.join('、')}`);
      lines.push(`- 方案等级：**${v.completeness.blocking ? '暂不出方案（缺产量）' : v.completeness.preliminary ? '初步方案（关键字段未齐，须补齐重算）' : v.completeness.complete ? '完整方案' : '可用方案'}**`);
      lines.push('');

      if (v.completeness.follow_up.length) {
        lines.push('## 二、要向客户追问的清单（按紧急度排序）');
        lines.push('');
        lines.push(mdTable(['紧急度', '字段', '追问话术', '为什么必须要'], v.completeness.follow_up.map((f) => [f.urgency, f.label, f.question, f.why])));
        lines.push('');
      }

      if (v.plant_design) {
        const p = v.plant_design;
        lines.push('## 三、整线方案');
        lines.push('');
        lines.push(`- 总破碎比 **${p.total_reduction_ratio}**，推荐 **${p.recommended_stages} 段**`);
        lines.push('');
        lines.push(mdTable(['段', '工序', '给料 mm', '产品 mm', '破碎比'], p.stage_plan.map((s) => [s.index, s.stage, s.feed_mm, s.product_mm, s.reduction_ratio])));
        lines.push('');
        const f = (x, t) => (x ? `- ${t}：**${x.model} ${x.cavity} 腔 @ CSS ${x.css_mm} mm，${x.units} 台，${x.power_kw} kW**（单台需求 ${x.per_unit_tph} t/h；产能 ${x.capacity_tph.join('-')} t/h；依据 ${x.basis}）` : null);
        lines.push(f(p.cone_crusher_coarse_side, '中碎段圆锥破'));
        lines.push(f(p.cone_crusher_fine_side, '细碎段圆锥破'));
        if (p.coarse_crusher_recommendation) lines.push(`- 粗碎设备：**${p.coarse_crusher_recommendation.equipment}**（最大给料 ${p.coarse_crusher_recommendation.maxFeedMm} mm，排矿 ${p.coarse_crusher_recommendation.dischargeMm.join('-')} mm）`);
        lines.push(`- 筛分：处理量 ${p.screening.throughput_tph} t/h，面积 **${p.screening.optimistic_m2}-${p.screening.conservative_m2} m²**`);
        lines.push(`- 输送：设计能力 ${p.conveying.design_throughput_tph} t/h，带宽 **B${p.conveying.recommended_width_mm}**（${p.conveying.width_basis}），倾角 ≤ ${p.conveying.max_incline_deg.join('-')}°`);
        lines.push('');
        lines.push('> 依据标注：`S1 腔型×CSS 详表` = 厂商硬数据；`系列区间近似` = 须经 MACKORN 技术复核。');
        lines.push('');
      } else {
        lines.push('## 三、整线方案');
        lines.push('');
        lines.push(`**暂不出方案**：${v.warnings.find((w) => w.includes('缺少阻断字段')) ?? '阻断字段未齐'}。把产量补上即可出方案。`);
        lines.push('');
      }

      if (v.annual) {
        lines.push('## 四、年产量与矿山服务年限');
        lines.push('');
        lines.push(`- ${v.annual.note}`);
        lines.push('');
      }

      if (v.derived_recommendations.length) {
        lines.push('## 五、由表单派生的工艺建议');
        lines.push('');
        lines.push(mdTable(['结论', '依据'], v.derived_recommendations.map((r) => [r.conclusion, r.basis])));
        lines.push('');
      }

      lines.push(assumptionBlock(v.assumptions, v.warnings));
      lines.push(jsonBlock({ completeness: v.completeness.missing_summary, normalized: v.normalized }, '归一化结果与缺失清单 JSON'));
      return text(lines.filter((l) => l !== null).join('\n'));
    },
  },
  async execute(args) {
    return intakeRequirement(args);
  },
};

/** 供测试与文档引用：表单字段定义。 */
export const formFields = FORM_FIELDS;

/* --------------------------------------------------------------------------
 * 工具 12：MACKORN 标准方案书（交付版）
 * ------------------------------------------------------------------------ */

const toolProposal = {
  name: 'mackorn_proposal',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) 【交付主入口】按 MACKORN 标准方案口径，把客户需求一次性生成一份**可直接交付的方案书**（Markdown）。章节：项目概况与需求 / 设计依据与基础数据 / 工艺流程与规模 / 主要设备选择（含设备清单表）/ 设备技术参数 / 电气与自动控制 / 环保除尘降噪 / 土建与总图布置要求 / 供货范围与不含范围 / 投资估算 / 实施建议与工期 / 假设与数据来源 / 风险与待确认项 / 附件清单（流程图+平面布置图+预算表，符合 QMK《生产线方案设计预算标准化要求》）。可直接粘贴客户需求表的文字。要出投标方案、给客户的方案书、或需要"从需求到成稿"时调用。',
  parameters: obj(
    {
      capacity_tph: S.number('客户要求的成品产量 t/h（必填）。'),
      form_text: S.string('客户需求表的文字内容（可整段粘贴，工具自动抽取字段）。'),
      title: S.string('方案标题（不填自动生成）。'),
      project: S.string('项目名称。'),
      client_name: S.string('客户名称。'),
      project_location: S.string('项目地点。'),
      salesperson: S.string('业务员。'),
      date: S.string('编制日期（YYYY-MM-DD）。'),
      line_type: S.stringEnum('产线类型。', ['砂石骨料', '金属矿山']),
      ore_type: S.string('矿石种类。'),
      max_feed_mm: S.number('原矿最大给料粒度 mm。'),
      compressive_strength_mpa: S.number('抗压强度 MPa。'),
      moisture_pct: S.number('原矿含水率 %。'),
      total_reserve_t: S.number('矿山总储量 吨。'),
      product_mm: S.number('成品粒度要求（mm 以下）。'),
      product_specs: { type: 'array', description: '成品骨料规格清单。', items: { type: 'string' } },
      production_method: S.stringEnum('生产方式。', ['干法', '湿法']),
      hours_per_day: S.integer('每天工作小时。'),
      days_per_year: S.integer('每年工作天数。'),
      scope: S.stringEnum('需求内容。', ['主机设备', '总包生产线']),
      electrical_origin: S.stringEnum('电气元件及软启动。', ['国产', '进口']),
      belt_sealing: S.string('皮带机密封形式。'),
      storage_type: S.stringEnum('储料形式。', ['地仓', '筒仓', '堆棚']),
      storage_capacity_t: S.number('储料仓容 吨。'),
      dust_limit_mgm3: S.number('环保要求 mg/m³。'),
      other_requirements: S.string('客户其他需求（原样写入方案）。'),
      cost_model: S.stringEnum('用于投资估算的机型（不填则第 10 节留空）。', MODEL_ENUM),
      cost_units: S.integer('投资估算台数。'),
      electricity_price: S.number('电价 元/kWh。'),
      hours_per_year: S.integer('年运行小时数（不填则按工作制推算）。'),
      liner_life_hours: S.number('衬板寿命 h（用于衬板吨成本）。'),
      liner_cost_per_set: S.number('单套衬板价格 元/套。'),
      unit_price_wan_cny: S.number('实际商务单价 万元/台。'),
    },
    ['capacity_tph'],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_args, v) => text(v.markdown),
  },
  async execute(args) {
    const res = buildProposal(args);
    return { markdown: res.markdown, assumptions: res.assumptions, warnings: res.warnings, attachments: res.attachments };
  },
};

/* --------------------------------------------------------------------------
 * 工具 13-15：自我丰富 / 自我迭代
 * ------------------------------------------------------------------------ */

const toolIntelWatch = {
  name: 'mackorn_intel_watch',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) 【自我丰富·采集端】返回 MACKORN 行业情报的固定观测面与可执行研究简报：山特维克/美卓新品与专利动向、中国与国际破碎机专利（IPC B02C 2/00 等）、国家标准更新、矿山机械市场数据。每条含"为什么看/看哪些源/搜什么词/多久看一次/看到后按什么格式入库/可信度评分口径"。当用户问"最近山特维克美卓有什么新东西""帮我看看破碎机专利""行业有什么新动向""知识该更新了""保持领先"时调用；也可用 focus 只取某一条观测项。注意：本插件不联网，检索由具备联网能力的 AI 完成，插件负责纪律与入库。',
  parameters: obj(
    { focus: S.string('只取某个观测项：观测项 id（如 W-SANDVIK / W-PATENT-INTL）或类别（竞品动向/专利/标准规范/市场）。不填则只返回"已到期该采集"的项。') },
    [],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_a, v) => text(
      [
        '## 行业情报观测简报' + (v.due_only ? '（仅列出已到期项）' : ''),
        '',
        v.items.map((i) => [
          `### ${i.target}　\`${i.id}\``,
          `- 类别：${i.category}　周期：${i.cadence_days} 天　上次采集：${i.last_checked ?? '从未'}`,
          `- 为什么看：${i.why}`,
          `- 来源：${i.sources.join('；')}`,
          `- 检索词：${i.queries.map((q) => `\`${q}\``).join('　')}`,
          `- 入库：\`${i.record_as.tool}\`，必填 ${i.record_as.required.join('/')}，kind=${i.record_as.kind}，tags=${i.record_as.tags.join('/')}`,
        ].join('\n')).join('\n\n'),
        '',
        '### 执行流程',
        ...v.workflow.map((w) => `- ${w}`),
        '',
        `> ${v.honesty_note}`,
        jsonBlock(v),
      ].join('\n'),
    ),
  },
  async execute(args) {
    return intelBrief(args.focus);
  },
};

const toolKnowledgeUpdate = {
  name: 'mackorn_knowledge_update',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) 【自我丰富·入库端】把新采集到的行业情报/竞品动态/专利/标准/案例写入 MACKORN 持久化知识库，并自动完成：①来源可信度分级（1-5，白名单域名提档）②数值矛盾检测（功率/产能/CSS/价格/能耗等字段两两比对，超容差即记冲突）③版本演进判定（矛盾处置率≥0.8 且覆盖率≥0.3 且杠杆分≥0.6 → V1.1→V2）④变更留痕（changelog + PDCA 台账）。知识库落在 $DSH_HOME/mackorn-knowledge，插件升级不丢。铁律：**无 source_url 的条目一律拒收**；可信度自动裁决只产出"建议值"，用于选型前必须人工确认。当用户说"把这条加进知识库""更新一下这个参数""记下这个竞品动向"时调用。',
  parameters: obj(
    {
      entries: {
        type: 'array',
        description: '要写入的知识条目数组。每条必须带 title、content、source_url。',
        items: obj({
          title: S.string('标题（必填）。'),
          content: S.string('正文/事实与数字（必填）。'),
          source_url: S.string('来源链接或可核查出处（必填，缺失即拒收）。'),
          source_type: S.stringEnum('来源类型，影响可信度基线。', ['official', 'academic', 'report', 'conference', 'media', 'expert']),
          kind: S.stringEnum('条目类型。', ['intel', 'patent', 'standard', 'market', 'spec', 'price', 'case', 'correction']),
          publish_date: S.string('发布日期 YYYY-MM-DD。'),
          subject: S.string('主题键：把"讲同一件事"的条目归到同一主题（如 "300TPH-圆锥破配置"），矛盾检测只在该主题内比较。型号类条目通常自带型号实体，可不填。'),
          tags: { type: 'array', description: '标签，如 ["竞品","山特维克"]。', items: { type: 'string' } },
          has_peer_review: S.boolean('是否同行评审（可信度 +1）。'),
          citation_count: S.integer('被引次数（>50 可信度 +1）。'),
          verification_status: S.stringEnum('核验状态。', ['pending', 'verified', 'cross_validated', 'disputed']),
        }, ['title', 'content', 'source_url']),
      },
      actor: S.string('操作者（如 销售-戴雷 / ai）。'),
      rationale: S.string('本轮采集/更新的目的说明。'),
      check_fields: { type: 'array', description: '要检测矛盾的字段（默认全部）。', items: { type: 'string' } },
      tolerance: S.number('数值矛盾容差（默认 0.1，即相差 10% 以上才算矛盾）。'),
      crushing_leverage_score: S.number('破碎效率杠杆得分 0-1（用于版本演进判定）。'),
    },
    ['entries'],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_a, v) => text(
      [
        '## 知识库更新',
        '',
        `- 接收 **${v.accepted}** 条；拒收 ${v.rejected.length} 条`,
        `- 版本：${v.version_before} → **${v.version_after}**${v.version_bumped ? '（触发演进）' : '（未达演进阈值）'}`,
        `- 知识库修订号：${v.store_revision}　位置：\`${v.store_path}\``,
        `- 新检出矛盾：${v.new_conflicts.length} 条（open ${v.open_conflicts} / 建议值 ${v.proposed_conflicts}）`,
        '',
        v.accepted_entries.length ? mdTable(['ID', '标题', '可信度', '来源'], v.accepted_entries.map((e) => [e.id, e.title, e.credibility, e.source])) : '',
        v.rejected.length ? `\n**被拒条目**\n\n` + v.rejected.map((r) => `- ${r.entry?.title ?? '(无标题)'}：${r.reason}`).join('\n') : '',
        v.new_conflicts.length ? `\n**新检出矛盾（并列保留，未取平均）**\n\n` + mdTable(['字段', '值A', '源A', '值B', '源B', '相对差', '状态'], v.new_conflicts.map((c) => [c.field, c.value_a, c.source_a, c.value_b, c.source_b, c.relative_diff, c.status])) : '',
        '',
        `**指标**：覆盖率 ${v.metrics.data_coverage}　矛盾处置率 ${v.metrics.conflict_resolution_rate}　杠杆分 ${v.metrics.crushing_leverage_score}　图谱密度 ${v.metrics.knowledge_graph_density}`,
        '',
        ...v.notes.map((n) => `> ${n}`),
        jsonBlock(v),
      ].filter((x) => x !== '').join('\n'),
    ),
  },
  async execute(args) {
    return ingestKnowledge(args);
  },
};

const toolPdca = {
  name: 'mackorn_pdca_status',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) 【自我迭代·驱动端】查看并推进 MACKORN 插件的自我优化循环（PDCA）：当前模型版本与知识库修订号、条目数与可信度分布、矛盾台账（open/建议值/处置率）、四项演进指标、版本演进阈值、到期的情报观测项、以及"本轮该做什么"的优化建议清单。action=record 时记录一轮 PDCA（Plan/Do/Check/Act）。当用户问"插件现在什么水平""还差什么""下一步该补什么""迭代到哪一步了""继续优化"时调用。',
  parameters: obj(
    {
      action: S.stringEnum('status=只看状态（默认）；record=记录一轮 PDCA。', ['status', 'record'], { default: 'status' }),
      plan: S.string('Plan：本轮计划做什么。'),
      do_items: { type: 'array', description: 'Do：本轮实际做了哪些动作。', items: { type: 'string' } },
      check: S.string('Check：本轮结果核对。'),
      act: S.string('Act：下轮要固化的改进或要修正的偏差。'),
      actor: S.string('操作者。'),
    },
    [],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_a, v) => {
      if (v.cycle) {
        const c = v.cycle;
        return text([
          `## PDCA 第 ${c.round} 轮已记录`,
          '',
          `- 模型版本：${c.model_version}　知识库修订号：${c.store_revision}　条目：${c.entries}`,
          `- 矛盾：open ${c.open_conflicts} / 建议值 ${c.proposed_conflicts}　处置率 ${c.metrics.conflict_resolution_rate}`,
          '',
          `**Plan**：${c.plan ?? '（未填）'}`,
          `**Do**：${c.do.length ? c.do.map((d) => `\n  - ${d}`).join('') : '（未填）'}`,
          `**Check**：${c.check ?? '（未填）'}`,
          `**Act**：${c.act ?? '（未填）'}`,
          '',
          '### 下轮建议',
          ...c.next_actions.map((s) => `- [${s.priority}] ${s.action} —— ${s.target}`),
          '',
          `> 台账：\`${v.ledger_path}\`　累计轮次：${v.total_rounds}`,
        ].join('\n'));
      }
      const s = v;
      return text([
        `## MACKORN 插件自我迭代状态`,
        '',
        `- **模型版本 ${s.model_version}**　知识库修订号 ${s.store_revision}　条目 **${s.entries}** 条`,
        `- 知识库位置：\`${s.kb_dir}\``,
        `- PDCA 已跑 **${s.pdca_rounds}** 轮`,
        '',
        '### 四项演进指标（与 Python 源模型同阈值）',
        mdTable(['指标', '当前值', '演进门槛'], [
          ['数据覆盖率 data_coverage', s.metrics.data_coverage, '≥ 0.30'],
          ['矛盾处置率 conflict_resolution_rate', s.metrics.conflict_resolution_rate, '≥ 0.80'],
          ['破碎杠杆分 crushing_leverage_score', s.metrics.crushing_leverage_score, '≥ 0.60'],
          ['图谱密度 knowledge_graph_density', s.metrics.knowledge_graph_density, '—'],
        ]),
        `\n当前是否满足演进条件：**${s.should_evolve_now ? '是 → 下一轮写入即升版' : '否'}**`,
        '',
        '### 矛盾台账',
        `- 共 ${s.conflicts.total} 条：open **${s.conflicts.open}** / 建议值 ${s.conflicts.proposed} / 处置率 ${s.conflicts.resolution_rate}`,
        s.conflicts.open > 0 ? `- ⚠️ 有 ${s.conflicts.open} 条未裁决（可信度无法分出高下），须人工判定` : '',
        '',
        '### 情报采集到期',
        s.watch_due.length ? s.watch_due.map((d) => `- \`${d.id}\` ${d.target} —— ${d.reason}`).join('\n') : '- 暂无到期项',
        `（观测面共 ${s.watch_total} 项，用 \`mackorn_intel_watch\` 取研究简报）`,
        '',
        '### 本轮优化建议',
        ...s.next_actions.map((a) => `- [${a.priority}] ${a.action}${a.target ? ` —— ${a.target}` : ''}`),
        '',
        '### 演进规则与护栏',
        `- ${s.evolution_rules.evolve_when}`,
        `- 版本方案：${s.evolution_rules.version_scheme}`,
        ...s.evolution_rules.guardrails.map((g) => `- 护栏：${g}`),
        jsonBlock(s),
      ].filter((x) => x !== '').join('\n'));
    },
  },
  async execute(args) {
    if (args.action === 'record') {
      return recordPdca({ plan: args.plan, do: args.do_items, check: args.check, act: args.act, actor: args.actor });
    }
    return evolutionStatus();
  },
};

/* --------------------------------------------------------------------------
 * 工具 16-17：工艺流程模拟（对标商业选型/仿真软件的能力，算法全部来自公开文献）
 * ------------------------------------------------------------------------ */

const toolCrusherCurve = {
  name: 'mackorn_crusher_curve',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) 【仿真】用 Whiten(1972) 稳态圆锥破模型生成产品粒度曲线：给入料分布 + CSS + 偏心距，算出产品 P80、破碎比、逐级产品分布、啮合区 K1/K2，并给 Bond(1952) 功耗估算。用于回答"这台机打这个料出什么粒度""破碎比多少""能耗多少"，也是流程模拟的单机内核。算法全部来自公开发表文献（Whiten 1972 / JKMRC / Bond 1952），不含任何第三方专有软件数据；破碎函数参数为文献典型值，须用 MACKORN 实测标定。',
  parameters: obj(
    {
      css_mm: S.number('紧边排矿口 CSS mm（必填）。'),
      feed_p80_mm: S.number('给料 P80 mm（必填；若给了 feed_distribution 则忽略）。'),
      feed_distribution: S.stringEnum('给料粒度分布形式（由 P80 拟合）。', ['rosin-rammler', 'gaudin-schuhmann'], { default: 'rosin-rammler' }),
      feed_n: S.number('Rosin-Rammler 均匀性指数 n（默认 1.1）。'),
      throw_mm: S.number('偏心距（冲程）mm，默认 25。'),
      throw_factor: S.number('啮合区宽度系数（文献典型 0.5-1.0，默认 0.8）。'),
      speed_rpm: S.number('偏心轴转速 rpm（默认 300，影响啮合函数）。'),
      phi: S.number('破碎函数粗粒生成占比（文献典型 0.3-0.6，默认 0.45）。'),
      gamma: S.number('破碎函数粗端指数（文献典型 0.4-1.0，默认 0.7）。'),
      beta: S.number('破碎函数细端指数（文献典型 2.5-5.0，默认 3.5）。'),
      bond_wi: S.number('邦德功指数 kWh/t（不填则按矿石种类取文献典型区间中值）。'),
      ore: S.string('矿石种类（用于取 Bond Wi 文献典型值）。'),
    },
    ['css_mm', 'feed_p80_mm'],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_a, v) => text([
      `## 圆锥破产品曲线（Whiten 稳态模型）`,
      '',
      `- CSS **${v.css_mm} mm**　偏心距 ${v.throw_mm} mm　啮合区 K2-K1 = **${v.K2_mm}-${v.K1_mm} mm**`,
      `- 给料 P80 **${v.feed_p80_mm} mm** → 产品 P80 **${v.product_p80_mm} mm**，破碎比 **${v.reduction_ratio}**`,
      `- 产品粒度区间：P20 ${v.percentiles.p20 ?? '—'} / P50 ${v.percentiles.p50 ?? '—'} / P80 ${v.percentiles.p80} mm`,
      `- 质量守恒误差 ${v.mass_balance.sum_error.toExponential(2)}（最大负值 ${v.mass_balance.max_negative}）`,
      v.power ? `- 功耗估算 **${v.power.w_kwh_per_t} kWh/t**（Wi=${v.power.wi_used}，${v.power.formula}）` : '',
      '',
      `### 产品累积通过率（抽点）`,
      mdTable(['粒径 mm', '累积通过 %'], v.sample_curve.map((r) => [r.size_mm, r.cumulative_pct])),
      assumptionBlock(v.assumptions, v.warnings),
      jsonBlock(v),
    ].filter(Boolean).join('\n')),
  },
  async execute(args) {
    return crusherCurve(args);
  },
};

const toolFlowsheet = {
  name: 'mackorn_simulate_flowsheet',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) 【仿真】多段破碎 + 筛分 + 闭路流程模拟：按段定义逐段算产品粒度与循环负荷，用群体平衡迭代到稳态，输出各段入料/出料 P80、破碎比、筛下率、循环负荷、最终产品 P80，并校核物料平衡。这是对标商业选型软件的流程仿真能力。算法全部来自公开文献（Whiten 1972 稳态破碎模型 + logistic 筛分分配曲线 + 群体平衡迭代），不含第三方专有软件数据。当用户问"这条线最终出料多细""循环负荷多少""几段配什么 CSS 能出这个产品"时调用。',
  parameters: obj(
    {
      feed_p80_mm: S.number('新鲜给料 P80 mm（必填）。'),
      feed_n: S.number('Rosin-Rammler 均匀性指数 n（默认 1.1）。'),
      stages: {
        type: 'array',
        description: '段定义数组，按顺序。破碎段 {type:"crusher", name, css_mm, throw_mm}；筛分段 {type:"screen", name, aperture_mm, recirculate_to}（recirculate_to 为返回的破碎段下标，不填则返回上一破碎段）。',
        items: obj({
          type: S.stringEnum('段类型。', ['crusher', 'screen']),
          name: S.string('段名称。'),
          css_mm: S.number('破碎段：紧边排矿口 mm。'),
          throw_mm: S.number('破碎段：偏心距 mm。'),
          aperture_mm: S.number('筛分段：筛孔 mm。'),
          recirculate_to: S.integer('筛分段：筛上返回的破碎段下标。'),
          screen_efficiency: S.number('筛分段：总筛分效率 0-1（默认 0.9）。'),
        }, ['type']),
      },
      bond_wi: S.number('邦德功指数 kWh/t。'),
      ore: S.string('矿石种类。'),
      max_iter: S.integer('最大迭代次数（默认 200）。'),
    },
    ['feed_p80_mm', 'stages'],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_a, v) => text([
      `## 流程模拟结果（群体平衡稳态解）`,
      '',
      `- 新鲜给料 P80 **${v.feed_p80_mm} mm** → 最终产品 P80 **${v.final_p80_mm} mm**，总破碎比 **${v.overall_reduction_ratio}**`,
      `- 迭代 **${v.iterations}** 次收敛（${v.converged ? '已收敛' : '**未收敛，请放宽 max_iter 或检查段定义**'}）`,
      `- 循环负荷 **${v.circulating_load_ratio}**（返回料/新鲜料）${v.circulating_load_note}`,
      `- 物料平衡：出料率 **${v.mass_balance.yield_ratio}**　${v.mass_balance.ok ? '✅ 守恒' : '❌ 不守恒'}`,
      '',
      '### 各段结果',
      mdTable(['#', '类型', '名称', '入料 P80 mm', '出料 P80 mm', '破碎比', '筛孔 mm', '筛下率'],
        v.stages.map((s) => [s.index, s.type, s.name, s.feed_p80_mm, s.product_p80_mm ?? '—', s.reduction_ratio ?? '—', s.aperture_mm ?? '—', s.fines_fraction ?? '—'])),
      v.power ? `\n- 全流程估算能耗：**${v.power.total_kwh_per_t} kWh/t**（${v.power.note}）` : '',
      assumptionBlock(v.assumptions, v.warnings),
      jsonBlock(v),
    ].filter(Boolean).join('\n')),
  },
  async execute(args) {
    return flowsheet(args);
  },
};

const toolCalibrate = {
  name: 'mackorn_calibrate',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) 【护城河】用**现场实测筛析数据**标定破碎函数参数 φ/γ/β 与啮合系数：输入某工况的给料筛析与产品筛析（累积通过率 %）+ 该工况 CSS，用最小二乘（有界网格 + 局部细化）反算出与实测最贴合的一套参数，给出拟合优度、逐点残差与可用性判断。标定结果可写入知识库（来源标记"实测"），之后选型与流程仿真即使用自有标定值而非文献默认值——这是别人抄不走的部分。当用户提供现场筛析报告、问"怎么用我们的实测数据校准模型""让模型更像我们自己的设备"时调用。',
  parameters: obj(
    {
      css_mm: S.number('该工况的紧边排矿口 CSS mm（必填）。'),
      feed_points: {
        type: 'array',
        description: '给料筛析：至少 2 个点。每点 {size_mm, cum_pct}（cum_pct 为累积通过 %）。',
        items: obj({ size_mm: S.number('粒径 mm。'), cum_pct: S.number('累积通过 %（0-100）。') }, ['size_mm', 'cum_pct']),
      },
      product_points: {
        type: 'array',
        description: '产品筛析：至少 3 个点（建议 ≥5）。',
        items: obj({ size_mm: S.number('粒径 mm。'), cum_pct: S.number('累积通过 %（0-100）。') }, ['size_mm', 'cum_pct']),
      },
      throw_mm: S.number('偏心距 mm（默认 25）。'),
      roughness: S.number('拟合优度门槛（RMSE，默认 0.06），超过即告警。'),
    },
    ['css_mm', 'feed_points', 'product_points'],
  ),
  output: {
    schema: ANY_OBJECT,
    render: (_a, v) => {
      const c = v.calibrated;
      const f = v.fit;
      const lib = v.library_defaults;
      return text([
        '## 破碎函数实测标定结果',
        '',
        `**标定参数**：φ = **${c.phi}**　γ = **${c.gamma}**　β = **${c.beta}**　啮合系数 = **${c.throwFactor}**`,
        `（工况：CSS ${c.css_mm} mm，偏心距 ${c.throw_mm} mm）`,
        '',
        `### 拟合优度：**${f.quality}**`,
        mdTable(['指标', '值'], [
          ['RMSE', `${f.rmse_pct_points} 个百分点`],
          ['单点最大偏差', `${f.max_abs_error_pp} 个百分点`],
          ['参与拟合的产品点数', f.n_points],
          ['参数搜索次数', f.evaluations],
        ]),
        '',
        `与文献默认值对比：φ ${lib.phi} → ${c.phi}　γ ${lib.gamma} → ${c.gamma}　β ${lib.beta} → ${c.beta}　啮合系数 ${lib.throwFactor} → ${c.throwFactor}`,
        '',
        '### 逐点残差（预测 − 实测，百分点）',
        mdTable(['粒径 mm', '实测累积通过 %', '模型预测 %', '偏差 pp'], v.residuals.map((r) => [r.size_mm, r.observed_pct, r.predicted_pct, r.error_pp])),
        '',
        '### 落库方式',
        v.how_to_persist.suggestion,
        '',
        `- 来源标记：**${v.how_to_persist.provenance}**　工具：\`${v.how_to_persist.tool}\``,
        assumptionBlock(v.assumptions, v.warnings),
        jsonBlock(v),
      ].join('\n'));
    },
  },
  async execute(args) {
    return calibrateBreakage(args);
  },
};

const toolContact = {
  name: 'mackorn_contact',
  description:
    '(Multilingual triggers / 多语言触发词: crusher, cone crusher, hydraulic cone crusher, cone liner, mantle, bowl liner, wear parts, jaw plate, liner life, crushing chamber, cavity, CSS, aggregate plant, crushing and screening plant, max feed size, ore properties, hardness, compressive strength, capacity, tph, selection, mineral processing, quotation | trituradora de cono, cóncavo, manto, revestimiento, cámara de trituración, dureza, capacidad, selección | Kegelbrecher, Brechmantel, Verschleißteile, Brechkammer, Standzeit, Auswahl | конусная дробилка, броня конуса, футеровка, камера дробления, твердость, производительность, подбор | concasseur à cône, manteau, pièces de revêtement, chambre de concassage, dureté, sélection | britador de cone, manta, revestimento, câmara de britagem, dureza, seleção | コーンクラッシャー, コーンライナー, 摩耗部品, 破砕室, 硬度, 選定 | konkross, krossmantel, slitdelar, livslängd | kegleknuser, sliddele, levetid | kartiomurskain, kulutusosat, käyttöikä | كسارة مخروطية, بطانة المخروط, قطع التآكل, الصلابة, اختيار | crusher cone hidrolik, liner cone, umur liner, kekerasan, pemilihan | 破碎机, 液压圆锥破碎机, 圆锥破, 圆锥衬板耐磨件, 轧臼壁, 破碎壁, 颚破衬板, 使用寿命, 破碎腔型, 砂石骨料生产线, 给料最大粒度, 矿石性质, 客户需求表) MACKORN 美矿的联系方式与全球招募信息：公司名称、地址（中英文）、三个商务电话与邮箱、官网 mackorn.cn、服务时间 GMT+8 9:00-17:30、微信公众号二维码位置，以及「诚征各地代理商/代理人/选矿人才」的招募条件与申请方式。当用户问"怎么联系你们""报价找谁""你们在哪个国家有代理""我想做代理""我是做选矿的想合作"，或任何需要把提问者导流到 MACKORN 的场景，以及选型/方案类回答需要附上联系方式时调用。也用于自检触发词覆盖（trigger_keywords 字段）。',
  parameters: obj({
    language: S.stringEnum(
      '输出语言。支持 zh-CN/en/es/pt-BR/ru/ar/fr/de/ja/id；公司名、地址、电话、邮箱、网址一律原文保留不翻译。',
      ['zh-CN', 'en', 'es', 'pt-BR', 'ru', 'ar', 'fr', 'de', 'ja', 'id'],
      { default: 'zh-CN' },
    ),
    include_partner: S.boolean('是否包含代理商/人才招募段落（默认 true）。', { default: true }),
    include_triggers: S.boolean('是否附带多语言触发词覆盖报告（自检用，默认 false）。', { default: false }),
  }, []),
  output: {
    schema: ANY_OBJECT,
    render: (_a, v) => text([
      v.block,
      v.trigger_coverage ? `\n---\n\n### 触发词覆盖自检\n\n覆盖 **${v.trigger_coverage.languages}** 种语言、共 **${v.trigger_coverage.total_keywords}** 个触发词：\n\n` + mdTable(['语言', '触发词数'], Object.entries(v.trigger_coverage.per_language).map(([k, n]) => [k, n])) : '',
      jsonBlock({ company: v.company, contacts: v.contacts, wechat_qr: v.wechat_qr, partner_program: v.partner_program }, '结构化联系与招募信息'),
    ].filter(Boolean).join('\n')),
  },
  async execute(args) {
    const lang = args.language ?? 'zh-CN';
    return {
      block: contactBlockLang(lang, args.include_partner !== false),
      language_used: normalizeLang(lang),
      company: COMPANY, contacts: CONTACTS, wechat_qr: WECHAT_QR, partner_program: PARTNER_PROGRAM,
      trigger_coverage: args.include_triggers ? triggerCoverageReport() : null,
      language_coverage: args.include_triggers ? languageCoverage() : null,
    };
  },
};

const TOOLS = [
  toolIntake, toolProposal, toolSelection, toolPlant, toolCapacity, toolCost, toolMcfm,
  toolWear, toolGrading, toolMarket, toolReport, toolCatalog,
  toolIntelWatch, toolKnowledgeUpdate, toolPdca, toolCrusherCurve, toolFlowsheet, toolCalibrate, toolContact,
];

/* --------------------------------------------------------------------------
 * Cordis entry
 * ------------------------------------------------------------------------ */

/**
 * 注册全部 MACKORN 工具。
 * 加载期绝不抛错：单个工具注册失败只记录告警，避免拖垮 profile 树。
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  const logger = ctx.logger ?? ctx.get?.('logger') ?? console;
  const warn = (msg) => {
    try {
      if (typeof logger.warn === 'function') logger.warn(`[${name}] ${msg}`);
      else console.warn(`[${name}] ${msg}`);
    } catch { /* 日志失败不影响装载 */ }
  };

  // HMR 重入保护：释放上一轮的注册，避免 "tool already registered"
  const previous = globalThis[REGISTRY_KEY];
  if (Array.isArray(previous)) {
    for (const dispose of previous.reverse()) {
      try { dispose(); } catch (error) { warn(`释放旧注册失败：${error && error.message}`); }
    }
  }

  const disposers = [];
  let ok = 0;
  for (const definition of TOOLS) {
    try {
      const dispose = ctx.tools.register(definition);
      disposers.push(dispose);
      ok += 1;
    } catch (error) {
      warn(`工具 ${definition.name} 注册失败，已跳过：${error && error.message}`);
    }
  }
  globalThis[REGISTRY_KEY] = disposers;
  warn(`已注册 ${ok}/${TOOLS.length} 个工具`);
}

/** 供测试与手册引用：工具清单。 */
export const toolNames = TOOLS.map((t) => t.name);
/** 供测试校验用的完整工具定义（与注册进 ctx.tools 的对象同一份）。 */
export const toolDefinitions = TOOLS;
