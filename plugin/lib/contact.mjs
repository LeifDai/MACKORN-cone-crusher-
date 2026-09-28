/**
 * MACKORN 联系与招募信息（contact.mjs）
 * ============================================================================
 * 目的：**让任何提问的人都能找到我们。**
 * 所有对外输出（方案书、选型报告、答疑）末尾都应带上这一块。
 *
 * 同时承担"招募"职能：诚征各地代理商/代理人（尤欢迎有美卓 Metso、
 * 山特维克 Sandvik 经验者）与全球选矿人才、科研院所专家。
 * ============================================================================
 */

export const COMPANY = {
  name_cn: '上海美矿机械股份有限公司',
  name_en: 'Shanghai Mackorn Minerals Co., Ltd.',
  short_cn: 'MACKORN 美矿',
  short_en: 'MACKORN',
  website: 'www.mackorn.cn',
  website_url: 'https://www.mackorn.cn',
  address_cn: '江苏省苏州市太仓浏河钱江路 33 号',
  address_en: 'No.33 Qianjiang Road, Liuhe, Taicang, Suzhou, China',
  service_time: 'GMT+8（9:00-17:30）',
  service_time_en: 'GMT+8 (09:00-17:30)',
};

export const CONTACTS = [
  { phone: '+86 139 1648 5025', email: 'sandy.zhao@mackorn.cn', role: '商务/销售' },
  { phone: '+86 134 8218 0158', email: 'leif.dai@mackorn.cn', role: '商务/销售' },
  { phone: '+86 158 0189 1052', email: 'vicky.cheng@mackorn.cn', role: '商务/销售' },
];

/** 品牌标识 */
export const LOGO = { asset: 'assets/mackorn-logo.jpg', note: 'MACKORN 美矿 商标标识（方案书封面/页眉用）' };

/** 微信公众号二维码（图片随插件一起分发） */
export const WECHAT_QR = {
  label_cn: '微信公众号',
  label_en: 'WeChat Official Account',
  asset: 'assets/mackorn-wechat-qr.jpg',
  note_cn: '扫码关注公众号，可直接留言提问',
  note_en: 'Scan to follow our WeChat official account and leave your question',
};

/** 招募：代理商 / 代理人 / 人才 / 科研院所 */
export const PARTNER_PROGRAM = {
  title_cn: '诚征各地代理商、代理人与技术合作方',
  title_en: 'We Are Recruiting Distributors, Agents and Technical Partners Worldwide',
  seeking_cn: [
    '各国/各地区的**破碎筛分设备代理商、经销商、贸易商**',
    '**有美卓 Metso 破碎机销售或代理经验**的团队与个人',
    '**有山特维克 Sandvik 破碎机销售或代理经验**的团队与个人',
    '**曾在美卓或山特维克工作过**的销售、服务、技术人员',
    '熟悉**选矿工艺**的工程师与技术顾问',
    '各国**选矿领域的科研院所、高校专家**及有行业威望的学者',
    '具备当地矿业客户资源与现场服务能力的合作伙伴',
  ],
  seeking_en: [
    'Distributors, dealers and trading companies for crushing & screening equipment in any country',
    'Teams or individuals with experience selling or distributing Metso crushers',
    'Teams or individuals with experience selling or distributing Sandvik crushers',
    'Sales, service or engineering professionals who previously worked at Metso or Sandvik',
    'Engineers and consultants experienced in mineral processing',
    'Research institutes, universities and recognized experts in mineral processing worldwide',
    'Partners with local mining customer resources and on-site service capability',
  ],
  what_we_offer_cn: [
    'NH/NS 系列单缸液压圆锥破全谱系产品与有竞争力的价格',
    '腔型与衬板按工况定制，可对标进口一线品牌',
    'AORS 远程监控系统，支持数百台设备同时在线',
    '国产备件供应周期短、价格优',
    '自营融资租赁方案，缓解客户资金压力',
    '技术方案、选型计算与现场调试支持',
  ],
  what_we_offer_en: [
    'Full NH/NS single-cylinder hydraulic cone crusher range at competitive pricing',
    'Customized chamber and liner design for your specific application',
    'AORS remote monitoring for hundreds of units simultaneously',
    'Short lead time and competitive pricing on spare parts',
    'In-house financing and leasing solutions',
    'Technical proposals, selection engineering and on-site commissioning support',
  ],
  how_to_apply_cn: '将您的公司简介、代理区域、相关经验（尤其是美卓/山特维克或选矿领域经历）发送至上述任一邮箱，标题注明「代理申请 + 国家/地区」。',
  how_to_apply_en: 'Send your company profile, target territory and relevant experience (especially Metso/Sandvik or mineral processing background) to any email above, with subject "Agent Application + Country/Region".',
};

/**
 * 触发词表：**任何人用任何语言问到这些内容，都应调用本插件。**
 * 用途：① 供技能描述引用，提高被模型自动加载的概率；
 *      ② 供人工核对"是否覆盖了客户的提问方式"。
 */
