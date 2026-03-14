$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$testDir = Join-Path (Join-Path (Get-Location) "output") ($timestamp + "--task-6-classroom-foundation")
New-Item -ItemType Directory -Path $testDir -Force | Out-Null

$prepareLog = Join-Path $testDir "db-prepare.log"
$dbDryLog = Join-Path $testDir "db-push-dry.log"
$dbPushLog = Join-Path $testDir "db-push.log"
$lintLog = Join-Path $testDir "lint.log"
$typeLog = Join-Path $testDir "typecheck.log"
$testLog = Join-Path $testDir "test.log"
$dbProofLog = Join-Path $testDir "db-proof.log"
$devLog = Join-Path $testDir "dev-server.log"
$devErrLog = Join-Path $testDir "dev-server.err.log"
$lopHocPngPath = Join-Path $testDir "lop-hoc.png"
$lopHocJpgPath = Join-Path $testDir "lop-hoc.jpg"
$taoLopPngPath = Join-Path $testDir "lop-hoc-tao.png"
$taoLopJpgPath = Join-Path $testDir "lop-hoc-tao.jpg"
$outputPath = Join-Path $testDir "output.txt"

function DungDevServer([int]$fallbackPid) {
  if ($fallbackPid -gt 0) {
    Stop-Process -Id $fallbackPid -Force -ErrorAction SilentlyContinue
  }

  $connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ($connections) {
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $pids) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

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
$dbProofExit = ChayLenhGhiLog "node scripts/task6-classroom-db-proof.mjs" $dbProofLog "db runtime proof that bai"

$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev -- --hostname 127.0.0.1 --port 3000" -WorkingDirectory (Get-Location) -PassThru -RedirectStandardOutput $devLog -RedirectStandardError $devErrLog

$readyLopHoc = $false
$readyTaoLop = $false
$statusLopHoc = ""
$statusTaoLop = ""

for ($i = 0; $i -lt 100; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $responseLopHoc = Invoke-WebRequest -Uri "http://127.0.0.1:3000/lop-hoc" -UseBasicParsing -TimeoutSec 2
    if ($responseLopHoc.StatusCode -eq 200) {
      $readyLopHoc = $true
      $statusLopHoc = $responseLopHoc.StatusCode
    }
  }
  catch {
  }

  try {
    $responseTaoLop = Invoke-WebRequest -Uri "http://127.0.0.1:3000/lop-hoc/tao" -UseBasicParsing -TimeoutSec 2
    if ($responseTaoLop.StatusCode -eq 200) {
      $readyTaoLop = $true
      $statusTaoLop = $responseTaoLop.StatusCode
    }
  }
  catch {
  }

  if ($readyLopHoc -and $readyTaoLop) {
    break
  }
}

if (-not ($readyLopHoc -and $readyTaoLop)) {
  DungDevServer -fallbackPid $proc.Id
  throw "Khong the khoi dong day du page UI task 6 trong thoi gian cho phep."
}

$edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
if (-not (Test-Path $edgePath)) {
  DungDevServer -fallbackPid $proc.Id
  throw "Khong tim thay Edge de chup man hinh."
}

& $edgePath --headless --disable-gpu --window-size=1440,900 --screenshot=$lopHocPngPath http://127.0.0.1:3000/lop-hoc | Out-Null
& $edgePath --headless --disable-gpu --window-size=1440,900 --screenshot=$taoLopPngPath http://127.0.0.1:3000/lop-hoc/tao | Out-Null

Add-Type -AssemblyName System.Drawing

$lopHocImage = [System.Drawing.Image]::FromFile((Resolve-Path $lopHocPngPath))
$taoLopImage = [System.Drawing.Image]::FromFile((Resolve-Path $taoLopPngPath))
try {
  $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
  $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 92L)
  $lopHocImage.Save($lopHocJpgPath, $jpegCodec, $encoderParams)
  $taoLopImage.Save($taoLopJpgPath, $jpegCodec, $encoderParams)
}
finally {
  $lopHocImage.Dispose()
  $taoLopImage.Dispose()
}

DungDevServer -fallbackPid $proc.Id

@"
[THOI GIAN TEST]
$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

[MUC TIEU TEST]
Kiem tra migration + boundary + API + UI toi thieu cho module lop hoc task 6.

[LENH DA CHAY]
1) npm run db:prepare-migrations
2) npm run db:push:dry
3) npm run db:push
4) npm run lint
5) npm run typecheck
6) npm run test
7) node scripts/task6-classroom-db-proof.mjs
8) npm run dev -- --hostname 127.0.0.1 --port 3000
9) Invoke-WebRequest /lop-hoc va /lop-hoc/tao
10) msedge --headless --screenshot

[KET QUA TOM TAT]
- db:prepare-migrations exit code: $prepareExit
- db:push:dry exit code: $dbDryExit
- db:push exit code: $dbPushExit
- lint exit code: $lintExit
- typecheck exit code: $typeExit
- test exit code: $testExit
- db runtime proof exit code: $dbProofExit
- HTTP status /lop-hoc: $statusLopHoc
- HTTP status /lop-hoc/tao: $statusTaoLop
- Anh giao dien: lop-hoc.jpg, lop-hoc-tao.jpg

[GHI CHU]
- Kiem tra DB runtime cho bang classes va class_members nam trong db-proof.log.
- UI screenshot duoc chup tren local dev server.
"@ | Set-Content -Path $outputPath -Encoding UTF8

Write-Output $testDir
