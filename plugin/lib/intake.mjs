/**
 * MACKORN 客户需求信息输入表 · 录入与归一键（intake.mjs）
 * ============================================================================
 * 目标：销售只把**客户填好的需求表**（或表里的文字）+ 产量丢进来，就能得到
 *       "还缺什么要问客户" + "该配什么设备" 的完整解答。
 *
 * 支持两类官方表格（字段结构已对照原文件核对）：
 *   F1 砂石骨料生产线客户需求信息输入表 20211010
 *   F2 Q／MK-J00.002-2021R01 金属矿山生产线客户需求信息输入表 20211215J
 *
 * 两种录入方式，可混用，显式字段优先于文本解析：
 *   · form_text —— 把表里的文字（Word 转文本 / 直接粘贴）整段贴进来，自动抽取数值字段
 *   · 结构化字段 —— 客户名称 / 产量 / 最大给料粒度 / 抗压强度 … 逐项填
 *
 * 诚实纪律：
 *   1. **剔除模板套话**：表格「客户须知」栏里的"抗压强度≥60MPa、含水≤1%、Mx=3.0"
 *      是空白模板的填写说明，不是客户数据。解析前先剥离该栏，否则会把套话当客户输入。
 *   2. **勾选框不猜**：□ 在纯文本里无法判断是否已勾选，只在检测到 ☑/■/√/✔/✓/× 时认定。
 *   3. **缺失字段返回 null**，绝不填默认值冒充客户输入；缺到影响结论时明确降级并告警。
 * ============================================================================
 */

import { sizePlant } from './engine.mjs';

/** 空值判定：null / undefined / '' 都算"没填"（避免 Number(null)===0 被当成有效值）。 */
const nz = (v) => (v === null || v === undefined || v === '' ? null : v);
/** 安全取数：拿不到就 null。 */
const numOrNull = (v) => {
  const raw = nz(v);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};
const round = (x, n = 2) => (Number.isFinite(x) ? Number(x.toFixed(n)) : null);

/**
 * 表单字段定义。
 * level 语义：
 *   '阻断' —— 没它无法出任何方案（只有产量）
 *   '关键' —— 缺了要出"初步方案"并显著降级，必须回来补
 *   '建议' —— 影响精度/报价，应补
 *   '可选' —— 商务/配置偏好
 */
export const FORM_FIELDS = [
  { key: 'capacity_tph', label: '产量需求 t/h', level: '阻断' },
  { key: 'max_feed_mm', label: '原矿最大给料粒度 mm', level: '关键' },
  { key: 'product_mm', label: '成品粒度要求（mm 以下）', level: '关键' },
  { key: 'ore_type', label: '矿石种类', level: '关键' },
  { key: 'compressive_strength_mpa', label: '抗压强度 MPa', level: '关键' },
  { key: 'moisture_pct', label: '原矿含水率 %', level: '关键' },
  { key: 'line_type', label: '产线类型（砂石骨料/金属矿山）', level: '关键' },
  { key: 'production_method', label: '生产方式（干法/湿法）', level: '关键' },
  { key: 'client_name', label: '客户名称', level: '建议' },
  { key: 'project_location', label: '项目地点', level: '建议' },
  { key: 'ore_source', label: '矿石来源（自有矿山/外购）', level: '建议' },
  { key: 'size_distribution', label: '粒度组成（0-60/60-100/100-300/>300mm 占比 %）', level: '建议' },
  { key: 'hardness_note', label: '矿石硬度 / 压碎值', level: '建议' },
  { key: 'bulk_density_t_m3', label: '堆密度 t/m³', level: '建议' },
  { key: 'soil_content_pct', label: '原矿含土量 %', level: '建议' },
  { key: 'soil_level', label: '含土程度（较少/较多/粘性）', level: '建议' },
  { key: 'soil_removal_needed', label: '除土需求（是/否）', level: '建议' },
  { key: 'total_reserve_t', label: '矿山总储量 吨', level: '建议' },
  { key: 'ore_use', label: '产品主要用途', level: '建议' },
  { key: 'scope', label: '需求内容（主机设备/总包生产线）', level: '建议' },
  { key: 'product_specs', label: '成品骨料规格及占比', level: '建议' },
  { key: 'sand_fineness_modulus', label: '机制砂细度模数 Mx', level: '建议' },
  { key: 'dust_limit_mgm3', label: '环保要求 mg/m³', level: '建议' },
  { key: 'hours_per_day', label: '每天工作小时', level: '建议' },
  { key: 'days_per_year', label: '每年工作天数', level: '建议' },
  { key: 'grade_note', label: '矿石品位 / 抛废率（金属矿）', level: '可选' },
  { key: 'chemical_note', label: '化学成分 CaO/SiO2/MgO（骨料）', level: '可选' },
  { key: 'shaping_needed', label: '是否需要整形', level: '可选' },
  { key: 'belt_type', label: '皮带机选型（TD75/DTII/满足使用）', level: '可选' },
  { key: 'electrical_origin', label: '电气元件及软启动（国产/进口）', level: '可选' },
  { key: 'belt_sealing', label: '皮带机密封形式', level: '可选' },
  { key: 'storage_type', label: '储料形式（地仓/筒仓/堆棚）', level: '可选' },
  { key: 'storage_capacity_t', label: '储料仓容 吨', level: '可选' },
  { key: 'design_qualification', label: '设计资质/图审要求', level: '可选' },
  { key: 'salesperson', label: '业务员', level: '可选' },
  { key: 'date', label: '日期', level: '可选' },
  { key: 'other_requirements', label: '客户其他需求', level: '可选' },
];

