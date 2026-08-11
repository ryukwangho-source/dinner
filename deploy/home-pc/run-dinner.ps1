# 집 PC 상시 실행 런처 본체 (dinner).
#
# 기동은 run-dinner.cmd -> 이 스크립트. 창 없이 띄우려면 run-dinner-hidden.vbs 를 쓴다
# (시작프로그램 lnk 도 vbs 를 가리킨다).
#
# - 프로덕션 빌드(.next)를 0.0.0.0:3300 에 바인딩해 구동한다.
#   3000은 invest, 3200은 travel 프로덕션 전용.
# - 프로세스가 죽으면 자동 재시작한다. 단 즉시 다시 죽는 상황(빌드 깨짐 등)에서는
#   대기를 지수적으로 늘려 무한 스핀을 막는다.
# - 로그는 logs\dinner.log 에 append 되고, 커지면 .1 로 밀어낸다.
#
# 배치의 `timeout /t` 를 쓰지 않는 이유: stdin 이 콘솔이 아니면
# "ERROR: Input redirection is not supported" 로 즉시 실패해 대기가 통째로 사라진다.
# vbs(창 숨김) 기동이 정확히 그 조건이라, 대기 없는 재시작 루프가 됐었다.

$ErrorActionPreference = 'Stop'

$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repo

$logDir = Join-Path $repo 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir 'dinner.log'

# 재시작이 "정상 가동 후 사망"인지 "뜨자마자 사망"인지 가르는 기준
$healthySeconds = 60
$baseDelay = 5
$maxDelay = 300
$maxLogBytes = 5MB

function Write-Log($message) {
    # 메시지는 ASCII 로 유지한다 — bun 출력(UTF-8)과 같은 파일에 섞이므로 인코딩 사고를 피한다.
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path $log -Value "[$stamp] $message" -Encoding utf8
}

function Rotate-Log {
    if (-not (Test-Path $log)) { return }
    if ((Get-Item $log).Length -lt $maxLogBytes) { return }
    $rolled = "$log.1"
    if (Test-Path $rolled) { Remove-Item $rolled -Force }
    Move-Item $log $rolled
}

$consecutiveFastFailures = 0

while ($true) {
    Rotate-Log
    Write-Log 'starting dinner (0.0.0.0:3300)'

    $startedAt = Get-Date
    # 리다이렉션은 cmd 에 맡긴다 — PowerShell 5.1 에서 native exe 의 stderr 를 직접
    # 리다이렉트하면 각 줄이 NativeCommandError 로 감싸여 로그가 오염된다.
    cmd /c "bun run start:home >> `"$log`" 2>&1"
    $exitCode = $LASTEXITCODE
    $uptime = [int]((Get-Date) - $startedAt).TotalSeconds

    if ($uptime -ge $healthySeconds) {
        $consecutiveFastFailures = 0
        $delay = $baseDelay
    } else {
        $consecutiveFastFailures++
        $delay = [Math]::Min($baseDelay * [Math]::Pow(2, $consecutiveFastFailures - 1), $maxDelay)
    }
    $delay = [int]$delay

    Write-Log "process exited (code $exitCode) after ${uptime}s - restarting in ${delay}s (fast failures: $consecutiveFastFailures)"
    Start-Sleep -Seconds $delay
}
