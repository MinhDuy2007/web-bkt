$ErrorActionPreference = 'Stop'

$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$testDir = Join-Path 'output' ($timestamp + '--task-1-khoi-tao-nen-tang-toi-thieu')
New-Item -ItemType Directory -Path $testDir -Force | Out-Null

$logPath = Join-Path $testDir 'dev-server.log'
$errPath = Join-Path $testDir 'dev-server.err.log'
$rawPngPath = Join-Path $testDir 'home-page.png'
$outputPath = Join-Path $testDir 'output.txt'

$cmdLine = 'npm run dev -- --hostname 127.0.0.1 --port 3000'
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmdLine -WorkingDirectory (Get-Location) -PassThru -RedirectStandardOutput $logPath -RedirectStandardError $errPath

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
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  throw 'Khong the khoi dong dev server trong thoi gian cho phep.'
}

$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edgePath)) {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  throw 'Khong tim thay Edge de chup anh headless.'
}

& $edgePath --headless --disable-gpu --window-size=1440,900 --screenshot=$rawPngPath http://127.0.0.1:3000 | Out-Null

Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile((Resolve-Path $rawPngPath))
try {
  $bitmap = New-Object System.Drawing.Bitmap $image
  $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $encoder = [System.Drawing.Imaging.Encoder]::Quality
  $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($encoder, 92L)
  $bitmap.Save((Join-Path (Resolve-Path $testDir).Path 'home-page.jpg'), $jpegCodec, $encoderParams)
  $bitmap.Dispose()
}
finally {
  $image.Dispose()
}

Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue

$devLog = if (Test-Path $logPath) { Get-Content $logPath -Raw } else { '' }
$errLog = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { '' }

@"
[THOI GIAN TEST]
$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

[MUC TIEU TEST]
Kiem tra bo khung Task 1 co khoi dong local duoc va render trang chu toi thieu.

[LENH DA CHAY]
1) npm run lint
2) npm run typecheck
3) npm run build
4) npm run dev -- --hostname 127.0.0.1 --port 3000
5) Invoke-WebRequest http://127.0.0.1:3000
6) msedge --headless --screenshot

[KET QUA NHANH]
- HTTP status: $httpStatus
- Anh chup giao dien: home-page.jpg
- Log server: dev-server.log
- Log loi server: dev-server.err.log

[DEV SERVER STDOUT]
$devLog

[DEV SERVER STDERR]
$errLog
"@ | Set-Content -Path $outputPath -Encoding UTF8

Write-Output $testDir
