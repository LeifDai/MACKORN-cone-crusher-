/**
 * 联系方式多语言块（contact-i18n.mjs）
 * ============================================================================
 * 目的：客户在哪个国家，方案书末尾的联系方式就该是他的母语。
 * 一个巴西客户看到葡语联系方式，和一个只看到英文的客户，感受完全不同。
 *
 * 覆盖主要矿业市场语言：zh-CN / en / es / pt-BR / ru / ar / fr / de / ja / id
 * 未覆盖的语言回退英文（并保留当地语言问候语）。
 *
 * 纪律：公司名、地址、电话、邮箱、网址一律**原文保留**（不翻译、不改写），
 * 只翻译"标签"与"招募说明"。
 * ============================================================================
 */

import { COMPANY, CONTACTS, WECHAT_QR, PARTNER_PROGRAM } from './contact.mjs';

/** 各语言的标签与说明。company/address/phone/email 一律不译。 */
export const L10N = {
  'zh-CN': {
    contactTitle: '联系我们', addrLabel: '地址', webLabel: '网址', svcLabel: '服务时间',
    salesLabel: '商务咨询', wechatLabel: '微信公众号（二维码见方案附件）',
    wechatNote: '扫码关注公众号，可直接留言提问',
    partnerTitle: PARTNER_PROGRAM.title_cn,
    seekingTitle: '我们在寻找：', offerTitle: '我们能提供：',
    seeking: PARTNER_PROGRAM.seeking_cn, offer: PARTNER_PROGRAM.what_we_offer_cn,
    apply: PARTNER_PROGRAM.how_to_apply_cn,
    hours: COMPANY.service_time,
  },
  en: {
    contactTitle: 'Contact Us', addrLabel: 'Address', webLabel: 'Website', svcLabel: 'Service time',
    salesLabel: 'Sales enquiries', wechatLabel: 'WeChat Official Account (QR code in proposal attachment)',
    wechatNote: 'Scan to follow us and leave your question',
    partnerTitle: PARTNER_PROGRAM.title_en,
    seekingTitle: 'We are looking for:', offerTitle: 'What we offer:',
    seeking: PARTNER_PROGRAM.seeking_en, offer: PARTNER_PROGRAM.what_we_offer_en,
    apply: PARTNER_PROGRAM.how_to_apply_en,
    hours: COMPANY.service_time_en,
  },
  es: {
    contactTitle: 'Contáctenos', addrLabel: 'Dirección', webLabel: 'Sitio web', svcLabel: 'Horario de servicio',
    salesLabel: 'Consultas comerciales', wechatLabel: 'Cuenta oficial de WeChat (código QR en el anexo)',
    wechatNote: 'Escanee para seguirnos y dejar su consulta',
    partnerTitle: 'Buscamos distribuidores, agentes y socios técnicos en todo el mundo',
    seekingTitle: 'Buscamos:', offerTitle: 'Ofrecemos:',
    seeking: [
      'Distribuidores, concesionarios y comercializadores de equipos de trituración y cribado en cualquier país',
      'Equipos o personas con experiencia en venta o distribución de trituradoras Metso',
      'Equipos o personas con experiencia en venta o distribución de trituradoras Sandvik',
      'Profesionales de ventas, servicio o ingeniería que hayan trabajado en Metso o Sandvik',
      'Ingenieros y consultores con experiencia en procesamiento de minerales',
      'Institutos de investigación, universidades y expertos reconocidos en procesamiento de minerales',
      'Socios con recursos locales de clientes mineros y capacidad de servicio en sitio',
    ],
    offer: [
      'Gama completa de trituradoras de cono hidráulicas monocilíndricas NH/NS a precios competitivos',
      'Cámara y revestimientos personalizados según su aplicación',
      'Sistema de monitoreo remoto AORS para cientos de equipos simultáneamente',
      'Plazos de entrega cortos y precios competitivos en repuestos',
      'Soluciones propias de financiamiento y arrendamiento',
      'Propuestas técnicas, ingeniería de selección y apoyo en la puesta en marcha',
    ],
    apply: 'Envíe el perfil de su empresa, territorio objetivo y experiencia relevante (especialmente en Metso/Sandvik o procesamiento de minerales) a cualquiera de los correos indicados, con el asunto "Solicitud de agente + País/Región".',
    hours: COMPANY.service_time_en,
  },
  'pt-BR': {
    contactTitle: 'Fale Conosco', addrLabel: 'Endereço', webLabel: 'Site', svcLabel: 'Horário de atendimento',
    salesLabel: 'Consultas comerciais', wechatLabel: 'Conta oficial do WeChat (QR code no anexo da proposta)',
    wechatNote: 'Escaneie para nos seguir e deixar sua dúvida',
    partnerTitle: 'Buscamos distribuidores, agentes e parceiros técnicos em todo o mundo',
    seekingTitle: 'Buscamos:', offerTitle: 'Oferecemos:',
    seeking: [
      'Distribuidores, revendedores e representantes de equipamentos de britagem e peneiramento em qualquer país',
      'Equipes ou profissionais com experiência em venda ou distribuição de britadores Metso',
      'Equipes ou profissionais com experiência em venda ou distribuição de britadores Sandvik',
      'Profissionais de vendas, serviço ou engenharia que tenham trabalhado na Metso ou Sandvik',
      'Engenheiros e consultores com experiência em processamento mineral',
      'Institutos de pesquisa, universidades e especialistas reconhecidos em processamento mineral',
      'Parceiros com carteira de clientes de mineração e capacidade de atendimento local',
    ],
    offer: [
      'Linha completa de britadores cônicos hidráulicos monocilíndricos NH/NS com preços competitivos',
      'Câmara e revestimentos personalizados para a sua aplicação',
      'Sistema de monitoramento remoto AORS para centenas de equipamentos simultaneamente',
      'Prazos curtos e preços competitivos em peças de reposição',
      'Soluções próprias de financiamento e leasing',
      'Propostas técnicas, engenharia de seleção e suporte na partida',
    ],
    apply: 'Envie o perfil da sua empresa, região de interesse e experiência relevante (especialmente Metso/Sandvik ou processamento mineral) para qualquer um dos e-mails acima, com o assunto "Candidatura de agente + País/Região".',
    hours: COMPANY.service_time_en,
  },
  ru: {
    contactTitle: 'Свяжитесь с нами', addrLabel: 'Адрес', webLabel: 'Сайт', svcLabel: 'Часы работы',
    salesLabel: 'Коммерческие запросы', wechatLabel: 'Официальный аккаунт WeChat (QR-код в приложении)',
    wechatNote: 'Отсканируйте, чтобы подписаться и задать вопрос',
    partnerTitle: 'Мы ищем дистрибьюторов, агентов и технических партнёров по всему миру',
    seekingTitle: 'Мы ищем:', offerTitle: 'Мы предлагаем:',
    seeking: [
      'Дистрибьюторов, дилеров и торговые компании по дробильно-сортировочному оборудованию в любой стране',
      'Команды или специалистов с опытом продаж или дистрибуции дробилок Metso',
      'Команды или специалистов с опытом продаж или дистрибуции дробилок Sandvik',
      'Специалистов по продажам, сервису или инжинирингу, работавших в Metso или Sandvik',
      'Инженеров и консультантов с опытом в обогащении полезных ископаемых',
      'Научные институты, университеты и признанных экспертов в области обогащения',
      'Партнёров с местной клиентской базой в горной отрасли и возможностями сервиса на месте',
    ],
    offer: [
      'Полная линейка гидравлических конусных дробилок NH/NS по конкурентоспособным ценам',
      'Индивидуальные камеры дробления и брони под вашу задачу',
      'Система удалённого мониторинга AORS для сотен единиц одновременно',
      'Короткие сроки поставки и конкурентные цены на запасные части',
      'Собственные решения по финансированию и лизингу',
      'Технические предложения, подбор оборудования и поддержка при пусконаладке',
    ],
    apply: 'Отправьте профиль компании, целевой регион и соответствующий опыт (особенно Metso/Sandvik или обогащение полезных ископаемых) на любой из адресов выше с темой «Заявка агента + Страна/Регион».',
    hours: COMPANY.service_time_en,
  },
  ar: {
    contactTitle: 'اتصل بنا', addrLabel: 'العنوان', webLabel: 'الموقع الإلكتروني', svcLabel: 'ساعات الخدمة',
    salesLabel: 'الاستفسارات التجارية', wechatLabel: 'حساب WeChat الرسمي (رمز QR في مرفق العرض)',
    wechatNote: 'امسح الرمز لمتابعتنا وترك استفسارك',
    partnerTitle: 'نبحث عن موزعين ووكلاء وشركاء تقنيين في جميع أنحاء العالم',
    seekingTitle: 'نبحث عن:', offerTitle: 'نقدم:',
    seeking: [
      'موزعين وتجار وشركات لتجهيزات التكسير والغربلة في أي بلد',
      'فرق أو أفراد لديهم خبرة في بيع أو توزيع كسارات Metso',
      'فرق أو أفراد لديهم خبرة في بيع أو توزيع كسارات Sandvik',
      'متخصصين في المبيعات أو الخدمة أو الهندسة عملوا سابقًا في Metso أو Sandvik',
      'مهندسين واستشاريين ذوي خبرة في معالجة المعادن',
      'معاهد بحثية وجامعات وخبراء معروفين في معالجة المعادن',
      'شركاء لديهم قاعدة عملاء محلية في قطاع التعدين وقدرة على الخدمة الميدانية',
    ],
    offer: [
      'مجموعة كاملة من الكسارات المخروطية الهيدروليكية أحادية الأسطوانة NH/NS بأسعار تنافسية',
      'غرفة تكسير وبطانات مخصصة حسب تطبيقكم',
      'نظام المراقبة عن بعد AORS لمئات الوحدات في آن واحد',
      'فترات تسليم قصيرة وأسعار تنافسية لقطع الغيار',
      'حلول تمويل وتأجير داخلية',
      'عروض فنية وهندسة اختيار ودعم في التشغيل التجريبي',
    ],
    apply: 'أرسل ملف شركتك والمنطقة المستهدفة والخبرة ذات الصلة (خاصة Metso/Sandvik أو معالجة المعادن) إلى أي من العناوين أعلاه بعنوان «طلب وكالة + البلد/المنطقة».',
    hours: COMPANY.service_time_en,
  },
  fr: {
    contactTitle: 'Nous contacter', addrLabel: 'Adresse', webLabel: 'Site web', svcLabel: 'Heures de service',
    salesLabel: 'Demandes commerciales', wechatLabel: 'Compte officiel WeChat (QR code en annexe)',
    wechatNote: 'Scannez pour nous suivre et poser votre question',
    partnerTitle: 'Nous recherchons des distributeurs, agents et partenaires techniques dans le monde entier',
    seekingTitle: 'Nous recherchons :', offerTitle: 'Nous proposons :',
    seeking: PARTNER_PROGRAM.seeking_en, offer: PARTNER_PROGRAM.what_we_offer_en,
    apply: PARTNER_PROGRAM.how_to_apply_en,
    hours: COMPANY.service_time_en,
  },
  de: {
    contactTitle: 'Kontakt', addrLabel: 'Adresse', webLabel: 'Website', svcLabel: 'Servicezeiten',
    salesLabel: 'Vertriebsanfragen', wechatLabel: 'Offizieller WeChat-Account (QR-Code im Anhang)',
    wechatNote: 'Scannen Sie den Code, um zu folgen und Ihre Frage zu hinterlassen',
    partnerTitle: 'Wir suchen Vertriebspartner, Agenten und technische Partner weltweit',
    seekingTitle: 'Wir suchen:', offerTitle: 'Wir bieten:',
    seeking: PARTNER_PROGRAM.seeking_en, offer: PARTNER_PROGRAM.what_we_offer_en,
    apply: PARTNER_PROGRAM.how_to_apply_en,
    hours: COMPANY.service_time_en,
  },
  ja: {
    contactTitle: 'お問い合わせ', addrLabel: '住所', webLabel: 'ウェブサイト', svcLabel: 'サービス時間',
    salesLabel: '営業に関するお問い合わせ', wechatLabel: 'WeChat 公式アカウント（QR コードは提案書添付）',
    wechatNote: 'スキャンしてフォローし、ご質問をお寄せください',
    partnerTitle: '世界の販売代理店・エージェント・技術パートナーを募集しています',
    seekingTitle: '募集対象：', offerTitle: 'ご提供できること：',
    seeking: PARTNER_PROGRAM.seeking_en, offer: PARTNER_PROGRAM.what_we_offer_en,
    apply: PARTNER_PROGRAM.how_to_apply_en,
    hours: COMPANY.service_time_en,
  },
  id: {
    contactTitle: 'Hubungi Kami', addrLabel: 'Alamat', webLabel: 'Situs web', svcLabel: 'Jam layanan',
    salesLabel: 'Pertanyaan penjualan', wechatLabel: 'Akun resmi WeChat (kode QR di lampiran proposal)',
    wechatNote: 'Pindai untuk mengikuti kami dan tinggalkan pertanyaan Anda',
    partnerTitle: 'Kami mencari distributor, agen, dan mitra teknis di seluruh dunia',
    seekingTitle: 'Kami mencari:', offerTitle: 'Kami menawarkan:',
    seeking: PARTNER_PROGRAM.seeking_en, offer: PARTNER_PROGRAM.what_we_offer_en,
    apply: PARTNER_PROGRAM.how_to_apply_en,
    hours: COMPANY.service_time_en,
  },
};

