# venue-manual-course-one 구현 계획

## 아키텍처 결정

| 결정 | 선택 | 이유 |
|---|---|---|
| 결과 데이터 형태 | 기존 `RegionRecommendation`을 그대로 재사용 (`region` 필드에 입력한 1차 장소명을 담는다) | wireframe에서 확정한 "그룹 제목 = 1차 장소명"과 정확히 일치하고, `ResultList`·`VenueCard`·저장·투표·공유 컴포넌트를 전혀 수정하지 않고 그대로 태울 수 있다 |
| 1차 카드의 walkingMinutes | `null`로 설정 | `VenueCard`가 이미 `walkingMinutes != null`일 때만 "도보 N분"을 붙이므로, null로 두면 컴포넌트 변경 없이 wireframe이 확정한 "1차 카드엔 도보시간 표시 안 함"이 그대로 나온다 |
| Job store 스키마 | 기존 `venue_jobs` 테이블에 `mode` 컬럼(`"region" \| "manual"`, 기본값 `"region"`) 추가. `regions` 컬럼은 manual일 때 `[장소명]` 단일 원소 배열로 재사용 | 새 테이블 없이 기존 캐시(findFresh)·진행중 조회(findActive)·백그라운드 지속 로직을 그대로 재사용한다. `mode` 없이 `regions` 텍스트만으로 캐시 키를 잡으면, 우연히 같은 문자열("강남역")을 지역명으로도 1차 장소명으로도 쓸 때 서로 다른 의미의 job이 캐시 충돌을 일으킬 수 있어 `mode`로 분리한다 |
| API 요청 스키마 | `POST /api/venues/generate` body에 `mode: "region" \| "manual"` 판별 필드 추가(discriminated union), 기본값 `"region"` | 엔드포인트·job store·폴링(GET `[jobId]`)을 하나로 유지해 새 라우트를 안 만들어도 된다. 기존 클라이언트(테스트 포함)는 `mode` 생략 시 기존과 100% 동일하게 동작 |
| 홈 화면 기본 모드 | "지역으로 찾기" (기존)를 기본 활성 탭으로 유지 | 사용자 결정 — 기존 사용자의 익숙한 흐름을 그대로 노출 |
| 1차 장소 검증 실패 처리 | 새 생성 서비스가 던진 에러를 기존 `startGeneration`과 동일한 catch → `markError` 경로로 흘려보낸다 | 새 에러 처리 코드 없이 기존 실패 UI(`GenerationStatus` error state)를 그대로 재사용 |

## 인프라 리소스

None — 기존 venue-live-generation의 SQLite job store·Agent SDK 구독 인증·직접 API 경로를 그대로 재사용한다.

## 데이터 모델

### VenueGenerationJob (기존 타입 확장)
- mode: `"region" | "manual"` (required, 신규 필드 — DB 컬럼 추가, 기본값 `"region"`)
- 그 외 필드(id, status, regions, partySize, budgetPerPerson, result, error, usage, createdAt, updatedAt)는 기존과 동일

## 필요 스킬

| 스킬 | 적용 Task | 용도 |
|---|---|---|
| shadcn | Task 4 | 홈 화면 모드 토글 UI — 2개 옵션 전환은 `ToggleGroup` 사용(Critical Rules), `Button` 반복 금지 |
| claude-api | Task 1 | 직접 API 경로(`web_search_20260209`, `effort`, `messages.parse`)의 최신 파라미터 형태 재확인 — 기존 `venue-generator.ts`가 이미 이 패턴을 쓰고 있어 그대로 베낀다 |

## 영향 받는 파일

| 파일 경로 | 변경 유형 | 관련 Task |
|---|---|---|
| `services/venue-manual-generator.ts`, `.test.ts` | New | Task 1 |
| `services/fixtures/venue-manual-generation-fixture.ts` | New | Task 1 |
| `services/venue-job-store.ts`, `.test.ts` | Modify | Task 2 |
| `services/venue-generation-runner.ts` | Modify | Task 3 |
| `app/api/venues/generate/route.ts` | Modify | Task 3 |
| `app/api/venues/generate/__tests__/route.test.ts` | Modify | Task 3 |
| `components/venue/recommend-form.tsx`, `.test.tsx` | Modify | Task 4 |
| `lib/recommendation-validation.ts`, `.test.ts` | Modify | Task 4 |
| `app/results/page.tsx` | Modify | Task 5 |
| `components/venue/venue-results-flow.tsx`, `.test.tsx` | Modify | Task 5 |
| `e2e/venue-manual-course-one.spec.ts` | New | Task 6 |

