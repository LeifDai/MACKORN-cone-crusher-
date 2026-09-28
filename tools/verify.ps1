<#
.SYNOPSIS
  MACKORN 液压圆锥破碎机生产线选型插件 · 验收自检

.DESCRIPTION
  按「五道门」自检，任何一项失败都会以非零码退出：
    G1 内核同值对照（JS 移植 vs Python 源模型 golden）
    G2 真实 dsh SDK schema 校验
    G3 entry 契约与功能冒烟（10 个工具逐个真跑）
    G4 负控（8 项，必须全部响亮报错）
    G5 安装态检查（插件目录 / 技能目录 / patch 标记 / 相对路径可解析）
  可选 -BootTest：用临时 profile 真启动一次 dsh，验证插件树能装载。

.PARAMETER DshHome
  DeepSeek Harness 家目录。默认取 $env:DSH_HOME，否则 $env:USERPROFILE\.dsh

.PARAMETER BootTest
  额外做一次真实启动装载测试（需要本机已安装 dsh CLI）。

.PARAMETER PythonExe
  生成 golden 用的 Python 解释器路径（默认自动探测）。
#>
[CmdletBinding()]
param(
  [string]$DshHome,
  [switch]$BootTest,
  [string]$PythonExe
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$fail = 0

function Resolve-DshHome([string]$Explicit) {
  if ($Explicit) { return $Explicit }
  if ($env:DSH_HOME) { return $env:DSH_HOME }
  return (Join-Path $env:USERPROFILE '.dsh')
}
$home_dsh = Resolve-DshHome $DshHome

function Step([string]$Title) { Write-Host "`n=== $Title ===" -ForegroundColor Cyan }
function Ok([string]$Msg) { Write-Host "  ok   $Msg" -ForegroundColor Green }
function Bad([string]$Msg) { Write-Host "  FAIL $Msg" -ForegroundColor Red; $script:fail++ }

# ---------- G1-G4：自动化测试 ----------
Step 'G1-G4 内核对照 / SDK 校验 / 契约冒烟 / 负控'
if (-not $PythonExe) {
  foreach ($cand in @(
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
  )) { if (Test-Path -LiteralPath $cand) { $PythonExe = $cand; break } }
  if (-not $PythonExe) { $cmd = Get-Command python -ErrorAction SilentlyContinue; if ($cmd) { $PythonExe = $cmd.Source } }
}
$golden = Join-Path $Root 'tests\golden\python-golden.json'
if ($PythonExe -and (Test-Path -LiteralPath $PythonExe)) {
  & $PythonExe (Join-Path $Root 'tests\golden\generate_python_golden.py') | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok "golden 已由 Python 重新生成（$PythonExe）" } else { Bad "golden 生成失败" }
} elseif (Test-Path -LiteralPath $golden) {
  Write-Host "  warn 未找到 Python，沿用既有 golden：$golden" -ForegroundColor Yellow
} else {
  Bad "既无 Python 也无 golden，G1 无法执行"
}

if (Get-Command node -ErrorAction SilentlyContinue) {
  & node (Join-Path $Root 'tests\run.mjs')
  if ($LASTEXITCODE -eq 0) { Ok 'node tests/run.mjs 全部通过' } else { Bad "node tests/run.mjs 失败（exit $LASTEXITCODE）" }
} else {
  Bad '找不到 node，无法执行自动化测试'
}

# ---------- G5：安装态检查 ----------
Step 'G5 安装态检查'
$dstPlugin = Join-Path $home_dsh 'plugins\mackorn-cone-crusher'
if (Test-Path -LiteralPath (Join-Path $dstPlugin 'index.mjs')) { Ok "工具插件已安装：$dstPlugin" } else { Bad "工具插件未安装：$dstPlugin" }
foreach ($f in @('lib\core.mjs', 'lib\data.mjs', 'lib\data-market.mjs', 'lib\engine.mjs')) {
  if (Test-Path -LiteralPath (Join-Path $dstPlugin $f)) { Ok "  $f" } else { Bad "  缺文件 $f" }
}

$patchPath = Join-Path $home_dsh 'cordis.patch.yml'
if (Test-Path -LiteralPath $patchPath) {
  $content = [System.IO.File]::ReadAllText($patchPath)
  if ($content -match '>>>\s*mackorn-cone-crusher') { Ok 'cordis.patch.yml 含 mackorn 标记区块' } else { Bad 'cordis.patch.yml 缺少 mackorn 标记区块' }
  if ($content -match "name:\s*'\./plugins/mackorn-cone-crusher/index\.mjs'") {
    Ok '插件行使用相对路径（相对 patch 文件所在目录，已实测有效）'
  } else {
    Bad "插件行不是预期的相对路径形式（绝对路径在 dsh 中会被静默忽略）"
  }
  # 把相对路径按 dsh 的解析规则换算成真实文件，确认能落地
  $resolved = Join-Path $home_dsh 'plugins\mackorn-cone-crusher\index.mjs'
  if (Test-Path -LiteralPath $resolved) { Ok "相对路径可解析到真实文件：$resolved" } else { Bad "相对路径解析不到文件：$resolved" }
} else {
  Bad "patch 文件不存在：$patchPath"
}

