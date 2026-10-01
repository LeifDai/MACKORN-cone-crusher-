// 测试全球海关/贸易数据源可达性与免费额度
const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' };

const SOURCES = [
  // 官方 / 免费
  ['UN Comtrade 新版 API',   'https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=76&period=2023&cmdCode=847420&flowCode=M&maxRecords=5'],
  ['UN Comtrade 旧版 API',   'https://comtrade.un.org/api/get?max=5&type=C&freq=A&px=HS&ps=2023&r=76&p=all&rg=1&cc=847420'],
  ['UN Comtrade 文档',       'https://comtradeapi.un.org/'],
  ['WITS (世界银行)',        'https://wits.worldbank.org/API/V1/SDMX/V21/datasource/tradestats-trade/reporter/bra/year/2022/partner/000/product/847420/indicator/MPRT-TRD-VL'],
  ['WTO Stats',              'https://stats.wto.org/'],
  ['Eurostat 贸易',          'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/DS-045409'],
  // 商业（付费，仅探测可达性）
  ['ImportGenius',           'https://www.importgenius.com/'],
  ['Panjiva (S&P)',          'https://panjiva.com/'],
  ['Volza',                  'https://www.volza.com/'],
  ['Import Yeti',            'https://www.importyeti.com/'],
  ['TradeAtlas',             'https://www.tradeatlas.com/'],
  ['Export Genius',          'https://www.exportgenius.in/'],
  ['Trademo',                'https://www.trademo.com/'],
  ['52wmb (中国海关)',        'https://www.52wmb.com/'],
  ['中国海关总署统计',         'http://stats.customs.gov.cn/'],
  // 矿业市场情报
  ['S&P Global MI',          'https://www.spglobal.com/marketintelligence/'],
  ['Wood Mackenzie',         'https://www.woodmac.com/'],
  ['CRU Group',              'https://www.crugroup.com/'],
  ['Mining.com',             'https://www.mining.com/'],
  ['InfoMine',               'https://www.infomine.com/'],
];

(async () => {
  console.log('数据源'.padEnd(24) + 'HTTP  类型    说明');
  console.log('-'.repeat(86));
  for (const [label, url] of SOURCES) {
    let s = 'ERR', kind = '', note = '';
    try {
      const r = await fetch(url, { headers: H, redirect: 'follow', signal: AbortSignal.timeout(18000) });
      s = String(r.status);
      const ct = r.headers.get('content-type') || '';
      kind = ct.includes('json') ? 'JSON' : ct.includes('xml') ? 'XML' : 'HTML';
      const t = await r.text();
      if (ct.includes('json')) note = t.slice(0, 90).replace(/\s+/g, ' ');
      else if (/subscription|api.?key|sign in|register|付费|订阅/i.test(t.slice(0, 6000))) note = '需订阅/注册';
    } catch (e) { note = (e.cause?.code || e.message || '').slice(0, 40); }
    console.log(label.padEnd(24) + s.padEnd(7) + kind.padEnd(8) + note);
  }
})();
