// 查 mcp.so 的 GitHub 仓库结构，找免费收录路径
const H = { 'User-Agent': 'p', Accept: 'application/vnd.github+json' };
const get = async (u) => { try { const r = await fetch(u, { headers: H }); return { s: r.status, t: r.status === 200 ? await r.text() : '' }; } catch (e) { return { s: 0, t: '', e: e.cause?.code || e.message }; } };

const j0 = JSON.parse((await get('https://api.github.com/repos/chatmcp/mcpso')).t);
console.log('=== 仓库 ===');
console.log('  ' + j0.full_name + '  ' + j0.stargazers_count + '★  default=' + j0.default_branch);
console.log('  ' + (j0.description || ''));
console.log('  最后提交: ' + j0.pushed_at);

console.log('\n=== 顶层内容 ===');
const r1 = await get('https://api.github.com/repos/chatmcp/mcpso/contents/');
if (r1.s === 200) {
  JSON.parse(r1.t).forEach((x) => console.log('  ' + (x.type === 'dir' ? '[dir] ' : '      ') + x.name + (x.size ? '  ' + x.size + 'B' : '')));
} else console.log('  HTTP ' + r1.s);

console.log('\n=== 找数据文件 / 提交说明 ===');
for (const f of ['CONTRIBUTING.md', 'README.md', 'data/servers.json', 'servers.json', 'src/data/servers.json', 'data']) {
  const r = await get('https://api.github.com/repos/chatmcp/mcpso/contents/' + f);
  console.log('  HTTP ' + r.s + '  ' + f);
  if (r.s === 200 && /\.md$/i.test(f)) {
    const c = JSON.parse(r.t);
    const t = Buffer.from((c.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
    t.split('\n').filter((l) => /submit|contribut|add your|pull request|\bPR\b|free|listing/i.test(l)).slice(0, 12).forEach((l) => console.log('      ' + l.trim().slice(0, 160)));
  }
}

console.log('\n=== 仓库里的 open issues/PRs 是否有人免费提交过 ===');
const r2 = await get('https://api.github.com/search/issues?q=repo:chatmcp/mcpso+type:pr&per_page=5&sort=created&order=desc');
if (r2.s === 200) {
  const j2 = JSON.parse(r2.t);
  console.log('  PR 总数: ' + j2.total_count);
  (j2.items || []).slice(0, 5).forEach((x) => console.log('    #' + x.number + '  ' + x.state + '  ' + x.title.slice(0, 80)));
}
