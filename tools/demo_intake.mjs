/**
 * 演示：把真实的客户需求表文本 + 产量丢进 mackorn_requirement_intake，看它给出什么。
 * 用法：node tools/demo_intake.mjs <表单文本文件> [产量t/h]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const intake = await import(pathToFileURL(join(ROOT, 'plugin/lib/intake.mjs')).href);

const formPath = process.argv[2];
const tph = Number(process.argv[3] ?? 500);
if (!formPath) {
  console.error('用法: node tools/demo_intake.mjs <表单文本文件> [产量t/h]');
  process.exit(1);
}
const formText = readFileSync(formPath, 'utf8');
const r = intake.intakeRequirement({ capacity_tph: tph, form_text: formText });

console.log('=== 1. 文本自动抽取到的字段 ===');
console.log(JSON.stringify(r.form_parsed, null, 1));
console.log('\n=== 2. 归一化工况 ===');
console.log(JSON.stringify(r.normalized, null, 1));
console.log('\n=== 3. 完整性 ===');
console.log('阻断缺失:', r.completeness.missing_summary['阻断'].join('、') || '无');
console.log('关键缺失:', r.completeness.missing_summary['关键'].join('、') || '无');
console.log('建议缺失:', r.completeness.missing_summary['建议'].join('、') || '无');
console.log(`结论: ${r.completeness.blocking ? '【不能出方案，先追问产量】' : r.completeness.preliminary ? '【初步方案，关键字段须补齐重算】' : '【可用方案】'}`);
console.log('勾选/字段来源抽查:', JSON.stringify({
  soil_removal_needed: r.requirement.soil_removal_needed,
  soil_level: r.requirement.soil_level,
  production_method: r.requirement.production_method,
  ore_type: r.requirement.ore_type,
  ore_source: r.requirement.ore_source,
  scope: r.requirement.scope,
  belt_type: r.requirement.belt_type,
  electrical_origin: r.requirement.electrical_origin,
  storage_type: r.requirement.storage_type,
  days_per_year: r.requirement.days_per_year,
  dust_limit_mgm3: r.requirement.dust_limit_mgm3,
}, null, 0));

console.log('\n=== 4. 追问清单 ===');
for (const f of r.completeness.follow_up.slice(0, 8)) {
  console.log(`  [${f.urgency}] ${f.label}`);
  console.log(`     问：${f.question}`);
  console.log(`     因：${f.why}`);
}

console.log('\n=== 5. 年产量与矿山寿命 ===');
console.log(' ', r.annual.note);

if (r.plant_design) {
  const p = r.plant_design;
  console.log('\n=== 6. 整线方案 ===');
  console.log(`  总破碎比 ${p.total_reduction_ratio}，${p.recommended_stages} 段`);
  for (const s of p.stage_plan) console.log(`   段${s.index} ${s.stage}: ${s.feed_mm}→${s.product_mm}mm (i=${s.reduction_ratio})`);
  const f = (x, t) => x && console.log(`  ${t}: ${x.model} ${x.cavity}腔 @ CSS ${x.css_mm}mm | ${x.units}台 | 单台需求 ${x.per_unit_tph} t/h | 产能 ${x.capacity_tph.join('-')} | 达标=${x.capacity_ok} | 产品可达=${x.product_ok} | 依据=${x.basis}`);
  f(p.cone_crusher_coarse_side, '中碎');
  f(p.cone_crusher_fine_side, '细碎');
  if (p.coarse_crusher_recommendation) console.log(`  粗碎: ${p.coarse_crusher_recommendation.equipment}`);
  console.log(`  筛分: ${p.screening.optimistic_m2}-${p.screening.conservative_m2} m² | 带宽 B${p.conveying.recommended_width_mm} (${p.conveying.width_basis})`);
}

console.log('\n=== 7. 派生工艺建议 ===');
for (const d of r.derived_recommendations) console.log(`  * ${d.conclusion}\n    ← ${d.basis}`);

console.log('\n=== 8. 风险与待确认 ===');
for (const w of r.warnings) console.log(`  ! ${w}`);
