/**
 * 用插件跑 8 种矿石/岩石的**整线配置 + 圆锥破选型**真实算例。
 *
 * 第一版踩的坑：我把**原矿粒度**（500–900mm）当成圆锥破给料传进去，
 * 插件正确地全部拒绝并告警"超出腔型表常规分档，建议前段预筛分或改粗碎"。
 * 那是对的——圆锥破是中细碎设备，不该吃原矿。
 *
 * 所以正确做法：用 mackorn_plant_design（它先配粗碎，再把中/细碎给料算出来），
 * 再用 mackorn_cone_selection 对中碎段给料单独选型。
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, openSync, closeSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PLUGIN = join(ROOT, 'upload-ready', 'plugin', 'mcp-server.mjs');
const OUT = process.argv[2] || join(ROOT, 'distribution', 'ore-cases.json');

const CASES = [
  { key: 'basalt',     zh: '玄武岩', en: 'Basalt',         mpa: 200, f: '16-18', tph: 300, rom: 500, product: 31.5, ore: '玄武岩 f=16-18' },
  { key: 'granite',    zh: '花岗岩', en: 'Granite',        mpa: 150, f: '12-14', tph: 500, rom: 600, product: 31.5, ore: '花岗岩 f=12-14' },
  { key: 'andesite',   zh: '安山岩', en: 'Andesite',       mpa: 130, f: '10-12', tph: 250, rom: 450, product: 31.5, ore: '安山岩 f=10-12' },
  { key: 'diabase',    zh: '辉绿岩', en: 'Diabase',        mpa: 180, f: '14-16', tph: 200, rom: 400, product: 31.5, ore: '辉绿岩 f=14-16' },
  { key: 'iron_ore',   zh: '铁矿',   en: 'Iron ore',       mpa: 150, f: '12-16', tph: 600, rom: 800, product: 20,   ore: '铁矿 f=12-16' },
  { key: 'copper_ore', zh: '铜矿',   en: 'Copper ore',     mpa: 120, f: '10-14', tph: 800, rom: 900, product: 15,   ore: '铜矿 f=10-14' },
  { key: 'lead_zinc',  zh: '铅锌矿', en: 'Lead-zinc ore',  mpa: 100, f: '8-12',  tph: 400, rom: 600, product: 20,   ore: '铅锌矿 f=8-12' },
  { key: 'molybdenum', zh: '钼矿',   en: 'Molybdenum ore', mpa: 130, f: '10-14', tph: 500, rom: 700, product: 15,   ore: '钼矿 f=10-14' },
];

function mcpCall(toolName, args) {
  const req = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'ore', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: toolName, arguments: args } },
  ].map((o) => JSON.stringify(o)).join('\n') + '\n';

  const reqFile = join(ROOT, '.ore-req.jsonl');
  const resFile = join(ROOT, '.ore-res.jsonl');
  writeFileSync(reqFile, req, 'utf8');
  let out = '';
  try {
    const fi = openSync(reqFile, 'r');
    const fo = openSync(resFile, 'w');
    spawnSync(process.execPath, [PLUGIN], { cwd: ROOT, stdio: [fi, fo, fo] });
    closeSync(fi); closeSync(fo);
    out = readFileSync(resFile, 'utf8');
  } catch (e) { return { error: e.code || e.message }; }
  finally {
    try { rmSync(reqFile, { force: true }); } catch { }
    try { rmSync(resFile, { force: true }); } catch { }
  }
  for (const line of out.split('\n')) {
    try {
      const o = JSON.parse(line);
      if (o.id === 2) {
        if (o.error) return { error: JSON.stringify(o.error).slice(0, 300) };
        return { text: o.result?.content?.[0]?.text || '' };
      }
    } catch { }
  }
  return { error: '无响应' };
}

const results = [];
for (const c of CASES) {
  process.stdout.write('  ' + c.zh.padEnd(6) + ' ' + c.tph + 't/h ... ');

  // 1) 整线配置（自动配粗碎 + 中碎 + 细碎）
  const plant = mcpCall('mackorn_plant_design', {
    target_tph: c.tph, max_feed_mm: c.rom, target_product_mm: c.product, ore: c.ore, closed_circuit: true,
  });

  // 2) 中碎段圆锥破选型：给料取"原矿/3"（经粗碎后的典型粒度）
  const midFeed = Math.max(80, Math.round(c.rom / 3));
  const mid = mcpCall('mackorn_cone_selection', {
    target_tph: c.tph, max_feed_mm: midFeed, target_product_mm: c.product, ore: c.ore, stage: '中碎', closed_circuit: true,
  });

  // 3) 细碎段选型：给料取"中碎产品"量级
  const fineFeed = Math.max(40, Math.round(c.product * 2.5));
  const fine = mcpCall('mackorn_cone_selection', {
    target_tph: c.tph, max_feed_mm: fineFeed, target_product_mm: c.product, ore: c.ore, stage: '细碎', closed_circuit: true,
  });

  results.push({
    ...c,
    mid_feed_mm: midFeed, fine_feed_mm: fineFeed,
    plant_ok: !plant.error, plant_text: (plant.text || '').slice(0, 5000), plant_error: plant.error || null,
    mid_ok: !mid.error, mid_text: (mid.text || '').slice(0, 5000), mid_error: mid.error || null,
    fine_ok: !fine.error, fine_text: (fine.text || '').slice(0, 5000), fine_error: fine.error || null,
  });
  const okCount = [!plant.error, !mid.error, !fine.error].filter(Boolean).length;
  console.log('整线/中碎/细碎 = ' + okCount + '/3');
}

writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), plugin_version: '0.0.9', note: '圆锥破为中细碎设备，给料为经粗碎后的粒度；原矿粒度通过 plant_design 处理', cases: results }, null, 2), 'utf8');
console.log('\n  写入 ' + OUT);