## Tasks

### Task 1: 1차 장소 검증 + 도보 10분 이내 2차 생성 서비스 (fixture 모드 포함) ✅

- **담당 시나리오**: Scenario 1 (생성 로직), Scenario 4 (실패 판정), Scenario 5 (업종 무관 허용)
- **크기**: M (3 파일)
- **의존성**: None
- **참조**:
  - `services/venue-generator.ts` — 프롬프트·파싱·직접 API/Agent SDK 이원 경로 패턴을 그대로 베껴 회식 장소가 아니라 "지정된 특정 장소" 기준으로 바꾼다 (복사 후 도메인에 맞게 수정, 새 파일로 분리 — 기존 지역 흐름 로직은 건드리지 않는다)
  - `services/fixtures/venue-generation-fixture.ts` — fixture 패턴 참조
  - `lib/venue-ranking.ts`의 `rankVenueCandidates` — 2차 후보 정렬·상위 5곳 선정에 재사용
- **구현 대상**:
  - `services/venue-manual-generator.ts`:
    - `generateManualVenues(place: string, partySize: number, budgetPerPerson: number, client?): Promise<{ results: RegionRecommendation[]; usage: GenerationUsage | null }>`
    - 1단계: 입력한 장소명(`place`)을 웹검색으로 조사해 정확한 이름·업종·평점·리뷰수·조회수·1인 예상 비용을 확인한다 (회식 업종 화이트리스트 검증 없음 — 그대로 받는다). 확인할 수 없으면(오타·존재하지 않음) 에러를 던진다
    - 2단계: 확인된 장소를 기준점으로 도보 `MAX_WALKING_MINUTES`(10분) 이내 2차 업종(이자카야·호프) 후보를 조사한다
    - 반환 시 1차 장소는 `RankedVenue`(withinBudget은 budgetPerPerson과 비교해 계산, `walkingMinutes: null`, `region: place`) 하나, 2차는 `rankVenueCandidates(courseTwo, budgetPerPerson)`로 상위 5곳
    - `RegionRecommendation.region`에 `place`를 그대로 담는다 (결과 화면 그룹 제목 = 입력한 장소명)
  - `services/venue-manual-generator.test.ts`
  - `services/fixtures/venue-manual-generation-fixture.ts` — `GENERATE_FIXTURE=1`용 결정적 데이터: 입력한 `place` 이름을 그대로 쓰는 1차 장소 1곳(평점·리뷰·조회수 포함) + 도보 10분 이내 2차 후보 5곳 이상(이자카야·호프 섞어서)
- **수용 기준**:
  - [x] `GENERATE_FIXTURE=1`일 때 `generateManualVenues("브리비트 강남역점", 8, 30000)` 호출 → `results[0].region`이 `"브리비트 강남역점"`이고 `courseOne.length === 1`, `courseOne[0].venue.name`에 입력한 장소명이 포함된다
  - [x] 반환된 1차 장소의 `walkingMinutes`는 `null`이다
  - [x] 도보 10분 이내 2차 후보가 5곳 이상 있는 fixture 데이터를 쓰면 `courseTwo.length === 5`이고(spec 시나리오 1 happy path), 모든 `courseTwo` 항목의 `walkingMinutes`가 `MAX_WALKING_MINUTES`(10) 이하다
  - [x] `courseTwo` 항목들의 `category`가 2차 업종(이자카야·호프)에만 속한다
  - [x] 반환된 1차·2차 각 항목의 `rating`·`reviewCount`·`viewCount`는 fixture(조사 결과) 값 그대로이며 고정 상수로 대체되지 않는다 — fixture에 항목마다 서로 다른 값을 심어 그 값이 그대로 나오는지 검증한다 (spec 불변 규칙 2)
  - [x] 카페 등 회식과 무관한 이름의 장소를 입력해도(fixture로 그런 이름을 넣었을 때) 업종을 이유로 거부되지 않고 `courseOne`에 그대로 포함된다
  - [x] 장소를 확인할 수 없는 입력(fixture에서 "실패" 포함 이름 등 의도된 실패 트리거)을 주면 함수가 에러를 던진다
