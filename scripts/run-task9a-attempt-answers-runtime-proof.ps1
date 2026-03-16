$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$testDir = Join-Path (Join-Path (Get-Location) "output") ($timestamp + "--task-9a-attempt-answers-runtime-proof")
New-Item -ItemType Directory -Path $testDir -Force | Out-Null

$lintLog = Join-Path $testDir "lint.log"
$typeLog = Join-Path $testDir "typecheck.log"
$testLog = Join-Path $testDir "test.log"
$runtimeProofLog = Join-Path $testDir "runtime-proof.log"
$outputPath = Join-Path $testDir "output.txt"

function ChayLenhGhiLog([string]$command, [string]$logPath, [string]$errorMessage) {
  cmd /c "$command > `"$logPath`" 2>&1"
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "$errorMessage (exit code: $exitCode)"
  }

  return $exitCode
}

function ChayRuntimeProofCoRetry([string]$command, [string]$logPath, [int]$maxRetry) {
  $exitCode = 1
  for ($attempt = 1; $attempt -le $maxRetry; $attempt++) {
    Add-Content -Path $logPath -Value ("`n===== Runtime proof attempt " + $attempt + "/" + $maxRetry + " =====`n")
    cmd /c "$command >> `"$logPath`" 2>&1"
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) {
      return $exitCode
    }

    Start-Sleep -Seconds 2
  }

  throw "runtime proof task9a that bai sau $maxRetry lan thu (exit code cuoi: $exitCode)"
}

$lintExit = ChayLenhGhiLog "npm run lint" $lintLog "lint that bai"
$typeExit = ChayLenhGhiLog "npm run typecheck" $typeLog "typecheck that bai"
$testExit = ChayLenhGhiLog "npm run test" $testLog "test that bai"
$runtimeProofExit = ChayRuntimeProofCoRetry "npm run test:task9a:runtime" $runtimeProofLog 3

@"
[THOI GIAN TEST]
$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

[MUC TIEU TEST]
Kiem chung runtime DB that cho task 9A: save/list/submit/scoring module attempt answers.

[LENH DA CHAY]
1) npm run lint
2) npm run typecheck
3) npm run test
4) npm run test:task9a:runtime

[KET QUA TOM TAT]
- lint exit code: $lintExit
- typecheck exit code: $typeExit
- test exit code: $testExit
- runtime proof exit code: $runtimeProofExit

[FILE LOG]
- lint.log
- typecheck.log
- test.log
- runtime-proof.log

[GHI CHU]
- Runtime proof script su dung DB dev/test that, tao du lieu test prefix task9a-* va cleanup sau khi chay.
- Khong co screenshot UI trong buoc nay vi pham vi proof la service/repository/DB.
"@ | Set-Content -Path $outputPath -Encoding UTF8

Write-Output $testDir
