# 分析 awesome-dsh-plugin 的审核机制、通过者特征与被拒原因
$ErrorActionPreference = 'Continue'
$h = @{ 'User-Agent' = 'probe' }
$api = 'https://api.github.com/repos/awesome-dsh-plugin/awesome-dsh-plugin'

Write-Host '=== 1) 谁在合并 PR（最近 100 个已关闭） ==='
$closed = Invoke-RestMethod "$api/pulls?state=closed&sort=updated&direction=desc&per_page=100" -Headers $h -TimeoutSec 40
$merged = @($closed | Where-Object { $_.merged_at })
Write-Host ("  关闭 {0} / 已合并 {1} / 被拒 {2}" -f $closed.Count, $merged.Count, ($closed.Count - $merged.Count))
$merged | Group-Object { $_.merged_by.login } | Sort-Object Count -Descending | Select-Object -First 8 |
  ForEach-Object { Write-Host ("    合并人 {0} : {1} 个" -f $_.Name, $_.Count) }

Write-Host ''
Write-Host '=== 2) 已合并 PR 的作者分布 ==='
$merged | Group-Object { $_.user.login } | Sort-Object Count -Descending | Select-Object -First 10 |
  ForEach-Object { Write-Host ("    {0} : {1} 个" -f $_.Name, $_.Count) }

Write-Host ''
Write-Host '=== 3) 被拒 PR 样本 ==='
$rejected = @($closed | Where-Object { -not $_.merged_at })
$rejected | Select-Object -First 12 | ForEach-Object {
  $t = $_.title; if ($t.Length -gt 70) { $t = $t.Substring(0, 70) }
  Write-Host ("    #{0} [{1}] {2}" -f $_.number, $_.user.login, $t)
}

Write-Host ''
Write-Host '=== 4) 被拒原因（读评论） ==='
$shown = 0
foreach ($p in $rejected) {
  if ($shown -ge 6) { break }
  try {
    $cm = Invoke-RestMethod "$api/issues/$($p.number)/comments" -Headers $h -TimeoutSec 20
    if ($cm.Count -gt 0) {
      $shown++
      Write-Host ("  --- #{0} ---" -f $p.number)
      $body = $cm[-1].body
      if ($body.Length -gt 320) { $body = $body.Substring(0, 320) }
      Write-Host ("    [{0}] {1}" -f $cm[-1].user.login, ($body -replace "`r?`n", ' '))
    }
  } catch { }
}
if ($shown -eq 0) { Write-Host '  （被拒 PR 上无评论，多为 CI 未过或自行关闭）' }

Write-Host ''
Write-Host '=== 5) 仓库规模 ==='
$repo = Invoke-RestMethod $api -Headers $h -TimeoutSec 25
Write-Host ("  Stars {0} | Forks {1} | Open issues {2}" -f $repo.stargazers_count, $repo.forks_count, $repo.open_issues_count)
Write-Host ("  {0}" -f $repo.description)

Write-Host ''
Write-Host '=== 6) 已合并条目分类分布（取 data/plugins 首页 100 个 + 统计 category） ==='
try {
  $dirs = @('data/plugins', 'data/plugins/a', 'data/plugins/b')
  $cats = @{}
  $cnt = 0
  foreach ($d in $dirs) {
    try {
      $items = Invoke-RestMethod "$api/contents/$d" -Headers $h -TimeoutSec 30
      foreach ($it in $items) {
        if ($it.name -notlike '*.yml') { continue }
        try {
          $f = Invoke-RestMethod $it.url -Headers $h -TimeoutSec 15
          $c = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($f.content))
          $m = [regex]::Match($c, '(?m)^category:\s*(\S+)')
          if ($m.Success) {
            $k = $m.Groups[1].Value
            if ($cats.ContainsKey($k)) { $cats[$k]++ } else { $cats[$k] = 1 }
            $cnt++
          }
        } catch { }
        if ($cnt -ge 60) { break }
      }
    } catch { }
    if ($cnt -ge 60) { break }
  }
  Write-Host ("  采样 {0} 个条目，分类分布：" -f $cnt)
  $cats.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { Write-Host ("    {0,-22} {1}" -f $_.Key, $_.Value) }
} catch { Write-Host '  分类统计失败' }

Write-Host ''
Write-Host '=== 7) 我们的 PR 对照检查 ==='
$pr = Invoke-RestMethod "$api/pulls/6141" -Headers $h -TimeoutSec 25
Write-Host ("  #{0} {1} | 改动 {2} 文件 +{3}/-{4} | 创建 {5}" -f $pr.number, $pr.state, $pr.changed_files, $pr.additions, $pr.deletions, $pr.created_at)
$cr = Invoke-RestMethod "$api/commits/$($pr.head.sha)/check-runs" -Headers $h -TimeoutSec 25
$cr.check_runs | ForEach-Object { Write-Host ("    [{0}/{1}] {2}" -f $_.status, $_.conclusion, $_.name) }
