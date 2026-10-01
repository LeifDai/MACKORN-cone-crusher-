/**
 * SDK 可移植性辅助模块
 *
 * 背景：tests/run.mjs 原来把官方 SDK 的安装路径写死为作者本机的一条绝对路径
 * 并且"加载不到就 FAIL"。后果是任何在别处克隆仓库的人、
 * 以及 GitHub Actions CI 跑测试都会红（实测 CI 连续 15 次 failure）。
 * 对一个主打"可验证"的项目，这是硬伤。
 *
 * 本模块把可移植性逻辑集中到一处：
 *   - loadDshSdk() 按顺序探测官方 SDK
 *   - assertSupportedJsonSchema() / validateJsonSchemaValueFallback()
 *     是 dsh enforced JSON Schema 子集的内置实现，官方 SDK 缺失时使用
 *
 * 这样 tests/run.mjs 只需要极小的改动，而且任何机器上都能跑出有意义的结论。
 */

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require_ = createRequire(import.meta.url);

/** 按优先级探测官方 @deepseek-ai/dsh-tools */
export async function loadDshSdk() {
  const tried = [];
  const candidates = [];

  // 1) 显式指定
  if (process.env.DSH_SDK_ROOT) {
    const r = String(process.env.DSH_SDK_ROOT).replace(/[\\/]+$/, '');
    candidates.push(join(r, 'dsh-tools', 'lib', 'index.js'));
    candidates.push(join(r, 'lib', 'index.js'));
  }

  // 2) 作为普通依赖安装（推荐）
  try { candidates.push(require_.resolve('@deepseek-ai/dsh-tools')); } catch { /* 未安装 */ }

  // 3) 本机 DSH 装配环境的常见位置（纯猜测，找不到也不影响别人）
  //    注意：这里**不写死任何作者私有路径**——需要时可自行设置 DSH_SDK_ROOT。
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const guesses = [
    home && join(home, '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies',
      'node_modules', '@deepseek-ai', 'dsh-tools', 'lib', 'index.js'),
    '/usr/lib/node_modules/@deepseek-ai/dsh-tools/lib/index.js',
    '/usr/local/lib/node_modules/@deepseek-ai/dsh-tools/lib/index.js',
  ].filter(Boolean);
  candidates.push(...guesses);

  for (const c of candidates) {
    tried.push(c);
    try {
      const m = await import(pathToFileURL(c).href);
      if (typeof m.assertSupportedJsonSchema === 'function') return { sdk: m, from: c, tried };
    } catch { /* 试下一个 */ }
  }
  return { sdk: null, from: null, tried };
}

/* --------------------------------------------------------------------------
 * dsh enforced JSON Schema 子集的内置实现
 * 允许的关键字：type / oneOf / properties / required / additionalProperties /
 *              items / enum / const（+ 纯元数据 description/title/default/examples）
 * ------------------------------------------------------------------------ */
const ALLOWED_KEYS = new Set([
  'type', 'oneOf', 'properties', 'required', 'additionalProperties', 'items',
  'enum', 'const', 'description', 'title', 'default', 'examples',
]);
const ALLOWED_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);

export function assertSupportedJsonSchema(schema, path = '$') {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error(path + ': schema must be an object');
  }
  for (const k of Object.keys(schema)) {
    if (!ALLOWED_KEYS.has(k)) throw new Error(path + ': keyword not in the supported subset: "' + k + '"');
  }
  if (schema.type !== undefined && !ALLOWED_TYPES.has(schema.type)) {
    throw new Error(path + ': invalid type "' + schema.type + '"');
  }
  if (schema.type === 'object') {
    if (!('additionalProperties' in schema)) throw new Error(path + ': object must declare additionalProperties explicitly');
    if (schema.required !== undefined && !Array.isArray(schema.required)) {
      throw new Error(path + ': required must be an array of strings (the author-DSL form required:true/false is rejected)');
    }
    for (const [pk, pv] of Object.entries(schema.properties || {})) {
      assertSupportedJsonSchema(pv, path + '.properties.' + pk);
    }
  } else if (schema.required !== undefined) {
    // required 只对 object 有意义。写在非 object 上就是作者 DSL 的 required:true/false 写法，
    // 官方 SDK 会拒绝——内置校验器必须同样拒绝，否则负控1 在无 SDK 环境下会假通过。
    throw new Error(path + ': "required" is only valid on an object schema (author-DSL required:true/false is rejected)');
  }
  if (schema.items !== undefined) assertSupportedJsonSchema(schema.items, path + '.items');
  (schema.oneOf || []).forEach((b, i) => assertSupportedJsonSchema(b, path + '.oneOf[' + i + ']'));
  return true;
}

/** 内置取值校验兜底：验证工具输出是否符合自己的 output.schema */
export function validateJsonSchemaValueFallback(schema, value, path = '$') {
  const out = [];
  if (schema === null || typeof schema !== 'object') return out;

  if (Array.isArray(schema.oneOf) && schema.oneOf.length) {
    const anyOk = schema.oneOf.some((b) => validateJsonSchemaValueFallback(b, value, path).length === 0);
    if (!anyOk) out.push(path + ': matches no oneOf branch');
    return out;
  }
  if (schema.const !== undefined && value !== schema.const) out.push(path + ': expected const');
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) out.push(path + ': not in enum');

  const ty = schema.type;
  if (ty === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) { out.push(path + ': expected object'); return out; }
    for (const k of schema.required || []) if (!(k in value)) out.push(path + ': missing required field ' + k);
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(value)) if (!(schema.properties || {})[k]) out.push(path + ': unexpected field ' + k);
    }
    for (const [k, sub] of Object.entries(schema.properties || {})) {
      if (k in value) out.push(...validateJsonSchemaValueFallback(sub, value[k], path + '.' + k));
    }
  } else if (ty === 'array') {
    if (!Array.isArray(value)) { out.push(path + ': expected array'); return out; }
    if (schema.items) value.forEach((v, i) => out.push(...validateJsonSchemaValueFallback(schema.items, v, path + '[' + i + ']')));
  } else if (ty === 'string') { if (typeof value !== 'string') out.push(path + ': expected string'); }
  else if (ty === 'number') { if (typeof value !== 'number') out.push(path + ': expected number'); }
  else if (ty === 'integer') { if (!Number.isInteger(value)) out.push(path + ': expected integer'); }
  else if (ty === 'boolean') { if (typeof value !== 'boolean') out.push(path + ': expected boolean'); }
  else if (ty === 'null') { if (value !== null) out.push(path + ': expected null'); }
  return out;
}
