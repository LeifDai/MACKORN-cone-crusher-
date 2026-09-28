/**
 * 实测数据标定（calibrate.mjs）
 * ============================================================================
 * 这是把插件从"公开文献模型"升级为"MACKORN 自有模型"的关键一步。
 *
 * 输入：现场实测的**给料筛析**与**产品筛析**（累积通过率），以及该工况的 CSS。
 * 输出：最小二乘反算得到的破碎函数参数 φ/γ/β 与啮合系数，并给出拟合优度与逐点残差。
 *
 * 为什么重要：
 *   文献默认值让模拟"能跑"；只有用**自家设备的实测数据标定**，输出才成为
 *   别人抄不走的资产。标定结果写入知识库（来源标记 MACKORN-实测），
 *   后续所有选型与仿真自动用它。
 *
 * 方法：有界网格搜索 + 局部细化（不需要任何外部优化库）。
 * ============================================================================
 */

import { sieveSeries, discretize, cumFromFrac, simulateConeCrusher } from './simulate.mjs';

/** 线性插值（对数粒径轴）把"点表"变成连续分布函数。 */
function interpolatePoints(points) {
  const pts = [...points].filter((p) => Number.isFinite(p.size_mm) && p.size_mm > 0 && Number.isFinite(p.cum_pct))
    .map((p) => ({ x: Math.log(p.size_mm), y: Math.max(0, Math.min(1, p.cum_pct > 1 ? p.cum_pct / 100 : p.cum_pct)) }))
    .sort((a, b) => a.x - b.x);
  if (pts.length < 2) throw new Error('至少需要 2 个有效筛析点（size_mm + cum_pct）');
  return (x) => {
    const lx = Math.log(Math.max(x, 1e-9));
    if (lx <= pts[0].x) return pts[0].y;
    if (lx >= pts[pts.length - 1].x) return pts[pts.length - 1].y;
    for (let i = 0; i < pts.length - 1; i += 1) {
      if (lx >= pts[i].x && lx <= pts[i + 1].x) {
        const t = (lx - pts[i].x) / (pts[i + 1].x - pts[i].x);
        return pts[i].y + t * (pts[i + 1].y - pts[i].y);
      }
    }
    return pts[pts.length - 1].y;
  };
}

/** 在校准点上取预测累积通过率。 */
function predictAt(productCum, sizes, x) {
  const lx = Math.log(Math.max(x, 1e-9));
  const ls = sizes.map((s) => Math.log(s));
  if (lx <= ls[0]) return productCum[0];
  if (lx >= ls[ls.length - 1]) return productCum[productCum.length - 1];
  for (let i = 0; i < ls.length - 1; i += 1) {
    if (lx >= ls[i] && lx <= ls[i + 1]) {
      const t = (lx - ls[i]) / (ls[i + 1] - ls[i]);
      return productCum[i] + t * (productCum[i + 1] - productCum[i]);
    }
  }
  return productCum[productCum.length - 1];
}

/** 单次拟合误差：预测产品曲线 vs 实测产品点的 RMSE（累积通过率口径）。 */
function rmse(feedFn, sizes, measure, params) {
  let r;
  try {
    const { frac } = discretize(feedFn, sizes);
    r = simulateConeCrusher(frac, sizes, params);
  } catch { return { rmse: Number.POSITIVE_INFINITY, cum: null }; }
  let s = 0;
  for (const p of measure) {
    const pred = predictAt(r.product_cum, sizes, p.size_mm);
    const obs = p.cum_pct > 1 ? p.cum_pct / 100 : p.cum_pct;
    s += (pred - obs) ** 2;
  }
  return { rmse: Math.sqrt(s / measure.length), cum: r.product_cum };
}

