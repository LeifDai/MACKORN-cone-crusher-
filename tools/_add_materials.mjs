// 把目标矿石/岩石与目标市场写入官网落地页（meta keywords + 页面内容段落）
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2];
const FILE = join(ROOT, 'distribution', '官网落地页', 'index.html');
let t = readFileSync(FILE, 'utf8');

const ORE_EN = 'metal mining · iron ore · copper ore · lead-zinc ore · molybdenum ore · granite · basalt · andesite · diabase · hard rock · medium-hard ore · quarry';
const ORE_ZH = '金属矿山 · 铁矿 · 铜矿 · 铅锌矿 · 钼矿 · 花岗岩 · 玄武岩 · 安山岩 · 辉绿岩 · 中硬以上矿石';
const MARKET = 'Central Asia · Africa · Southeast Asia · South America · Middle East · Russia/CIS';
const ORE_I18N = 'granito · basalto · andesita · diabasa · mineral de hierro · mineral de cobre · Granit · Basalt · Andesit · Diabas · Eisenerz · Kupfererz · гранит · базальт · андезит · диабаз · железная руда · медная руда · granite · basalte · andésite · minerai de fer · minério de ferro · 花岗岩 · 玄武岩 · batu granit · bijih besi · الجرانيت';

/* 1) meta keywords 追加 */
const m = t.match(/<meta name="keywords" content="([^"]*)">/);
if (m) {
  const add = [ORE_EN.replace(/ · /g, ','), ORE_ZH.replace(/ · /g, ','), MARKET.replace(/ · /g, ','), ORE_I18N.replace(/ · /g, ',')].join(',');
  const merged = [...new Set((m[1] + ',' + add).split(',').map((s) => s.trim()).filter(Boolean))].join(',');
  t = t.replace(m[0], '<meta name="keywords" content="' + merged + '">');
  console.log('  meta keywords → ' + merged.split(',').length + ' 个词');
}

/* 2) 页面加"适用物料与市场"章节（真实内容，AI 检索会命中） */
if (!t.includes('id="materials"')) {
  const sec = `
<section id="materials">
  <h2>适用物料与目标市场 / Materials &amp; Markets</h2>
  <p><strong>Metal mines (medium-hard and above)</strong> — iron ore, copper ore, lead-zinc ore, molybdenum ore, gold, chromium.
     <strong>Hard-rock aggregate</strong> — granite, basalt, andesite, diabase. These are exactly the feeds where a
     single-cylinder hydraulic cone crusher earns its keep: high compressive strength, abrasive, and unforgiving of
     a badly chosen cavity or closed-side setting.</p>
  <p><strong>金属矿山（中硬以上）</strong> —— 铁矿、铜矿、铅锌矿、钼矿、金矿、铬矿。
     <strong>硬岩骨料</strong> —— 花岗岩、玄武岩、安山岩、辉绿岩。这类物料抗压强度高、磨蚀性强，
     腔型与排矿口选错代价很大——正是单缸液压圆锥破的价值所在。</p>
  <p class="muted"><strong>Materials (EN):</strong> ${ORE_EN}</p>
  <p class="muted"><strong>物料（中文）:</strong> ${ORE_ZH}</p>
  <p class="muted"><strong>Materials (multilingual):</strong> ${ORE_I18N}</p>
  <p class="muted"><strong>Markets served:</strong> ${MARKET}</p>
</section>
`;
  t = t.replace('<section id="scope"', sec + '\n<section id="scope"');
  console.log('  已插入「适用物料与目标市场」章节');
} else console.log('  章节已存在');

writeFileSync(FILE, t, 'utf8');
console.log('  文件: ' + (t.length) + ' 字符');
