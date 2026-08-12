# venue-live-generation 구현 계획

## 아키텍처 결정

| 결정 | 선택 | 이유 |
|---|---|---|
| 생성 실행 방식 | SQLite job store + fire-and-forget 백그라운드 실행 + 클라이언트 폴링 | travel의 job-store/generation-runner 패턴을 그대로 이식 — "화면 이탈·새로고침에도 지속"(Scenario 2)을 만족하는 이미 검증된 유일한 패턴 |
| LLM 인증 경로 | `@anthropic-ai/claude-agent-sdk`의 `query()` (Agent 모드, 구독 인증) | dinner에는 `ANTHROPIC_API_KEY`가 없음(.env.local 없음) — travel의 폴백 경로와 동일하게 동작하며 추가 설정 불필요 |
| 캐시 키 | `region + partySize + budgetPerPerson` 조합, TTL 6시간 | spec 불변 규칙(6시간 캐싱). job store 조회만으로 캐시 레이어 역할을 겸해 별도 캐시 저장소가 불필요 |
| 재진입 지속 방식 | localStorage 없이 서버가 같은 키의 기존 job(진행 중이든 완료든)을 그대로 반환 | dinner는 입력이 URL 쿼리(region/people/budget)에 고정돼 있어 그 자체가 캐시 키다. travel은 입력이 매번 새로 제출돼 localStorage로 jobId를 들고 다녀야 했지만, dinner는 URL 재방문만으로 같은 job을 다시 찾을 수 있어 더 단순하다 |
| 저장·투표 POST 바디 | `venueIds: string[]` → `venues: Venue[]` (zod 검증) | 실시간 생성된 장소는 `config/venues.ts`의 정적 배열에 없어 id로 재조회할 수 없다. 클라이언트가 이미 들고 있는 전체 Venue 객체를 그대로 보낸다 |
| 자동화 테스트용 실호출 우회 | `GENERATE_FIXTURE=1` 환경변수로 실제 웹검색 대신 고정 fixture 사용 | travel과 동일한 패턴. 웹검색은 수 분·토큰 비용이 들고 비결정적이라 자동화 테스트(unit/E2E)에 그대로 쓸 수 없다 |
| 회식 업종 제한 | 생성 서비스가 프롬프트에 업종을 명시하고, 파싱 후 화이트리스트로 한 번 더 필터링 | LLM 프롬프트만 믿으면 카페 등이 섞일 수 있다(spec 시나리오 5) — 후처리 필터로 이중 방어 |
| 기존 시드 데이터(config/venues.ts) 처리 | 코드에 그대로 남기되 결과 화면 경로에서는 더 이상 쓰지 않는다 (fixture/개발용으로만 잠재적 재사용) | spec 제외 항목: 실패 시 시드로 폴백하지 않는다 — 삭제하면 나중에 되돌리기 어려우니 남겨만 둔다 |

## 인프라 리소스

| 리소스 | 유형 | 선언 위치 | 생성 Task |
|---|---|---|---|
| `VENUE_JOBS_DB_PATH` | Env var (선택, 기본 `data/venue-jobs.db`) | `services/venue-job-store.ts` | Task 2 |
| `GENERATE_FIXTURE` | Env var (선택, 테스트/E2E 전용) | `services/venue-generation-runner.ts` | Task 1 |
| Claude Agent SDK 구독 인증 | 외부 인증 | Claude Code 실행 환경에 이미 존재 (추가 설정 불필요) | — |

## 데이터 모델

### VenueGenerationJob
- id (required)
- status: `"pending" | "running" | "done" | "error"` (required)
- region, partySize, budgetPerPerson (요청 키, required)
- result: `RankedVenue[] | null`
- error: `string | null`
- createdAt, updatedAt (required)

## 필요 스킬

| 스킬 | 적용 Task | 용도 |
|---|---|---|
| shadcn | Task 4 | 로딩/실패 상태 컴포넌트가 프로젝트 Critical Rules(toast, variant 우선 등) 준수하는지 |
| claude-api | Task 1 | Agent SDK `query()`, `web_search` tool 사용법·모델 id 확인 |

## 영향 받는 파일

