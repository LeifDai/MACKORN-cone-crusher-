# 推送更新：主仓库文件 + 注册表条目（PR #6141 会自动更新）
[CmdletBinding()]
param(
  [string]$Owner = 'LeifDai',
  [string]$Repo  = 'MACKORN-hydraulic-cone-crusher',
  [string]$SourceDir = 'D:\DSH desktop\DSH destop工作区\MACKORN-DSH-Plugin\upload-ready',
  [string]$EntryFile = 'D:\DSH desktop\DSH destop工作区\MACKORN-DSH-Plugin\github-submission\LeifDai__MACKORN-hydraulic-cone-crusher.yml'
)
$ErrorActionPreference = 'Stop'
$token = $env:GITHUB_TOKEN
if (-not $token) { throw '请先设置 GITHUB_TOKEN' }
$H = @{ Authorization = "Bearer $($token.Trim())"; Accept = 'application/vnd.github+json'
        'X-GitHub-Api-Version' = '2022-11-28'; 'User-Agent' = 'mackorn-update' }

function ApiJson($method, $uri, $obj) {
  $json  = $obj | ConvertTo-Json -Depth 10 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  return Invoke-RestMethod -Uri $uri -Headers $H -Method $method -Body $bytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 90
}

Write-Host ''
Write-Host '  === 推送更新 ===' -ForegroundColor Cyan
$me = (Invoke-RestMethod 'https://api.github.com/user' -Headers $H -TimeoutSec 30).login
Write-Host "  已认证：$me"

# ---------- 1. 主仓库：只更新有变化的文件 ----------
Write-Host '  [1/2] 同步主仓库文件'
$files = Get-ChildItem -LiteralPath $SourceDir -Recurse -File | Where-Object { $_.Extension -ne '.tgz' } | Sort-Object FullName
$base = "https://api.github.com/repos/$Owner/$Repo/contents"
$changed = 0; $same = 0; $fail = @()
foreach ($f in $files) {
  $rel = $f.FullName.Substring($SourceDir.Length).TrimStart('\', '/').Replace('\', '/')
  $url = "$base/$rel"
  $remoteSha = $null; $remoteText = $null
  try {
    $ex = Invoke-RestMethod -Uri "$url`?ref=main" -Headers $H -Method Get -TimeoutSec 40
    $remoteSha = $ex.sha
    if ($ex.content) { $remoteText = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($ex.content -replace "`n", ''))) }
  } catch { }
  $localText = $null
  try { $localText = [IO.File]::ReadAllText($f.FullName) } catch { }
  if ($remoteText -ne $null -and $localText -ne $null) {
    $a = $remoteText -replace "`r`n", "`n"; $b = $localText -replace "`r`n", "`n"
    if ($a -eq $b) { $same++; continue }
  }
  $body = @{ message = "Update $rel"; branch = 'main'
             content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($f.FullName)) }
  if ($remoteSha) { $body.sha = $remoteSha }
  try { $null = ApiJson 'PUT' $url $body; $changed++ }
  catch { $fail += "$rel :: $($_.Exception.Message)" }
}
Write-Host "        更新 $changed 个 / 未变 $same 个 / 失败 $($fail.Count) 个"
$fail | ForEach-Object { Write-Host "          $_" -ForegroundColor Red }

# ---------- 2. 注册表条目（fork 里更新 -> PR 自动更新） ----------
Write-Host '  [2/2] 更新注册表条目'
$upRepo = 'awesome-dsh-plugin'
$entryPath = "data/plugins/${Owner}__${Repo}.yml"
$eUrl = "https://api.github.com/repos/$me/$upRepo/contents/$entryPath"
$sha = $null
try { $sha = (Invoke-RestMethod -Uri "$eUrl`?ref=main" -Headers $H -Method Get -TimeoutSec 40).sha } catch { }
$content = [IO.File]::ReadAllText($EntryFile)
$body = @{ message = 'Refine description: precise claims only'; branch = 'main'
           content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($content)) }
if ($sha) { $body.sha = $sha }
$null = ApiJson 'PUT' $eUrl $body
Write-Host "        条目已更新（PR #6141 自动跟随）" -ForegroundColor Green

# ---------- 3. 校验 ----------
Write-Host ''
Write-Host '  === 校验 ===' -ForegroundColor Cyan
Start-Sleep -Seconds 3
$pr = Invoke-RestMethod -Uri "https://api.github.com/repos/awesome-dsh-plugin/$upRepo/pulls/6141" -Headers $H -TimeoutSec 40
Write-Host "  PR #$($pr.number)  $($pr.state)  mergeable=$($pr.mergeable)  改动 $($pr.changed_files) 文件 +$($pr.additions)/-$($pr.deletions)"
Write-Host "  $($pr.html_url)"
$readme = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/contents/README.md" -Headers $H -TimeoutSec 40
$rt = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($readme.content -replace "`n", '')))
Write-Host "  README 含 Background 章节 : $($rt -match '## Background and credibility')"
Write-Host "  README 含 垂直领域论证章节 : $($rt -match '## Why a vertical-domain plugin')"
$ent = Invoke-RestMethod -Uri "$eUrl`?ref=main" -Headers $H -TimeoutSec 40
$et = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($ent.content -replace "`n", '')))
Write-Host '  --- 条目当前内容 ---'
$et -split "`n" | ForEach-Object { Write-Host "    $_" }
Write-Host ''
