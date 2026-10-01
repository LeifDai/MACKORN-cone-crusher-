/**
 * 生成 8 篇矿石/岩石圆锥破选型深度指南（中英双语，AEO 导向）
 *
 * 数据来源：distribution/ore-cases.json（插件真实运行结果，非编造）
 * 输出：distribution/官网落地页/guides/{ore}/index.html
 *
 * 设计原则：
 *   - 每个数字都来自插件真实运行，并保留"假设与来源"
 *   - 中英同页（技术内容双语有助于跨语言检索命中）
 *   - JSON-LD：Article + FAQPage + BreadcrumbList
 *   - 内部互链 + 回主落地页
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUTBASE = join(ROOT, 'distribution', '官网落地页');
const CASES = JSON.parse(readFileSync(join(ROOT, 'distribution', 'ore-cases.json'), 'utf8')).cases;
const VERSION = '0.0.9';
const BASE = 'https://mackorn.cn';
const REPO = 'https://github.com/LeifDai/MACKORN-hydraulic-cone-crusher';

/* 每种物料的补充专业信息（硬度/磨蚀性/工程要点） */
const META = {
  basalt: {
    abr: 'very high', abrZh: '很高',
    note: 'Basalt is fine-grained volcanic rock. Its high compressive strength combined with high abrasiveness is what wears a cone liner out — manganese grade and cavity profile matter more here than headline capacity.',
    noteZh: '玄武岩是细粒火山岩。抗压强度高 + 磨蚀性强，这两点共同决定衬板寿命——在这种料上，锰钢牌号和腔型比标称产能更重要。',
    tips: [
      ['Pick the coarse end of the cavity pool', '偏高硬度 + 高磨蚀 → 选腔型池的偏粗端（EC/MC），避免细腔导致衬板局部过度磨损。'],
      ['Do not chase a small CSS', 'CSS 压得越小，单位能耗和衬板磨损上升越快。先用"能做出目标粒形的最大 CSS"，再按实际产品曲线微调。'],
      ['Expect a thicker liner', '玄武岩建议用加厚型衬板或提高锰含量，牺牲一点腔容换寿命。'],
    ],
    faq: [
      ['Is a cone crusher suitable for basalt?', 'Yes — a single-cylinder hydraulic cone crusher is the standard choice for basalt in the secondary and tertiary stages. Basalt is hard and abrasive, so cavity selection and liner grade drive the economics more than nominal capacity.'],
      ['Can a cone crusher take ROM basalt directly?', 'No. A cone crusher is a secondary/tertiary machine. The plugin rejects feed above roughly 350 mm and tells you to pre-screen or add a primary crusher — that is the expected answer, not an error.'],
    ],
  },
  granite: {
    abr: 'high', abrZh: '高',
    note: 'Granite is coarse-grained and abrasive. It is the highest-volume hard-rock aggregate worldwide, which is why a granite line is usually specified at high capacity with generous screening area.',
    noteZh: '花岗岩是粗粒结构、磨蚀性强。它是全球用量最大的硬岩骨料，所以花岗岩线通常按大产能配，筛分面积要给足。',
    tips: [
      ['Size the screen properly', '花岗岩线的瓶颈常在筛分而不是破碎。筛分面积不足会让循环负荷飙升。'],
      ['Watch the flake content', '花岗岩节理发育，针片状含量偏高时考虑整形段或调整腔型。'],
      ['Plan for liner rotation', '花岗岩磨损均匀性较好，衬板可以翻转使用延长寿命。'],
    ],
    faq: [
      ['What cone crusher for a 500 t/h granite plant?', 'For hard, abrasive granite a single-cylinder hydraulic cone crusher in the MC cavity is the usual answer. The plugin computed NH700 MC at CSS 15.8 mm, 2 units, for 500 t/h — but you must confirm against MACKORN\'s cavity x CSS table before ordering.'],
      ['Why two stages and not three for granite?', 'Total reduction ratio decides the stage count: granite from 600 mm to 31.5 mm is about 19:1, which two stages handle. Iron ore or copper ore at 40-60:1 needs three.'],
    ],
  },
  andesite: {
    abr: 'medium-high', abrZh: '中高',
    note: 'Andesite sits just below basalt in hardness. It is common in volcanic terranes across Indonesia, the Philippines, Turkey and the Andes — often in the same operation as basalt.',
    noteZh: '安山岩硬度略低于玄武岩。在印尼、菲律宾、土耳其和安第斯地区分布广泛——常与玄武岩在同一矿区出现。',
    tips: [
      ['Check the silica content', '安山岩的 SiO₂ 波动大，超过 60% 时磨蚀性会明显上升。'],
      ['Consider a smaller unit count', '硬度略低时可用稍小机型多台，灵活性更好。'],
      ['Watch moisture in tropical sites', '热带矿区含水率高，筛分效率要打折，筛孔易堵。'],
    ],
    faq: [
      ['Is andesite harder to crush than granite?', 'Usually comparable or slightly harder. Andean and Indonesian andesite commonly runs 130-180 MPa compressive strength.'],
      ['What cavity for andesite?', 'MC (medium-coarse) is the usual starting point; move toward C or EC if the feed is coarse, or MF if a finer product is required.'],
    ],
  },
  diabase: {
    abr: 'very high', abrZh: '很高',
    note: 'Diabase (dolerite) is a shallow intrusive rock. It is tough and abrasive, and it is the classic feed for high-quality aggregate and railway ballast because of its angular, strong particles.',
    noteZh: '辉绿岩是浅成侵入岩。韧性好、磨蚀性强，因为颗粒棱角分明、强度高，是优质骨料和铁路道砟的经典料源。',
    tips: [
      ['Smaller capacity per unit is normal', '辉绿岩用小型号更常见——大机型在小产能下反而衬板磨损不均。'],
      ['Ballast spec drives the cavity', '做道砟时针片状含量要求严，腔型要偏细碎。'],
      ['Monitor the power draw', '辉绿岩韧性大，功率曲线比玄武岩更陡，要注意堵转保护。'],
    ],
    faq: [
      ['Why is diabase crushed at lower capacity?', 'Its toughness and abrasiveness mean a smaller crushing chamber is often more economical per tonne, even at the cost of unit capacity.'],
      ['What is diabase used for?', 'High-quality aggregate, railway ballast and asphalt chips, thanks to its strong angular particles.'],
    ],
  },
  iron_ore: {
    abr: 'high', abrZh: '高',
    note: 'Iron ore plants are usually three-stage because the total reduction ratio is large (ROM can be 800-1000 mm while the concentrator wants 10-20 mm). Liberation, not just size, drives the flowsheet.',
    noteZh: '铁矿通常是三段破碎——总破碎比大（原矿 800-1000mm，选厂要 10-20mm）。决定流程的除了粒度还有单体解离。',
    tips: [
      ['Three stages is the default', '总破碎比 40 以上基本要三段。两段会让细碎段负荷过高。'],
      ['Plan for the concentrator feed', '最终粒度要与磨机给料匹配，多破少磨能显著降低总能耗。'],
      ['Magnetic separation downstream', '磁铁矿常见干选抛废，破碎段要为预选留出粒度条件。'],
    ],
    faq: [
      ['How many crushing stages for iron ore?', 'Typically three: primary (jaw or gyratory), secondary cone, tertiary cone. A ROM of 800-1000 mm reduced to 10-20 mm is a total ratio of 40-100:1, which two stages cannot carry.'],
      ['Does the plugin handle metal-mine flowsheets?', 'Yes. Give it the ROM size and the concentrator feed target and it computes the total ratio, the stage count and a cone crusher selection for each stage.'],
    ],
  },
  copper_ore: {
    abr: 'medium-high', abrZh: '中高',
    note: 'Copper porphyry is the largest single source of crushing-plant demand worldwide, concentrated in Chile and Peru. Capacity is usually very high (800 t/h and well above), so plant availability matters as much as unit capacity.',
    noteZh: '斑岩铜矿是全球破碎设备需求最大的单一来源，集中在智利和秘鲁。产能通常很高（800 t/h 以上），所以设备可用率和单机产能同样重要。',
    tips: [
      ['Availability beats peak capacity', '铜矿一般是连续生产，可用率比峰值产能更值钱。要配足备机或备件。'],
      ['Watch the work index', 'Bond 功指数波动大，选型前一定要做磨蚀试验。'],
      ['Multiple parallel units', '大产能通常用并联机组，便于检修不停产。'],
    ],
    faq: [
      ['What size cone crusher for an 800 t/h copper plant?', 'The plugin computed NH860 EC at CSS 29.4 mm, 2 units, 500 kW each. That is a starting point — a copper flowsheet must be confirmed against the ore\'s Bond work index and abrasion test.'],
      ['Why is copper ore crushing capacity so large?', 'Porphyry copper operations are among the largest mines in the world; a single concentrator can consume tens of thousands of tonnes per day.'],
    ],
  },
  lead_zinc: {
    abr: 'medium', abrZh: '中',
    note: 'Lead-zinc ores are usually softer than copper or iron ore, but they are often finely disseminated, so the crushing circuit is designed for liberation rather than for maximum reduction.',
    noteZh: '铅锌矿通常比铜矿、铁矿软，但嵌布粒度细，所以破碎流程是为单体解离设计，而不是追求最大破碎比。',
    tips: [
      ['Softer ore, watch the fines', '矿石偏软时过粉碎风险高，CSS 不宜过小。'],
      ['Liberation size drives the target', '最终粒度按目的矿物嵌布粒度定，不按习惯。'],
      ['Consider pre-screening', '含泥含水高时预筛分能显著提升细碎效率。'],
    ],
    faq: [
      ['Is lead-zinc ore easy to crush?', 'Generally easier than copper or iron ore (often 80-120 MPa), but fine dissemination means the target size is set by liberation rather than by crushing cost alone.'],
      ['What causes over-crushing in lead-zinc plants?', 'A CSS set too small for a relatively soft ore. The plugin warns when the CSS is below the cavity\'s practical minimum.'],
    ],
  },
  molybdenum: {
    abr: 'medium-high', abrZh: '中高',
    note: 'Molybdenum is often a by-product of porphyry copper, so the crushing circuit usually follows the copper flowsheet. Where it is the primary product, grade is low and tonnage high.',
    noteZh: '钼矿常作为斑岩铜矿的伴生矿，破碎流程通常随铜矿走。作为主产品时品位低、处理量大。',
    tips: [
      ['Follow the copper flowsheet', '伴生钼矿一般不需要独立破碎段，随铜流程即可。'],
      ['Recovery starts at crushing', '钼的选别回收率对给料粒度敏感，别为省破碎成本牺牲细度。'],
      ['Check the Bond index', '钼矿石功指数变化大，必须实测。'],
    ],
    faq: [
      ['Does molybdenum need its own crushing circuit?', 'Usually not — where molybdenum is a by-product of porphyry copper the same crushing circuit serves both, and the molybdenum is recovered in flotation.'],
      ['What crusher for molybdenum ore?', 'The same single-cylinder hydraulic cone crusher used for copper porphyry; cavity and CSS follow the required liberation size.'],
    ],
  },
};

