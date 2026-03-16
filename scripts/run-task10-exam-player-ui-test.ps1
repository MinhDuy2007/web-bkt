$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$testDir = Join-Path (Join-Path (Get-Location) "output") ($timestamp + "--task-10-exam-player-ui-min")
New-Item -ItemType Directory -Path $testDir -Force | Out-Null

$lintLog = Join-Path $testDir "lint.log"
$typeLog = Join-Path $testDir "typecheck.log"
$testLog = Join-Path $testDir "test.log"
$setupLog = Join-Path $testDir "ui-setup.log"
$devLog = Join-Path $testDir "dev-server.log"
$devErrLog = Join-Path $testDir "dev-server.err.log"
$screenshotLog = Join-Path $testDir "screenshot.log"
$cleanupLog = Join-Path $testDir "ui-cleanup.log"
$pngPath = Join-Path $testDir "exam-player.png"
$jpgPath = Join-Path $testDir "exam-player.jpg"
$outputPath = Join-Path $testDir "output.txt"

$statePath = Join-Path $env:TEMP ("task10-exam-player-state-" + [guid]::NewGuid().ToString() + ".json")
$storagePath = Join-Path $env:TEMP ("task10-exam-player-storage-" + [guid]::NewGuid().ToString() + ".json")
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

try {
  $lintExit = ChayLenhGhiLog "npm run lint" $lintLog "lint that bai"
  $typeExit = ChayLenhGhiLog "npm run typecheck" $typeLog "typecheck that bai"
  $testExit = ChayLenhGhiLog "npm run test" $testLog "test that bai"
  $setupExit = ChayLenhGhiLog "node --import tsx scripts/task10-exam-player-ui-proof.ts setup `"$statePath`"" $setupLog "ui setup that bai"

  $setupState = Get-Content -Raw $statePath | ConvertFrom-Json
  if (-not $setupState.examCode -or -not $setupState.sessionToken) {
    throw "State setup khong day du examCode/sessionToken."
  }

  $storageState = @{
    cookies = @(
      @{
        name = "session_token"
        value = [string]$setupState.sessionToken
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

  $examUrl = "http://127.0.0.1:3000/bai-thi/$($setupState.examCode)"
  cmd /c "npx playwright screenshot --browser chromium --channel msedge --device `"Desktop Chrome`" --color-scheme dark --load-storage `"$storagePath`" --wait-for-selector `"[data-testid='question-card']`" --wait-for-timeout 1500 --full-page `"$examUrl`" `"$pngPath`" > `"$screenshotLog`" 2>&1"
  $screenshotExit = $LASTEXITCODE
  if ($screenshotExit -ne 0) {
    throw "Chup screenshot exam player that bai (exit code: $screenshotExit)"
  }

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

  @"
[THOI GIAN TEST]
$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

[MUC TIEU TEST]
Kiem tra exam player toi thieu cho hoc sinh: load player data, render cau hoi, luu bai qua API hien co va chup giao dien that tren dev/test.

[LENH DA CHAY]
1) npm run lint
2) npm run typecheck
3) npm run test
4) node --import tsx scripts/task10-exam-player-ui-proof.ts setup
5) npm run dev -- --hostname 127.0.0.1 --port 3000
6) npx playwright screenshot --load-storage ...

[KET QUA TOM TAT]
- lint exit code: $lintExit
- typecheck exit code: $typeExit
- test exit code: $testExit
- ui setup exit code: $setupExit
- screenshot exit code: $screenshotExit
- HTTP status root: $httpStatus
- examCode proof: $($setupState.examCode)
- Anh giao dien: exam-player.jpg

[FILE LOG]
- lint.log
- typecheck.log
- test.log
- ui-setup.log
- dev-server.log
- dev-server.err.log
- screenshot.log

[GHI CHU]
- Screenshot da dung storage state co session cookie HttpOnly cua hoc sinh test.
- Trang duoc chup o route /bai-thi/[examCode] sau khi attempt da duoc tao san tu script setup.
- Session token chi duoc luu tam trong file state/storage cua he thong va da duoc xoa sau khi ket thuc.
"@ | Set-Content -Path $outputPath -Encoding UTF8
}
finally {
  try {
    if (Test-Path $statePath) {
      cmd /c "node --import tsx scripts/task10-exam-player-ui-proof.ts cleanup `"$statePath`" > `"$cleanupLog`" 2>&1"
    }
  }
  catch {
  }

  DungDevServer

  if (Test-Path $statePath) {
    Remove-Item $statePath -Force -ErrorAction SilentlyContinue
  }

  if (Test-Path $storagePath) {
    Remove-Item $storagePath -Force -ErrorAction SilentlyContinue
  }
}

Write-Output $testDir
