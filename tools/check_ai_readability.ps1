# AI 可读性检测：逐条探测全球 AI 能不能读到 MACKORN 插件
# 检测的是"AI 会去看的那些地方"，不是"我们自己觉得做好了"
[CmdletBinding()]
param(
  [string]$Site = 'https://mackorn.cn',
  [string]$SiteHttps = 'https://mackorn.cn',
  [string]$Repo = 'LeifDai/MACKORN-hydraulic-cone-crusher',
  [string]$NpmPkg = 'mackorn-cone-crusher'
)
$ErrorActionPreference = 'Continue'
$h = @{ 'User-Agent' = 'Mozilla/5.0 (compatible; AI-Readability-Check/1.0)' }
$script:pass = 0
$script:fail = 0
$script:warn = 0

function Check($name, $ok, $detail) {
  # PowerShell 里 $true -eq 'warn' 会返回 True（非空字符串转布尔即 true），
  # 必须先判断是不是字符串，否则所有 OK 都会被误判成 warn。踩过这个坑。
  $isWarn = ($ok -is [string]) -and ($ok -eq 'warn')
  if ($isWarn)        { $script:warn++; Write-Host ("  [!]  {0,-44} {1}" -f $name, $detail) -ForegroundColor Yellow }
  elseif ($ok)        { $script:pass++; Write-Host ("  [OK] {0,-44} {1}" -f $name, $detail) -ForegroundColor Green }
  else                { $script:fail++; Write-Host ("  [XX] {0,-44} {1}" -f $name, $detail) -ForegroundColor Red }
}

function Get-Text($url, $timeout = 20) {
  try {
    $r = Invoke-WebRequest $url -Headers $h -UseBasicParsing -TimeoutSec $timeout
    return @{ ok = $true; code = $r.StatusCode; text = $r.Content; bytes = $r.RawContentLength }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = $_.Exception.Response.StatusCode.value__ }
    return @{ ok = $false; code = $code; text = ''; bytes = 0 }
  }
}

Write-Host ''
Write-Host '================================================================' -ForegroundColor Cyan
Write-Host '  AI 可读性检测 —— MACKORN 圆锥破插件' -ForegroundColor Cyan
Write-Host '================================================================' -ForegroundColor Cyan

# ---------- 1. 官网落地页 ----------
Write-Host ''
Write-Host '【1】官网落地页（AI 搜索的主要来源）' -ForegroundColor Cyan
$landing = Get-Text "$Site/ai/"
if (-not $landing.ok) { $landing = Get-Text "$SiteHttps/ai/" }
Check 'v /ai/ 可访问' $landing.ok ("HTTP " + $landing.code)
if ($landing.ok) {
  Check '  含 JSON-LD 结构化数据' ($landing.text -match 'application/ld\+json')
  Check '  含 SoftwareApplication' ($landing.text -match 'SoftwareApplication')
  Check '  含 FAQPage（易匹配提问）' ($landing.text -match 'FAQPage')
  Check '  含标题' ($landing.text -match '<title>')
  Check '  含 meta description' ($landing.text -match 'name="description"')
  Check '  含 canonical' ($landing.text -match 'rel="canonical"')
}

# ---------- 2. llms.txt ----------
Write-Host ''
Write-Host '【2】llms.txt（AI 爬虫专用摘要）' -ForegroundColor Cyan
$llmsSite = Get-Text "$Site/llms.txt"
if (-not $llmsSite.ok) { $llmsSite = Get-Text "$SiteHttps/llms.txt" }
Check 'v mackorn.cn/llms.txt 可访问' $llmsSite.ok ("HTTP " + $llmsSite.code + ", " + $llmsSite.bytes + " bytes")
$llmsRepo = Get-Text "https://raw.githubusercontent.com/$Repo/main/llms.txt"
if (-not $llmsRepo.ok) { $llmsRepo = Get-Text "https://api.github.com/repos/$Repo/contents/llms.txt" }
Check 'v 仓库 llms.txt 可访问' $llmsRepo.ok ("HTTP " + $llmsRepo.code)