- **검증**: `bun run test -- services/venue-manual-generator.test.ts` — 통과 (10/10)

---

### Task 2: Job store에 mode 구분 추가 (지역 vs 1차 직접 입력 캐시 분리) ✅

- **담당 시나리오**: Scenario 3 (캐시 재사용의 전제 — 지역 job과 섞이지 않아야 함)
- **크기**: S (2 파일)
- **의존성**: None
- **참조**:
  - `services/venue-job-store.ts` 기존 `ALTER TABLE` 없는 `CREATE TABLE IF NOT EXISTS` 패턴 — 이미 배포된 DB에 컬럼을 안전하게 추가하려면 `travel/services/job-store.ts`의 "컬럼 존재 확인 후 `ALTER TABLE ADD COLUMN`" 패턴을 참고한다 (이미 서비스 중인 `data/venue-jobs.db`에 `mode` 컬럼이 없으므로 마이그레이션 가드 필수)
- **구현 대상**:
  - `services/venue-job-store.ts`:
    - `mode` 컬럼 추가 (기존 DB에는 `hasUsageColumn`과 같은 방식으로 존재 확인 후 `ALTER TABLE venue_jobs ADD COLUMN mode TEXT NOT NULL DEFAULT 'region'`)
    - `create(regions, partySize, budgetPerPerson, mode: "region" | "manual" = "region")`
    - `findFresh(regions, partySize, budgetPerPerson, mode: "region" | "manual" = "region", now?)`, `findActive(regions, partySize, budgetPerPerson, mode: "region" | "manual" = "region")` — WHERE 절에 `AND mode = ?` 추가. **세 함수 모두 `mode` 기본값을 `"region"`으로 통일해, Task 3에서 기존 `startGeneration`의 호출부를 한 글자도 안 고쳐도 그대로 컴파일·동작하게 한다** (plan-reviewer 지적 반영 — 기본값이 없으면 기존 호출부가 깨진다)
    - `rowToJob`이 `mode`를 포함해 반환
  - `services/venue-job-store.test.ts` — 기존 케이스에 `mode` 인자 추가 + 신규 케이스
- **수용 기준**:
  - [x] `create(["강남역"], 8, 30000, "manual")`로 만든 job은 `mode`가 `"manual"`이다
  - [x] 같은 문자열("강남역")로 `mode="region"` job과 `mode="manual"` job을 각각 만들면, `findFresh(["강남역"], 8, 30000, now, "region")`은 region job만, `findFresh(["강남역"], 8, 30000, now, "manual")`은 manual job만 반환한다 (서로 캐시가 섞이지 않는다) — **구현 시 mode를 4번째가 아니라 5번째(마지막) 파라미터로 배치**(learnings.md 참고, 기존 `now` 인자 자리 보존)
  - [x] `mode` 컬럼이 없는 기존 DB 파일을 열어도 에러 없이 마이그레이션되고, 기존에 저장된 row는 `mode`가 `"region"`으로 조회된다
- **검증**: `bun run test -- services/venue-job-store.test.ts` — 통과 (20/20)

---

### Checkpoint: Tasks 1-2 이후 ✅
- [x] 모든 테스트 통과: `bun run test` (235/235)
- [x] 빌드 성공: `bun run build`
- [x] 서비스 레벨 단독 — 아직 API/UI 미연결, 유닛 테스트로 갈음

---

### Task 3: 생성 시작 API에 manual 모드 연결 ✅

- **담당 시나리오**: Scenario 1, 3, 4 (API 레벨)
- **크기**: M (3 파일)
- **의존성**: Task 1 (생성 서비스), Task 2 (job store mode)
- **참조**:
  - `services/venue-generation-runner.ts`, `app/api/venues/generate/route.ts` 기존 코드 — 그대로 분기만 추가
- **구현 대상**:
  - `services/venue-generation-runner.ts`:
    - `startManualGeneration(place, partySize, budgetPerPerson, force = false): StartGenerationResult` 추가 — `findFresh`/`findActive`/`create`를 `mode="manual"`로 호출하고, 백그라운드 실행 시 `generateManualVenues` 호출
  - `app/api/venues/generate/route.ts`:
    - body 스키마를 discriminated union으로 확장: `mode: z.literal("region").optional()` 분기(기존과 동일, `regions` 배열) | `mode: z.literal("manual")` 분기(`place: z.string().trim().min(1)`, 배열 아님)
    - `mode === "manual"`이면 `startManualGeneration` 호출, 아니면 기존 `startGeneration` 그대로 호출
  - `app/api/venues/generate/__tests__/route.test.ts` — manual 케이스 추가
