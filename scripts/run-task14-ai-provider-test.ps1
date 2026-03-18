$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$outputDir = Join-Path (Resolve-Path ".") "output/$timestamp--task-14-ai-provider-real-adapter"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$outputFile = Join-Path $outputDir "output.txt"
$prepareLog = Join-Path $outputDir "db-prepare.log"
$pushDryLog = Join-Path $outputDir "db-push-dry.log"
$pushLog = Join-Path $outputDir "db-push.log"
$lintLog = Join-Path $outputDir "lint.log"
$typeLog = Join-Path $outputDir "typecheck.log"
$testLog = Join-Path $outputDir "test.log"
$runtimeLog = Join-Path $outputDir "runtime-proof.log"

function ChayLenhGhiLog([string]$command, [string]$logPath, [string]$errorMessage) {
  cmd /c "$command > `"$logPath`" 2>&1"
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "$errorMessage (exit code: $exitCode)"
  }

  return $exitCode
}

$prepareExit = ChayLenhGhiLog "npm run db:prepare-migrations" $prepareLog "db prepare migrations that bai"
$pushDryExit = ChayLenhGhiLog "npm run db:push:dry" $pushDryLog "db push dry that bai"
$pushExit = ChayLenhGhiLog "npm run db:push" $pushLog "db push that bai"
$lintExit = ChayLenhGhiLog "npm run lint" $lintLog "lint that bai"
$typeExit = ChayLenhGhiLog "npm run typecheck" $typeLog "typecheck that bai"
$testExit = ChayLenhGhiLog "npm run test" $testLog "test that bai"
$runtimeExit = ChayLenhGhiLog "npm run test:task14:runtime" $runtimeLog "runtime proof that bai"

@"
[THOI GIAN TEST]
$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

[MUC TIEU TEST]
Kiem tra task 14: adapter provider that theo huong server-side only, usage log toi thieu, va guard timeout/failure tren dev/test.

[LENH DA CHAY]
1) npm run db:prepare-migrations
2) npm run db:push:dry
3) npm run db:push
4) npm run lint
5) npm run typecheck
6) npm run test
7) npm run test:task14:runtime

[KET QUA TOM TAT]
- db prepare exit code: $prepareExit
- db push dry exit code: $pushDryExit
- db push exit code: $pushExit
- lint exit code: $lintExit
- typecheck exit code: $typeExit
- test exit code: $testExit
- runtime proof exit code: $runtimeExit

[FILE LOG]
- db-prepare.log
- db-push-dry.log
- db-push.log
- lint.log
- typecheck.log
- test.log
- runtime-proof.log

[GHI CHU]
- Runtime proof dung adapter OpenAI-compatible server-side path va usage log tren DB that.
- Neu env khong co OPENAI_API_KEY that, script proof van di qua duong adapter openai bang mock endpoint cuc bo co kiem soat.
- Teacher van phai accept suggestion thi final_score moi doi.
"@ | Set-Content -Path $outputFile -Encoding UTF8

Write-Output $outputDir
