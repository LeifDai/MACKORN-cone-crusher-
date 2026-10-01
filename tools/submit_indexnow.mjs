/**
 * IndexNow 提交器 —— 让 Bing 在几分钟内收录新页面
 *
 * 为什么它对"让 ChatGPT 更快搜到你"最有用：
 *   ChatGPT 的联网搜索用的是 **Bing 索引**（Copilot 也是）。
 *   IndexNow 是 Bing/Yandex/Seznam 等共同支持的**即时收录协议**：
 *   你主动推 URL 过去，对方立刻来抓，不用等爬虫自己发现。
 *
 * 前置条件（一次性）：
 *   1. 把密钥文件放到官网根目录：https://mackorn.cn/<KEY>.txt
 *      文件名 = 密钥本身，文件内容 = 密钥本身（就一行）
 *   2. 跑这个脚本验证并通过 API 提交
 *
 * 用法：
 *   node tools/submit_indexnow.mjs                    # 提交默认 URL 列表
 *   node tools/submit_indexnow.mjs --check            # 只验证密钥文件是否就位
 *   node tools/submit_indexnow.mjs <url> [<url> ...]  # 提交指定 URL
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const KEY_FILE = join(ROOT, 'distribution', '官网落地页', '_indexnow-key.txt');
const HOST = 'mackorn.cn';

const CHECK_ONLY = process.argv.includes('--check');
const argUrls = process.argv.slice(2).filter((a) => /^https?:\/\//.test(a));

const DEFAULT_URLS = [
  'https://mackorn.cn/ai/',
  'https://mackorn.cn/llms.txt',
  'https://mackorn.cn/',
  'https://mackorn.cn/sitemap.xml',
];

if (!existsSync(KEY_FILE)) { console.error(`找不到密钥文件：${KEY_FILE}\n先生成密钥。`); process.exit(1); }
const KEY = readFileSync(KEY_FILE, 'utf8').trim();
if (!/^[a-f0-9]{8,128}$/i.test(KEY)) { console.error(`密钥格式不对（应为 8-128 位十六进制）：${KEY}`); process.exit(1); }

const keyUrl = `https://${HOST}/${KEY}.txt`;
console.log(`  密钥     : ${KEY}`);
console.log(`  密钥文件 : ${keyUrl}\n`);

// ---- 1. 验证密钥文件已就位（IndexNow 要求能读到它，否则提交会被拒） ----
console.log('=== 1) 验证密钥文件 ===');
let keyOk = false;
try {
  const r = await fetch(keyUrl, { signal: AbortSignal.timeout(20000) });
  const t = (await r.text()).trim();
  keyOk = r.status === 200 && t === KEY;
  console.log(`  HTTP ${r.status}  内容「${t.slice(0, 60)}」  ${keyOk ? '✅ 匹配' : '❌ 不匹配'}`);
  if (!keyOk && r.status === 200) console.log(`     期望「${KEY}」—— 文件内容必须正好是密钥本身，不能有多余字符或 BOM`);
} catch (e) {
  console.log(`  ❌ 取不到：${e.cause?.code || e.message}`);
}
if (!keyOk) {
  console.log('\n  密钥文件未就位，IndexNow 会拒绝提交。');
  console.log(`  请把「${KEY}」保存成文件放到官网根目录：`);
  console.log(`    文件名：${KEY}.txt`);
  console.log(`    内容  ：${KEY}`);
  console.log(`    即    ：https://${HOST}/${KEY}.txt`);
  console.log('  放好后重新运行本脚本。');
  process.exit(1);
}

if (CHECK_ONLY) { console.log('\n  --check 模式，密钥就位即退出。'); process.exit(0); }

// ---- 2. 提交 ----
const urls = argUrls.length ? argUrls : DEFAULT_URLS;
console.log(`\n=== 2) 提交 ${urls.length} 个 URL ===`);
urls.forEach((u) => console.log('  ' + u));

const body = { host: HOST, key: KEY, keyLocation: keyUrl, urlList: urls };

// 同时打多个端点：api.indexnow.org 会转发给所有参与方
const ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
  'https://yandex.com/indexnow',
];

let anyOk = false;
for (const ep of ENDPOINTS) {
  try {
    const r = await fetch(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    // 200/202 = 已接受；其它状态码含义见 IndexNow 文档
    const ok = r.status === 200 || r.status === 202;
    if (ok) anyOk = true;
    const txt = (await r.text()).slice(0, 200);
    console.log(`  ${ok ? '✅' : '⚠ '} ${ep}  HTTP ${r.status} ${txt ? '· ' + txt : ''}`);
  } catch (e) {
    console.log(`  ❌ ${ep}  ${e.cause?.code || e.message}`);
  }
}

console.log('\n  状态码参考：200/202 已接受 · 400 请求格式错 · 403 密钥无效 · 422 URL 不属于该 host 或密钥不匹配 · 429 提交过快');
console.log(anyOk
  ? '\n  ✅ 已提交。Bing 通常几分钟到几小时来抓；ChatGPT 的联网搜索用的是 Bing 索引。'
  : '\n  ❌ 全部端点失败，请检查上面的状态码。');