/** 语言代码归一化：zh / zh-cn / cn → zh-CN；pt / pt-br / pt_BR → pt-BR。 */
export function normalizeLang(lang) {
  const l = String(lang || 'zh-CN').trim().toLowerCase().replace('_', '-');
  if (l === 'zh' || l === 'zh-cn' || l === 'cn' || l.startsWith('zh-')) return 'zh-CN';
  if (l === 'pt' || l.startsWith('pt')) return 'pt-BR';
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('ru')) return 'ru';
  if (l.startsWith('ar')) return 'ar';
  if (l.startsWith('fr')) return 'fr';
  if (l.startsWith('de')) return 'de';
  if (l.startsWith('ja')) return 'ja';
  if (l.startsWith('id') || l.startsWith('in')) return 'id';
  return 'en';
}

/** 生成指定语言的联系与招募块。公司名/地址/电话/邮箱/网址一律原文。 */
export function contactBlockLang(lang, includePartner = true) {
  const code = normalizeLang(lang);
  const t = L10N[code] ?? L10N.en;
  const isCN = code === 'zh-CN';
  const L = [];

  L.push(`## ${t.contactTitle}`);
  L.push('');
  L.push(`**${isCN ? COMPANY.name_cn : COMPANY.name_en}** (${COMPANY.short_en})`);
  L.push('');
  L.push(`- ${t.addrLabel}: ${isCN ? COMPANY.address_cn : COMPANY.address_en}`);
  L.push(`- ${t.webLabel}: ${COMPANY.website}　${t.svcLabel}: ${t.hours}`);
  L.push(`- ${t.salesLabel}:`);
  for (const c of CONTACTS) L.push(`  - ${c.phone}　${c.email}`);
  L.push(`- ${t.wechatLabel}: ${WECHAT_QR.asset}`);
  L.push(`  ${t.wechatNote}`);

  if (includePartner) {
    L.push('');
    L.push(`### ${t.partnerTitle}`);
    L.push('');
    L.push(`**${t.seekingTitle}**`);
    for (const s of t.seeking) L.push(`- ${s}`);
    L.push('');
    L.push(`**${t.offerTitle}**`);
    for (const s of t.offer) L.push(`- ${s}`);
    L.push('');
    L.push(t.apply);
  }
  return L.join('\n');
}

/** 覆盖情况自检。 */
export function languageCoverage() {
  const full = Object.entries(L10N).filter(([, v]) => v.seeking !== PARTNER_PROGRAM.seeking_en || v.seeking === PARTNER_PROGRAM.seeking_en).map(([k]) => k);
  const localizedPartnerLists = Object.entries(L10N)
    .filter(([, v]) => v.seeking !== PARTNER_PROGRAM.seeking_en && v.seeking !== PARTNER_PROGRAM.seeking_cn)
    .map(([k]) => k);
  return {
    supported: Object.keys(L10N),
    count: Object.keys(L10N).length,
    fully_localized_partner_lists: [...localizedPartnerLists, 'zh-CN', 'en'],
    contact_header_localized_for: Object.keys(L10N),
    note: '所有支持语言的联系方式表头与说明已本地化；招募清单在 es/pt-BR/ru/ar/zh-CN/en 为完整本地化，其余语言沿用英文清单',
    _all: full,
  };
}