const CHECKED = '[☑■√✔✓☒×]';

/** 剥离「客户须知」等模板套话区，避免把填写说明当成客户数据。 */
export function stripBoilerplate(text) {
  let t = String(text || '');
  // 客户须知 栏：从"客户须知"到第一个内容栏标题
  t = t.replace(/客户须知[\s\S]*?(?=原\s*料\s*信\s*息|矿\s*石\s*种\s*类|工艺需求信息内容|矿石信息)/, '');
  // 干法制砂客户特别须知等说明段
  t = t.replace(/[（(]三[）)][^\n]*须\s*知[\s\S]*?(?=原\s*料\s*信\s*息|工艺需求信息内容)/, '');
  // "以下数据将作为设备选型依据…" 这类提示句
  t = t.replace(/、?以下数据将作为设备选型依据[\s\S]*?慎重填写。/, '');
  // 理论最大入料量说明
  t = t.replace(/机制砂石生产线理论最大入料量[\s\S]*?而不同。/, '');
  return t;
}

/** 未勾选的选项（选项词 + □）不是客户答案，抽取数值前先删掉，避免把选项清单当答案。 */
export function stripUncheckedOptions(text) {
  return String(text || '').replace(/[^\s、，,;；|/]{1,24}\s*□/g, ' ');
}

/** 段落标题等非答案文本，避免被当成客户填写值。 */
const HEADER_WORDS = /^(原\s*料\s*信\s*息|矿\s*石\s*信\s*息|工艺需求信息内容|客户须知|客户其他需求|业务员|日期|原\s*矿\s*规\s*格|客户名称|项目地点|矿石种类|物料性质)/;
/** 答案判定：长度够、不是标题词、且本身不像"标签："。 */
const isAnswerish = (v) => {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (s.length < 2) return false;
  if (HEADER_WORDS.test(s)) return false;
  if (/[：:]$/.test(s)) return false;            // "项目地点：" 这类标签
  if (/^(是|否)$/.test(s)) return false;
  return true;
};

function num(text, re) {
  const m = re.exec(text);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}
/** 取包含某字段标签的整行，用于"只在本行内判定勾选"，避免串行误判。 */
function rowOf(text, label) {
  const re = new RegExp(`([^\\n]*${label}[^\\n]*)`);
  const m = re.exec(text);
  return m ? m[1] : '';
}
/** 多字选项的宽松写法：允许字间有空格（表里常写成"国  产"）。 */
function flex(opt) {
  return opt.split('').map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
}
function checkedOption(text, options) {
  for (const opt of options) {
    const f = flex(opt);
    if (new RegExp(`${f}\\s*${CHECKED}|${CHECKED}\\s*${f}`).test(text)) return opt;
  }
  return null;
}
/** 在指定行内判定 是/否 勾选。 */
function yesNoInRow(row) {
  const yes = new RegExp(`${CHECKED}\\s*是|是\\s*${CHECKED}`).test(row);
  const no = new RegExp(`${CHECKED}\\s*否|否\\s*${CHECKED}`).test(row);
  if (yes && !no) return true;
  if (no && !yes) return false;
  return null;
}