/* ---------------- 模板 ---------------- */
function guide(c) {
  const m = META[c.key];
  const pt = c.plant_text || '';
  const mt = c.mid_text || '';
  const ft = c.fine_text || '';

  // 从真实输出里抽关键行
  const pick = (re, s = pt) => (s.match(re) || [])[1] || '';
  const ratio = pick(/总破碎比 \*\*([\d.]+)\*\*/);
  const stages = pick(/推荐段数：\*\*(\d+) 段\*\*/);
  const first = pick(/中碎段首选：\*\*(.+?)\*\*/) || pick(/首选：\*\*(.+?)\*\*/);
  const screen = pick(/建议筛分面积 \*\*([\d. \-]+) m²\*\*/);
  const belt = pick(/建议带宽 \*\*(\d+) mm\*\*/);
  const stageRows = [...pt.matchAll(/^\| (\d) \| (.+?) \| (.+?) \| (.+?) \| (.+?) \|/gm)]
    .map((x) => ({ no: x[1], duty: x[2].trim(), fin: x[3].trim(), fout: x[4].trim(), i: x[5].trim() }));

  const others = CASES.filter((x) => x.key !== c.key).map((x) =>
    `<a href="../${x.key}/">${x.zh} ${x.en}</a>`).join(' · ');

  const faqs = [
    ...m.faq,
    [`What cavity and CSS does the plugin recommend for ${c.en.toLowerCase()}?`, `${first || 'See the computed case above'}. Treat it as a starting point: the plugin marks whether the basis is MACKORN's cavity x CSS hard data or a series-interval approximation that needs technical review.`],
    [`What is the total reduction ratio for ${c.tph} t/h of ${c.en.toLowerCase()}?`, `Feed ${c.feed} mm to product ${c.product} mm gives a total ratio of ${ratio || '—'}, which the plugin resolves into ${stages || '—'} stages.`],
  ];

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${c.zh}圆锥破选型指南 ${c.tph} t/h | ${c.en} Cone Crusher Selection Guide | MACKORN</title>
<meta name="description" content="${c.zh}（${c.en}，${c.f}，约 ${c.mpa} MPa）圆锥破碎机选型完整指南：${c.feed}mm 给料、${c.product}mm 成品、${c.tph} t/h。含 MACKORN 插件真实算例（总破碎比 ${ratio}、${stages} 段、${first || '见正文'}）、腔型与排矿口选择、常见问题。">
<meta name="keywords" content="${c.zh},${c.zh}圆锥破,${c.zh}破碎,${c.zh}选型,${c.en},${c.en} cone crusher,cone crusher selection,${c.en.toLowerCase()} crushing,hydraulic cone crusher,MACKORN,${c.mpa} MPa,hard rock crushing,medium hard ore">
<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">
<link rel="canonical" href="${BASE}/ai/guides/${c.key}/">
<link rel="alternate" hreflang="zh-CN" href="${BASE}/ai/guides/${c.key}/">
<link rel="alternate" hreflang="en" href="${BASE}/ai/guides/${c.key}/">
<link rel="alternate" hreflang="x-default" href="${BASE}/ai/guides/">
<script type="application/ld+json">
${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: `${c.zh}圆锥破选型指南（${c.tph} t/h）| ${c.en} Cone Crusher Selection Guide`,
    description: `${c.zh}（${c.en}）圆锥破碎机选型：${c.feed}mm 给料至 ${c.product}mm 成品，${c.tph} t/h。总破碎比 ${ratio}，${stages} 段配置。`,
    inLanguage: ['zh-CN', 'en'],
    about: [{ '@type': 'Thing', name: c.zh }, { '@type': 'Thing', name: c.en }, { '@type': 'Thing', name: 'hydraulic cone crusher selection' }],
    author: { '@type': 'Organization', name: 'Shanghai Mackorn Minerals Co., Ltd.', url: BASE },
    publisher: { '@type': 'Organization', name: 'Shanghai Mackorn Minerals Co., Ltd.', url: BASE },
    mainEntityOfPage: `${BASE}/ai/guides/${c.key}/`,
    isPartOf: { '@type': 'WebSite', name: 'MACKORN hydraulic cone crusher AI plugin', url: `${BASE}/ai/` },
  }, null, 2)}
