$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$testDir = Join-Path (Join-Path (Get-Location) "output") ($timestamp + "--task-8-exam-questions-foundation")
New-Item -ItemType Directory -Path $testDir -Force | Out-Null

$prepareLog = Join-Path $testDir "db-prepare.log"
$dbDryLog = Join-Path $testDir "db-push-dry.log"
$dbPushLog = Join-Path $testDir "db-push.log"
$lintLog = Join-Path $testDir "lint.log"
$typeLog = Join-Path $testDir "typecheck.log"
$testLog = Join-Path $testDir "test.log"
$outputPath = Join-Path $testDir "output.txt"

function ChayLenhGhiLog([string]$command, [string]$logPath, [string]$errorMessage) {
  cmd /c "$command > `"$logPath`" 2>&1"
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "$errorMessage (exit code: $exitCode)"
  }

  return $exitCode
}

$prepareExit = ChayLenhGhiLog "npm run db:prepare-migrations" $prepareLog "db:prepare-migrations that bai"
$dbDryExit = ChayLenhGhiLog "npm run db:push:dry" $dbDryLog "db:push:dry that bai"
$dbPushExit = ChayLenhGhiLog "npm run db:push" $dbPushLog "db:push that bai"
$lintExit = ChayLenhGhiLog "npm run lint" $lintLog "lint that bai"
$typeExit = ChayLenhGhiLog "npm run typecheck" $typeLog "typecheck that bai"
$testExit = ChayLenhGhiLog "npm run test" $testLog "test that bai"

@"
[THOI GIAN TEST]
$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

[MUC TIEU TEST]
Kiem tra nen tang question/answer key cho exam (migration, policy, service, repository, api, test unit) cua Task 8.

[LENH DA CHAY]
1) npm run db:prepare-migrations
2) npm run db:push:dry
3) npm run db:push
4) npm run lint
5) npm run typecheck
6) npm run test

[KET QUA TOM TAT]
- db:prepare-migrations exit code: $prepareExit
- db:push:dry exit code: $dbDryExit
- db:push exit code: $dbPushExit
- lint exit code: $lintExit
- typecheck exit code: $typeExit
- test exit code: $testExit

[FILE LOG]
- db-prepare.log
- db-push-dry.log
- db-push.log
- lint.log
- typecheck.log
- test.log

[GHI CHU]
- Buoc nay chua co screenshot UI vi pham vi task 8 backend-first cho question/answer key.
"@ | Set-Content -Path $outputPath -Encoding UTF8

Write-Output $testDir
