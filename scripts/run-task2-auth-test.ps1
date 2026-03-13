$ErrorActionPreference = 'Stop'

$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$testDir = Join-Path (Join-Path (Get-Location) 'output') ($timestamp + '--task-2-auth-nen-tang')
New-Item -ItemType Directory -Path $testDir -Force | Out-Null

$lintLog = Join-Path $testDir 'lint.log'
$typeLog = Join-Path $testDir 'typecheck.log'
$authTestLog = Join-Path $testDir 'auth-test.log'
$buildLog = Join-Path $testDir 'build.log'
$devLog = Join-Path $testDir 'dev-server.log'
$devErrLog = Join-Path $testDir 'dev-server.err.log'
$pngPath = Join-Path $testDir 'home-page.png'
$jpgPath = Join-Path $testDir 'home-page.jpg'
$outputPath = Join-Path $testDir 'output.txt'

function DungDevServer([int]$fallbackPid) {
  if ($fallbackPid -gt 0) {
    Stop-Process -Id $fallbackPid -Force -ErrorAction SilentlyContinue
  }

  $conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ($conn) {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

& npm run lint *> $lintLog
$lintExit = $LASTEXITCODE
if ($lintExit -ne 0) { throw "Lint that bai" }

& npm run typecheck *> $typeLog
$typeExit = $LASTEXITCODE
if ($typeExit -ne 0) { throw "Typecheck that bai" }

& npm run test:auth *> $authTestLog
$testExit = $LASTEXITCODE
if ($testExit -ne 0) { throw "Test auth that bai" }

& npm run build *> $buildLog
$buildExit = $LASTEXITCODE
if ($buildExit -ne 0) { throw "Build that bai" }

$cmdLine = 'npm run dev -- --hostname 127.0.0.1 --port 3000'
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmdLine -WorkingDirectory (Get-Location) -PassThru -RedirectStandardOutput $devLog -RedirectStandardError $devErrLog

$ready = $false
$httpStatus = ''
for ($i = 0; $i -lt 80; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      $ready = $true
      $httpStatus = $response.StatusCode
      break
    }
  }
  catch {
  }
}

if (-not $ready) {
  DungDevServer -fallbackPid $proc.Id
  throw 'Khong the khoi dong dev server trong thoi gian cho phep.'
}

$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edgePath)) {
  DungDevServer -fallbackPid $proc.Id
  throw 'Khong tim thay Edge de chup man hinh.'
}

& $edgePath --headless --disable-gpu --window-size=1440,900 --screenshot=$pngPath http://127.0.0.1:3000 | Out-Null

Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile((Resolve-Path $pngPath))
try {
  $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 92L)
  $image.Save($jpgPath, $jpegCodec, $encoderParams)
}
finally {
  $image.Dispose()
}

DungDevServer -fallbackPid $proc.Id

@"
[THOI GIAN TEST]
$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

[MUC TIEU TEST]
Kiem tra bo khung auth/verify/role nen tang sau task 2.

[LENH DA CHAY]
1) npm run lint
2) npm run typecheck
3) npm run test:auth
4) npm run build
5) npm run dev -- --hostname 127.0.0.1 --port 3000
6) Invoke-WebRequest http://127.0.0.1:3000
7) msedge --headless --screenshot

[KET QUA TOM TAT]
- lint exit code: $lintExit
- typecheck exit code: $typeExit
- test:auth exit code: $testExit
- build exit code: $buildExit
- HTTP status khi dev: $httpStatus
- Anh giao dien: home-page.jpg
- Log chi tiet: lint.log, typecheck.log, auth-test.log, build.log, dev-server.log, dev-server.err.log
"@ | Set-Content -Path $outputPath -Encoding UTF8

Write-Output $testDir
