// 统一标签在各列表中的位置核查
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2];
const UNIFIED = /mining[- ]industry|矿山行业/i;

const lists = [
  ['npm package.json', join(ROOT, 'upload-ready', 'package.json'), 'keywords'],
  ['MCPB manifest.json', join(ROOT, 'distribution', 'mcpb', 'mackorn-cone-crusher', 'manifest.json'), 'keywords'],
];

for (const [label, p, field] of lists) {
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const arr = j[field] || [];
  const idx = arr.findIndex((k) => UNIFIED.test(k));
  console.log('  ' + label.padEnd(22) + '共 ' + arr.length + ' 个  统一标签在第 ' + (idx + 1) + ' 位  ' + (idx >= 0 ? '✅(' + arr[idx] + ')' : '❌'));
}

// 官网 meta keywords
const html = readFileSync(join(ROOT, 'distribution', '官网落地页', 'index.html'), 'utf8');
const meta = (html.match(/<meta name="keywords" content="([^"]*)"/) || [])[1] || '';
const kws = meta.split(',').filter(Boolean);
const mi = kws.findIndex((k) => UNIFIED.test(k.trim()));
console.log('  ' + '官网 meta keywords'.padEnd(22) + '共 ' + kws.length + ' 个  统一标签在第 ' + (mi + 1) + ' 位  ' + (mi >= 0 ? '✅(' + kws[mi].trim() + ')' : '❌'));

// llms.txt 定位段
for (const [label, p] of [
  ['仓库 llms.txt', join(ROOT, 'upload-ready', 'llms.txt')],
  ['官网 llms.txt', join(ROOT, 'distribution', '官网落地页', 'llms.txt')],
]) {
  const t = readFileSync(p, 'utf8');
  const has = t.includes('<!-- CANONICAL-POSITIONING -->');
  const en = /mining industry/i.test(t);
  const zh = /矿山行业/.test(t);
  console.log('  ' + label.padEnd(22) + (has ? '有定位段' : '无定位段') + '  英文 ' + (en ? 'Y' : 'n') + '  中文 ' + (zh ? 'Y' : 'n'));
}