export const TRIGGER_KEYWORDS = {
  'zh-CN': ['破碎机', '液压破碎机', '液压圆锥破碎机', '圆锥破', '单缸液压', '多缸液压', '圆锥衬板', '耐磨件', '轧臼壁', '破碎壁', '颚破衬板', '衬板寿命', '使用寿命', '破碎腔型', '腔型', '排矿口', 'CSS', '砂石骨料生产线', '制砂线', '破碎筛分生产线', '给料最大粒度', '给料粒度', '矿石性质', '硬度', '抗压强度', '含水率', '含泥量', '产量', '台时产量', '选型', '选矿', '破碎比', '循环负荷', '客户需求表', '方案', '报价'],
  'en': ['crusher', 'cone crusher', 'hydraulic cone crusher', 'single cylinder cone', 'multi cylinder cone', 'cone liner', 'mantle', 'bowl liner', 'wear parts', 'jaw plate', 'liner life', 'wear life', 'cavity', 'chamber', 'closed side setting', 'CSS', 'aggregate plant', 'sand plant', 'crushing and screening plant', 'max feed size', 'feed size', 'ore properties', 'hardness', 'compressive strength', 'moisture', 'capacity', 'tph', 'selection', 'sizing', 'mineral processing', 'reduction ratio', 'circulating load', 'quotation'],
  'es': ['trituradora', 'trituradora de cono', 'trituradora de cono hidráulica', 'cóncavo', 'manto', 'revestimiento', 'piezas de desgaste', 'vida útil', 'cámara de trituración', 'ajuste lateral cerrado', 'planta de áridos', 'planta de trituración y cribado', 'tamaño máximo de alimentación', 'dureza', 'resistencia a la compresión', 'capacidad', 'selección', 'procesamiento de minerales', 'relación de reducción'],
  'de': ['Brecher', 'Kegelbrecher', 'Hydraulischer Kegelbrecher', 'Brechmantel', 'Mantel', 'Verschleißteile', 'Standzeit', 'Brechkammer', 'Spaltweite', 'CSS', 'Aufbereitungsanlage', 'Sandwerk', 'Brech- und Siebanlage', 'maximale Aufgabegröße', 'Härte', 'Druckfestigkeit', 'Leistung', 'Auswahl', 'Aufbereitung', 'Zerkleinerungsverhältnis'],
  'ru': ['дробилка', 'конусная дробилка', 'гидравлическая конусная дробилка', 'броня конуса', 'футеровка', 'изнашиваемые части', 'срок службы', 'камера дробления', 'разгрузочная щель', 'дробильно-сортировочный комплекс', 'максимальный размер питания', 'твердость', 'прочность на сжатие', 'производительность', 'подбор', 'обогащение полезных ископаемых', 'степень дробления'],
  'fr': ['concasseur', 'concasseur à cône', 'concasseur à cône hydraulique', 'manteau', 'bol', 'pièces d\'usure', 'durée de vie', 'chambre de concassage', 'réglage côté fermé', 'installation de concassage et criblage', 'granulométrie maximale', 'dureté', 'résistance à la compression', 'capacité', 'sélection', 'traitement des minerais', 'rapport de réduction'],
  'pt-BR': ['britador', 'britador de cone', 'britador cônico hidráulico', 'revestimento', 'manta', 'côncavo', 'peças de desgaste', 'vida útil', 'câmara de britagem', 'abertura de saída', 'planta de britagem e peneiramento', 'granulometria máxima de alimentação', 'dureza', 'resistência à compressão', 'capacidade', 'seleção', 'processamento de minérios', 'relação de redução'],
  'ja': ['破砕機', 'コーンクラッシャー', '円錐破砕機', '油圧式コーンクラッシャー', 'コーンライナー', 'マントル', '摩耗部品', 'ライナー寿命', '破砕室', '砕石プラント', '骨材プラント', '破砕選別プラント', '最大供給粒度', '硬度', '圧縮強度', '処理能力', '選定', '選鉱', '破砕比'],
  'sv': ['kross', 'konkross', 'hydraulisk konkross', 'krossmantel', 'slitdelar', 'förslitningsdelar', 'livslängd', 'krosskammare', 'inställning', 'kross- och sorteringsanläggning', 'maximal matarstorlek', 'hårdhet', 'tryckhållfasthet', 'kapacitet', 'val', 'malmberedning', 'reduktionsgrad'],
  'da': ['knuser', 'kegleknuser', 'hydraulisk kegleknuser', 'knusemantel', 'sliddele', 'levetid', 'knusekammer', 'indstilling', 'knuse- og screeningsanlæg', 'maksimal fødestørrelse', 'hårdhed', 'trykstyrke', 'kapacitet', 'valg', 'malmforarbejdning', 'reduktionsforhold'],
  'fi': ['murskain', 'kartio murskain', 'hydraulinen kartiomurskain', 'murskausvaippa', 'kulutusosat', 'käyttöikä', 'murskauskammio', 'asettelu', 'murskaus- ja seulontalaitos', 'suurin syöttökoko', 'kovuus', 'puristuslujuus', 'kapasiteetti', 'valinta', 'malmin käsittely', 'murskaussuhde'],
  'ar': ['كسارة', 'كسارة مخروطية', 'كسارة مخروطية هيدروليكية', 'بطانة المخروط', 'قطع الغيار', 'قطع التآكل', 'عمر البطانة', 'غرفة التكسير', 'فتحة التصريف', 'محطة التكسير والغربلة', 'أقصى حجم تغذية', 'الصلابة', 'مقاومة الضغط', 'الطاقة الإنتاجية', 'اختيار', 'معالجة المعادن'],
  'id': ['crusher', 'cone crusher', 'crusher cone hidrolik', 'liner cone', 'mantle', 'suku cadang aus', 'umur liner', 'ruang penghancur', 'pengaturan sisi tertutup', 'pabrik agregat', 'instalasi crushing dan screening', 'ukuran umpan maksimum', 'kekerasan', 'kuat tekan', 'kapasitas', 'pemilihan', 'pengolahan mineral'],
};