| 파일 경로 | 변경 유형 | 관련 Task |
|---|---|---|
| `config/venue-generation.ts` | New | Task 1 |
| `services/venue-generator.ts`, `.test.ts` | New | Task 1 |
| `services/fixtures/venue-generation-fixture.ts` | New | Task 1 |
| `services/venue-job-store.ts`, `.test.ts` | New | Task 2 |
| `services/venue-generation-runner.ts` | New | Task 3 |
| `app/api/venues/generate/route.ts`, `__tests__/route.test.ts` | New | Task 3 |
| `app/api/venues/generate/[jobId]/route.ts`, `__tests__/route.test.ts` | New | Task 3 |
| `components/venue/generation-status.tsx`, `.test.tsx` | New | Task 4 |
| `components/venue/venue-results-flow.tsx`, `.test.tsx` | New | Task 4 |
| `app/results/page.tsx` | Modify | Task 4 |
| `components/venue/result-list.tsx`, `.test.tsx` | Modify | Task 5 |
| `app/api/saved/route.ts`, 관련 테스트 | Modify | Task 5 |
| `app/api/votes/route.ts`, 관련 테스트 | Modify | Task 5 |
| `e2e/venue-live-generation.spec.ts` | New | Task 6 |
| `playwright.config.ts` | Modify (GENERATE_FIXTURE 환경변수 추가) | Task 6 |

## Tasks

### Task 1: 웹검색 기반 장소 생성 서비스 (fixture 모드 포함)

- **담당 시나리오**: Scenario 1 (생성 로직), Scenario 4 (실패 판정), Scenario 5 (업종 제한)
- **크기**: M (4 파일)
- **의존성**: None
- **참조**:
  - claude-api — Agent SDK `query()` + `allowedTools: ["WebSearch", "WebFetch"]` (dinner는 ANTHROPIC_API_KEY가 없어 travel의 `runAgentGeneration` 경로에 해당 — `web_search_20260209` tool은 API 키가 있을 때만 쓰는 별도 경로이므로 혼동 금지)
  - `C:\claude\travel\services\itinerary-generator.ts` (프롬프트·파싱 패턴 참조용, 복사하지 않고 회식 도메인에 맞게 재작성)
  - `C:\claude\travel\services\fixtures\generation-fixture.ts` (fixture 패턴 참조)
  - `lib/venue-ranking.ts`의 `rankVenues` (정렬 로직 재사용 — 아래 참조)
- **구현 대상**:
  - `config/venue-generation.ts` — RATING_MIN, REVIEW_MIN, GENERATION_MODEL, WEB_SEARCH_MAX_USES, ALLOWED_CATEGORIES(회식 업종 화이트리스트)
  - `services/venue-generator.ts` — 프롬프트 생성, Agent SDK 호출, 응답 파싱·검증(zod), 업종 필터링. **LLM이 반환한 순서를 그대로 쓰지 않고, 필터링된 후보 풀에 기존 `rankVenues(venues, budgetPerPerson)`를 적용해 예산적합도→평점→리뷰수→조회수 순으로 최종 상위 5곳을 선정한다** (spec 제외 항목: 정렬 기준 변경 없음)
  - `services/venue-generator.test.ts`
  - `services/fixtures/venue-generation-fixture.ts` — GENERATE_FIXTURE=1용 결정적 후보 목록 (회식 업종만, 지역별로 이름에 지역명 포함)
- **수용 기준**:
  - [ ] `GENERATE_FIXTURE=1`일 때 실제 웹검색 없이 고정 fixture로 지역당 5곳 이상의 회식 업종 후보를 반환한다
  - [ ] 반환된 모든 후보의 category가 회식 업종 화이트리스트(고깃집·이자카야·호프·횟집·일식 등 — spec.md 시나리오 5 문구 기준)에 속한다
  - [ ] LLM 응답 파싱이 실패하는 입력(불완전한 JSON 등)을 주면 함수가 에러를 던진다
  - [ ] 예산 이내 후보와 초과 후보가 섞인 fixture를 주면, 기존 `rankVenues`와 동일한 순서(예산적합도→평점→리뷰수→조회수)로 상위 5곳이 반환된다
  - [ ] 반환된 각 후보의 rating·reviewCount는 fixture/조사 결과 값 그대로이며 고정된 상수로 대체되지 않는다 (spec 불변 규칙 검증)
