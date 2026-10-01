// 标签一致性审计：检查核心定位词在各国文件里的覆盖情况
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2];

// 核心标签体系（聚焦"矿山行业垂直领域 MACKORN 液压圆锥破插件"）
const TAGS = {
  '英文定位': [
    'mining industry',
    'vertical-domain',
    'MACKORN',
    'hydraulic cone crusher',
    'cone crusher selection',
    'crushing plant',
    'mineral processing',
    'aggregate',
    'MCP server',
    'AI plugin',
    'ore properties',
    'liner wear',
    'wear parts',
    'capacity',
    'tph',
    'particle size',
  ],
  '中文定位': [
    '矿山',
    '垂直领域',
    '美矿',
    '液压圆锥破碎机',
    '圆锥破选型',
    '破碎筛分生产线',
    '选矿',
    '砂石骨料',
    '矿石性质',
    '衬板',
    '耐磨件',
    '产量',
    '粒度',
  ],
};

const FILES = [
  ['npm package.json',        'upload-ready/package.json'],
  ['README.md',               'upload-ready/README.md'],
  ['仓库 llms.txt',           'upload-ready/llms.txt'],
  ['server.json',             'upload-ready/server.json'],
  ['cordis.patch.yml',        'upload-ready/cordis.patch.yml'],
  ['MCPB manifest.json',      'distribution/mcpb/mackorn-cone-crusher/manifest.json'],
  ['官网 index.html',         'distribution/官网落地页/index.html'],
  ['官网 llms.txt',           'distribution/官网落地页/llms.txt'],
  ['官网 sitemap.xml',        'distribution/官网落地页/sitemap.xml'],
  ['server-card.json',        'distribution/官网落地页/.well-known/mcp/server-card.json'],
  ['技术文章(中)',            'articles/技术文章-1972年的Whiten模型做成了MACKORN美矿圆锥破选型插件.md'],
  ['技术文章(英)',            'articles/tech-article-whiten-model-cone-crusher-plugin-en.md'],
];

console.log('标签覆盖审计（Y=有 / n=缺）\n');

const missing = {};   // file -> [tags]
for (const [label, rel] of FILES) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { console.log('  [跳过] ' + label + '（文件不存在）'); continue; }
  const t = readFileSync(p, 'utf8');
  const rows = [];
  for (const [group, list] of Object.entries(TAGS)) {
    const miss = list.filter((k) => !t.toLowerCase().includes(k.toLowerCase()));
    const have = list.length - miss.length;
    rows.push(group + ' ' + have + '/' + list.length + (miss.length ? '  缺: ' + miss.join(', ') : '  ✅ 全'));
    if (miss.length) (missing[label] ||= []).push(...miss);
  }
  console.log('  ' + label.padEnd(22) + rows.join('\n' + ' '.repeat(24)));
}

console.log('\n=== 汇总：每个标签缺在哪些文件 ===');
const byTag = {};
for (const [f, tags] of Object.entries(missing)) for (const t of tags) (byTag[t] ||= []).push(f);
Object.entries(byTag).sort((a, b) => b[1].length - a[1].length).forEach(([t, fs]) => {
  console.log('  ' + t.padEnd(28) + '缺 ' + fs.length + ' 处');
});
