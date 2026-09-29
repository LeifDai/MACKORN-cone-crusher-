<#
.SYNOPSIS
  MACKORN 插件 → GitHub 一键发布（上传文件 + 设置 Topics + Description + 官网链接 + 校验）

.DESCRIPTION
  为什么需要这个脚本：
    · 本机没有 git/gh，github.com 网页也被网络策略拦（只有 api.github.com 通）
    · GitHub 的 Topics 在网页上不好找（About 齿轮 / Settings 两处），而且只能一个个手输
    · 所以本脚本用 GitHub REST API **一次把所有事做完**，你只粘贴一次 Token

  它会做 5 件事：
    1. 校验 Token 与目标仓库
    2. 上传/更新仓库内全部文件（已存在的先取 sha 再覆盖）
    3. 设置 Topics（10 个，AI 搜索入口）
    4. 设置 Description 与官网链接（AI 爬虫权重高于 README）
    5. 回读校验：文件数、Topics、Description 是否真的生效

  用法（复制这一行即可）：
    powershell -ExecutionPolicy Bypass -File "<插件目录>\tools\github_publish.ps1"

  Token 怎么建（30 秒）：
    https://github.com/settings/personal-access-tokens/new
    → Repository access: Only select repositories → 选你的仓库
    → Permissions → Repository permissions →
        · Contents: Read and write        （上传文件）
        · Administration: Read and write  （设置 Topics/Description）
    → Generate token → 复制

  Token 只从安全输入框或环境变量读取，**不落盘、不打印、不进聊天记录**。
