$ErrorActionPreference = 'Continue'

$projectRoot = 'C:\Users\19511\Desktop\lianai-game'
$log = Join-Path $projectRoot 'work\deepseek-r2.out.log'
$errLog = Join-Path $projectRoot 'work\deepseek-r2.err.log'
$promptPath = Join-Path $PSScriptRoot 'ds-r2-functional.md'

$env:PI_CODING_AGENT_DIR = $PSScriptRoot
$prompt = Get-Content -Raw $promptPath

"=== DeepSeekHarness R2 start $(Get-Date -Format o) ===" | Out-File -Encoding utf8 $log

& 'C:\Users\19511\.pi\agent\bin\pi.cmd' `
  --provider enw `
  --model deepseek-v4.1-flash `
  --thinking off `
  -p `
  --no-session `
  --approve `
  $prompt *>> $log 2>> $errLog

"=== DeepSeekHarness R2 end $(Get-Date -Format o) exit=$LASTEXITCODE ===" | Out-File -Encoding utf8 -Append $log
