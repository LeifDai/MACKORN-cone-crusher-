#!/usr/bin/env node
/**
 * MACKORN 液压圆锥破碎机生产线选型 · MCP 服务器
 * ============================================================================
 * 让**任何支持 Model Context Protocol 的 AI**（Claude Desktop / Cursor /
 * VS Code Copilot / ChatGPT 连接器 / 各类本地模型客户端 …）调用同一套 MACKORN 工具。
 *
 * 设计要点：
 *   · **零依赖**：只用手写 JSON-RPC 2.0 over stdio，不需要任何 MCP SDK，
 *     因此这个文件可以被复制到任何地方直接运行。
 *   · **同一份工具定义**：直接复用 `index.mjs` 的 TOOLS，不存在"两套实现漂移"。
 *   · stdout 只走协议，日志一律走 stderr。
 *
 * 用法：
 *   node mcp-server.mjs            # stdio 服务器（给 MCP 客户端调用）
 *   node mcp-server.mjs --list     # 打印工具清单后退出（自检用）
 *   node mcp-server.mjs --selftest # 自检：跑一遍 initialize / tools/list / 每个工具
 *
 * 客户端配置示例（Claude Desktop 的 claude_desktop_config.json）：
 *   {
 *     "mcpServers": {
 *       "mackorn": {
 *         "command": "node",
 *         "args": ["C:/Users/you/.dsh/plugins/mackorn-cone-crusher/mcp-server.mjs"]
 *       }
 *     }
 *   }
 * ============================================================================
 */

import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { toolDefinitions, name as PLUGIN_NAME } from './index.mjs';

const SERVER_NAME = 'mackorn-cone-crusher';
/** 版本从同级 package.json 读，保证与发布版本一致（读不到则回退）。 */
const SERVER_VERSION = (() => {
  try {
    const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));
    return pkg.version ?? '0.0.1';
  } catch {
    return '0.0.1';
  }
})();
const PROTOCOL_VERSION = '2024-11-05';

const TOOLS = toolDefinitions;
const byName = new Map(TOOLS.map((t) => [t.name, t]));

const log = (...args) => process.stderr.write(`[${SERVER_NAME}] ${args.join(' ')}\n`);

/** MCP tool 描述：inputSchema 直接复用插件参数 schema（本就是标准 JSON Schema 子集）。 */
function mcpToolList() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.parameters,
  }));
}

/** 执行一个工具，把 render 产出的文本块拼成 MCP content。 */
async function callTool(toolName, args) {
  const def = byName.get(toolName);
  if (!def) {
    return { content: [{ type: 'text', text: `未知工具 "${toolName}"。可用工具：${[...byName.keys()].join(', ')}` }], isError: true };
  }
  try {
    const value = await def.execute(args ?? {});
    const blocks = def.output.render(args ?? {}, value);
    const text = blocks.map((b) => (b && typeof b.text === 'string' ? b.text : '')).join('\n');
    return { content: [{ type: 'text', text: text.length ? text : '(工具执行完成，无文本输出)' }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `工具 ${toolName} 执行失败：${error && error.message ? error.message : String(error)}` }], isError: true };
  }
}

/** 单条 JSON-RPC 请求 → 响应对象（通知返回 null）。 */
async function handle(message) {
  const { id, method, params } = message ?? {};
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          instructions: 'MACKORN 美矿液压圆锥破碎机与破碎筛分生产线选型。'
            + '销售场景请先用 mackorn_requirement_intake（可粘贴客户需求表文字），'
            + '技术场景用 mackorn_cone_selection / mackorn_plant_design，收口用 mackorn_selection_report。'
            + '所有结论都带「假设与来源」，数据缺口如实返回 null。',
        },
      };
    case 'notifications/initialized':
    case 'initialized':
      return null;
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: mcpToolList() } };
    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments ?? {};
      const result = await callTool(toolName, args);
      return { jsonrpc: '2.0', id, result };
    }
    case 'resources/list':
      return { jsonrpc: '2.0', id, result: { resources: [] } };
    case 'prompts/list':
      return { jsonrpc: '2.0', id, result: { prompts: [] } };
    default:
      if (isNotification) return null;
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

