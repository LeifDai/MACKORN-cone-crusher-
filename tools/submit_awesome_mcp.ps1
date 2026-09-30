# 自动向 awesome-mcp-servers（⭐95,704）提交 PR
# 流程：fork → 下载 README → 在「Industrial & IoT」分类插入条目 → 提交 → 开 PR
[CmdletBinding()]
param(
  [string]$UpstreamOwner = 'punkpeye',
  [string]$UpstreamRepo  = 'awesome-mcp-servers',
  [string]$MyRepo        = 'MACKORN-hydraulic-cone-crusher'
)
$ErrorActionPreference = 'Stop'
$token = $env:GITHUB_TOKEN
if (-not $token) { throw '请先设置 GITHUB_TOKEN' }
$H = @{ Authorization = "Bearer $($token.Trim())"; Accept = 'application/vnd.github+json'
        'X-GitHub-Api-Version' = '2022-11-28'; 'User-Agent' = 'mackorn-mcp-pr' }
$Hraw = @{ Authorization = "Bearer $($token.Trim())"; Accept = 'application/vnd.github.raw'
           'X-GitHub-Api-Version' = '2022-11-28'; 'User-Agent' = 'mackorn-mcp-pr' }

function J($method, $uri, $obj) {
  $p = @{ Uri = $uri; Headers = $H; Method = $method; TimeoutSec = 180 }
  if ($obj) { $p.Body = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Depth 10 -Compress)); $p.ContentType = 'application/json; charset=utf-8' }
  return Invoke-RestMethod @p
}

$me = (J 'GET' 'https://api.github.com/user' $null).login
Write-Host "  已认证: $me" -ForegroundColor Green

# ---------- 1. Fork ----------
Write-Host '  [1/5] Fork 上游仓库'
$forkReady = $false
try { $null = J 'GET' "https://api.github.com/repos/$me/$UpstreamRepo" $null; $forkReady = $true; Write-Host '        已有 fork' }
catch { }
if (-not $forkReady) {
  try { $null = J 'POST' "https://api.github.com/repos/$UpstreamOwner/$UpstreamRepo/forks" @{}; Write-Host '        已发起 fork，等待就绪…' }
  catch { Write-Host "        fork 请求: $($_.Exception.Message)" }
}
for ($i = 1; $i -le 30; $i++) {
  Start-Sleep -Seconds 3
  try { $null = J 'GET' "https://api.github.com/repos/$me/$UpstreamRepo" $null; $forkReady = $true; break } catch { }
}
if (-not $forkReady) { throw '等待 fork 就绪超时' }
Write-Host '        fork 就绪' -ForegroundColor Green

# ---------- 2. 取 README 并同步 fork 到上游最新 ----------
Write-Host '  [2/5] 取 README'
$upHead = (J 'GET' "https://api.github.com/repos/$UpstreamOwner/$UpstreamRepo/commits/main" $null).sha
# 下载到文件再按 UTF-8 读（PS 5.1 直接读响应会丢换行，踩过；且 PS 5.1 无三元运算符）
$tmp = Join-Path $env:TEMP 'awesome-mcp-readme.md'
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
Invoke-WebRequest "https://api.github.com/repos/$UpstreamOwner/$UpstreamRepo/contents/README.md" -Headers $Hraw -OutFile $tmp -UseBasicParsing -TimeoutSec 180
$text = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($tmp))
Write-Host ("        README {0:N0} 字符，换行 {1}" -f $text.Length, ([regex]::Matches($text, "`n")).Count)

# ---------- 3. 插入条目 ----------
Write-Host '  [3/5] 在 Industrial & IoT 分类插入条目'
$entry = "- [LeifDai/$MyRepo](https://github.com/LeifDai/$MyRepo) [![LeifDai/$MyRepo MCP server](https://glama.ai/mcp/servers/LeifDai/$MyRepo/badges/score.svg)](https://glama.ai/mcp/servers/LeifDai/$MyRepo) 📇 🏠 🍎 🪟 🐧 - Cone crusher selection and crushing-plant design for MACKORN NH/NS hydraulic cone crushers: requirement-form intake, equipment selection, plant configuration, proposal generation, product-size simulation and field-data calibration. 19 tools, 6 skills."

if ($text -match [regex]::Escape("LeifDai/$MyRepo")) { throw '条目已存在，无需重复提交' }

