$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "app")
$nodePlatform = & node -p "process.platform"
if ($nodePlatform -ne "win32") {
  throw "当前 node 来自 $nodePlatform，请在 Windows PowerShell 中运行，或使用 deploy-hk.cmd。"
}
npm run deploy:hk -- @args
