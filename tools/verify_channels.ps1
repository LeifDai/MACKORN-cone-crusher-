# 两个通道的端到端验证：npm 安装 + MCP 服务器真实协议握手
$ErrorActionPreference = 'Continue'
Remove-Item Env:\NPM_CONFIG_USERCONFIG -ErrorAction SilentlyContinue

$t = Join-Path $env:TEMP ("mackorn-verify-" + (Get-Random))
New-Item -ItemType Directory -Force -Path $t | Out-Null
Push-Location $t

Write-Host ''
Write-Host '################  通道 1：npm  ################' -ForegroundColor Cyan
& npm init -y 2>&1 | Out-Null
$sw = [Diagnostics.Stopwatch]::StartNew()
$ins = & npm i mackorn-cone-crusher 2>&1
$sw.Stop()
$ins | Where-Object { $_ -match 'added|error|warn' } | Select-Object -First 4 | ForEach-Object { Write-Host "  $_" }
Write-Host ("  安装耗时: {0:N1} 秒" -f $sw.Elapsed.TotalSeconds)

$pkg = Join-Path $t 'node_modules\mackorn-cone-crusher'
Write-Host ''
Write-Host '  --- 安装结果核对 ---'
if (-not (Test-Path $pkg)) { Write-Host '  ❌ 未安装成功' -ForegroundColor Red; Pop-Location; exit 1 }
$installedVer = (Get-Content (Join-Path $pkg 'package.json') -Raw | ConvertFrom-Json).version
Write-Host ("  版本        : {0}" -f $installedVer)
Write-Host ("  文件总数    : {0}" -f (Get-ChildItem $pkg -Recurse -File).Count)
foreach ($f in @('package.json','cordis.patch.yml','llms.txt','README.md','LICENSE',
                 'plugin\index.mjs','plugin\mcp-server.mjs','plugin\lib\simulate.mjs',
                 'plugin\lib\calibrate.mjs','plugin\lib\contact-i18n.mjs','plugin\lib\calibration-store.mjs',
                 'assets\mackorn-logo.jpg','assets\mackorn-wechat-qr.jpg',
                 'skills\mackorn-plant-simulation\SKILL.md','knowledge\equipment-nh-ns.json')) {
  $ok = Test-Path (Join-Path $pkg $f)
  Write-Host ("  {0} {1}" -f $(if ($ok) { 'OK  ' } else { 'MISS' }), $f)
}

Push-Location $pkg
Write-Host ''
Write-Host '  --- package.json 的 dsh 字段（市场收录硬性要求）---'
$pj = Get-Content (Join-Path $pkg 'package.json') -Raw | ConvertFrom-Json
Write-Host ("  dsh = {0}" -f ($pj.dsh | ConvertTo-Json -Compress))
Pop-Location

Write-Host ''
Write-Host '################  通道 2：MCP 服务器  ################' -ForegroundColor Cyan
$srv = Join-Path $pkg 'plugin\mcp-server.mjs'

Write-Host ''
Write-Host '  --- 2a. --list（工具清单）---'
$listOut = & node $srv --list 2>&1
$listOut | Select-Object -Last 1 | ForEach-Object { Write-Host "  $_" }

Write-Host ''
Write-Host '  --- 2b. --selftest（协议 + 全工具自检）---'
$selfOut = & node $srv --selftest 2>&1
$selfOut | Select-Object -Last 1 | ForEach-Object { Write-Host "  $_" }

Write-Host ''
Write-Host '  --- 2c. 真实 MCP 协议握手（stdio JSON-RPC）---'
$lines = @(
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}'
  '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"mackorn_contact","arguments":{"language":"es","include_partner":false}}}'
  '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"mackorn_crusher_curve","arguments":{"css_mm":16,"feed_p80_mm":90,"bond_wi":14}}}'
)
$stdin = ($lines -join "`n") + "`n"
$raw = $stdin | & node $srv 2>$null
$outLines = @($raw)

Write-Host ("  收到响应行数: {0}" -f $outLines.Count)
foreach ($ln in $outLines) {
  try {
    $o = $ln | ConvertFrom-Json
    if ($o.id -eq 1) {
      Write-Host ("  [initialize]  serverInfo = {0} {1}  protocol = {2}" -f $o.result.serverInfo.name, $o.result.serverInfo.version, $o.result.protocolVersion)
    } elseif ($o.id -eq 2) {
      Write-Host ("  [tools/list]  {0} 个工具" -f $o.result.tools.Count)
      Write-Host ("                前 6 个: {0}" -f (($o.result.tools | Select-Object -First 6 | ForEach-Object { $_.name }) -join ', '))
    } elseif ($o.id -eq 3) {
      $txt = $o.result.content[0].text
      $head = ($txt -split "`n" | Select-Object -First 3) -join ' | '
      Write-Host ("  [tools/call mackorn_contact es] ✅ 返回 {0} 字符" -f $txt.Length)
      Write-Host ("                {0}" -f $head)
    } elseif ($o.id -eq 4) {
      $txt = $o.result.content[0].text
      $m = [regex]::Match($txt, '"product_p80_mm":\s*([0-9.]+)')
      Write-Host ("  [tools/call mackorn_crusher_curve] ✅ 产品 P80 = {0} mm" -f $(if ($m.Success) { $m.Groups[1].Value } else { '?' }))
    } elseif ($o.error) {
      Write-Host ("  [error id={0}] {1}" -f $o.id, $o.error.message) -ForegroundColor Red
    }
  } catch {
    if ($ln.Trim()) { Write-Host ("  (非 JSON 行) {0}" -f $ln.Substring(0, [Math]::Min(80, $ln.Length))) }
  }
}

Pop-Location
# 先在清理前记录结论——否则删掉临时目录后 Test-Path 会误报"失败"（这个坑踩过一次）
$ch1ok = Test-Path $pkg
$ch1files = if ($ch1ok) { (Get-ChildItem $pkg -Recurse -File).Count } else { 0 }
$ch2ok = ($outLines.Count -ge 4)
Remove-Item $t -Recurse -Force -ErrorAction SilentlyContinue
Write-Host ''
Write-Host '################  结论  ################' -ForegroundColor Cyan
Write-Host ("  通道 1  npm i mackorn-cone-crusher      : {0}   ({1} 个文件, v{2})" -f $(if ($ch1ok) { '通过' } else { '失败' }), $ch1files, $installedVer)
Write-Host ("  通道 2  node .../plugin/mcp-server.mjs  : {0}" -f $(if ($ch2ok) { '通过   (真实 stdio JSON-RPC: initialize + tools/list + 2x tools/call)' } else { '待确认' }))
Write-Host ''