$anchor = [regex]::Match($text, '(?m)^###\s+.{0,80}Industrial & IoT\s*$')
if (-not $anchor.Success) { throw '找不到 Industrial & IoT 分类标题' }
$afterHeader = $text.Substring($anchor.Index + $anchor.Length)
$nextSec = [regex]::Match($afterHeader, '(?m)^###\s+')
$insertAt = if ($nextSec.Success) { $anchor.Index + $anchor.Length + $nextSec.Index } else { $text.Length }
$section = $text.Substring($anchor.Index, $insertAt - $anchor.Index)
Write-Host ("        分类区间 {0:N0} 字符，现有条目 {1} 条" -f $section.Length, ([regex]::Matches($section, '(?m)^\s*-\s*\[')).Count)

# 在分类标题后的第一个空行之后插入
$headEnd = $section.IndexOf("`n")
$firstItem = [regex]::Match($section, '(?m)^\s*-\s*\[')
if ($firstItem.Success) {
  $abs = $anchor.Index + $firstItem.Index
  $newText = $text.Substring(0, $abs) + $entry + "`n" + $text.Substring($abs)
} else {
  $abs = $anchor.Index + $headEnd + 1
  $newText = $text.Substring(0, $abs) + "`n" + $entry + "`n" + $text.Substring($abs)
}
Write-Host ("        插入后 {0:N0} → {1:N0} 字符" -f $text.Length, $newText.Length)

# ---------- 4. 提交到 fork ----------
Write-Host '  [4/5] 提交到你的 fork'
$cUrl = "https://api.github.com/repos/$me/$UpstreamRepo/contents/README.md"
$sha = $null
try { $sha = (J 'GET' "$cUrl`?ref=main" $null).sha } catch { }
$bytes = [Text.Encoding]::UTF8.GetBytes($newText)
$body = @{ message = "Add LeifDai/$MyRepo (Industrial & IoT)"; branch = 'main'
           content = [Convert]::ToBase64String($bytes) }
if ($sha) { $body.sha = $sha }
$null = J 'PUT' $cUrl $body
Write-Host '        已提交' -ForegroundColor Green

# ---------- 5. 开 PR ----------
Write-Host '  [5/5] 开 Pull Request'
Start-Sleep -Seconds 5
$prBody = @"
## What this adds

**LeifDai/MACKORN-hydraulic-cone-crusher** — an MCP server for hydraulic cone crusher selection and
crushing-plant design, in the **Industrial & IoT** category.

- **19 tools / 6 skills**, zero runtime dependencies, stdio transport
- Published on npm: ``mackorn-cone-crusher`` — ``npx mackorn-cone-crusher`` / ``node node_modules/mackorn-cone-crusher/plugin/mcp-server.mjs``
- Domain: aggregate and metal-mine crushing & screening circuits (cone crusher model / cavity / CSS
  selection, plant stage configuration, product-size simulation, field-data calibration, proposal generation)
- TypeScript/JavaScript codebase, local stdio server, cross-platform (Node.js >= 18)

## Checklist

- [x] Entry follows the list format and sits in the correct section
- [x] Repository is public and contains real, working code (15 plugin files, 6 skills, 138 passing assertions including 8 negative controls)
- [x] ``package.json`` declares a ``dsh.bundle`` manifest and ``server.json`` for the official MCP registry
- [x] Description covers what the server does; no marketing language
- [x] Only this one entry is added — no unrelated lines touched

Repository: https://github.com/LeifDai/$MyRepo
npm: https://www.npmjs.com/package/mackorn-cone-crusher
"@
$existing = J 'GET' "https://api.github.com/repos/$UpstreamOwner/$UpstreamRepo/pulls?state=open&head=$me`:main" $null
if ($existing -and $existing.Count -gt 0) {
  Write-Host "        已存在开放 PR：#$($existing[0].number)  $($existing[0].html_url)" -ForegroundColor Yellow
} else {
  $pr = J 'POST' "https://api.github.com/repos/$UpstreamOwner/$UpstreamRepo/pulls" @{
    title = "Add LeifDai/$MyRepo - hydraulic cone crusher selection MCP server"
    head  = "$me`:main"; base = 'main'; body = $prBody; maintainer_can_modify = $true }
  Write-Host "        PR 已创建：#$($pr.number)" -ForegroundColor Green
  Write-Host "        $($pr.html_url)" -ForegroundColor Green
}