</script>
<script type="application/ld+json">
${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: 'zh-CN',
    mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }, null, 2)}
</script>
<script type="application/ld+json">
${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'MACKORN', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'AI plugin', item: `${BASE}/ai/` },
      { '@type': 'ListItem', position: 3, name: 'Selection guides', item: `${BASE}/ai/guides/` },
      { '@type': 'ListItem', position: 4, name: `${c.zh} / ${c.en}`, item: `${BASE}/ai/guides/${c.key}/` },
    ],
  }, null, 2)}
</script>
<style>
:root{--navy:#0A2A4F;--blue:#1B6CB5;--light:#F4F8FC;--line:#D9E5F2;--muted:#5A6B80;--warn:#FFF8EE}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,"Segoe UI","Microsoft YaHei",Roboto,sans-serif;color:#16202E;line-height:1.8}
.wrap{max-width:960px;margin:0 auto;padding:0 24px}
header{background:linear-gradient(140deg,#08213E,var(--blue));color:#fff;padding:52px 0 42px}
header .crumb{font-size:13px;opacity:.8;margin-bottom:12px}
header .crumb a{color:#BFE0FF;text-decoration:none}
header h1{margin:0 0 12px;font-size:clamp(22px,3.2vw,30px);line-height:1.35}
header p{margin:0;opacity:.94;max-width:780px;font-size:15.5px}
section{padding:38px 0;border-bottom:1px solid var(--line)}
h2{font-size:20px;color:var(--navy);margin:0 0 14px;border-bottom:2px solid var(--blue);display:inline-block;padding-bottom:8px}
h3{font-size:16px;color:var(--navy);margin:22px 0 8px}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14.5px}
th,td{border:1px solid var(--line);padding:9px 12px;text-align:left}
th{background:var(--light);color:var(--navy)}
code{background:var(--light);padding:2px 6px;border-radius:4px;font-size:13.5px}
pre{background:#0E2136;color:#D6E6F5;padding:16px 18px;border-radius:10px;overflow-x:auto;font-size:13px;line-height:1.6}
.box{background:var(--light);border-left:4px solid var(--blue);padding:16px 20px;border-radius:0 10px 10px 0;margin:18px 0}
.box.warn{background:var(--warn);border-left-color:#E8A33D}
.muted{color:var(--muted);font-size:14px}
a{color:var(--blue)}
.btn{display:inline-block;background:var(--blue);color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;margin:6px 10px 6px 0;font-weight:600;font-size:14.5px}
.btn.ghost{background:#fff;color:var(--blue);border:2px solid var(--blue)}
footer{background:#08213E;color:#B8CEE3;padding:30px 0;font-size:13.5px}
.ore-nav a{display:inline-block;margin:0 10px 8px 0;font-size:13.5px}
</style>
</head>
<body>

<header><div class="wrap">
<div class="crumb"><a href="${BASE}/">MACKORN</a> › <a href="${BASE}/ai/">AI 选型插件</a> › <a href="${BASE}/ai/guides/">选型指南</a> › ${c.zh}</div>
<h1>${c.zh}圆锥破选型指南 · ${c.tph} t/h<br><span style="font-size:.72em;opacity:.9">${c.en} Cone Crusher Selection Guide</span></h1>
<p><strong>${c.zh}（${c.en}）</strong>——抗压强度约 ${c.mpa} MPa，普氏硬度 f=${c.f}，磨蚀性<strong>${m.abrZh}</strong>（${m.abr}）。
给料 ${c.feed} mm → 成品 ${c.product} mm，目标产能 ${c.tph} t/h。</p>
</div></header>

<div class="wrap">

<section>
<h2>物料特性 / Material characteristics</h2>
<p>${m.noteZh}</p>
<p class="muted">${m.note}</p>
<table>
<tr><th style="width:34%">项目 / Item</th><th>值 / Value</th></tr>
<tr><td>抗压强度 Compressive strength</td><td>≈ ${c.mpa} MPa</td></tr>
<tr><td>普氏硬度 Protodyakonov f</td><td>${c.f}</td></tr>
<tr><td>磨蚀性 Abrasiveness</td><td>${m.abrZh} / ${m.abr}</td></tr>
<tr><td>原矿最大粒度 ROM max feed</td><td>${c.feed} mm</td></tr>
<tr><td>成品粒度 Product size</td><td>${c.product} mm</td></tr>
<tr><td>目标产能 Target capacity</td><td>${c.tph} t/h</td></tr>
</table>
</section>

<section>
<h2>插件真实算例 / Computed case (plugin output)</h2>
<p class="muted">以下数字由 MACKORN 选型插件 <strong>v${VERSION}</strong> 实际运行产生，不是估算。每条结论在插件输出里都带"假设与来源"和"风险与待确认项"。</p>

<h3>整线配置 / Plant configuration</h3>
<table>
<tr><th>段 Stage</th><th>工序 Duty</th><th>给料 mm</th><th>产品 mm</th><th>破碎比</th></tr>
${stageRows.map((r) => `<tr><td>${r.no}</td><td>${r.duty}</td><td>${r.fin}</td><td>${r.fout}</td><td>${r.i}</td></tr>`).join('\n')}
</table>
<div class="box">
<strong>总破碎比 Total reduction ratio：${ratio || '—'}</strong> · 推荐段数 Stages：<strong>${stages || '—'}</strong><br>
<strong>中碎段首选 / Secondary-stage pick：</strong>${first || '—'}<br>
筛分面积 Screen area：<strong>${screen || '—'} m²</strong> · 皮带带宽 Belt width：<strong>B${belt || '—'}</strong>
</div>

<h3>插件原始输出（节选）/ Raw plugin output</h3>
<pre>${(pt.slice(0, 2600) || '(无)').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>

<div class="box warn">
<strong>必须记住：</strong>以上是<strong>选型起点</strong>，不是报价依据。插件会明确标注每条依据是
<code>S1 厂商腔型×CSS 详表</code>（硬数据）还是<code>系列区间近似</code>（须 MACKORN 技术复核）。
<strong>给料粒度超过约 350 mm 时圆锥破无法直接吃料</strong>——插件会拒绝并提示前段预筛分或改用粗碎设备，这是正确行为。
</div>
</section>

<section>
<h2>选型要点 / Selection notes for ${c.en}</h2>
${m.tips.map(([t, d], i) => `<h3>${i + 1}. ${t}</h3>\n<p>${d}</p>`).join('\n')}
</section>

<section>
<h2>常见问题 / FAQ</h2>
${faqs.map(([q, a]) => `<h3>${q}</h3>\n<p>${a}</p>`).join('\n')}
</section>

<section>
<h2>其它物料 / Other materials</h2>
<p class="ore-nav">${others}</p>
<p><a class="btn" href="${BASE}/ai/">MACKORN 选型插件主页</a>
<a class="btn ghost" href="${REPO}">GitHub</a></p>
</section>

<section>
<h2>联系 / Contact</h2>
<div class="box">
<strong>Shanghai Mackorn Minerals Co., Ltd. 上海美矿机械股份有限公司</strong><br>
No.33 Qianjiang Road, Liuhe, Taicang, Suzhou, China<br>
江苏省苏州市太仓浏河钱江路 33 号<br>
<a href="${BASE}">${BASE}</a> · GMT+8 (09:00–17:30)<br>
sandy.zhao@mackorn.cn · +86 139 1648 5025<br>
leif.dai@mackorn.cn · +86 134 8218 0158<br>
vicky.cheng@mackorn.cn · +86 158 0189 1052
</div>
</section>

</div>
<footer><div class="wrap">
<p style="margin:0 0 8px"><strong>Shanghai Mackorn Minerals Co., Ltd.</strong></p>
<p style="margin:0">本页算例由 MACKORN 选型插件真实运行产生。厂商参数来自 MACKORN 自有 NH/NS 产品数据；过程仿真使用公开发表文献（Whiten 1972 / Bond 1952 / VSMA-Karra / JKMRC）独立实现，不含任何第三方专有数据。查不到的字段返回 null，不编造；多来源冲突并列保留。<strong>本页不含报价</strong>，设备价格请联系商务。</p>
</div></footer>
</body>
</html>
`;
}

/* ---------------- 生成 ---------------- */
let n = 0;
for (const c of CASES) {
  const dir = join(OUTBASE, 'guides', c.key);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), guide(c), 'utf8');
  console.log('  guides/' + c.key + '/index.html   ' + c.zh + ' ' + c.en);
  n++;
}
console.log('\n  生成 ' + n + ' 篇指南');