# ---------- 3. robots.txt（最关键，最容易踩坑） ----------
Write-Host ''
Write-Host '【3】robots.txt —— AI 爬虫是否被放行（最容易踩的坑）' -ForegroundColor Cyan
$rb = Get-Text "$Site/robots.txt"
if (-not $rb.ok) { $rb = Get-Text "$SiteHttps/robots.txt" }
if (-not $rb.ok) {
  Check 'robots.txt' 'warn' ("读取失败 HTTP " + $rb.code + " —— 无 robots.txt 通常等于全部放行，但也可能是页面不存在")
} else {
  Check 'v robots.txt 存在' $true ($rb.bytes.ToString() + " bytes")
  $bots = @('GPTBot','OAI-SearchBot','ChatGPT-User','Google-Extended','ClaudeBot','anthropic-ai','PerplexityBot','Bytespider','Applebot-Extended')
  $blocked = @()
  foreach ($b in $bots) {
    # 粗略判断：该 UA 段落里出现 Disallow: / 即视为被屏蔽
    $m = [regex]::Match($rb.text, "(?is)User-agent:\s*$b\s*(.*?)(?=User-agent:|\z)")
    if ($m.Success -and $m.Groups[1].Value -match 'Disallow:\s*/\s*(\r?\n|$)') { $blocked += $b }
  }
  if ($blocked.Count -eq 0) { Check '  主流 AI 爬虫全部放行' $true ($bots.Count.ToString() + " 个 UA 均未被 / 级屏蔽") }
  else { Check '  主流 AI 爬虫被屏蔽' $false ("被屏蔽: " + ($blocked -join ', ')) }
}

# ---------- 4. GitHub 仓库（AI 训练数据与代码检索来源） ----------
Write-Host ''
Write-Host '【4】GitHub 仓库' -ForegroundColor Cyan
$gh = Get-Text "https://api.github.com/repos/$Repo"
Check 'v 仓库可公开访问' $gh.ok ("HTTP " + $gh.code)
if ($gh.ok) {
  try {
    $j = $gh.text | ConvertFrom-Json
    Check '  README 可读' $true ($j.description)
    # GitHub contents API 返回的是 base64，必须先解码再匹配（直接 match 是在匹配 base64 串）
    $pjResp = Get-Text "https://api.github.com/repos/$Repo/contents/package.json"
    $pjOk = $false
    if ($pjResp.ok) {
      try {
        $pjObj = $pjResp.text | ConvertFrom-Json
        $pjText = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($pjObj.content -replace "`n", '')))
        $pjOk = $pjText -match '"bundle"'
      } catch { }
    }
    Check '  声明 dsh.bundle（市场收录硬性要求）' $pjOk
    Check '  server.json 在仓库' ((Get-Text "https://api.github.com/repos/$Repo/contents/server.json").ok)
    Check '  cordis.patch.yml 在仓库' ((Get-Text "https://api.github.com/repos/$Repo/contents/cordis.patch.yml").ok)
  } catch { }
}

# ---------- 5. npm ----------
Write-Host ''
Write-Host '【5】npm（包管理器路径）' -ForegroundColor Cyan
$npm = Get-Text "https://registry.npmjs.org/$NpmPkg"
Check 'v npmjs 可读' $npm.ok ("HTTP " + $npm.code)
$npmcn = Get-Text "https://registry.npmmirror.com/$NpmPkg"
Check 'v npmmirror 国内镜像已同步' $npmcn.ok ("HTTP " + $npmcn.code)

# ---------- 6. MCP 注册表收录情况 ----------
Write-Host ''
Write-Host '【6】MCP 注册表 / 精选清单收录情况' -ForegroundColor Cyan
$mcpreg = Get-Text "https://registry.modelcontextprotocol.io/v0/servers?limit=100"
Check 'v MCP 官方注册表可查询' $mcpreg.ok ("HTTP " + $mcpreg.code)
if ($mcpreg.ok) {
  $found = $mcpreg.text -match 'mackorn'
  Check '  官方注册表已收录 mackorn' $found $(if ($found) { '已收录' } else { '尚未收录（等 DNS 记录 + publish）' })
}
$awesome = Get-Text "https://api.github.com/repos/punkpeye/awesome-mcp-servers/pulls/15410"
Check 'v awesome-mcp-servers PR 存在' $awesome.ok ("HTTP " + $awesome.code)

Write-Host ''
Write-Host '================================================================' -ForegroundColor Cyan
Write-Host ("  通过 {0} / 未通过 {1} / 待确认 {2}" -f $script:pass, $script:fail, $script:warn) -ForegroundColor Cyan
Write-Host '================================================================' -ForegroundColor Cyan
Write-Host ''