- **검증**: `bun run test -- services/venue-generator.test.ts`

---

### Task 2: 생성 작업 저장소 (job store + 캐시 조회)

- **담당 시나리오**: Scenario 2 (작업 지속), Scenario 3 (캐시 재사용)
- **크기**: S (2 파일)
- **의존성**: None
- **참조**:
  - `C:\claude\travel\services\job-store.ts` (그대로 이식할 패턴 — SQLite, ALTER TABLE 방어 포함)
- **구현 대상**:
  - `services/venue-job-store.ts`
  - `services/venue-job-store.test.ts`
- **수용 기준**:
  - [ ] `create()`로 job을 만들면 상태가 `pending`이고, 이후 `markRunning`/`markDone`/`markError`로 상태가 바뀐다
  - [ ] `findFresh(region, partySize, budgetPerPerson, now)`가 6시간 이내 생성된 `done` 상태 job이 있으면 그 job을 반환하고, 없거나 6시간이 지났으면 `null`을 반환한다
  - [ ] `findActive(region, partySize, budgetPerPerson)`가 같은 조합으로 `pending` 또는 `running` 상태인 job이 있으면(TTL 무관) 그 job을 반환하고, 없으면 `null`을 반환한다 — 진행 중 새로고침 시 중복 생성을 막는 데 쓴다 (Scenario 2)
  - [ ] `get(id)`로 존재하지 않는 id를 조회하면 `null`을 반환한다
- **검증**: `bun run test -- services/venue-job-store.test.ts`

---

### Checkpoint: Tasks 1-2 이후
- [ ] 모든 테스트 통과: `bun run test`
- [ ] 빌드 성공: `bun run build`
- [ ] 서비스 레벨 단독 — 아직 API/UI 미연결, 유닛 테스트로 갈음

---

### Task 3: 생성 시작 + 폴링 API (캐시 우선 조회)

- **담당 시나리오**: Scenario 1, 2, 3, 4 (API 레벨)
- **크기**: M (4 파일)
- **의존성**: Task 1 (생성 서비스), Task 2 (job store)
- **참조**:
  - `C:\claude\travel\app\api\trips\generate\route.ts`, `[jobId]\route.ts` (엔드포인트 형태 참조)
  - `C:\claude\travel\services\generation-runner.ts` (fixture 분기 포함 fire-and-forget 패턴)
- **구현 대상**:
  - `services/venue-generation-runner.ts` — `startGeneration()`: **①** `findFresh`로 6시간 이내 완료 캐시 조회 → 있으면 그 job 그대로 반환 **②** 없으면 `findActive`로 진행 중인 job 조회 → 있으면 새로 만들지 않고 그 job(jobId) 반환 **③** 둘 다 없으면 새 job 생성 + 백그라운드 실행(GENERATE_FIXTURE 분기 포함)
  - `app/api/venues/generate/route.ts` (POST), `__tests__/route.test.ts`
  - `app/api/venues/generate/[jobId]/route.ts` (GET), `__tests__/route.test.ts`
- **수용 기준**:
  - [ ] `POST /api/venues/generate`에 region/partySize/budgetPerPerson을 보내면 202와 jobId가 반환된다 (캐시·진행 중인 job이 없는 최초 요청)
  - [ ] 같은 조합으로 6시간 이내 캐시된 `done` job이 있으면 새 job을 만들지 않고 그 결과가 담긴 job이 즉시 반환된다
  - [ ] 같은 조합으로 아직 진행 중인(`pending`/`running`) job이 있는 상태에서 다시 요청하면, 새 job을 만들지 않고 기존 jobId가 그대로 반환된다 (새로고침으로 인한 중복 웹검색 방지 — Scenario 2)
  - [ ] `GET /api/venues/generate/[jobId]`로 상태를 조회하면 완료 시 결과 목록이, 실패 시 에러 메시지가 담긴다
  - [ ] 존재하지 않는 jobId를 조회하면 404가 반환된다
- **검증**: `bun run test`

---

