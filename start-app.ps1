$ErrorActionPreference = "Stop"

$node = "C:\Users\ibele\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$next = Join-Path $PSScriptRoot "node_modules\next\dist\bin\next"

& $node $next dev --hostname 127.0.0.1 --port 3000