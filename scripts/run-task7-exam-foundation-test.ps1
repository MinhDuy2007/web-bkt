$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$testDir = Join-Path (Join-Path (Get-Location) "output") ($timestamp + "--task-7-exam-foundation")
New-Item -ItemType Directory -Path $testDir -Force | Out-Null

$prepareLog = Join-Path $testDir "db-prepare.log"
$dbDryLog = Join-Path $testDir "db-push-dry.log"
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
$lintExit = ChayLenhGhiLog "npm run lint" $lintLog "lint that bai"
$typeExit = ChayLenhGhiLog "npm run typecheck" $typeLog "typecheck that bai"
$testExit = ChayLenhGhiLog "npm run test" $testLog "test that bai"

@"
[THOI GIAN TEST]
$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

[MUC TIEU TEST]
Kiem tra nen tang exam theo lop (schema/policy/service/api/test unit) cho Task 7.

[LENH DA CHAY]
1) npm run db:prepare-migrations
2) npm run db:push:dry
3) npm run lint
4) npm run typecheck
5) npm run test

[KET QUA TOM TAT]
- db:prepare-migrations exit code: $prepareExit
- db:push:dry exit code: $dbDryExit
- lint exit code: $lintExit
- typecheck exit code: $typeExit
- test exit code: $testExit

[FILE LOG]
- db-prepare.log
- db-push-dry.log
- lint.log
- typecheck.log
- test.log

[GHI CHU]
- Buoc nay chua co anh UI vi pham vi Task 7 hien tai tap trung backend/schema/quyen exam.
"@ | Set-Content -Path $outputPath -Encoding UTF8

Write-Output $testDir