/**
 * 从需求表文本中抽取字段。
 * 三重防误判：① 剥离「客户须知」套话区；② 剥离未勾选选项（词+□）；
 * ③ 勾选类字段只在有明确勾选标记时认定。抽不到的一律 null。
 * @param {string} rawText 表格文字
 */
export function parseFormText(rawText) {
  const stripped = stripBoilerplate(rawText).replace(/\u3000/g, ' ');
  // 勾选判定必须在原文上做（剥离后标记还在，但选项词被删了，故两版都用）
  const t = stripped;
  const tClean = stripUncheckedOptions(stripped);
  const out = {};

  out.line_type = /金属矿山/.test(t) && !/砂石骨料/.test(t) ? '金属矿山' : /砂石骨料/.test(t) ? '砂石骨料' : null;

  const cm = /客户名称[：:]\s*([^\s]{2,40})/.exec(t);
  if (cm && isAnswerish(cm[1])) out.client_name = cm[1].trim();
  const pm = /项目地点[：:]\s*([^\s]{2,40})/.exec(t);
  if (pm && isAnswerish(pm[1])) out.project_location = pm[1].trim();

  // 数值字段：在剥离未勾选选项后的文本上抽取
  out.max_feed_mm = num(tClean, /最大[给給]料粒度[：:\s]*([\d.]+)/);
  out.capacity_tph = num(t, /产量需求[^\d\n]{0,12}([\d.]+)\s*(?:t\/h|吨\/小时|tph)/i) ?? num(tClean, /([\d.]+)\s*(?:t\/h|吨\/小时|tph)/i);
  out.compressive_strength_mpa = num(tClean, /抗压强度[：:\s]*([\d.]+)/);
  out.bulk_density_t_m3 = num(tClean, /堆密度[：:\s]*([\d.]+)/);
  out.soil_content_pct = num(tClean, /含土量[：:\s]*([\d.]+)/);
  out.moisture_pct = num(tClean, /含水率[：:\s]*([\d.]+)/);
  out.total_reserve_t = num(tClean, /总储量[：:\s]*([\d.]+)/);

  const p60 = num(tClean, /0\s*[-–~]\s*60\s*mm\s*占\s*([\d.]+)/);
  const p100 = num(tClean, /60\s*[-–~]\s*100\s*mm\s*占\s*([\d.]+)/);
  const p300 = num(tClean, /100\s*[-–~]\s*300\s*mm\s*占\s*([\d.]+)/);
  const pgt = num(tClean, /(?:大于|>)\s*300\s*mm\s*占\s*([\d.]+)/);
  if ([p60, p100, p300, pgt].some((v) => v !== null)) {
    out.size_distribution = { p0_60: p60, p60_100: p100, p100_300: p300, p_gt300: pgt };
  }

  const fm = /成品(?:要求|骨料规格)[^\n]{0,60}?([\d.]+)\s*mm\s*以下/.exec(tClean);
  if (fm) out.product_mm = Number(fm[1]);
  else {
    const f2 = /([\d.]+)\s*mm\s*以下/.exec(tClean);
    if (f2) out.product_mm = Number(f2[1]);
  }

  // 成品规格：必须带占比数字或勾选标记才算客户答案，否则只作为候选项提示
  const SPECS = ['0-5mm', '5-10mm', '10-20mm', '20-31.5mm'];
  const specHits = SPECS.filter((s) => {
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`${esc}\\s*[:：]?\\s*[\\d.]+\\s*%`).test(tClean)
      || new RegExp(`${esc}\\s*${CHECKED}|${CHECKED}\\s*${esc}`).test(t);
  });
  if (specHits.length) out.product_specs = specHits;

  out.sand_fineness_modulus = num(tClean, /细度模数\s*M?x?[^\d\n]{0,10}([\d.]+)/i);
  // 工作制：优先取勾选项；否则取剥离选项后的独立写法
  const hpdChecked = checkedOption(t, ['8小时/天', '12小时/天', '16小时/天', '20小时/天']);
  out.hours_per_day = hpdChecked ? Number(/(\d{1,2})/.exec(hpdChecked)[1]) : num(tClean, /(\d{1,2})\s*小时\s*\/\s*天/);
  out.days_per_year = num(tClean, /每年\s*([\d]{2,3})\s*天/);
  // 环保：优先勾选项
  const dustChecked = checkedOption(t, ['10Nmg/m³', '20Nmg/m³', '30Nmg/m³', '10mg/m³', '20mg/m³', '30mg/m³']);
  out.dust_limit_mgm3 = dustChecked ? Number(/(\d{1,2})/.exec(dustChecked)[1]) : num(tClean, /(\d{1,2})\s*(?:N?mg\/m³|mg\/m3)/i);

  // 行内判定，避免"设计资质"行的 否☑ 被当成"除土需求=否"
  out.soil_removal_needed = yesNoInRow(rowOf(tClean, '除土需求') || rowOf(t, '除土需求'));
  out.production_method = checkedOption(rowOf(t, '生产方式'), ['干法生产', '湿法生产'])?.replace('生产', '') ?? null;
  out.ore_source = checkedOption(rowOf(t, '矿石来源'), ['自有矿山', '外购原材料'])?.replace('原材料', '') ?? null;
  out.scope = checkedOption(rowOf(t, '需求内容'), ['总包生产线', '主机设备']) ?? null;
  out.belt_type = checkedOption(rowOf(t, '皮带机选型'), ['TD75', 'DTII', '满足使用']) ?? null;
  out.electrical_origin = checkedOption(rowOf(t, '电气元件'), ['国产', '进口']) ?? null;
  out.storage_type = checkedOption(rowOf(t, '储料形式'), ['地仓', '筒仓', '堆棚']) ?? null;
  out.soil_level = checkedOption(rowOf(t, '含土'), ['含土较少', '含土较多且为粘性土质', '含土较多']) ?? null;

  // 设计资质（是/否两问），作为备注保留
  const qualRow = rowOf(t, '设计资质');
  if (qualRow) {
    const q1 = /盖章[^\n]{0,10}?(是|否)\s*[☑■√✔✓☒×]/.exec(qualRow);
    const q2 = /图审[^\n]{0,10}?(是|否)\s*[☑■√✔✓☒×]/.exec(qualRow);
    if (q1 || q2) out.design_qualification = `盖章:${q1 ? q1[1] : '未明确'}；图审:${q2 ? q2[1] : '未明确'}`;
  }

  // 矿石种类：只在"勾选"或"其它请说明：xxx"里认定；选项清单只作为候选提示
  const rockWords = ['石灰石', '大理石', '白云岩', '砂岩', '石英岩', '凝灰岩', '片麻岩', '花岗岩', '玄武岩', '辉绿岩'];
  const oreWords = ['铁矿石', '铜铅锌矿石', '铜矿', '铅锌矿石', '钼矿石', '镍矿石', '钨矿石', '金矿石', '锰矿石'];
  const allOre = [...oreWords, ...rockWords];
  const oreRow = rowOf(t, '矿石种类') || rowOf(t, '矿石来源');
  const oreChecked = checkedOption(oreRow || t, allOre);
  const oreTyped = (() => {
    const m = /(?:其它|其他)[^\n]{0,40}?(?:请说明|说明)[：:]\s*([^\s；;，,]{2,20})/.exec(tClean);
    return m && isAnswerish(m[1]) ? m[1].trim() : null;
  })();
  if (oreChecked) out.ore_type = oreChecked;
  else if (oreTyped) out.ore_type = oreTyped;

  const uses = ['建筑骨料', '高钙石', '水泥原料', '机制砂'];
  const useRow = rowOf(t, '骨料用途') || rowOf(t, '产品主要用途');
  const useChecked = checkedOption(useRow || t, uses);
  if (useChecked) out.ore_use = useChecked;
  else {
    const hitUses = uses.filter((w) => new RegExp(`${flex(w)}\\s*${CHECKED}|${CHECKED}\\s*${flex(w)}`).test(useRow || t));
    if (hitUses.length) out.ore_use = hitUses.join('/');
  }

  const oreMentioned = allOre.filter((w) => t.includes(w));
  const specMentioned = SPECS.filter((s) => t.includes(s));
  out._mentions = {
    ore_type_candidates: oreMentioned,
    product_spec_candidates: specMentioned,
    checked_marker_found: new RegExp(CHECKED).test(t),
    note: new RegExp(CHECKED).test(t)
      ? '检测到勾选标记，勾选类字段已按标记认定'
      : '未检测到勾选标记（空白表里全是 □）：勾选类字段一律留空，候选值仅供参考，需销售向客户确认',
  };
  return out;
}

