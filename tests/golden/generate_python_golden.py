#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MACKORN DSH 插件 · Python golden 数据生成器
================================================================================
从官方源模型 `20260924 Mackorn 矿山选矿科研模型V1.py` 的 MackornCoreTheory
直接算出基准值，供 JS 移植版做同值对照。

用法：
    python generate_python_golden.py [源模型.py路径] [输出 json 路径]

默认源模型路径为 MACKORN 本机路径；若文件不存在则报错退出（不会静默生成假数据）。
================================================================================
"""

import importlib.util
import json
import math
import os
import sys

DEFAULT_MODEL = (
    r"E:\Mackorn\02 产品-设计-研发\99 DeepSeek研发模型\DeepSeek找人模型"
    r"\20260924 Mackorn 矿山选矿科研模型V1.py"
)


def load_module(path):
    if not os.path.isfile(path):
        raise SystemExit(f"[FAIL] 源模型不存在：{path}")
    spec = importlib.util.spec_from_file_location("mackorn_src_model", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def build_golden(core):
    golden = {}

    # --- MCFM ---
    arrays = [
        [100, 88, 70, 52, 38, 26, 15, 8],
        [100, 96, 90, 84, 76, 66, 55, 40],
        [100, 70, 45, 30, 18, 10, 5, 2],
        [100, 99, 98, 97, 96, 95, 94, 93],
    ]
    golden["mcfm_formula"] = [
        {"A": a, "M": core.mcfm_formula(a)} for a in arrays
    ]
    golden["mcfm_optimal_range"] = list(core.mcfm_optimal_range())
    golden["mcfm_deviation"] = [
        {"M": m, "result": core.mcfm_deviation(m)} for m in [3.2, 4.0, 4.25, 4.5, 5.6]
    ]

    # --- 终端速度 ---
    golden["terminal_velocity"] = [
        {"d_p": d, "rho_p": r, "v_t": core.terminal_velocity(d, r)}
        for d, r in [(0.01, 2650.0), (0.05, 2650.0), (0.2, 7800.0), (0.001, 1.0)]
    ]

    # --- 速度均匀化 ---
    scenarios = {
        "A_uneven_feeding": [12.0, 8.5, 6.2, 4.5, 3.0, 2.1],
        "B_partial_homogenization": [9.0, 7.8, 6.5, 5.9, 5.2, 4.8],
        "C_target_uniformity": [6.0, 5.9, 6.1, 5.95, 6.05, 5.98],
        "single": [2.5],
        "zeros": [0.0, 0.0],
    }
    golden["velocity_uniformity_index"] = {
        k: {"v": v, "result": core.velocity_uniformity_index(v)}
        for k, v in scenarios.items()
    }

    # --- 碰撞能量损失 ---
    golden["collision_energy_loss"] = [
        {"rpm": r, "v_feed": v, "E": core.collision_energy_loss(r, v)}
        for r, v in [(600, 30), (900, 25), (100, 400)]
    ]

    # --- 磨损均匀度 ---
    # 注意：Python 在 wmin==0 时返回 float("inf")，JSON 无法表示。此处显式序列化为
    # 字符串 "Infinity"，测试端要求 JS 侧返回 null（工具输出必须是无损 JSON）。
    wear_cases = [
        [1.8, 2.5, 3.6, 2.2, 1.4],
        [2.0, 2.15, 2.05, 2.1, 1.95],
        [3.0],
        [0.0, 1.0],
    ]
    wear_rows = []
    for w in wear_cases:
        result = core.wear_uniformity(w)
        if not math.isfinite(result["max_min_ratio"]):
            result = dict(result, max_min_ratio="Infinity")
        wear_rows.append({"w": w, "result": result})
    golden["wear_uniformity"] = wear_rows

    # --- 多梯度衬板 ---
    golden["gradient_liner_design"] = [
        {
            "n": n,
            "base": b,
            "factor": f,
            "H": core.gradient_liner_design(n, base_hardness=b, gradient_factor=f),
        }
        for n, b, f in [(5, 58.0, 1.12), (3, 60.0, 1.15), (6, 55.0, 1.2)]
    ]

    # --- 孔隙率 ---
    golden["porosity_from_grading"] = [
        {"c": c, "m": m, "f": f, "phi": core.porosity_from_grading(c, m, f)}
        for c, m, f in [
            (0.80, 0.05, 0.15),
            (0.60, 0.20, 0.20),
            (0.50, 0.30, 0.20),
            (0.0, 0.0, 0.0),
            (1.0, 1.0, 1.0),
        ]
    ]
    golden["optimal_grading"] = core.optimal_grading()

    return golden


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MODEL
    out = (
        sys.argv[2]
        if len(sys.argv) > 2
        else os.path.join(os.path.dirname(os.path.abspath(__file__)), "python-golden.json")
    )
    module = load_module(src)
    core = module.MackornCoreTheory()
    golden = build_golden(core)
    golden["_meta"] = {
        "source_python": src,
        "generator": "tests/golden/generate_python_golden.py",
        "class": "MackornCoreTheory",
    }
    with open(out, "w", encoding="utf-8") as handle:
        json.dump(golden, handle, ensure_ascii=False, indent=2)
    print(f"[OK] golden 已写入 {out}（{len(golden) - 1} 组）")


if __name__ == "__main__":
    main()
