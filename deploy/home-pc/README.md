# 집 PC 배포 — 상시 실행 + 자동 배포

두 개의 독립된 상시 루프를 시작프로그램에 등록해 함께 띄운다.

| 루프 | 파일 | 역할 |
|---|---|---|
| 서버 실행 | `run-dinner-hidden.vbs` | `.next` 빌드 산출물로 `next start`를 0.0.0.0:3301에 띄우고, 죽으면 자동 재시작 |
| 자동 배포 | `auto-deploy-hidden.vbs` | 2분마다 `origin/main`을 확인해 새 커밋이 있으면 pull → build → 기존 서버 프로세스 종료 |

역할을 분리한 이유: 자동 배포 루프는 "언제 새로 띄울지"만 결정한다. "어떻게 띄울지"(재시작·백오프·로그 로테이션)는 이미 `run-dinner.ps1`이 하고 있으므로, 배포 루프는 새 빌드가 성공했을 때 포트 3301을 쓰는 프로세스를 종료만 하면 `run-dinner.ps1`이 5초 안에 새 빌드로 다시 띄운다.

## 설치 (최초 1회, 집 PC에서 직접)

1. `Win + R` → `shell:startup` 입력 → 엔터 (시작프로그램 폴더가 열림)
2. 아래 두 파일의 **바로가기**를 그 폴더에 추가
   - `deploy\home-pc\run-dinner-hidden.vbs`
   - `deploy\home-pc\auto-deploy-hidden.vbs`
3. 둘 다 더블클릭해 한 번 실행 (또는 재부팅해서 시작프로그램으로 자동 기동 확인)
4. `logs\dinner.log`, `logs\deploy.log`에 로그가 쌓이는지 확인

## 동작 확인

- `logs\deploy.log`: `new commit detected` → `pull done - starting build` → `build succeeded - stopping existing server process` 순으로 찍히면 정상
- `logs\dinner.log`: 배포 직후 `process exited` → `starting dinner` 로그가 다시 찍히면 새 빌드로 재기동된 것
- 실시간으로 보려면 PowerShell에서 `Get-Content logs\deploy.log -Wait -Tail 20` (Ctrl+C로 중단)

> 로그 메시지는 (주석과 달리) ASCII만 쓴다. BOM 없는 UTF-8 파일을 Windows PowerShell 5.1이
> 시스템 코드페이지로 잘못 해석해 한글이 들어간 문자열 리터럴의 따옴표가 깨지는 사고를
> travel에서 겪은 뒤 같은 규칙으로 맞췄다 — 새 `Write-Log` 호출을 추가할 때도 메시지는 영문으로 쓸 것.
>
> git 명령(`fetch`/`pull`/`status`/`rev-parse`)은 전부 `cmd /c "... 2>&1"` 또는
> `2>nul`로 감싸서 부른다. PowerShell 5.1은 native exe가 stderr에 쓰는 줄을
> `NativeCommandError`로 감싸는데, git은 정상 동작(fetch/pull) 중에도 stderr에
> 진행 메시지를 쓰므로 `$ErrorActionPreference='Stop'`과 만나면 스크립트가
> 그 자리에서 죽는다 — 새 git 호출을 추가할 때도 같은 방식으로 감쌀 것.
>
> 시작프로그램 등록 후 수동으로 `.\auto-deploy.ps1`을 직접 실행해 테스트했다면
> 반드시 `Ctrl+C`로 끄고 나서 vbs로 다시 띄울 것 — 두 인스턴스가 동시에 돌면
> 배포 시점에 pull/build/프로세스 종료가 겹쳐 실행될 수 있다.

## 안전장치

- **빌드 실패 시 기존 프로세스를 그대로 둔다** — 깨진 빌드로 서비스가 죽는 사고를 막는다.
- **작업 트리가 지저분하면(추적 중인 파일의 실제 변경 존재) pull을 건너뛴다** — 로컬 변경을 임의로 덮어쓰지 않는다. untracked 파일(`?? `)은 pull을 막지 않는다 — IDE가 만드는 `.claude/launch.json` 같은 로컬 전용 파일 때문에 배포가 영원히 스킵되는 사고가 travel에서 실제로 있었다.
- **`git pull --ff-only`만 쓴다** — 브랜치가 갈라졌으면 자동 병합하지 않고 그냥 건너뛰며 로그를 남긴다. 이 경우 집 PC에서 직접 `git status`로 확인 후 처리한다.

## 포트 충돌 주의

이 PC의 `IntelTechnologyAccessService`(Windows 서비스)가 임의 포트를 점유할 수 있다 —
실제로 3300을 선점해 dinner 프로덕션이 `EADDRINUSE`로 계속 크래시 재시작한 사고가 있었다
(2026-08-16, 3301로 이전해 해결). 포트를 다시 바꿔야 한다면 이 파일과
`run-dinner.ps1`/`auto-deploy.ps1`/`package.json`(`start:home`)/`playwright.config.ts`/
`CLAUDE.md`의 포트 표기를 모두 함께 바꾸고, `tailscale serve`의 `svc:dinner` 매핑도
새 포트로 갱신해야 한다(`tailscale serve --set-path ...` 또는 관리 콘솔).

## 중지 / 제거

- 즉시 중지: 작업 관리자에서 `auto-deploy.ps1`을 실행 중인 `powershell.exe` 종료 (서버 자체는 `run-dinner` 루프가 별개이므로 계속 떠 있음)
- 영구 제거: `shell:startup`에서 두 바로가기 중 배포 감시 것만 삭제