function mergeFields(explicit = {}, parsed = {}) {
  const merged = {};
  const sources = {};
  for (const f of FORM_FIELDS) {
    const ev = nz(explicit[f.key]);
    const pv = nz(parsed[f.key]);
    if (ev !== null) { merged[f.key] = ev; sources[f.key] = '客户表单-显式填写'; }
    else if (pv !== null) { merged[f.key] = pv; sources[f.key] = '客户表单-文本抽取'; }
    else { merged[f.key] = null; sources[f.key] = null; }
  }
  // 非表单字段的原样透传
  if (nz(parsed._mentions)) merged._mentions = parsed._mentions;
  return { merged, sources };
}

const QUESTION_TEMPLATE = {
  capacity_tph: '请问这条线要求的**成品产量**是多少 t/h？（注意是成品量，不是原矿处理量；若客户只给年产量，换算：t/h = 年产量 ÷ 年工作天数 ÷ 每天小时数）',
  max_feed_mm: '请问**原矿最大给料粒度**是多少 mm？（要最大块度，不要平均块度；这决定粗碎设备与给料口尺寸）',
  product_mm: '请问**成品粒度要求**是多少 mm 以下（或要哪些骨料规格：0-5/5-10/10-20/20-31.5mm）？',
  ore_type: '请问矿石种类是什么？（花岗岩/玄武岩等硬岩，还是石灰石等中软岩？决定腔型、衬板与产量折减）',
  compressive_strength_mpa: '请问矿石**抗压强度**是多少 MPa？（或提供硬度 f 值 / 压碎值）',
  moisture_pct: '请问原矿**含水率**是多少 %？（>5% 要考虑防堵筛孔与湿法除尘，影响筛分面积）',
  line_type: '请问是**砂石骨料生产线**还是**金属矿山生产线**？（两者表字段与工艺路线不同）',
  production_method: '请问采用**干法**还是**湿法**生产？（决定是否配洗砂与污水处理系统）',
  client_name: '请问**客户名称**？（用于方案封面与商务建档）',
  soil_level: '请问原矿**含土程度**属于哪一档：较少 / 较多 / 较多且为粘性土质？（决定除土工艺与防堵措施）',
  soil_removal_needed: '请问客户**是否需要除土**？',
  total_reserve_t: '请问**矿山总储量**约多少吨？（用于核算矿山服务年限）',
  hours_per_day: '请问**每天工作几小时**（8/12/16/20）？',
  days_per_year: '请问**每年工作多少天**？（用于年产量与吨成本核算）',
  scope: '请问客户要的是**主机设备**还是**总包生产线**？（决定方案深度与报价边界）',
  ore_source: '请问原料是**自有矿山**还是**外购**？',
  dust_limit_mgm3: '请问**环保排放要求**是多少 mg/m³（10/20/30）？',
  product_specs: '请问**成品骨料规格及占比**要求（0-5 / 5-10 / 10-20 / 20-31.5mm，各自占比）？',
  sand_fineness_modulus: '请问**机制砂细度模数 Mx**要求多少？',
};

