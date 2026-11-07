$ErrorActionPreference = 'Continue'

$projectRoot = 'C:\Users\19511\Desktop\lianai-game'
$log = Join-Path $projectRoot 'work\wb-r2.out.log'
$errLog = Join-Path $projectRoot 'work\wb-r2.err.log'
$promptPath = Join-Path $projectRoot 'work\prompts\wb-r2-ui.md'
$prompt = Get-Content -Raw $promptPath

"=== WorkBuddy R2 start $(Get-Date -Format o) ===" | Out-File -Encoding utf8 $log

& 'C:\Users\19511\AppData\Roaming\npm\codebuddy.cmd' `
  -p -y `
  --model deepseek-v4.1-flash `
  --add-dir $projectRoot `
  --output-format text `
  $prompt *>> $log 2>> $errLog

"=== WorkBuddy R2 end $(Get-Date -Format o) exit=$LASTEXITCODE ===" | Out-File -Encoding utf8 -Append $log
