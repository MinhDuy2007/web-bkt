$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$testDir = Join-Path (Join-Path (Get-Location) "output") ($timestamp + "--task-13-ai-assisted-grading-foundation")
New-Item -ItemType Directory -Path $testDir -Force | Out-Null

$prepareLog = Join-Path $testDir "db-prepare.log"
$pushDryLog = Join-Path $testDir "db-push-dry.log"
$pushLog = Join-Path $testDir "db-push.log"
$lintLog = Join-Path $testDir "lint.log"
$typeLog = Join-Path $testDir "typecheck.log"
$testLog = Join-Path $testDir "test.log"
$setupLog = Join-Path $testDir "ui-setup.log"
$verifyLog = Join-Path $testDir "runtime-verify.log"
$devLog = Join-Path $testDir "dev-server.log"
$devErrLog = Join-Path $testDir "dev-server.err.log"
$teacherShotLog = Join-Path $testDir "teacher-screenshot.log"
$studentShotLog = Join-Path $testDir "student-screenshot.log"
$cleanupLog = Join-Path $testDir "ui-cleanup.log"
$teacherPngPath = Join-Path $testDir "teacher-ai-assisted-grading.png"
$teacherJpgPath = Join-Path $testDir "teacher-ai-assisted-grading.jpg"
$studentPngPath = Join-Path $testDir "student-result-after-ai-accept.png"
$studentJpgPath = Join-Path $testDir "student-result-after-ai-accept.jpg"
$outputPath = Join-Path $testDir "output.txt"

$statePath = Join-Path $env:TEMP ("task13-ai-grading-state-" + [guid]::NewGuid().ToString() + ".json")
$teacherStoragePath = Join-Path $env:TEMP ("task13-ai-grading-teacher-storage-" + [guid]::NewGuid().ToString() + ".json")
$studentStoragePath = Join-Path $env:TEMP ("task13-ai-grading-student-storage-" + [guid]::NewGuid().ToString() + ".json")
$devProcess = $null
$serverReady = $false
$setupState = $null