### Task 4: 결과 화면 생성 흐름 (로딩·실패·완료 UI)

- **담당 시나리오**: Scenario 1, 2, 4 (UI 레벨)
- **크기**: M (5 파일)
- **의존성**: Task 3
- **참조**:
  - shadcn — 로딩·에러 상태 컴포넌트가 기존 Critical Rules 준수하는지 확인
  - `C:\claude\travel\app\trips\new\new-trip-flow.tsx` (phase state machine 패턴 참조)
- **구현 대상**:
  - `components/venue/generation-status.tsx`, `.test.tsx` — 로딩/실패 상태 UI (재시도 버튼 포함)
  - `components/venue/venue-results-flow.tsx`, `.test.tsx` — region/partySize/budgetPerPerson을 받아 생성 시작·폴링·결과 렌더링을 관리하는 클라이언트 컴포넌트
  - `app/results/page.tsx` — 기존 동기 `rankVenues` 호출 제거, 입력값 검증 후 `VenueResultsFlow`에 위임
- **수용 기준**:
  - [ ] `/results` 진입 시 진행 중 안내가 먼저 보이고, 생성 완료 후 자동으로 카드 5개가 표시된다
  - [ ] 생성 진행 중 새로고침해도 같은 진행 중 안내가 이어지고 처음부터 다시 생성되지 않는다
  - [ ] 생성 실패 시 실패 안내와 "다시 시도" 버튼이 보이고, 클릭하면 같은 조건으로 재시도된다
- **검증**: `bun run test`, `GENERATE_FIXTURE=1`로 Browser MCP에서 진행 중→완료 화면 전환 확인, 증거는 `artifacts/venue-live-generation/evidence/task-4.png`

---

### Checkpoint: Tasks 1-4 이후
- [ ] 모든 테스트 통과: `bun run test`
- [ ] 빌드 성공: `bun run build`
- [ ] `GENERATE_FIXTURE=1` 환경에서 "추천받기" → 로딩 → 결과 5곳까지 end-to-end 동작

---

### Task 5: 저장·투표가 실시간 생성 장소에도 동작하도록 전환

- **담당 시나리오**: Scenario 6
- **크기**: M (5 파일)
- **의존성**: Task 4 (결과 화면에서 선택할 카드가 있어야 함)
- **구현 대상**:
  - `app/api/saved/route.ts` — POST 바디를 `venueIds` → `venues: Venue[]`(zod 검증)로 전환
  - `app/api/votes/route.ts` — 동일 전환
  - `components/venue/result-list.tsx` — `handleSave`/`handleCreateVote`가 선택된 venue 객체를 직접 전송하도록 수정
  - 위 세 파일에 대응하는 기존 테스트 갱신
- **수용 기준**:
  - [ ] 결과 화면에서 카드 2개 선택 후 저장 → 저장 목록에서 그 2곳이 정상적으로 보인다 (정적 배열에 없는 장소도 저장 가능)
  - [ ] 카드 5개로 카톡 공유 → 공유 텍스트에 5곳 이름이 모두 포함된다 (기존 로직 변경 없음 재확인)
  - [ ] 카드 일부를 후보로 투표 만들기 → 투표 화면에서 정상적으로 후보가 등록되고 득표할 수 있다
- **검증**: `bun run test`

---

### Task 6: E2E 골든 패스

- **담당 시나리오**: 전체 happy path (Scenario 1, 5, 6 통합)
- **크기**: S (2 파일)
- **의존성**: Task 1-5
- **구현 대상**:
  - `e2e/venue-live-generation.spec.ts`
  - `playwright.config.ts` — webServer 환경변수에 `GENERATE_FIXTURE=1` 추가
- **수용 기준**:
  - [ ] `GENERATE_FIXTURE=1` 환경에서 지역·인원·예산 입력 → 추천받기 → 로딩 화면 → 결과 5곳(회식 업종) → 2곳 선택 저장까지 브라우저에서 실제로 동작한다
- **검증**: `bun run test:e2e`

---

## 미결정 항목

- "추천받기" 버튼에 대한 비밀번호 잠금 범위 — spec.md에서 이미 보류. 이 plan 범위 밖, 별도 후속 논의.
