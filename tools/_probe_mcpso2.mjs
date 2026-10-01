// 查 mcp.so：1) 仓库 data 目录结构  2) 提交页是否有"取消付费"的免费路径
const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', Accept: 'application/vnd.github+json' };

const gh = async (u) => { try { const r = await fetch(u, { headers: H }); return { s: r.status, t: r.status === 200 ? await r.text() : '' }; } catch (e) { return { s: 0, t: '' }; } };

console.log('=== 1) 仓库 data/ 目录 ===');
const r = await gh('https://api.github.com/repos/chatmcp/mcpso/contents/data');
if (r.s === 200) JSON.parse(r.t).forEach(x => console.log('  ' + (x.type === 'dir' ? '[dir] ' : '      ') + x.name + (x.size ? '  ' + x.size + 'B' : '')));

console.log('\n=== 2) 仓库最近的合并活动（判断 PR 还有没有人处理）===');
const rc = await gh('https://api.github.com/repos/chatmcp/mcpso/commits?per_page=5');
if (rc.s === 200) JSON.parse(rc.t).forEach(c => console.log('  ' + c.commit.author.date.slice(0, 10) + '  ' + c.commit.message.split('\n')[0].slice(0, 70)));
const rm = await gh('https://api.github.com/search/issues?q=repo:chatmcp/mcpso+type:pr+is:merged&per_page=3&sort=updated&order=desc');
if (rm.s === 200) {
  const j = JSON.parse(rm.t);
  console.log('  已合并 PR 总数: ' + j.total_count);
  (j.items || []).forEach(x => console.log('    #' + x.number + '  ' + (x.pull_request?.merged_at || '').slice(0, 10) + '  ' + x.title.slice(0, 60)));
}

console.log('\n=== 3) mcp.so 提交页：付费框是否可取消（找免费通道）===');
const rp = await fetch('https://mcp.so/submit?type=server', { headers: H });
const t = await rp.text();
// 页面里的按钮/文案
const txt = t.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const m = txt.match(/.{0,120}(Paid submission|Pay and submit|submit automatically|free|review).{0,160}/gi) || [];
[...new Set(m)].slice(0, 10).forEach(s => console.log('  ' + s.trim()));

console.log('\n=== 4) 页面 JS 里有没有 free/submit 分支 ===');
const scripts = [...t.matchAll(/src="([^"]*submit[^"]*\.js)"/g)].map(x => x[1]);
console.log('  相关脚本: ' + (scripts.join(', ') || '(无)'));
for (const s of scripts.slice(0, 2)) {
  const u = s.startsWith('http') ? s : 'https://mcp.so' + s;
  try {
    const rr = await fetch(u, { headers: H });
    const jt = await rr.text();
    console.log('  ' + s + '  ' + jt.length + ' 字符');
    ['free', 'Free', 'review', 'paid', 'Paid', 'price', '39'].forEach(k => {
      const n = (jt.match(new RegExp(k, 'g')) || []).length;
      if (n) console.log('      ' + k + ' × ' + n);
    });
  } catch (e) { console.log('  取不到 ' + s); }
}
