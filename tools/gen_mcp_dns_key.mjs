// 生成 MCP 注册表 DNS 认证所需的 ed25519 密钥对
// 私钥写入本地文件（不入聊天、不入仓库）；公钥用于 DNS TXT 记录
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

// 取裸密钥：PKCS8 的末尾 32 字节是种子；SPKI 的末尾 32 字节是公钥
const privDer = privateKey.export({ type: 'pkcs8', format: 'der' });
const pubDer  = publicKey.export({ type: 'spki',  format: 'der' });
const privHex = privDer.subarray(privDer.length - 32).toString('hex');
const pubHex  = pubDer.subarray(pubDer.length - 32).toString('hex');

const outPath = process.argv[2];
const txtRecord = `v=MCPv1; k=ed25519; p=${pubHex}`;

writeFileSync(outPath, [
  '# MCP Registry DNS authentication - ed25519 key pair',
  '# KEEP THIS FILE PRIVATE. Do not commit it, do not send it anywhere.',
  '#',
  `# generated: ${new Date().toISOString()}`,
  `# domain   : mackorn.cn`,
  '',
  `PRIVATE_KEY_HEX=${privHex}`,
  '',
  `# public key (goes into DNS, public by design):`,
  `PUBLIC_KEY_HEX=${pubHex}`,
  '',
  `# DNS TXT record to create on mackorn.cn:`,
  `#   host/name : @  (or mackorn.cn itself)`,
  `#   type      : TXT`,
  `#   value     : ${txtRecord}`,
  '',
  `# command to run after the TXT record propagates:`,
  `#   mcp-publisher login dns --domain=mackorn.cn --private-key=${privHex}`,
  '',
].join('\n'), 'utf8');

console.log('  私钥已写入 : ' + outPath);
console.log('  私钥长度   : ' + privHex.length + ' hex chars (32 bytes)');
console.log('');
console.log('  === 要加到 DNS 的 TXT 记录 ===');
console.log('  主机/名称 : @   (即 mackorn.cn 本身)');
console.log('  类型      : TXT');
console.log('  值        : ' + txtRecord);
console.log('');
console.log('  公钥(可公开): ' + pubHex);
