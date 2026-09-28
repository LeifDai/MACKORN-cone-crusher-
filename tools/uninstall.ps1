<#
.SYNOPSIS
  MACKORN 液压圆锥破碎机生产线选型插件 · 卸载脚本

.DESCRIPTION
  完全撤销 install.ps1 的改动：
    1. 从 $DSH_HOME\cordis.patch.yml 删除带标记的区块（其余内容原样保留）
    2. 删除 $DSH_HOME\plugins\mackorn-cone-crusher\
    3. 删除 $DSH_HOME\skills\mackorn-*\ 与 $DSH_HOME\skills\dsh-industry-plugin-blueprint\
  执行前自动备份 patch 文件；不会触碰任何其它插件或技能。

.PARAMETER DshHome
  DeepSeek Harness 家目录。默认取 $env:DSH_HOME，否则 $env:USERPROFILE\.dsh

.PARAMETER KeepSkills
  只卸载工具插件，保留技能包。
#>
[CmdletBinding()]
param(
  [string]$DshHome,
  [switch]$KeepSkills
)

$ErrorActionPreference = 'Stop'
$Marker = 'mackorn-cone-crusher'
$PluginDirName = 'mackorn-cone-crusher'
$SkillNames = @('mackorn-cone-crusher-selection', 'mackorn-crushing-plant-design', 'mackorn-market-depth', 'dsh-industry-plugin-blueprint')
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Resolve-DshHome([string]$Explicit) {
  if ($Explicit) { return $Explicit }
  if ($env:DSH_HOME) { return $env:DSH_HOME }
  return (Join-Path $env:USERPROFILE '.dsh')
}

$home_dsh = Resolve-DshHome $DshHome
Write-Host "== MACKORN DSH 插件卸载 ==" -ForegroundColor Cyan
Write-Host "  DSH_HOME: $home_dsh"

if (-not (Test-Path -LiteralPath $home_dsh)) { throw "DSH 家目录不存在：$home_dsh" }

# ---------- 1. 从 patch 文件移除标记区块 ----------
$patchPath = Join-Path $home_dsh 'cordis.patch.yml'
if (Test-Path -LiteralPath $patchPath) {
  $content = [System.IO.File]::ReadAllText($patchPath)
  $pattern = "(?ms)^\s*#\s*>>>\s*$([regex]::Escape($Marker)).*?^\s*#\s*<<<\s*$([regex]::Escape($Marker))\s*<<<[^\r\n]*\r?\n?"
  if ($content -match $pattern) {
    $backup = "$patchPath.mackorn-uninstall-backup-$(Get-Date -Format yyyyMMdd-HHmmss)"
    Copy-Item -LiteralPath $patchPath -Destination $backup -Force
    $new = [regex]::Replace($content, $pattern, '')
    if ($new.Trim() -eq '') { $new = "[]`n" }
    [System.IO.File]::WriteAllText($patchPath, $new, $Utf8NoBom)
    Write-Host "  [1/3] 已从 patch 移除 $Marker 区块（备份：$backup）" -ForegroundColor Green
  } else {
    Write-Host "  [1/3] patch 中未找到 $Marker 标记区块，跳过" -ForegroundColor Yellow
  }
} else {
  Write-Host "  [1/3] patch 文件不存在，跳过" -ForegroundColor Yellow
}

# ---------- 2. 删除工具插件目录 ----------
$dstPlugin = Join-Path $home_dsh "plugins\$PluginDirName"
if (Test-Path -LiteralPath $dstPlugin) {
  Remove-Item -LiteralPath $dstPlugin -Recurse -Force
  Write-Host "  [2/3] 已删除 $dstPlugin" -ForegroundColor Green
} else {
  Write-Host "  [2/3] 插件目录不存在，跳过" -ForegroundColor Yellow
}

# ---------- 3. 删除技能包 ----------
if ($KeepSkills) {
  Write-Host "  [3/3] 保留技能包（-KeepSkills）" -ForegroundColor Yellow
} else {
  $removed = 0
  foreach ($skill in $SkillNames) {
    $target = Join-Path (Join-Path $home_dsh 'skills') $skill
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force; $removed++; Write-Host "        已删除 $target" -ForegroundColor Green }
  }
  Write-Host "  [3/3] 共删除 $removed 个技能包" -ForegroundColor Green
}

Write-Host ""
Write-Host "卸载完成。patch 文件与技能目录热重载，通常无需重启。" -ForegroundColor Cyan
