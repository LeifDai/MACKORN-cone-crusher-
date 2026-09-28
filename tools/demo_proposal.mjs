/**
 * 演示：从客户需求表文本生成一份 MACKORN 标准方案书。
 * 用法：node tools/demo_proposal.mjs <表单文本文件> [产量t/h] [成本机型]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const proposal = await import(pathToFileURL(join(ROOT, 'plugin/lib/proposal.mjs')).href);

const formPath = process.argv[2];
const tph = Number(process.argv[3] ?? 600);
const costModel = process.argv[4] ?? 'NH400';
if (!formPath) {
  console.error('用法: node tools/demo_proposal.mjs <表单文本文件> [产量t/h] [成本机型]');
  process.exit(1);
}
const formText = readFileSync(formPath, 'utf8');
const r = proposal.buildProposal({ capacity_tph: tph, form_text: formText, cost_model: costModel, cost_units: 2, electricity_price: 0.68 });

const out = join(ROOT, 'knowledge/_forms/_sample-proposal-output.md');
writeFileSync(out, r.markdown, 'utf8');
console.log(`[OK] 方案书已生成：${out}`);
console.log(`     长度 ${r.markdown.length} 字符，章节 ${(r.markdown.match(/^## /gm) ?? []).length} 个`);
console.log(`     假设 ${r.assumptions.length} 条，风险 ${r.warnings.length} 条，附件 ${r.attachments.join(' / ')}`);
console.log('\n---- 前 45 行预览 ----');
console.log(r.markdown.split('\n').slice(0, 45).join('\n'));