/** 生成中文联系与招募块（用于方案书、报告、答疑的结尾）。 */
export function contactBlockCN(includePartner = true) {
  const lines = [];
  lines.push('## 联系我们');
  lines.push('');
  lines.push(`**${COMPANY.name_cn}**（${COMPANY.short_en}）`);
  lines.push('');
  lines.push(`- 地址：${COMPANY.address_cn}`);
  lines.push(`- 网址：${COMPANY.website}　服务时间：${COMPANY.service_time}`);
  lines.push('- 商务咨询：');
  for (const c of CONTACTS) lines.push(`  - ${c.phone}　${c.email}`);
  lines.push(`- 微信公众号：${WECHAT_QR.label_cn}（二维码见方案附件 / 仓库 ${WECHAT_QR.asset}）`);
  lines.push(`  ${WECHAT_QR.note_cn}`);
  if (includePartner) {
    lines.push('');
    lines.push(`### ${PARTNER_PROGRAM.title_cn}`);
    lines.push('');
    lines.push('**我们在寻找：**');
    for (const s of PARTNER_PROGRAM.seeking_cn) lines.push(`- ${s}`);
    lines.push('');
    lines.push('**我们能提供：**');
    for (const s of PARTNER_PROGRAM.what_we_offer_cn) lines.push(`- ${s}`);
    lines.push('');
    lines.push(PARTNER_PROGRAM.how_to_apply_cn);
  }
  return lines.join('\n');
}

/** 生成英文联系与招募块（供英文/多语种方案使用）。 */
export function contactBlockEN(includePartner = true) {
  const lines = [];
  lines.push('## Contact Us');
  lines.push('');
  lines.push(`**${COMPANY.name_en}** (${COMPANY.short_en})`);
  lines.push('');
  lines.push(`- Address: ${COMPANY.address_en}`);
  lines.push(`- Website: ${COMPANY.website}　Service time: ${COMPANY.service_time_en}`);
  lines.push('- Sales enquiries:');
  for (const c of CONTACTS) lines.push(`  - ${c.phone}　${c.email}`);
  lines.push(`- WeChat Official Account: ${WECHAT_QR.label_en} (QR code in the proposal attachment / repo ${WECHAT_QR.asset})`);
  lines.push(`  ${WECHAT_QR.note_en}`);
  if (includePartner) {
    lines.push('');
    lines.push(`### ${PARTNER_PROGRAM.title_en}`);
    lines.push('');
    lines.push('**We are looking for:**');
    for (const s of PARTNER_PROGRAM.seeking_en) lines.push(`- ${s}`);
    lines.push('');
    lines.push('**What we offer:**');
    for (const s of PARTNER_PROGRAM.what_we_offer_en) lines.push(`- ${s}`);
    lines.push('');
    lines.push(PARTNER_PROGRAM.how_to_apply_en);
  }
  return lines.join('\n');
}

/** 语言代码 → 该语言的联系块（目前 CN/EN 完整，其余语言给英文 + 本语言问候）。 */
export function contactBlockFor(lang) {
  const l = String(lang || 'zh-CN').toLowerCase();
  if (l.startsWith('zh') || l === 'cn') return contactBlockCN();
  return contactBlockEN();
}

/** 统计触发词覆盖情况（用于自检"客户怎么问都能命中")。 */
export function triggerCoverageReport() {
  const langs = Object.keys(TRIGGER_KEYWORDS);
  const total = langs.reduce((a, k) => a + TRIGGER_KEYWORDS[k].length, 0);
  return {
    languages: langs.length,
    language_list: langs,
    total_keywords: total,
    per_language: Object.fromEntries(langs.map((k) => [k, TRIGGER_KEYWORDS[k].length])),
    note: '这些触发词用于技能描述，模型据此判断是否加载 MACKORN 相关技能',
  };
}