const WHY_IT_MATTERS = {
  capacity_tph: '产量是全部选型的起点：机型档位、台数、筛分面积、带宽都由它推出。',
  max_feed_mm: '最大给料粒度决定腔型上限与粗碎设备档位；取平均值会导致现场卡料。',
  product_mm: '成品粒度决定总破碎比、段数与细碎腔型/CSS。',
  ore_type: '硬度决定产量折减、腔型选择与衬板材质。',
  compressive_strength_mpa: '抗压强度是判断硬岩/中软岩的依据，直接影响单机能力取值。',
  moisture_pct: '含水率高会糊筛孔、降低筛分效率，并使干法除尘不可行。',
  line_type: '两类产线的表格字段、工艺路线、成品要求都不同。',
  production_method: '干法/湿法决定是否需要洗砂污水处理系统与除尘方案。',
  client_name: '方案封面与商务建档需要；不影响设备选型。',
  soil_level: '粘性土会糊筛、堵腔，需加大筛分面积并设除土工艺。',
  soil_removal_needed: '决定是否配置除土筛与除土皮带。',
  total_reserve_t: '用于核算矿山服务年限，判断投资强度是否合理。',
  hours_per_day: '决定年产量与吨成本。',
  days_per_year: '决定年产量与吨成本。',
  scope: '决定方案深度（单机供货范围 vs EPC 总包）与报价边界。',
  ore_source: '自有矿山可直接取料试验；外购原料成分波动大，需留余量。',
  dust_limit_mgm3: '决定除尘器规格与是否必须全密封。',
  product_specs: '决定筛分层数与成品仓分仓方案。',
  sand_fineness_modulus: '决定制砂段与石粉控制方案。',
};