- **수용 기준**:
  - [x] `POST /api/venues/generate`에 `{ mode: "manual", place: "브리비트 강남역점", partySize: 8, budgetPerPerson: 30000 }`를 보내면 202와 jobId가 반환된다 (캐시·진행 중 job 없는 최초 요청)
  - [x] 같은 조합으로 6시간 이내 캐시된 `done` job이 있으면 새 job을 만들지 않고 그 결과가 담긴 job이 즉시 반환된다 (`fromCache: true`)
  - [x] `mode` 없이 기존처럼 `{ regions: [...], partySize, budgetPerPerson }`만 보내면 기존과 동일하게(region 모드로) 동작한다 — 기존 테스트 전부 그대로 통과
  - [x] `GET /api/venues/generate/[jobId]`로 manual job 상태를 조회하면 완료 시 `result[0].region`에 입력한 장소명이, 실패 시 에러 메시지가 담긴다
  - [x] 6시간이 지난 뒤 같은 manual 조합으로 재요청하면 캐시를 쓰지 않고 `fromCache: false`로 새 job이 만들어진다 (`vi.useFakeTimers()` + `advanceTimersByTime`로 검증 — spec 시나리오 3 성공 기준 2)
- **검증**: `bun run test -- app/api/venues/generate` — 통과 (18/18)

---

### Checkpoint: Tasks 1-3 이후 ✅
- [x] 모든 테스트 통과: `bun run test` (241/241)
- [x] 빌드 성공: `bun run build`
- [x] `curl -X POST http://localhost:3110/api/venues/generate -d '{"mode":"manual","place":"브리비트 강남역점","partySize":8,"budgetPerPerson":30000}'`로 (GENERATE_FIXTURE=1) 실제 202(pending) → GET 폴링 → done, courseOne 1곳(walkingMinutes null)·courseTwo 5곳(도보 10분 이내) 확인

---

### Task 4: 홈 화면 모드 토글 + 1차 장소 직접 입력 폼 ✅

- **담당 시나리오**: Scenario 1 (입력 UI)
- **크기**: M (4 파일)
- **의존성**: None (Task 1-3과 독립적으로 병행 가능하지만, 순서상 서비스 레이어 이후 배치)
- **참조**:
  - shadcn — `ToggleGroup`(2개 옵션 전환), `FieldGroup`+`Field` 레이아웃 규칙 준수 확인
  - `artifacts/venue-manual-course-one/wireframe.html` — 홈 화면 세그먼트 토글·필드 배치
- **구현 대상**:
  - `lib/recommendation-validation.ts`: `validateManualRecommendationInput({ place, partySize, budgetPerPerson })` 추가 — place는 공백 제거 후 비어있으면 에러, partySize/budgetPerPerson은 기존 검증 재사용
  - `lib/recommendation-validation.test.ts`
  - `components/venue/recommend-form.tsx`:
    - 상단에 `ToggleGroup`("지역으로 찾기" / "1차 장소 직접 입력") 추가, 기본값 `"region"`
    - `"manual"` 선택 시 지역 입력 대신 "1차 장소명" 단일 텍스트 필드를 보여준다 (인원수·예산 필드는 공유)
    - manual 모드 제출 시 `router.push('/results?place=' + encode(place) + '&people=...&budget=...')`
  - `components/venue/recommend-form.test.tsx` — manual 모드 케이스 추가
- **수용 기준**:
  - [x] 홈 화면 첫 진입 시 "지역으로 찾기"가 활성 탭이고 기존 지역 입력 필드가 보인다
  - [x] "1차 장소 직접 입력" 탭 클릭 → 지역 입력 대신 "1차 장소명" 필드 하나가 보인다
  - [x] 1차 장소명="브리비트 강남역점", 인원수=8, 예산=30000 입력 후 "추천받기" 클릭 → `router.push`가 `place=브리비트 강남역점`을 포함한 `/results` URL로 호출된다
  - [x] 1차 장소명을 비운 채 "추천받기" 클릭 → "입력해주세요" 안내가 표시되고 이동하지 않는다