function ChayLenhGhiLog([string]$command, [string]$logPath, [string]$errorMessage) {
  cmd /c "$command > `"$logPath`" 2>&1"
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "$errorMessage (exit code: $exitCode)"
  }

  return $exitCode
}

function DungDevServer() {
  if ($devProcess -and -not $devProcess.HasExited) {
    Stop-Process -Id $devProcess.Id -Force -ErrorAction SilentlyContinue
  }

  $connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ($connections) {
    $connections | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
      Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
  }
}

function TaoStorageState([string]$token, [string]$storagePath) {
  $storageState = @{
    cookies = @(
      @{
        name = "session_token"
        value = $token
        domain = "127.0.0.1"
        path = "/"
        httpOnly = $true
        secure = $false
        sameSite = "Strict"
        expires = -1
      }
    )
    origins = @()
  }
  [System.IO.File]::WriteAllText(
    $storagePath,
    ($storageState | ConvertTo-Json -Depth 6),
    (New-Object System.Text.UTF8Encoding($false))
  )
}

function ChuyenPngSangJpg([string]$pngPath, [string]$jpgPath) {
  Add-Type -AssemblyName System.Drawing
  $image = [System.Drawing.Image]::FromFile((Resolve-Path $pngPath))
  try {
    $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 92L)
    $image.Save($jpgPath, $jpegCodec, $encoderParams)
  }
  finally {
    $image.Dispose()
  }
}

try {
  $prepareExit = ChayLenhGhiLog "npm run db:prepare-migrations" $prepareLog "db prepare migrations that bai"
  $pushDryExit = ChayLenhGhiLog "npm run db:push:dry" $pushDryLog "db push dry that bai"
  $pushExit = ChayLenhGhiLog "npm run db:push" $pushLog "db push that bai"
  $lintExit = ChayLenhGhiLog "npm run lint" $lintLog "lint that bai"
  $typeExit = ChayLenhGhiLog "npm run typecheck" $typeLog "typecheck that bai"
  $testExit = ChayLenhGhiLog "npm run test" $testLog "test that bai"
  $setupExit = ChayLenhGhiLog "node --import tsx scripts/task13-ai-assisted-grading-proof.ts setup `"$statePath`"" $setupLog "ui setup that bai"

  $setupState = Get-Content -Raw $statePath | ConvertFrom-Json
  if (-not $setupState.examCode -or -not $setupState.teacherToken -or -not $setupState.studentToken) {
    throw "State setup khong day du examCode/teacherToken/studentToken."
  }

  TaoStorageState ([string]$setupState.teacherToken) $teacherStoragePath
  TaoStorageState ([string]$setupState.studentToken) $studentStoragePath

  DungDevServer
  $devProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev -- --hostname 127.0.0.1 --port 3000" -WorkingDirectory (Get-Location) -PassThru -RedirectStandardOutput $devLog -RedirectStandardError $devErrLog

  $httpStatus = ""
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        $serverReady = $true
        $httpStatus = $response.StatusCode
        break
      }
    }
    catch {
    }
  }

  if (-not $serverReady) {
    throw "Khong the khoi dong dev server trong thoi gian cho phep."
  }

  $teacherUrl = "http://127.0.0.1:3000/giao-vien/cham-tu-luan/$($setupState.examCode)"
  cmd /c "npx playwright screenshot --browser chromium --channel msedge --device `"Desktop Chrome`" --color-scheme dark --load-storage `"$teacherStoragePath`" --wait-for-selector `"[data-testid='ai-suggestion-item']`" --wait-for-timeout 1500 --full-page `"$teacherUrl`" `"$teacherPngPath`" > `"$teacherShotLog`" 2>&1"
  $teacherShotExit = $LASTEXITCODE
  if ($teacherShotExit -ne 0) {
    throw "Chup screenshot teacher ai-assisted grading that bai (exit code: $teacherShotExit)"
  }
  ChuyenPngSangJpg $teacherPngPath $teacherJpgPath

  $verifyExit = ChayLenhGhiLog "node --import tsx scripts/task13-ai-assisted-grading-proof.ts verify `"$statePath`"" $verifyLog "runtime verify that bai"

  $studentUrl = "http://127.0.0.1:3000/ket-qua/$($setupState.examCode)"
  cmd /c "npx playwright screenshot --browser chromium --channel msedge --device `"Desktop Chrome`" --color-scheme dark --load-storage `"$studentStoragePath`" --wait-for-selector `"[data-testid='review-item']`" --wait-for-timeout 1500 --full-page `"$studentUrl`" `"$studentPngPath`" > `"$studentShotLog`" 2>&1"
  $studentShotExit = $LASTEXITCODE
  if ($studentShotExit -ne 0) {
    throw "Chup screenshot student result after ai accept that bai (exit code: $studentShotExit)"
  }
  ChuyenPngSangJpg $studentPngPath $studentJpgPath

  @"
[THOI GIAN TEST]
$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

[MUC TIEU TEST]
Kiem tra task 13: AI-assisted grading cho essay theo huong server-side only, teacher duyet cuoi, reject khong doi final score va accept moi cap nhat final score.

[MO HINH AI]
- Provider mode: mock (server-side only)
- Khong co frontend goi model truc tiep
- Khong coi day la production AI pipeline hoan chinh

[LENH DA CHAY]
1) npm run db:prepare-migrations
2) npm run db:push:dry
3) npm run db:push
4) npm run lint
5) npm run typecheck
6) npm run test
7) node --import tsx scripts/task13-ai-assisted-grading-proof.ts setup
8) npm run dev -- --hostname 127.0.0.1 --port 3000
9) npx playwright screenshot ... /giao-vien/cham-tu-luan/[examCode]
10) node --import tsx scripts/task13-ai-assisted-grading-proof.ts verify
11) npx playwright screenshot ... /ket-qua/[examCode]

[KET QUA TOM TAT]
- db prepare exit code: $prepareExit
- db push dry exit code: $pushDryExit
- db push exit code: $pushExit
- lint exit code: $lintExit
- typecheck exit code: $typeExit
- test exit code: $testExit
- ui setup exit code: $setupExit
- runtime verify exit code: $verifyExit
- teacher screenshot exit code: $teacherShotExit
- student result screenshot exit code: $studentShotExit
- HTTP status root: $httpStatus
- examCode proof: $($setupState.examCode)
- Anh giao dien teacher: teacher-ai-assisted-grading.jpg
- Anh giao dien hoc sinh: student-result-after-ai-accept.jpg

[FILE LOG]
- db-prepare.log
- db-push-dry.log
- db-push.log
- lint.log
- typecheck.log
- test.log
- ui-setup.log
- runtime-verify.log
- dev-server.log
- dev-server.err.log
- teacher-screenshot.log
- student-screenshot.log

[GHI CHU]
- Proof runtime verify da kiem tra reject truoc, sau do tao goi y moi va accept.
- Final score chi doi sau accept; reject khong duoc doi final score.
- Screenshot teacher duoc chup khi suggestion dang pending de the hien AI chi la goi y cho teacher.
- Screenshot student result duoc chup sau accept de the hien result doc du lieu server sau cap nhat.
- Session token chi duoc luu tam trong file state/storage va da duoc xoa sau khi ket thuc.
"@ | Set-Content -Path $outputPath -Encoding UTF8
}
finally {
  try {
    if (Test-Path $statePath) {
      cmd /c "node --import tsx scripts/task13-ai-assisted-grading-proof.ts cleanup `"$statePath`" > `"$cleanupLog`" 2>&1"
    }
  }
  catch {
  }

  DungDevServer

  if (Test-Path $statePath) {
    Remove-Item $statePath -Force -ErrorAction SilentlyContinue
  }

  if (Test-Path $teacherStoragePath) {
    Remove-Item $teacherStoragePath -Force -ErrorAction SilentlyContinue
  }

  if (Test-Path $studentStoragePath) {
    Remove-Item $studentStoragePath -Force -ErrorAction SilentlyContinue
  }
}

Write-Output $testDir
