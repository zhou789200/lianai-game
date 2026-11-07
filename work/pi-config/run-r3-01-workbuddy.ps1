$ErrorActionPreference = 'Continue'

$projectRoot = 'C:\Users\19511\Desktop\lianai-game'
$logDir = Join-Path $projectRoot 'work\r3'
$log = Join-Path $logDir 'R3-01-workbuddy.out.log'
$errLog = Join-Path $logDir 'R3-01-workbuddy.err.log'
$promptPath = Join-Path $logDir 'R3-01-WorkBuddy任务书.md'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location -LiteralPath $projectRoot
$prompt = Get-Content -Raw -LiteralPath $promptPath

"=== WorkBuddy R3-01 start $(Get-Date -Format o) ===" | Out-File -Encoding utf8 -LiteralPath $log

& 'C:\Users\19511\AppData\Roaming\npm\codebuddy.ps1' `
  -p -y `
  --model glm-5.3 `
  --add-dir $projectRoot `
  --output-format text `
  $prompt *>> $log 2>> $errLog

"=== WorkBuddy R3-01 end $(Get-Date -Format o) exit=$LASTEXITCODE ===" | Out-File -Encoding utf8 -Append -LiteralPath $log