- **검증**: `bun run test -- components/venue/recommend-form.test.tsx lib/recommendation-validation.test.ts` — 통과 (10/10, 10/10)

---

### Task 5: 결과 화면에서 manual 모드 흐름 연결 ✅

- **담당 시나리오**: Scenario 1, 2, 4 (UI 통합)
- **크기**: M (3 파일)
- **의존성**: Task 3(API), Task 4(홈 화면이 만드는 URL 형태)
- **구현 대상**:
  - `app/results/page.tsx`: `searchParams`에 `place`가 있으면 manual 모드로 판단해 검증 후 `VenueResultsFlow`에 `mode="manual"`, `place`를 전달. `regions`가 있으면 기존과 동일
  - `components/venue/venue-results-flow.tsx`: props를 region 모드(`regions: string[]`)와 manual 모드(`place: string`) 판별 유니온으로 확장하고, `requestGeneration`이 모드에 맞는 body(`{mode:"manual", place, ...}` 또는 기존과 동일)를 보내도록 분기. `ResultList`에 넘기는 `regions` prop은 manual일 때 `[place]`로 구성해 그대로 재사용(컴포넌트 변경 없음)
  - `components/venue/venue-results-flow.test.tsx` — manual 모드 케이스 추가
- **수용 기준**:
  - [x] `/results?place=브리비트+강남역점&people=8&budget=30000` 진입 시 진행 중 안내가 먼저 보이고, 완료되면 "브리비트 강남역점" 카드 1개 + 2차 카드들이 표시된다
  - [x] 결과 화면 그룹 제목에 입력한 장소명("브리비트 강남역점")이 그대로 표시된다
  - [x] 생성 실패 시 실패 안내와 "다시 시도" 버튼이 보이고, 클릭하면 같은 `place`로 재시도된다 (유닛 테스트로 검증)
- **검증**: `bun run test` 통과, `GENERATE_FIXTURE=1`로 Browser MCP에서 홈(1차 직접 입력 탭)→로딩→캐시 다이얼로그→결과 화면까지 실제 확인. 스크린샷 도구가 세션 내 pane 렌더링 문제로 불가해 DOM 텍스트 증거로 대체 — `artifacts/venue-manual-course-one/evidence/task-5.md`

---

### Checkpoint: Tasks 1-5 이후 ✅
- [x] 모든 테스트 통과: `bun run test` (252/252)
- [x] 빌드 성공: `bun run build`
- [x] `GENERATE_FIXTURE=1` 환경에서 홈 "1차 장소 직접 입력" → 로딩(캐시 있어 다이얼로그) → 1차 1곳+2차 5곳 결과까지 end-to-end 동작 확인. 저장/투표 자체 클릭 검증은 Task 6 E2E로 이월

---

### Task 6: E2E 골든 패스 ✅

- **담당 시나리오**: 전체 happy path (Scenario 1, 2, 6 통합)
- **크기**: S (1 파일)
- **의존성**: Task 1-5
- **구현 대상**:
  - `e2e/venue-manual-course-one.spec.ts`
- **수용 기준**:
  - [x] `GENERATE_FIXTURE=1` 환경에서 홈 화면 → "1차 장소 직접 입력" 탭 전환 → 장소명·인원·예산 입력 → 추천받기 → 로딩 화면 → 1차 1곳+2차 5곳 결과 → 2차 카드 2곳 선택 저장까지 브라우저에서 실제로 동작한다 (spec 시나리오 6 성공 기준 1)
  - [x] 결과 화면에서 카드들로 카톡 공유(클립보드 복사 폴백 포함) → 복사된 텍스트에 1차·2차 장소 이름이 모두 포함된다 (spec 시나리오 6 성공 기준 2)
  - [x] 결과 화면에서 카드 일부를 후보로 투표 만들기 → 투표 화면(`/vote/[id]`)에 그 후보들이 정상 등록되고, 하나를 선택해 투표하면 득표수가 반영된다 (spec 시나리오 6 성공 기준 3)
- **검증**: `bun run test:e2e -- venue-manual-course-one` — 통과 (1/1). 전체 `bun run test:e2e` 스위트에서 무관한 기존 파일(`venue-vote.spec.ts`)의 지역명 캐시 충돌 버그를 발견했으나 이번 feature와 무관해 별도 task로 분리(learnings.md 참고)

---

## 미결정 항목

없음