/** 完整性评估：只有"阻断"字段会挡住方案，其余降级并告警。 */
export function assessCompleteness(merged, sources) {
  const byLevel = { 阻断: [], 关键: [], 建议: [], 可选: [] };
  for (const f of FORM_FIELDS) {
    const v = merged[f.key];
    if (v === null || v === undefined || v === '') byLevel[f.level].push(f);
  }
  const followUp = [];
  for (const level of ['阻断', '关键', '建议']) {
    for (const f of byLevel[level]) {
      followUp.push({
        field: f.key,
        label: f.label,
        urgency: level,
        question: QUESTION_TEMPLATE[f.key] ?? `请确认「${f.label}」。`,
        why: WHY_IT_MATTERS[f.key] ?? (level === '阻断' ? '缺少该项无法开始选型。' : '影响方案精度与报价准确性。'),
      });
    }
  }
  const blocking = byLevel.阻断.length > 0;
  return {
    blocking,
    preliminary: !blocking && byLevel.关键.length > 0,
    complete: !blocking && byLevel.关键.length === 0 && byLevel.建议.length === 0,
    missing_summary: {
      阻断: byLevel.阻断.map((f) => f.label),
      关键: byLevel.关键.map((f) => f.label),
      建议: byLevel.建议.map((f) => f.label),
      可选: byLevel.可选.map((f) => f.label),
    },
    follow_up: followUp,
    field_sources: sources,
  };
}

/** 把表单字段归一化成引擎输入。所有取值都走 numOrNull，杜绝 Number(null)===0。 */
export function normalizeToEngine(merged) {
  const targetTph = numOrNull(merged.capacity_tph);
  const maxFeedMm = numOrNull(merged.max_feed_mm);
  const moisture = numOrNull(merged.moisture_pct);
  const strength = numOrNull(merged.compressive_strength_mpa);

  let productMm = numOrNull(merged.product_mm);
  let productFromSpecs = false;
  if (productMm === null && Array.isArray(merged.product_specs) && merged.product_specs.length) {
    const maxSpec = merged.product_specs
      .map((s) => Number(String(s).split('-').pop().replace(/[^\d.]/g, '')))
      .filter(Number.isFinite);
    if (maxSpec.length) { productMm = Math.max(...maxSpec); productFromSpecs = true; }
  }

  const wet = merged.production_method === '湿法';
  const soilPct = numOrNull(merged.soil_content_pct);
  const highSoil = /含土较多/.test(String(merged.soil_level || '')) || (soilPct ?? 0) > 5;
  const sticky = (moisture ?? 0) > 5 || /粘性/.test(String(merged.soil_level || '')) || (soilPct ?? 0) > 10;
  const oreDesc = [
    merged.ore_type ?? '未提供矿石种类',
    strength !== null ? `抗压强度 ${strength}MPa` : null,
    moisture !== null ? `含水 ${moisture}%` : null,
    sticky ? '粘性/高含泥' : null,
  ].filter(Boolean).join('，');

  const usedDefaults = [];
  if (maxFeedMm === null) usedDefaults.push('原矿最大给料粒度缺省按 500mm 试算（必须回来修正）');
  if (productMm === null) usedDefaults.push('成品粒度缺省按 20mm 试算（必须回来修正）');

  const mfn = numOrNull(merged.sand_fineness_modulus);
  // 机制砂是"客户要求"才有，不能因为"这是砂石骨料线"就默认要制砂段
  const wantsSand = /机制砂/.test(String(merged.ore_use || '')) || mfn !== null;
  const soilRemoval = merged.soil_removal_needed === true;
  return {
    ready: targetTph !== null,
    blocking_fields: targetTph === null ? ['capacity_tph'] : [],
    used_defaults: usedDefaults,
    engineInput: {
      targetTph: targetTph ?? 0,
      maxFeedMm: maxFeedMm ?? 500,
      targetProductMm: productMm ?? 20,
      ore: oreDesc,
      closedCircuit: true,
      // 湿法才配洗砂/污水处理；"除土需求=是"不等于湿法——除土可用干法除土筛
      washing: wet,
    },
    product_from_specs: productFromSpecs,
    flags: {
      wet_process: wet,
      sticky_ore: sticky,
      high_soil: highSoil,
      soil_removal_needed: soilRemoval,
      soil_removal_method_unknown: soilRemoval && !wet,
      shaping_needed: merged.shaping_needed === true || /整形/.test(String(merged.other_requirements || '')),
      sand_line: wantsSand,
      sand_line_basis: wantsSand ? (mfn !== null ? `客户提供细度模数 Mx=${mfn}` : '客户用途含机制砂') : '客户未要求机制砂',
      metal_mine: merged.line_type === '金属矿山',
      dust_limit_mgm3: numOrNull(merged.dust_limit_mgm3),
    },
  };
}

