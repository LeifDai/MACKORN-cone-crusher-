// 排查 MCP / AI 目录站的覆盖情况与提交机制
const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' };

const SITES = [
  // MCP 目录
  ['Glama',              'https://glama.ai/mcp/servers'],
  ['Smithery',           'https://smithery.ai'],
  ['mcp.so',             'https://mcp.so'],
  ['PulseMCP',           'https://www.pulsemcp.com'],
  ['MCP Market',         'https://mcpmarket.com'],
  ['MCPHub',             'https://mcphub.io'],
  ['MCPServers.org',     'https://mcpservers.org'],
  ['Cursor Directory',   'https://cursor.directory'],
  ['OpenTools',          'https://opentools.ai'],
  ['Cline Marketplace',  'https://cline.bot/mcp-marketplace'],
  ['Docker MCP',         'https://hub.docker.com/mcp'],
  ['MCP Registry (官方)', 'https://registry.modelcontextprotocol.io'],
  // AI 工具目录
  ['Futurepedia',        'https://www.futurepedia.io'],
  ['There\'s An AI For That', 'https://theresanaiforthat.com'],
  // 行业垂直
  ['中国砂石协会',        'http://www.zgss.org.cn/'],
  ['砂石骨料网',          'https://www.cssglw.com/'],
  ['中国矿业网',          'http://www.chinamining.org.cn/'],
  // 通用可信度
  ['Wikidata',           'https://www.wikidata.org'],
  ['Crunchbase',         'https://www.crunchbase.com'],
  ['LinkedIn',           'https://www.linkedin.com'],
];

(async () => {
  console.log('站点'.padEnd(26) + 'HTTP   含 mackorn   提交入口线索');
  console.log('-'.repeat(88));
  for (const [label, base] of SITES) {
    let status = '-', has = '-', hint = '';
    try {
      const r = await fetch(base, { headers: H, redirect: 'follow', signal: AbortSignal.timeout(15000) });
      status = String(r.status);
      const t = r.status === 200 ? await r.text() : '';
      if (t) {
        has = /mackorn/i.test(t) ? 'Y' : 'n';
        // 找提交入口
        const m = t.match(/href="([^"]*(?:submit|add-server|add_server|publish|contribute)[^"]*)"/i);
        if (m) hint = m[1].slice(0, 46);
        if (/github\.com\/[\w.-]+\/[\w.-]+/i.test(t) && !hint) {
          const g = t.match(/github\.com\/([\w.-]+\/[\w.-]+)/i);
          if (g) hint = 'gh: ' + g[1].slice(0, 34);
        }
      }
    } catch (e) { status = 'ERR'; hint = e.cause?.code || e.message || ''; }
    console.log(label.padEnd(26) + status.padEnd(8) + has.padEnd(12) + hint);
  }
})();
