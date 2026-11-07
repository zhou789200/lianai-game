$ErrorActionPreference = 'Continue'
$logDir = 'C:\Users\19511\Desktop\lianai-game\work'
$log = Join-Path $logDir 'wb-r2.out.log'
$errLog = Join-Path $logDir 'wb-r2.err.log'

"=== WorkBuddy R2 start $(Get-Date -Format o) ===" | Out-File -Encoding utf8 $log

$prompt = Get-Content -Raw 'C:\Users\19511\Desktop\lianai-game\work\prompts\wb-r2-ui.md'

& 'C:\Users\19511\AppData\Roaming\npm\codebuddy.ps1' `
  -p -y `
  --model glm-5.3 `
  --add-dir 'C:\Users\19511\Desktop\lianai-game' `
  --output-format text `
  $prompt *>> $log 2>> $errLog

"=== WorkBuddy R2 end $(Get-Date -Format o) exit=$LASTEXITCODE ===" | Out-File -Encoding utf8 -Append $log