function send(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

/* ------------------------------ 自检模式 ------------------------------ */

async function selftest() {
  // 自检必须写**临时**知识库：否则每次 --selftest 都会往真实知识库灌"自检条目"
  // （实测已污染 11 条）。这与"交付纪律"一致——测试不许留痕到生产数据里。
  const { tmpdir } = await import('node:os');
  process.env.MACKORN_KB_DIR = join(tmpdir(), `mackorn-mcp-selftest-${process.pid}`);
  log(`自检写临时知识库：${process.env.MACKORN_KB_DIR}`);
  let pass = 0;
  let fail = 0;
  const check = (label, ok, detail = '') => {
    if (ok) { pass += 1; log(`ok   ${label}`); } else { fail += 1; log(`FAIL ${label} ${detail}`); }
  };

  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  check('initialize 返回 serverInfo', init?.result?.serverInfo?.name === SERVER_NAME);
  check('initialize 声明 tools 能力', init?.result?.capabilities?.tools !== undefined);

  const list = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  check(`tools/list 返回 ${TOOLS.length} 个工具`, list?.result?.tools?.length === TOOLS.length, JSON.stringify(list?.result?.tools?.length));
  check('每个工具都有 inputSchema', list.result.tools.every((t) => t.inputSchema && t.inputSchema.type === 'object'));

  check('未知方法返回 -32601', (await handle({ jsonrpc: '2.0', id: 3, method: 'nope' }))?.error?.code === -32601);
  check('通知不产生响应', (await handle({ jsonrpc: '2.0', method: 'notifications/initialized' })) === null);

  const bad = await handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'no_such_tool', arguments: {} } });
  check('未知工具返回 isError', bad?.result?.isError === true);

  // 每个工具都用最小样本真跑一遍
  const samples = {
    mackorn_requirement_intake: { capacity_tph: 500, max_feed_mm: 750, product_mm: 20, ore_type: '石灰石' },
    mackorn_contact: { language: 'en' },
    mackorn_calibrate: { css_mm: 16, feed_points: [{size_mm:1,cum_pct:2},{size_mm:90,cum_pct:80},{size_mm:200,cum_pct:100}], product_points: [{size_mm:1,cum_pct:18},{size_mm:10,cum_pct:56},{size_mm:16,cum_pct:72},{size_mm:40,cum_pct:99}] },
    mackorn_crusher_curve: { css_mm: 16, feed_p80_mm: 90 },
    mackorn_simulate_flowsheet: { feed_p80_mm: 90, stages: [{ type: 'crusher', css_mm: 16 }, { type: 'screen', aperture_mm: 20, recirculate_to: 0 }] },
    mackorn_intel_watch: { focus: 'W-SANDVIK' },
    mackorn_knowledge_update: {
      actor: 'mcp-selftest',
      entries: [{ title: '自检条目', content: '产能 100 t/h', source_url: 'https://mackorn.cn/selftest', source_type: 'official' }],
    },
    mackorn_pdca_status: { action: 'status' },
    mackorn_proposal: { capacity_tph: 500, max_feed_mm: 700, product_mm: 20, ore_type: '石灰石', include_cost: false },
    mackorn_cone_selection: { target_tph: 500, max_feed_mm: 180, target_product_mm: 20, stage: '中碎' },
    mackorn_plant_design: { target_tph: 500, max_feed_mm: 700, target_product_mm: 20 },
    mackorn_capacity_check: { model: 'NH400', cavity: 'C', css: 16 },
    mackorn_cost_estimate: { model: 'NH400', units: 2, tph: 500 },
    mackorn_mcfm_analysis: { cumulative_retained: [100, 88, 70, 52, 38, 26, 15, 8] },
    mackorn_wear_design: { sections: 5 },
    mackorn_grading_porosity: { coarse_frac: 0.5, mid_frac: 0.3, fine_frac: 0.2 },
    mackorn_market_intel: { focus: '骨料市场' },
    mackorn_selection_report: { title: '自检', target_tph: 500, max_feed_mm: 700, target_product_mm: 20, include_cost: false },
    mackorn_equipment_catalog: {},
  };
  for (const tool of list.result.tools) {
    const r = await callTool(tool.name, samples[tool.name] ?? {});
    const text = r.content?.[0]?.text ?? '';
    check(`tools/call ${tool.name}`, r.isError !== true && text.length > 20, text.slice(0, 120));
  }

  log(`结果：${pass} 通过 / ${fail} 失败`);
  process.exitCode = fail === 0 ? 0 : 1;
}

/* ------------------------------ 入口 ------------------------------ */

if (process.argv.includes('--list')) {
  for (const t of mcpToolList()) log(`${t.name}`);
  log(`共 ${TOOLS.length} 个工具（服务器 ${PLUGIN_NAME} v${SERVER_VERSION}）`);
  process.exit(0);
}

if (process.argv.includes('--selftest')) {
  await selftest();
} else {
  log(`MCP stdio 服务器已启动（${TOOLS.length} 个工具，协议 ${PROTOCOL_VERSION}）`);
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let queue = Promise.resolve();
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    queue = queue.then(async () => {
      let message;
      try {
        message = JSON.parse(trimmed);
      } catch {
        send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        return;
      }
      try {
        const response = await handle(message);
        if (response !== null) send(response);
      } catch (error) {
        send({ jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32603, message: String(error && error.message) } });
      }
    });
  });
  rl.on('close', () => { process.exit(0); });
}