/** 由表单字段派生的工艺建议（条件 → 结论，逐条给依据）。 */
export function deriveRecommendations(merged, flags) {
  const rec = [];
  const push = (cond, conclusion, basis) => { if (cond) rec.push({ conclusion, basis }); };

  push(flags.sticky_ore, '原矿含泥/粘性偏高：粗碎前必须设预筛分或除土筛，中细碎前加缓冲仓防止糊腔；筛分面积在上述计算基础上再加大 20%-40%。', '客户表单：含土量/含土程度/含水率');
  push(!flags.sticky_ore && flags.high_soil, '原矿含土偏多（但未达粘性档）：建议粗碎前设除土筛，并把筛分面积按加大 15%-25% 复核。', '客户表单：含土量/含土程度');
  push(flags.soil_removal_needed, '客户明确需要除土：配置除土筛 + 除土皮带（MACKORN 1000TPH 标准配置中的 B4 即为除土线）。', '客户表单：除土需求=是');
  push(flags.soil_removal_method_unknown, '⚠️ 除土方式待确认：客户要求除土但生产方式为**干法**——除土可用**干法除土筛**（无污水处理投资），也可用**湿法洗砂**（需浓密机+压滤机）。本方案按干法除土筛估算，**若实为湿法洗砂，投资与环保章节须重算**。', '客户表单：除土需求=是 且 生产方式=干法');
  push(flags.wet_process, '湿法生产：需配置洗砂机 + 污水处理系统（浓密机 + 压滤机），并复核成品含水与脱水筛配置。', '客户表单：生产方式=湿法');
  push(!flags.wet_process && flags.dust_limit_mgm3 !== null, `干法生产且环保要求 ${flags.dust_limit_mgm3} mg/m³：各转运点设除尘罩 + 布袋除尘器，密封形式按客户选择的廊道形式执行。`, '客户表单：环保要求');
  push(flags.sand_line, '客户有机制砂需求：需增加制砂段（CVS 系列制砂机或圆锥破 EF 腔），并校核细度模数 Mx 与石粉含量。', `客户表单：${flags.sand_line_basis}`);
  push(!flags.sand_line, '客户本次**未要求机制砂**：方案不含制砂段；如后续增加，需另设制砂与石粉控制工序（不要默认写进报价）。', `客户表单：${flags.sand_line_basis}`);
  push(flags.metal_mine, '金属矿山线：需确认抛废阶段与抛废率，粗碎后可能设抛废（手选/智能分选）工序，成品粒度以磨机给料为准。', '客户表单：金属矿山生产线');
  push(flags.shaping_needed, '客户要求整形：对相应粒级增设立轴冲击破整形段，或改用粒形更优的细碎腔型。', '客户表单：是否需要整形');
  push(merged.scope === '主机设备', '客户只要主机设备：按单机供货范围出方案，不含土建/钢构/电气/安装，报价须界定边界。', '客户表单：需求内容=主机设备');
  push(merged.scope === '总包生产线', '客户要总包生产线：需出完整供货范围清单与验收标准，方案深度按 EPC 口径。', '客户表单：需求内容=总包生产线');
  push(merged.storage_type !== null, `客户指定储料形式「${merged.storage_type}」：成品仓与堆场布置需按此形式设计。`, '客户表单：储料形式');
  push(merged.belt_type !== null, `客户指定皮带机「${merged.belt_type}」：选型与报价按该标准执行。`, '客户表单：皮带机选型');
  push(merged.electrical_origin !== null, `客户指定电气元件「${merged.electrical_origin}」：影响电控成本与交货周期。`, '客户表单：电气元件及软启动');
  return rec;
}

