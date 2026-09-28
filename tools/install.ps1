<#
  MACKORN 圆锥破插件 · 安装脚本（install.ps1）
  ========================================================================
  做四件事：
    1. 复制工具插件到 $DSH_HOME\plugins\mackorn-cone-crusher
    2. 往 $DSH_HOME\cordis.patch.yml 插入带标记的相对路径行（幂等，自动备份）
    3. 复制技能包到 $DSH_HOME\skills\<skill>
    4. 刷新 patch 修订标记触发热重载，并校验复制完整性（不一致自动重试）

  关键约束（踩过坑，别改）：
    · patch 的 insert.name 必须是**相对路径**（以 ./ 开头），
      绝对路径会被 loader 静默忽略。
    · 只改插件文件内容**不会**触发重载：loader 监听的是 patch 文件本身，
      所以每次都要刷新修订标记。
    · dsh 进程会占用插件文件，Copy-Item 可能静默失败 →
      必须哈希校验 + 重试。
#>
[CmdletBinding()]
param(
  [string]$DshHome,
  [switch]$NoSkills
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Marker = 'mackorn-cone-crusher'
$PluginDirName = 'mackorn-cone-crusher'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# 家目录：参数 > 环境变量 > 用户默认
$home_dsh = if ($DshHome) { $DshHome }
            elseif ($env:DSH_HOME) { $env:DSH_HOME }
            else { Join-Path $env:USERPROFILE '.dsh' }

Write-Host ''
Write-Host '== MACKORN DSH 插件安装 ==' -ForegroundColor Cyan
Write-Host "  源目录  : $Root"
Write-Host "  DSH_HOME: $home_dsh"

if (-not (Test-Path -LiteralPath $home_dsh)) {
  throw "DSH 家目录不存在：$home_dsh（请先运行一次 DeepSeek Harness，或用 -DshHome 指定）"
}

# ---------- 1. 复制工具插件 ----------
$srcPlugin = Join-Path $Root 'plugin'
if (-not (Test-Path -LiteralPath (Join-Path $srcPlugin 'index.mjs'))) {
  throw "找不到插件源文件：$srcPlugin\index.mjs"
}
$dstPlugin = Join-Path $home_dsh "plugins\$PluginDirName"
New-Item -ItemType Directory -Force -Path $dstPlugin | Out-Null
Copy-Item -Path (Join-Path $srcPlugin '*') -Destination $dstPlugin -Recurse -Force
Write-Host "  [1/4] 工具插件 -> $dstPlugin" -ForegroundColor Green

# ---------- 2. 写入家目录 patch 行（带标记，幂等） ----------
$patchPath = Join-Path $home_dsh 'cordis.patch.yml'
$block = @"
# >>> $Marker (managed by MACKORN install.ps1 - 请勿手工编辑本区块) >>>
- insert:
    - id: $Marker
      name: './plugins/$PluginDirName/index.mjs'
# <<< $Marker <<<
"@

function Write-Utf8($path, $text) {
  [System.IO.File]::WriteAllText($path, $text, $Utf8NoBom)
}

$existing = ''
if (Test-Path -LiteralPath $patchPath) {
  $existing = [System.IO.File]::ReadAllText($patchPath)
  if ($existing -match [regex]::Escape(">>> $Marker")) {
    Write-Host "  [2/4] 家目录 patch 已存在 $Marker 区块，跳过插入" -ForegroundColor Yellow
  } else {
    $backup = "$patchPath.mackorn-backup-$(Get-Date -Format yyyyMMdd-HHmmss)"
    Copy-Item -LiteralPath $patchPath -Destination $backup -Force
    Write-Host "  [2/4] 已备份原 patch -> $backup" -ForegroundColor Green
    $trimmed = $existing.Trim()
    if ($trimmed -eq '' -or $trimmed -eq '[]') {
      Write-Utf8 $patchPath ($block + "`n")
    } else {
      Write-Utf8 $patchPath ($existing.TrimEnd() + "`n`n" + $block + "`n")
    }
    Write-Host "  [2/4] 已插入 $Marker 到 $patchPath" -ForegroundColor Green
  }
} else {
  Write-Utf8 $patchPath ($block + "`n")
  Write-Host "  [2/4] 已创建 $patchPath 并插入 $Marker" -ForegroundColor Green
}

# ---------- 3. 复制技能包 ----------
if ($NoSkills) {
  Write-Host '  [3/4] 跳过技能包（-NoSkills）' -ForegroundColor Yellow
} else {
  $srcSkills = Join-Path $Root 'skills'
  $dstSkills = Join-Path $home_dsh 'skills'
  New-Item -ItemType Directory -Force -Path $dstSkills | Out-Null
  $n = 0
  if (Test-Path -LiteralPath $srcSkills) {
    foreach ($d in (Get-ChildItem -LiteralPath $srcSkills -Directory)) {
      $target = Join-Path $dstSkills $d.Name
      New-Item -ItemType Directory -Force -Path $target | Out-Null
      Copy-Item -Path (Join-Path $d.FullName '*') -Destination $target -Recurse -Force
      Write-Host "        技能 -> $($d.Name)"
      $n++
    }
  }
  Write-Host "  [3/4] 共安装 $n 个技能包" -ForegroundColor Green
}

# ---------- 4. 刷新 patch 修订标记 + 校验复制完整性（自动重试） ----------
if (Test-Path -LiteralPath $patchPath) {
  $cur = [System.IO.File]::ReadAllText($patchPath)
  $cur = [regex]::Replace($cur, '(?m)^# rev \S+ mackorn-cone-crusher\s*\r?\n', '')
  $revMark = "# rev $(Get-Date -Format yyyyMMdd-HHmmss) mackorn-cone-crusher"
  Write-Utf8 $patchPath ($cur.TrimEnd() + "`n" + $revMark + "`n")
}

$mismatch = @()
for ($attempt = 1; $attempt -le 3; $attempt++) {
  $mismatch = @()
  foreach ($sf in (Get-ChildItem -LiteralPath $srcPlugin -Recurse -File)) {
    $rel = $sf.FullName.Substring($srcPlugin.Length).TrimStart('\', '/')
    $df = Join-Path $dstPlugin $rel
    if (-not (Test-Path -LiteralPath $df)) { $mismatch += $rel; continue }
    if ((Get-FileHash -LiteralPath $sf.FullName).Hash -ne (Get-FileHash -LiteralPath $df).Hash) { $mismatch += $rel }
  }
  if ($mismatch.Count -eq 0) { break }
  if ($attempt -lt 3) {
    Write-Host "  [4/4] 第 $attempt 次校验发现 $($mismatch.Count) 个文件不一致，重试复制…" -ForegroundColor Yellow
    foreach ($rel in $mismatch) {
      $s = Join-Path $srcPlugin $rel
      $d = Join-Path $dstPlugin $rel
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $d) | Out-Null
      Copy-Item -LiteralPath $s -Destination $d -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 800
  }
}

if ($mismatch.Count -eq 0) {
  Write-Host "  [4/4] 已刷新 patch 修订标记；复制完整性校验通过（0 处不一致）" -ForegroundColor Green
} else {
  Write-Host ''
  Write-Host "  !!! 复制不完整，重试 3 次后仍不一致：" -ForegroundColor Red
  $mismatch | ForEach-Object { Write-Host "      $_" -ForegroundColor Red }
  Write-Host '  多半是 dsh 进程占用了文件。请【完全退出 DeepSeek Harness】后重跑本脚本。' -ForegroundColor Yellow
  exit 1
}

Write-Host ''
Write-Host '安装完成。生效方式：' -ForegroundColor Cyan
Write-Host '  · patch 文件与技能目录都由 dsh 监听，配置热重载，通常无需重启。'
Write-Host '  · 若当前会话看不到新工具，新开一个会话即可（工具清单按轮次装配）。'
Write-Host "  · 自检：powershell -ExecutionPolicy Bypass -File `"$Root\tools\verify.ps1`""
Write-Host "  · 卸载：powershell -ExecutionPolicy Bypass -File `"$Root\tools\uninstall.ps1`""
