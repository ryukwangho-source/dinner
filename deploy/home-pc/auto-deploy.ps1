# 집 PC 자동 배포 감시 루프 (dinner).
#
# 2분마다 origin/main을 확인해 새 커밋이 있으면 pull(ff-only) -> build ->
# 기존 서버 프로세스(포트 3300) 종료까지 자동 처리한다.
#
# 기동은 auto-deploy.cmd -> 이 스크립트. 창 없이 띄우려면 auto-deploy-hidden.vbs 를 쓴다
# (run-dinner-hidden.vbs 와 같은 패턴 — 시작프로그램에 둘 다 등록해서 함께 띄운다).
#
# 서버를 다시 띄우는 로직은 이 스크립트가 갖지 않는다 — 새 빌드가 성공하면 포트 3300을
# 쓰는 node.exe만 종료하고, run-dinner.ps1의 재시작 루프가 5초 내로 새 빌드를 집어
# 다시 띄운다. 재시작·백오프·로그 로테이션을 여기서 중복 구현하지 않기 위한 역할 분리다.
#
# 빌드가 실패하면 기존 프로세스를 그대로 살려둔다 — 깨진 빌드로 서비스가 죽는 사고를
# 막기 위함이다(run-dinner.ps1과 같은 원칙, travel의 2026-07-15 크래시 루프 재발 방지 패턴 준용).
# 작업 트리가 지저분하면(로컬 변경이 남아있으면) pull도 건너뛴다 — 임의로 덮어쓰지 않는다.
#
# 로그 메시지는 ASCII로만 쓴다 — run-dinner.ps1과 같은 이유(BOM 없는 UTF-8을 Windows
# PowerShell 5.1이 시스템 코드페이지로 잘못 해석해 문자열 리터럴이 깨지는 사고 방지).
# 주석은 파일 저장 인코딩과 무관하게 파싱에 영향이 없어 한글로 남겨도 안전하다.

$ErrorActionPreference = 'Stop'

$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repo

$logDir = Join-Path $repo 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir 'deploy.log'

$pollSeconds = 120
$port = 3300
$maxLogBytes = 5MB

function Write-Log($message) {
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

function Run-Deploy {
    # untracked 파일("?? ")은 pull을 막을 이유가 없다 — 추적 중인 파일의 실제 변경/스테이징만
    # "지저분함"으로 본다. 전부 다 걸러버리면 IDE가 만드는 로컬 전용 파일 하나 때문에
    # 배포가 영원히 멈춘다(travel에서 .claude/launch.json 때문에 실제로 발생했던 문제).
    $statusLines = cmd /c 'git status --porcelain 2>nul'
    $dirty = $statusLines | Where-Object { $_ -and ($_ -notmatch '^\?\? ') }
    if ($dirty) {
        Write-Log 'working tree has local changes - skipping pull (manual check needed)'
        return
    }

    # 리다이렉션은 전부 cmd에 맡긴다 — PowerShell 5.1에서 native exe의 stderr를 직접
    # 리다이렉트하면(또는 리다이렉트 없이 그대로 흘려보내면) 각 줄이 NativeCommandError로
    # 감싸이고, $ErrorActionPreference='Stop' 때문에 그게 곧바로 스크립트를 죽인다.
    # git은 정상 동작 중에도(fetch/pull) stderr에 진행 상황을 쓰므로 이 문제에 특히 취약하다.
    cmd /c "git pull --ff-only origin main >> `"$log`" 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Write-Log 'git pull --ff-only failed (local may have diverged from origin/main) - skipping this round'
        return
    }
    Write-Log 'pull done - starting build'

    cmd /c "bun run build >> `"$log`" 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Write-Log 'build failed - leaving existing process running, not deployed'
        return
    }
    Write-Log 'build succeeded - stopping existing server process (run-dinner.ps1 will restart with new build)'

    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) {
        Write-Log "no process found listening on port $port - run-dinner may not be running"
        return
    }
    foreach ($conn in $conns) {
        try {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop
            Write-Log "stopped PID $($conn.OwningProcess) - run-dinner.ps1 will restart with new build shortly"
        } catch {
            Write-Log "failed to stop PID $($conn.OwningProcess): $_"
        }
    }
}

Write-Log 'auto-deploy watch loop started'

while ($true) {
    Rotate-Log
    try {
        cmd /c "git fetch origin main --quiet >> `"$log`" 2>&1"
        $localHead = (cmd /c 'git rev-parse main 2>nul').Trim()
        $remoteHead = (cmd /c 'git rev-parse origin/main 2>nul').Trim()

        if ($localHead -ne $remoteHead) {
            Write-Log "new commit detected: $localHead -> $remoteHead"
            Run-Deploy
        }
    } catch {
        Write-Log "loop error: $_"
    }

    Start-Sleep -Seconds $pollSeconds
}