#>
[CmdletBinding()]
param(
  [string]$Owner = 'LeifDai',
  [string]$Repo  = 'MACKORN-hydraulic-cone-crusher',
  [string]$Branch = 'main',
  [string]$SourceDir,
  [switch]$SkipUpload,
  [switch]$SkipMeta
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# 上传源：优先用 upload-ready（已剔除 .tgz），否则用 dist 里的正式包
if (-not $SourceDir) {
  $a = Join-Path $Root 'upload-ready'
  $b = Join-Path $Root 'dist\mackorn-cone-crusher'
  $SourceDir = if (Test-Path -LiteralPath $a) { $a } else { $b }
}
if (-not (Test-Path -LiteralPath $SourceDir)) { throw "源目录不存在：$SourceDir" }

$ver = if (Test-Path (Join-Path $SourceDir 'VERSION')) { (Get-Content (Join-Path $SourceDir 'VERSION') -Raw).Trim() } else { 'unknown' }

# 要设置的元数据
$TOPICS = @('dsh-plugin','deepseek-harness','mcp','model-context-protocol','cone-crusher',
            'hydraulic-cone-crusher','mineral-processing','aggregate','crushing-and-screening','mackorn')
$DESCRIPTION = 'Hydraulic cone crusher selection, plant design and process simulation for AI - 19 tools, MCP server, 10 languages. By MACKORN.'
$HOMEPAGE = 'https://www.mackorn.cn'

Write-Host ''
Write-Host '  MACKORN 插件 -> GitHub 一键发布' -ForegroundColor Cyan
Write-Host "  仓库    : $Owner/$Repo   分支 $Branch"
Write-Host "  源目录  : $SourceDir"
Write-Host "  版本    : $ver"
Write-Host ''

# ---------- 1. 取 Token ----------
$token = $env:GITHUB_TOKEN
if (-not $token) {
  Write-Host '  请粘贴 GitHub 细粒度 Token（输入不回显）：' -ForegroundColor Yellow
  $sec = Read-Host -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
if (-not $token) { throw '未提供 Token，已中止' }
$token = $token.Trim()

$H = @{
  Authorization          = "Bearer $token"
  Accept                 = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent'           = 'mackorn-publisher'
}

# ---------- 2. 校验 ----------
try {
  $me = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $H -TimeoutSec 30
  Write-Host "  [1/5] 已认证为：$($me.login)" -ForegroundColor Green
} catch { throw "Token 无效：$($_.Exception.Message)" }

try {
  $r = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo" -Headers $H -TimeoutSec 30
  Write-Host "        仓库：$($r.full_name)（$($r.visibility)）默认分支 $($r.default_branch)"
  if ($r.default_branch) { $Branch = $r.default_branch }
  Write-Host "        当前 Topics: $(if($r.topics){$r.topics -join ' '}else{'（空）'})"
  Write-Host "        当前 Description: $(if($r.description){$r.description}else{'（空）'})"
} catch { throw "访问仓库 $Owner/$Repo 失败：$($_.Exception.Message)" }

$api = "https://api.github.com/repos/$Owner/$Repo/contents"

# ---------- 3. 上传 / 更新文件 ----------
if ($SkipUpload) {
  Write-Host '  [2/5] 跳过文件上传（-SkipUpload）' -ForegroundColor Yellow
} else {
  $files = Get-ChildItem -LiteralPath $SourceDir -Recurse -File |
    Where-Object { $_.Extension -ne '.tgz' } | Sort-Object FullName
  Write-Host "  [2/5] 上传 $($files.Count) 个文件…" -ForegroundColor Cyan
  $ok = 0; $fail = 0; $failList = @()
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($SourceDir.Length).TrimStart('\', '/').Replace('\', '/')
    $url = "$api/$rel"
    $sha = $null
    try { $sha = (Invoke-RestMethod -Uri "$url`?ref=$Branch" -Headers $H -Method Get -TimeoutSec 30).sha } catch { $sha = $null }
    $body = @{ message = "MACKORN $ver - update $rel"; branch = $Branch
               content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($f.FullName)) }
    if ($sha) { $body.sha = $sha }
    try {
      Invoke-RestMethod -Uri $url -Headers $H -Method Put -Body ($body | ConvertTo-Json -Compress) -ContentType 'application/json' -TimeoutSec 90 | Out-Null
      $ok++
    } catch { $fail++; $failList += "$rel  ($($_.Exception.Message))" }
  }
  if ($fail -eq 0) { Write-Host "        $ok 成功 / 0 失败" -ForegroundColor Green }
  else {
    Write-Host "        $ok 成功 / $fail 失败" -ForegroundColor Red
    $failList | ForEach-Object { Write-Host "          $_" -ForegroundColor Red }
  }
}

# ---------- 4. 设置 Topics / Description / 官网 ----------
if ($SkipMeta) {
  Write-Host '  [3/5] 跳过元数据设置（-SkipMeta）' -ForegroundColor Yellow
} else {
  # Topics：需要单独端点
  try {
    $body = @{ names = $TOPICS } | ConvertTo-Json -Compress
    $tr = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/topics" -Headers $H -Method Put -Body $body -ContentType 'application/json' -TimeoutSec 40
    Write-Host "  [3/5] Topics 已设置（$($tr.names.Count) 个）：$($tr.names -join ' ')" -ForegroundColor Green
  } catch {
    Write-Host "  [3/5] Topics 设置失败：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host "        多为 Token 缺 Administration: Read and write 权限（Contents 权限不够）" -ForegroundColor Yellow
    Write-Host "        兜底：网页 https://github.com/$Owner/$Repo/settings → 第一个 General 区块里的 Topics 框" -ForegroundColor Yellow
  }

  # Description + homepage：仓库 PATCH
  try {
    $body = @{ description = $DESCRIPTION; homepage = $HOMEPAGE } | ConvertTo-Json -Compress
    $pr = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo" -Headers $H -Method Patch -Body $body -ContentType 'application/json' -TimeoutSec 40
    Write-Host '  [4/5] Description 与官网链接已设置' -ForegroundColor Green
    Write-Host "        $($pr.description)"
    Write-Host "        homepage: $($pr.homepage)"
  } catch {
    Write-Host "  [4/5] Description 设置失败：$($_.Exception.Message)" -ForegroundColor Red
  }
}

# ---------- 5. 回读校验 ----------
Write-Host '  [5/5] 回读校验…' -ForegroundColor Cyan
Start-Sleep -Seconds 2
try {
  $v = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo" -Headers $H -TimeoutSec 30
  $tree = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/git/trees/$Branch`?recursive=1" -Headers $H -TimeoutSec 40
  $count = ($tree.tree | Where-Object { $_.type -eq 'blob' }).Count
  Write-Host ''
  Write-Host '  ===== 发布结果 =====' -ForegroundColor Cyan
  Write-Host "  仓库          : https://github.com/$Owner/$Repo"
  Write-Host "  可见性        : $($v.visibility)"
  Write-Host "  文件数        : $count"
  Write-Host "  Topics        : $(if($v.topics){$v.topics -join ' '}else{'（空 — 见上方失败原因）'})"
  Write-Host "  Description   : $(if($v.description){$v.description}else{'（空）'})"
  Write-Host "  Homepage      : $(if($v.homepage){$v.homepage}else{'（空）'})"
  Write-Host ''
  Write-Host '  最后一步（只能你在浏览器里做，1 分钟）：' -ForegroundColor Yellow
  Write-Host '    发项目介绍帖，让 DSH 社区看到：'
  Write-Host '    https://github.com/deepseek-ai/deepseek-harness/discussions'
  Write-Host '    New discussion -> 分类 Show Your Plugins!'
  Write-Host ''
} catch {
  Write-Host "  回读失败（不影响已完成的设置）：$($_.Exception.Message)" -ForegroundColor Yellow
}
