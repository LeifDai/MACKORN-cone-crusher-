/**
 * 全球破碎设备海关贸易数据（UN Comtrade 免费 API）—— 带限流重试版
 *
 * 第一版踩的坑：请求间隔 180ms 触发 429 限流，导致大量国家返回空。
 * 数据其实是有的（Chile $46.7M / Kazakhstan $268.5M），只是被限流吃掉了。
 * 这一版：请求间隔 1.3s + 429 自动退避重试 + 取 partnerCode=0（World 总计）。
 *
 * HS：847420 破碎/粉磨机械 · 847410 筛分/分选机械 · 847490 零件（衬板耐磨件）
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = process.argv[2] || join(ROOT, 'distribution', 'trade-data.json');

const COUNTRIES = {
  76: 'Brazil', 152: 'Chile', 604: 'Peru', 32: 'Argentina', 170: 'Colombia',
  36: 'Australia', 682: 'Saudi Arabia', 784: 'UAE', 512: 'Oman',
  792: 'Turkey', 364: 'Iran', 398: 'Kazakhstan', 860: 'Uzbekistan', 643: 'Russia',
  710: 'South Africa', 288: 'Ghana', 894: 'Zambia', 180: 'DRC', 834: 'Tanzania',
  508: 'Mozambique', 566: 'Nigeria',
  360: 'Indonesia', 608: 'Philippines', 704: 'Vietnam', 458: 'Malaysia', 764: 'Thailand',
  356: 'India', 410: 'South Korea', 392: 'Japan',
  484: 'Mexico', 124: 'Canada', 840: 'United States', 858: 'Uruguay',
};

const HS = { '847420': '破碎/粉磨机械', '847490': '零件（衬板耐磨件）' };
const YEARS = ['2021', '2022', '2023'];
const SLEEP = 1300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTrade(reporter, cmd, period, attempt = 1) {
  const url = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=${reporter}&period=${period}&cmdCode=${cmd}&flowCode=M`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (r.status === 429) {
      if (attempt > 4) return { err: 'rate-limited' };
      await sleep(3000 * attempt);
      return getTrade(reporter, cmd, period, attempt + 1);
    }
    if (!r.ok) return { err: 'HTTP ' + r.status };
    const j = await r.json();
    const rows = (j.data || []).filter((d) => d.flowCode === 'M' && d.cmdCode === cmd);
    if (!rows.length) return { err: 'no data' };
    // partnerCode 0 = World（总计）；没有就取最大值
    const world = rows.find((d) => d.partnerCode === 0 || d.partnerCode === '0');
    const best = world || rows.slice().sort((a, b) => (b.primaryValue || 0) - (a.primaryValue || 0))[0];
    return { usd: best.primaryValue ?? null, netWgt: best.netWgt ?? null, partner: best.partnerDesc || 'World' };
  } catch (e) {
    if (attempt <= 3) { await sleep(2000 * attempt); return getTrade(reporter, cmd, period, attempt + 1); }
    return { err: e.cause?.code || e.message };
  }
}

// 断点续跑
let result = { generated: new Date().toISOString(), source: 'UN Comtrade public preview API', unit: 'USD (imports, CIF, World total)', byCountry: {} };
if (existsSync(OUT)) { try { const old = JSON.parse(readFileSync(OUT, 'utf8')); if (old.byCountry) result.byCountry = old.byCountry; } catch { } }

let n = 0, total = Object.keys(COUNTRIES).length * Object.keys(HS).length * YEARS.length;
for (const [codeStr, name] of Object.entries(COUNTRIES)) {
  const code = Number(codeStr);
  result.byCountry[name] ||= { reporterCode: code, hs: {} };
  for (const [hs, label] of Object.entries(HS)) {
    result.byCountry[name].hs[hs] ||= { label, years: {} };
    for (const y of YEARS) {
      const cur = result.byCountry[name].hs[hs].years[y];
      if (cur && (cur.usd !== undefined || cur.error === 'no data')) { n++; continue; }  // 已有则跳过
      const t = await getTrade(code, hs, y);
      result.byCountry[name].hs[hs].years[y] = t.err ? { error: t.err } : { usd: t.usd, netWgt: t.netWgt };
      n++;
      process.stdout.write('\r  ' + n + '/' + total + '  ' + name.padEnd(14) + hs + '@' + y + '  ' + (t.usd ? '$' + (t.usd / 1e6).toFixed(1) + 'M' : (t.err || '—')).padEnd(16));
      await sleep(SLEEP);
    }
  }
  writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8');   // 每国落盘，防中断丢数据
}

console.log('\n');
writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8');

const rank = Object.entries(result.byCountry).map(([name, d]) => {
  const y = d.hs['847420'].years;
  const v = (yy) => y[yy]?.usd || 0;
  const p = d.hs['847490'].years;
  const pv = (yy) => p[yy]?.usd || 0;
  return { name, y21: v('2021'), y23: v('2023'), part23: pv('2023'), growth: v('2021') > 0 ? (v('2023') / v('2021') - 1) * 100 : null };
}).sort((a, b) => b.y23 - a.y23);

const f = (v) => (v ? '$' + (v / 1e6).toFixed(1) + 'M' : '—');
console.log('  ═══ HS 847420 破碎/粉磨机械 · 进口额（USD，World 总计）═══');
console.log('  ' + '国家'.padEnd(16) + '2021'.padEnd(13) + '2023'.padEnd(13) + '21→23'.padEnd(10) + '847490 零件 2023');
console.log('  ' + '-'.repeat(66));
for (const r of rank) {
  if (!r.y23 && !r.y21 && !r.part23) continue;
  console.log('  ' + r.name.padEnd(16) + f(r.y21).padEnd(13) + f(r.y23).padEnd(13) +
    (r.growth === null ? '—' : (r.growth > 0 ? '+' : '') + r.growth.toFixed(0) + '%').padEnd(10) + f(r.part23));
}
console.log('\n  写入 ' + OUT);