/** 年产能与矿山寿命校核。 */
export function checkAnnual(merged, targetTph) {
  const hpd = numOrNull(merged.hours_per_day);
  const dpy = numOrNull(merged.days_per_year);
  const reserve = numOrNull(merged.total_reserve_t);
  const out = {
    hours_per_day: hpd,
    days_per_year: dpy,
    annual_output_t: hpd !== null && dpy !== null && Number.isFinite(targetTph) ? round(targetTph * hpd * dpy, 0) : null,
    annual_operating_hours: hpd !== null && dpy !== null ? hpd * dpy : null,
    reserve_t: reserve,
    reserves_life_years: null,
    note: null,
  };
  if (out.annual_output_t && out.reserve_t) {
    out.reserves_life_years = round(out.reserve_t / out.annual_output_t, 1);
    out.note = `按 ${hpd} h/天 × ${dpy} 天/年 计，年产量 ${out.annual_output_t.toLocaleString()} t；`
      + `矿山总储量 ${out.reserve_t.toLocaleString()} t，对应服务年限约 ${out.reserves_life_years} 年（未计回收率与贫化）`;
  } else {
    out.note = '未同时提供「每天工作小时 + 每年工作天数 + 矿山总储量」，无法核算年产量与矿山服务年限';
  }
  return out;
}

/**
 * 主入口：把客户需求表变成"追问清单 + 选型方案"。
 * @param {object} input 见表单字段；亦可只给 { form_text, capacity_tph }
 */
export function intakeRequirement(input = {}) {
  const parsed = input.form_text ? parseFormText(input.form_text) : {};
  const { merged, sources } = mergeFields(input, parsed);
  const completeness = assessCompleteness(merged, sources);
  const normalized = normalizeToEngine(merged);
  const assumptions = [
    { assumption: '字段来源逐字段记录在 field_sources（客户表单-显式填写 / 客户表单-文本抽取），便于复核', source: 'INTAKE' },
    { assumption: '解析前已剥离表格「客户须知」等填写说明区，避免把模板套话（如"抗压强度≥60MPa"）当成客户数据', source: 'INTAKE' },
    { assumption: '空白表的勾选框（□）无法判断是否已勾选；仅在检测到 ☑/■/√/✔/✓/× 时认定，否则留空并进追问清单', source: 'INTAKE-LIMIT' },
    { assumption: '未提供的字段一律 null，不填默认值冒充客户输入；确需试算的默认值记入 used_defaults 并告警', source: 'INTAKE' },
  ];
  const warnings = [];

  const targetTph = numOrNull(merged.capacity_tph);
  const annual = checkAnnual(merged, targetTph);
  const derived = deriveRecommendations(merged, normalized.flags);

  let plant = null;
  if (normalized.ready) {
    plant = sizePlant(normalized.engineInput);
  } else {
    warnings.push(`缺少阻断字段「产量需求 t/h」——已先给出追问清单；把产量补上即可出方案`);
  }

  if (completeness.preliminary) {
    warnings.push(`这是**初步方案**：以下关键字段缺失，结论会显著降级，必须补齐后重算 —— ${completeness.missing_summary.关键.join('、')}`);
  }
  for (const d of normalized.used_defaults) warnings.push(`试算缺省：${d}`);
  if (normalized.flags.sticky_ore) warnings.push('含泥/粘性矿石：筛分面积与防堵措施需按现场实际加大，本方案经验区间可能偏乐观');
  const strength = numOrNull(merged.compressive_strength_mpa);
  if (strength !== null && strength >= 150) {
    warnings.push(`抗压强度 ${strength}MPa 属硬岩偏上：单机能力应按腔型×CSS 详表下限取值，建议先做磨蚀指数试验`);
  }
  if (targetTph !== null && targetTph > 2500) {
    warnings.push(`目标产量 ${targetTph} t/h 超出单条线常规范围（NH 系列单机最大约 2436 t/h）：需按多线并联考虑，请 MACKORN 技术复核`);
  }

  return {
    form_parsed: input.form_text
      ? { fields_found: Object.keys(parsed).filter((k) => !k.startsWith('_') && parsed[k] !== null && parsed[k] !== undefined), mentions: parsed._mentions ?? null }
      : null,
    client: { name: merged.client_name, location: merged.project_location, salesperson: merged.salesperson, date: merged.date },
    requirement: merged,
    completeness,
    normalized,
    annual,
    derived_recommendations: derived,
    plant_design: plant,
    fine_stage_detail: plant ? plant.cone_crusher_fine_side : null,
    assumptions,
    warnings,
  };
}