/**
 * 用实测给料/产品筛析标定破碎函数参数。
 * @param {object} input
 * @param {Array<{size_mm:number,cum_pct:number}>} input.feed_points 给料筛析（累积通过 %）
 * @param {Array<{size_mm:number,cum_pct:number}>} input.product_points 产品筛析（累积通过 %）
 * @param {number} input.css_mm 该工况的紧边排矿口
 * @param {number} [input.throw_mm] 偏心距
 * @param {number} [input.roughness] 拟合优度门槛（RMSE 超过即告警，默认 0.06）
 */
export function calibrateBreakage(input = {}) {
  const cssMm = Number(input.css_mm);
  if (!(cssMm > 0)) throw new Error('css_mm 必须为正数（标定必须有该工况的紧边排矿口）');
  const feedPoints = input.feed_points ?? [];
  const productPoints = input.product_points ?? [];
  if (feedPoints.length < 2) throw new Error('feed_points 至少 2 个点');
  if (productPoints.length < 3) throw new Error('product_points 至少 3 个点（点数太少无法约束 3 个参数）');

  const sizes = sieveSeries(0.5, 512);
  const feedFn = interpolatePoints(feedPoints);
  const measure = productPoints
    .filter((p) => Number.isFinite(p.size_mm) && p.size_mm > 0)
    .map((p) => ({ size_mm: Number(p.size_mm), cum_pct: Number(p.cum_pct) }));

  const throwMm = Number.isFinite(Number(input.throw_mm)) ? Number(input.throw_mm) : 25;

  // 有界网格：φ / γ / β / throwFactor
  const PHI = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
  const GAMMA = [0.3, 0.5, 0.7, 0.9, 1.2];
  const BETA = [2.0, 2.8, 3.5, 4.5, 6.0];
  const TF = [0.4, 0.6, 0.8, 1.0, 1.2];

  let best = { rmse: Number.POSITIVE_INFINITY };
  let evals = 0;
  for (const phi of PHI) for (const gamma of GAMMA) for (const beta of BETA) for (const tf of TF) {
    evals += 1;
    const r = rmse(feedFn, sizes, measure, { cssMm, throwMm, throwFactor: tf, breakage: { phi, gamma, beta } });
    if (r.rmse < best.rmse) best = { rmse: r.rmse, phi, gamma, beta, throwFactor: tf, cum: r.cum };
  }

  // 局部细化（在最优解附近做一次更细的搜索）
  const refine = (center, half, steps) => Array.from({ length: steps }, (_, i) => center - half + (2 * half * i) / (steps - 1));
  for (const phi of refine(best.phi, 0.05, 5)) {
    for (const gamma of refine(best.gamma, 0.1, 5)) {
      for (const beta of refine(best.beta, 0.4, 5)) {
        for (const tf of refine(best.throwFactor, 0.1, 5)) {
          if (phi <= 0 || gamma <= 0 || beta <= gamma || tf <= 0) continue;
          evals += 1;
          const r = rmse(feedFn, sizes, measure, { cssMm, throwMm, throwFactor: tf, breakage: { phi, gamma, beta } });
          if (r.rmse < best.rmse) best = { rmse: r.rmse, phi, gamma, beta, throwFactor: tf, cum: r.cum };
        }
      }
    }
  }

  const residuals = measure.map((p) => {
    const pred = predictAt(best.cum, sizes, p.size_mm);
    const obs = p.cum_pct > 1 ? p.cum_pct / 100 : p.cum_pct;
    return {
      size_mm: p.size_mm,
      observed_pct: Number((obs * 100).toFixed(2)),
      predicted_pct: Number((pred * 100).toFixed(2)),
      error_pp: Number(((pred - obs) * 100).toFixed(2)),
    };
  });
  const maxAbsErr = Math.max(...residuals.map((r) => Math.abs(r.error_pp)));

  const threshold = Number.isFinite(Number(input.roughness)) ? Number(input.roughness) : 0.06;
  const warnings = [];
  const assumptions = [
    { assumption: '用实测给料/产品筛析反算 Whiten 破碎函数参数 φ/γ/β 与啮合系数，目标函数为产品累积通过率的 RMSE', source: 'CALIBRATION (least squares, grid + local refine)' },
    { assumption: `网格搜索 ${evals} 次评估；参数域 φ∈[0.2,0.7] γ∈[0.3,1.2] β∈[2,6] 啮合系数∈[0.4,1.2]`, source: 'METHOD' },
    { assumption: '给料分布按对数粒径线性插值（点数越多越准）', source: 'METHOD' },
  ];
  if (best.rmse > threshold) {
    warnings.push(`拟合优度偏低（RMSE ${(best.rmse * 100).toFixed(2)} 个百分点，门槛 ${(threshold * 100).toFixed(0)}）：` +
      '可能原因——① 该工况 CSS 记录不准 ② 给料与产品不是同一批料 ③ 筛析点太少或存在系统误差 ④ 该机型需分段标定（不同 CSS 各自一套参数）');
  }
  if (maxAbsErr > 10) warnings.push(`单点最大偏差 ${maxAbsErr.toFixed(2)} 个百分点（>10），建议核对筛析数据的取样与称量`);
  if (measure.length < 5) warnings.push('产品筛析点少于 5 个，3 个参数的自由度偏高，结果稳健性有限');

  // 边界告警：最优解贴在搜索域边缘，说明真实最优可能在域外，参数未真正被数据约束住
  const atEdge = [];
  if (best.phi <= Math.min(...PHI) + 0.02 || best.phi >= Math.max(...PHI) - 0.02) atEdge.push(`φ=${best.phi}`);
  if (best.gamma <= 0.25 || best.gamma >= Math.max(...GAMMA) - 0.02) atEdge.push(`γ=${best.gamma}`);
  if (best.beta <= Math.min(...BETA) + 0.05 || best.beta >= Math.max(...BETA) - 0.05) atEdge.push(`β=${best.beta}`);
  if (best.throwFactor <= Math.min(...TF) + 0.02 || best.throwFactor >= Math.max(...TF) - 0.02) atEdge.push(`啮合系数=${best.throwFactor}`);
  if (atEdge.length) {
    warnings.push(`⚠️ 参数贴在搜索边界（${atEdge.join('、')}）：说明这几个参数**没有被实测数据真正约束住**，真实最优可能在搜索域外。` +
      '常见原因——产品筛析点集中在单一粒级、或 CSS/给料记录不准。建议增加 0.5-2 倍 CSS 区间的筛析点后重标，或把该参数按工程经验固定、只标其余参数。');
  }
  warnings.push('标定结果是**该机型 + 该腔型 + 该 CSS 区间**的参数；换机型/腔型需重新标定，不要跨机型套用');

  return {
    calibrated: {
      phi: Number(best.phi.toFixed(4)),
      gamma: Number(best.gamma.toFixed(4)),
      beta: Number(best.beta.toFixed(4)),
      throwFactor: Number(best.throwFactor.toFixed(4)),
      css_mm: cssMm,
      throw_mm: throwMm,
    },
    fit: {
      rmse_pct_points: Number((best.rmse * 100).toFixed(3)),
      max_abs_error_pp: Number(maxAbsErr.toFixed(2)),
      evaluations: evals,
      n_points: measure.length,
      quality: best.rmse <= 0.03 ? '优' : best.rmse <= threshold ? '可接受' : '偏低，须复核',
    },
    residuals,
    library_defaults: { phi: 0.45, gamma: 0.7, beta: 3.5, throwFactor: 0.8, note: '文献典型值（Napier-Munn et al. / Whiten 1972）' },
    how_to_persist: {
      tool: 'mackorn_knowledge_update',
      suggestion: '把本次标定结果作为一条 kind="spec" 条目写入知识库，source_url 填本次筛析报告编号/路径，tags 加 ["标定","实测",机型]，并在 content 中写明机型/腔型/CSS 与 RMSE，供后续选型自动引用',
      provenance: 'MACKORN-实测（这是自有资产，与文献默认值必须区分开）',
    },
    assumptions,
    warnings,
  };
}
