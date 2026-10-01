// 官网同步状态核对：线上 vs 本地
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT = process.argv[2];
const sha = (t) => createHash('sha256').update(t).digest('hex').slice(0, 12);

const pairs = [
  ['index.html（介绍页）',   'distribution/官网落地页/index.html',                              'https://mackorn.cn/ai/'],
  ['llms.txt',              'distribution/官网落地页/llms.txt',                                'https://mackorn.cn/llms.txt'],
  ['sitemap.xml',           'distribution/官网落地页/sitemap.xml',                             'https://mackorn.cn/sitemap.xml'],
  ['server-card.json',      'distribution/官网落地页/.well-known/mcp/server-card.json',         'https://mackorn.cn/.well-known/mcp/server-card.json'],
  ['IndexNow 密钥文件',      'distribution/官网落地页/836604ef2cb766c53bd4e0a7755b01db.txt',    'https://mackorn.cn/836604ef2cb766c53bd4e0a7755b01db.txt'],
  ['二维码 repo-qrcode.png', 'distribution/官网落地页/repo-qrcode.png',                         'https://mackorn.cn/ai/repo-qrcode.png'],
];

let need = 0;
for (const [label, rel, url] of pairs) {
  let lt;
  try { lt = readFileSync(join(ROOT, rel)); } catch { console.log('  ❓ 本地缺文件  ' + label); continue; }
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
    let same = false, rlen = 0;
    if (r.status === 200) {
      const buf = Buffer.from(await r.arrayBuffer());
      rlen = buf.length;
      same = sha(buf) === sha(lt);
    }
    if (!same) need++;
    console.log('  ' + (same ? '✅ 已同步  ' : '⏳ 待上传  ') + label.padEnd(24) + 'HTTP ' + String(r.status).padEnd(5) + '线上 ' + rlen + ' B / 本地 ' + lt.length + ' B');
  } catch (e) {
    console.log('  ❓ 无法验证  ' + label + '  ' + (e.cause?.code || e.message));
  }
}
console.log('\n  需要上传: ' + need + ' 个文件');