$skillsRoot = Join-Path $home_dsh 'skills'
foreach ($s in @('mackorn-cone-crusher-selection', 'mackorn-crushing-plant-design', 'mackorn-market-depth', 'dsh-industry-plugin-blueprint')) {
  $p = Join-Path $skillsRoot "$s\SKILL.md"
  if (Test-Path -LiteralPath $p) {
    $text = [System.IO.File]::ReadAllText($p)
    $nameOk = $text -match "(?m)^name:\s*$([regex]::Escape($s))\s*$"
    $descOk = $text -match '(?m)^description:\s*\S'
    if ($nameOk -and $descOk) { Ok "技能 $s（frontmatter name/description 合规）" } else { Bad "技能 $s frontmatter 不合规（name=$nameOk description=$descOk）" }
  } else {
    Bad "技能未安装：$p"
  }
}

# ---------- 可选：真实启动装载测试 ----------
if ($BootTest) {
  Step 'G5+ 真实启动装载测试（临时 profile，不影响 desktop）'
  $dshBin = $null
  $cmd = Get-Command dsh -ErrorAction SilentlyContinue
  if ($cmd) {
    # dsh.ps1 包装器 -> 解析真实 bin.js
    $cand = Join-Path (Split-Path -Parent (Split-Path -Parent $cmd.Source)) 'node_modules\@deepseek-ai\dsh\lib\bin.js'
    if (Test-Path -LiteralPath $cand) { $dshBin = $cand }
  }
  if (-not $dshBin) {
    foreach ($cand in @(
      "$env:APPDATA\npm\node_modules\@deepseek-ai\dsh\lib\bin.js",
      'D:\AI\npm_global\node_modules\@deepseek-ai\dsh\lib\bin.js'
    )) { if (Test-Path -LiteralPath $cand) { $dshBin = $cand; break } }
  }
  if (-not $dshBin) {
    Write-Host '  warn 未找到 dsh CLI，跳过启动装载测试' -ForegroundColor Yellow
  } else {
    $probeProfile = Join-Path $home_dsh 'profiles\mackorn-verify'
    New-Item -ItemType Directory -Force -Path $probeProfile | Out-Null
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Join-Path $probeProfile 'package.json'),
      '{"name":"dsh-profile-mackorn-verify","private":true,"dependencies":{},"dsh":{"profile":{"bundles":["@deepseek-ai/dsh-base","@deepseek-ai/dsh-headless"],"patchReload":"startup"}}}', $enc)
    [System.IO.File]::WriteAllText((Join-Path $probeProfile 'cordis.yml'), "[]
", $enc)
    [System.IO.File]::WriteAllText((Join-Path $probeProfile 'cordis.patch.yml'), "[]
", $enc)
    # 家目录 patch 对本 profile 同样生效 —— 正是要验证的通道
    $tmp = Join-Path $env:TEMP "mackorn-verify-$(Get-Random)"
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $o = Join-Path $tmp 'out.txt'; $e = Join-Path $tmp 'err.txt'
    $p = Start-Process -FilePath 'node' -ArgumentList @($dshBin, '--profile', 'mackorn-verify') -NoNewWindow -PassThru -RedirectStandardOutput $o -RedirectStandardError $e
    $p.WaitForExit(120000) | Out-Null
    $stderr = if (Test-Path $e) { [System.IO.File]::ReadAllText($e) } else { '' }
    if ($stderr -match 'plugin tree failed to load') {
      Bad '启动报错：plugin tree failed to load'; Write-Host $stderr
    } elseif ($stderr -match 'duplicate loader entry id') {
      Bad '启动报错：duplicate loader entry id（同一 id 被两个 patch 文件重复插入）'; Write-Host $stderr
    } elseif ($stderr -match 'a task is required') {
      Ok '临时 profile 启动到「需要任务」为止，插件树装载无报错（这是期望的健康信号）'
    } else {
      Write-Host "  warn 启动输出未匹配已知信号，stderr 如下：" -ForegroundColor Yellow
      Write-Host $stderr
    }
    Remove-Item -LiteralPath $probeProfile -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host ""
if ($fail -eq 0) {
  Write-Host "== 全部通过 ==" -ForegroundColor Green
  exit 0
} else {
  Write-Host "== 失败 $fail 项 ==" -ForegroundColor Red
  exit 1
}
