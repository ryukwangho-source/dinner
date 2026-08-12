## Workflow Phases

Ideate → Define → Sketch → Plan → Build → Compound

### Spec-Driven Development

| Phase | Skill | 산출물 |
|---|---|---|
| Ideate | `/idea-refine` | `artifacts/<feature>/idea.md` (선택) |
| Specify | `/write-spec` | `artifacts/<feature>/spec.md` |
| Sketch | `/sketch-wireframe` | `artifacts/<feature>/wireframe.html` |
| Plan | `/draft-plan` | `artifacts/<feature>/plan.md` |
| Build | `/execute-plan` | `artifacts/<feature>/learnings.md` |
| Compound | `/compound` | — |

## Development Workflow

- 패키지 매니저: `bun`
- **포트 배정**: 이 PC에서 3000은 invest 프로덕션, 3200은 travel 프로덕션, 3100은 travel dev·e2e가 상시/수시로 점유한다. dinner는 dev·e2e에 3110을, 프로덕션에 3300을 쓴다 (`bun run dev --port 3110`; playwright.config.ts도 3110 고정). 다른 포트에 붙으면 엉뚱한 앱을 테스트하게 된다.

### 커밋 규칙
- Conventional 규칙을 따르고, feature 단위로 커밋한다.

### 계획 작성 시 주의
- `/draft-plan`에서 아키텍처 결정을 확정하기 전에, 필요 스킬(특히 shadcn)의 Critical Rules를 먼저 읽는다 — 나중에 뒤집고 plan.md를 고치는 일을 반복하지 않기 위함 (예: "토스트 라이브러리 없이 인라인 배너"로 정했다가 shadcn의 "Toast via sonner" 규칙 때문에 구현 중 번복한 사례).

## Testing

### 원칙
**수용 기준을 정의한다. 검증될 때까지 반복한다.**

- 모든 변경에는 측정 가능한 수용 기준(구체적인 입력, 관찰 가능한 결과)이 필요하다
- 각 기준은 이를 증명하는 테스트를 가진다.
- 수용 기준이 실제로 증명되는 가장 낮은 경계를 선택한다. mock이 기준을 가린다면 거기서 mock하지 않는다.

### Stack & 파일 배치

| 도구 | 용도 | 위치 |
|---|---|---|
| Vitest (jsdom, `@testing-library/react`) | 단위·통합·수용 기준 | `<file>.test.tsx` colocated |
| Playwright | E2E | `e2e/*.spec.ts` | global

### Commands

| 명령 | 범위 |
|---|---|
| `bun run test` | Vitest |
| `bun run test:watch` | Vitest watch |
| `bun run test:e2e` | Playwright |
| `bun run lint` | ESLint (flat config 전체) — `bun run build`의 내장 린트보다 범위가 넓다. Task 완료 조건에 반드시 포함한다 (build만 돌리고 넘어가면 lint 실패를 놓친다) |

### 폴링·타이머 있는 컴포넌트 테스트
- `setInterval` 등으로 폴링·재시도하는 컴포넌트는 테스트 시작부터 `vi.useFakeTimers()`를 쓴다. real timer로 두면 interval이 테스트 실행 중 실제로 발동해 순차 mock 큐를 어긋나게 만든다.
- mock은 "호출 순서대로 값을 내주는 큐"가 아니라 "현재 서버 상태를 들고 있다가 요청에 맞춰 읽고 쓰는 작은 가짜 서버 함수"로 작성한다 — 실제 폴링·재제출 흐름을 그대로 흉내낼 수 있고, 호출 횟수·순서에 결합되지 않는다.

### 클라이언트가 보낸 id 배열 검증
- API가 id 배열(예: `venueIds`, `candidateIds`)을 받으면 **존재 검증과 중복 제거를 둘 다** 한다. 존재 검증만 하면 같은 id를 여러 번 보내 집계(득표수 등)를 부풀리는 것을 막지 못한다.

## Architecture

순환 의존 방지를 위해 역방향 의존은 금지한다. 의존성이 적은 것부터 구현한다.

| 순서 | 디렉토리 | 허용 의존성 |
|---|---|---|
| 1 | `types/` | 없음 |
| 2 | `config/` | types |
| 3 | `lib/` | types, config |
| 4 | `services/` | types, config, lib |
| 5 | `hooks/` | types, config, lib, services |
| 6 | `components/` | types, config, lib, hooks |
| 7 | `app/` | 모두 |
