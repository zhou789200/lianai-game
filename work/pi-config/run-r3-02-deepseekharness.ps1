$ErrorActionPreference = 'Continue'

$projectRoot = 'C:\Users\19511\Desktop\lianai-game'
$logDir = Join-Path $projectRoot 'work\r3'
$log = Join-Path $logDir 'R3-02-deepseek.out.log'
$errLog = Join-Path $logDir 'R3-02-deepseek.err.log'
$promptPath = Join-Path $logDir 'R3-02-DeepSeekHarness任务书.md'

$env:PI_CODING_AGENT_DIR = 'C:\Users\19511\Desktop\lianai-game\work\pi-config'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location -LiteralPath $projectRoot
$prompt = Get-Content -Raw -LiteralPath $promptPath

"=== DeepSeekHarness R3-02 start $(Get-Date -Format o) ===" | Out-File -Encoding utf8 -LiteralPath $log

& 'C:\Users\19511\.pi\agent\bin\pi.cmd' `
  --provider enw `
  --model deepseek-v4.1-flash `
  --thinking off `
  -p `
  --no-session `
  --approve `
  $prompt *>> $log 2>> $errLog

"=== DeepSeekHarness R3-02 end $(Get-Date -Format o) exit=$LASTEXITCODE ===" | Out-File -Encoding utf8 -Append -LiteralPath $log
