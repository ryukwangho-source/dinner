# Venue Vote 구현 계획

## 아키텍처 결정

| 결정 | 선택 | 이유 |
|---|---|---|
| 투표 링크 상태 | `/vote/[id]` 라우트, `id`는 서버가 발급한 uuid | venue-recommendation의 "URL이 곧 상태" 철학과 동일. 로그인 없이 링크만으로 접근 가능해야 하는 spec 요구와 자연스럽게 맞음 |
| 투표 후보 전달 | 결과 화면 → `/vote/new?venueIds=a,b,c` (쿼리 파라미터) | `/results?region=...` 패턴을 그대로 재사용. 새 상태 전달 방식을 만들지 않는다 |
| 후보 스냅샷 | 투표 생성 시 후보 장소(id·이름·1인 가격)를 `vote_candidates` 테이블에 스냅샷으로 저장 | `saved-venue-store`와 동일 원칙 — 시드 데이터가 나중에 바뀌어도 이미 만든 투표는 안 흔들림 |
| 기기 식별 | `lib/device-id.ts`가 `localStorage`에 `crypto.randomUUID()`를 1회 생성해 저장, 이후 모든 투표 API 호출에 `deviceId`로 실어 보냄 | spec이 명시한 "기기 기준 best-effort 식별"의 가장 단순한 구현. 로그인이 없으므로 이 이상의 신원 확인은 범위 밖 |
| 재투표 반영 방식 | `vote_submissions` 테이블은 `(vote_id, device_id)` 복합 PK 1행 — 재제출 시 `INSERT OR REPLACE`로 덮어씀 | "같은 기기는 항상 최신 제출만 반영"이라는 불변 규칙을 스키마 레벨에서 보장 — 이전 제출이 별도 행으로 남을 여지 자체가 없다 |
| 득표수 계산 | 저장 시점에 카운트를 미리 집계하지 않고, `GET /api/votes/[id]` 호출 시점에 `vote_submissions`를 읽어 그때그때 계산 | 데이터가 매우 작은 규모(투표당 참석자 수십 명)라 매번 재계산해도 비용이 무시할 만하고, 카운트 캐시와 실제 제출이 어긋날 위험이 아예 없다 |
| 실시간 득표 갱신 | WebSocket·SSE 없이, 참석자 화면(`vote-view.tsx`)이 5초 간격으로 `GET /api/votes/[id]`를 폴링 | 소규모 사내 도구에 실시간 인프라는 과함. spec의 "실시간 공개"는 방치된 화면도 곧 최신값을 보여주면 충분하다고 판단(사용자 재확인 없이 결정 — 저비용·가역적 구현이라 draft 단계에서 확정) |
| 제한시간 계산 | `lib/vote-deadline.ts`의 순수 함수가 `"30m"\|"1h"\|"3h"\|"tomorrow"` → 마감 `Date` 변환. `"tomorrow"`는 내일 23:59:59로 계산 | 클라이언트가 아니라 서버가 마감 시각을 계산해 저장 — 기기 시계 오차·타임존 문제를 피한다 |
| 투표 제목 | 별도 제목 입력 없음, 화면엔 고정 문구("회식 투표")만 표시 | spec 시나리오 어디에도 제목 필드가 없다. wireframe의 "오늘 저녁 뭐 먹지?"는 예시 텍스트였을 뿐 — 없는 요구사항을 임의로 추가하지 않는다 |
| "진행 중인 투표" 목록 범위 | 개인·세션 구분 없이 전체 투표를 생성 시각 역순으로 나열 (저장 목록과 동일하게 전체 공유) | 로그인이 없어 "내가 만든 투표"를 구분할 방법이 없다. venue-recommendation의 저장 목록과 동일한 무인증·전체공유 모델을 그대로 따른다 |
| 저장소 | SQLite(`better-sqlite3`), `data/votes.db`, 테이블 3개(votes, vote_candidates, vote_submissions) | 프로젝트 전체가 이미 이 패턴(`saved-venue-store.ts`) — 새 인프라 없이 확장 |
| 선택 없이 투표 만들기/투표하기 시도 | (투표 만들기) `disabled` 없이 클릭 핸들러에서 검사해 `toast.error`로 안내 — spec 시나리오 2가 "안내가 나타나고"를 명시적으로 요구하기 때문. (참석자 투표하기) spec에 해당 시나리오가 없어 venue-recommendation과 동일하게 버튼 `disabled`만 사용 | spec 문구 차이를 그대로 반영. "투표 만들기"는 다르게 만들 이유가 없는데도 서로 다른 방식을 썼던(코드 리뷰에서 지적됐던) 실수를 반복하지 않기 위해, 각 케이스가 spec에 실제로 뭐라고 썼는지부터 확인하고 결정 |

## 인프라 리소스

| 리소스 | 유형 | 선언 위치 | 생성 Task |
|---|---|---|---|
| `data/votes.db` | SQLite 파일 | `services/vote-store.ts`가 생성, `data/`는 이미 `.gitignore`에 있음 | Task 1 |
| `components/ui/progress.tsx` | shadcn 컴포넌트 | `bunx shadcn@latest add progress` | Task 3 |

## 데이터 모델

### Vote
- id (uuid)
- deadlineAt (ISO datetime)
- createdAt (ISO datetime)

### VoteCandidate
- id (uuid)
- voteId → Vote
- venueId, name, pricePerPerson (생성 시점 스냅샷)

### VoteSubmission
- voteId → Vote
- deviceId (string)
- selectedCandidateIds (string[])
- submittedAt (ISO datetime)
- (voteId, deviceId) 복합 PK — 기기당 최신 제출 1건만 존재

### VoteDetail (API 응답 전용, 저장 안 함)
- id, deadlineAt, isClosed (boolean)
- candidates → { id, name, pricePerPerson, voteCount }[]
- mySelection → string[] (호출한 deviceId의 현재 선택, 없으면 [])

## 필요 스킬

| 스킬 | 적용 Task | 용도 |
|---|---|---|
| shadcn | 2, 3, 6 | `ToggleGroup`(제한시간 선택), `Progress`(득표 막대), `Badge`(진행중/마감), `Card`. Critical Rules를 아키텍처 결정 전에 확인(CLAUDE.md 원칙) |
| next-best-practices | 2, 3, 5, 6 | Route Handlers, 동적 세그먼트(`[id]`) params, `searchParams` 비동기 처리 |
| vercel-react-best-practices | 3 | 폴링 `setInterval`의 정리(cleanup)·의존성 관리, 불필요한 리렌더 방지 |
| web-design-guidelines | Checkpoint 2 | 모바일 레이아웃 최종 점검 |

## 영향 받는 파일

| 파일 경로 | 변경 유형 | 관련 Task |
|---|---|---|
| `types/vote.ts` | New | 1 |
| `services/vote-store.ts` (+test) | New | 1 |
| `lib/vote-deadline.ts` (+test) | New | 1 |
| `lib/device-id.ts` (+test) | New | 3 |
| `lib/format-remaining.ts` (+test) | New | 3 |
| `app/api/votes/route.ts` (+test) | New | 2, 6 (GET 목록) |
| `app/api/votes/[id]/route.ts` (+test) | New | 3, 5 |
| `app/api/votes/[id]/ballot/route.ts` (+test) | New | 3, 4, 5 |
| `components/vote/create-vote-form.tsx` (+test) | New | 2 |
| `app/vote/new/page.tsx` | New | 2 |
| `components/vote/vote-view.tsx` (+test) | New | 3, 4, 5 |
| `app/vote/[id]/page.tsx` | New | 3 |
| `components/vote/active-votes-list.tsx` (+test) | New | 6 |
| `components/venue/result-list.tsx` | Modify — "투표 만들기" 버튼, "진행 중인 투표" 섹션 추가 | 2, 6 |
| `app/results/page.tsx` | Modify — 투표 목록 조회해 `ResultList`에 전달 | 6 |
| `e2e/venue-vote.spec.ts` | New | 7 |
| `playwright.config.ts` | Modify — `VOTES_DB_PATH` env 추가 | 1 |

## Tasks

### Task 1: 투표 데이터 모델 + 스토어

- **담당 시나리오**: 불변 규칙 전체(마감 후 미반영·득표수 정확성·재투표 최신만 반영), Scenario 1·3·4·5·6의 데이터 계층
- **크기**: M (4 파일)
- **의존성**: None (venue-recommendation의 `types/recommendation.ts`, `config/venues.ts`는 이미 존재)
- **참조**: `services/saved-venue-store.ts`(동일 패턴 재사용)
- **구현 대상**:
  - `types/vote.ts`
  - `lib/vote-deadline.ts` + test (`"30m"|"1h"|"3h"|"tomorrow"` → Date, 순수 함수)
  - `services/vote-store.ts` + test (`better-sqlite3`, `data/votes.db`)
  - `playwright.config.ts` (Modify — `webServer.env`에 `VOTES_DB_PATH: "data/votes-e2e.db"` 추가)
- **수용 기준**:
  - [x] `"30m"` 기준 시각 14:00 → 마감 14:30, `"1h"` → 15:00, `"3h"` → 17:00, `"tomorrow"` → 다음 날 23:59:59
  - [x] 후보 3곳으로 투표를 만들면 그 3곳의 스냅샷(이름·가격)이 저장되고, 이후 `config/venues.ts`의 원본 데이터를 바꿔도 이미 만든 투표의 후보 정보는 그대로다
  - [x] 같은 기기로 후보 [A,B] 제출 후 [A,C]로 재제출 → 조회 시 B의 득표수는 0(반영 안 됨), A·C는 1씩
  - [x] 서로 다른 기기 3대가 각각 [A], [A,B], [B]를 제출하면 조회 시 A=2표, B=2표로 정확히 합산된다
  - [x] 마감 시각이 지난 투표에 제출을 시도하면 저장이 거부된다
  - [x] 전체 투표 목록 조회 시 생성 시각 역순으로 정렬된다
- **검증**: `bun run test -- vote-deadline`, `bun run test -- vote-store`

### Task 2: 투표 만들기 — 후보 확인 + 제한시간 선택 + 링크 발급

- **담당 시나리오**: Scenario 1 (full), Scenario 2 (full)
- **크기**: M (5 파일)
- **의존성**: Task 1 (`vote-store.ts`, `vote-deadline.ts`)
- **참조**: shadcn (`ToggleGroup`, `Button`), wireframe.html(venue-recommendation) 화면 "10. 선택"·"11. 발급완료", `config/venues.ts`의 `getVenuesByIds`(이미 존재)
- **구현 대상**:
  - `app/api/votes/route.ts` + test (POST 생성, GET 목록)
  - `lib/venue-share.ts` (Modify — `shareVoteLink(url: string)` 추가: 기존 `shareVenues`와 같은 Web Share API 우선·클립보드 폴백 패턴을 URL 하나 공유용으로 재사용) + test 추가
  - `components/vote/create-vote-form.tsx` + test (제한시간 선택 → 확정 → 발급 완료 상태로 전환해 링크·"카톡으로 공유"·"링크 복사"·"결과 화면으로 돌아가기" 표시 — wireframe "11. 발급완료")
  - `app/vote/new/page.tsx` (searchParams의 `venueIds` 파싱 → `getVenuesByIds`로 후보 조회 → 없거나 빈 결과면 홈으로 redirect)
  - `components/venue/result-list.tsx` (Modify — "투표 만들기" 버튼 추가, 클릭 시 `disabled` 대신 핸들러에서 0개 선택 검사 후 `toast.error("투표할 장소를 선택해주세요")`, 선택 있으면 `/vote/new?venueIds=...`로 이동)
- **수용 기준**:
  - [x] 결과 화면에서 카드 3개 체크 후 "투표 만들기" 클릭 → `/vote/new`로 이동하고 체크한 3곳이 후보로 표시된다
  - [x] 카드 선택 없이 "투표 만들기" 클릭 → "투표할 장소를 선택해주세요" 안내가 나타나고 화면 전환이 없다
  - [x] 제한시간 "1시간" 선택 후 확정 → 공유 가능한 링크(URL)가 화면에 표시된다
  - [x] 발급 완료 상태에서 "링크 복사" 클릭 → 클립보드에 그 URL이 복사된다
  - [x] 발급 완료 상태에서 "결과 화면으로 돌아가기" 클릭 → 결과 화면으로 이동한다
  - [x] 투표 생성 직후 결과 화면으로 돌아가면 "진행 중인 투표" 목록에 방금 만든 투표가 나타난다 (Task 6에서 목록 UI가 붙기 전까지는 API 응답으로만 검증)
  - [x] POST `/api/votes`에 빈 `venueIds` → 400
- **검증**: `bun run test -- votes`(route), `bun run test -- create-vote-form`, `bun run test -- venue-share`

---

### Checkpoint 1: Tasks 1-2 이후
- [x] 모든 테스트 통과: `bun run test`
- [x] 빌드 성공: `bun run build`
- [x] 결과 화면에서 후보 선택 → 투표 만들기 → 제한시간 선택 → 링크 발급까지 브라우저에서 end-to-end로 동작

---

### Task 3: 참석자 투표 — 최초 투표

- **담당 시나리오**: Scenario 3 (full)
- **크기**: M (6 파일)
- **의존성**: Task 1, 2 (발급된 투표 링크)
- **참조**: shadcn (`Progress`, `Checkbox`, `Badge` — `bunx shadcn@latest add progress` 먼저 실행), wireframe.html 화면 "12. 최초투표", vercel-react-best-practices(폴링 cleanup)
- **구현 대상**:
  - `lib/device-id.ts` + test (`localStorage` 기반, SSR 환경에서는 빈 문자열 반환)
  - `lib/format-remaining.ts` + test ("42분 남음", "1시간 24분 남음", "마감" 등 문자열 포맷)
  - `app/api/votes/[id]/route.ts` + test (GET, `?device=` 쿼리로 `mySelection` 포함)
  - `app/api/votes/[id]/ballot/route.ts` + test (POST 제출)
  - `components/vote/vote-view.tsx` + test (마운트 시 `deviceId` 확보 → 상세 조회 → 5초 간격 폴링, 언마운트 시 정리)
  - `app/vote/[id]/page.tsx`
- **수용 기준**:
  - [x] 투표 링크 접속 → 후보 목록과 각 후보의 현재 득표수가 표시된다
  - [x] 후보 2곳 체크 후 "투표하기" 클릭 → 그 2곳의 득표수가 각각 1씩 증가해 화면에 반영된다
  - [x] 제출 후 "투표하기" 버튼이 사라지거나 "투표 변경"으로 바뀐다 (Task 4에서 완성)
  - [x] 후보를 하나도 선택하지 않으면 제출 버튼이 비활성화된다
  - [x] 존재하지 않는 투표 id로 접속 시 404 처리된다
  - [x] fake timer로 5초 경과를 흘려보내면 상세 조회 API가 다시 호출된다 (다른 기기의 제출이 화면에 자동 반영되는 폴링 동작의 최소 증명)
- **검증**: `bun run test -- device-id`, `bun run test -- format-remaining`, `bun run test -- votes` (GET/[id], ballot), `bun run test -- vote-view`

### Task 4: 같은 기기에서 투표 변경

- **담당 시나리오**: Scenario 4 (full), 불변 규칙(최신 제출만 반영)
- **크기**: S (2 파일 — 모두 Modify)
- **의존성**: Task 3
- **참조**: wireframe.html 화면 "13. 투표수정"
- **구현 대상**:
  - `components/vote/vote-view.tsx` (Modify — `mySelection`이 있으면 해당 체크박스를 미리 체크, 버튼 라벨을 "투표 변경"으로, "이미 투표했어요 · 마감 전까지 바꿀 수 있어요" 안내 추가)
- **수용 기준**:
  - [x] 이미 투표한 기기로 같은 링크 재접속 → 직전 선택이 체크된 채 표시되고 버튼은 "투표 변경"이다
  - [x] 체크를 B 해제·C 추가 후 "투표 변경" 클릭 → B 득표수 -1, C 득표수 +1, A는 변화 없음
  - [x] 같은 기기로 세 번째 제출을 해도 그 기기의 반영은 항상 마지막 제출 하나뿐이다 (Task 1의 스토어 계층에서 이미 보장 — 여기선 UI가 최신 상태를 정확히 보여주는지만 확인)
- **검증**: `bun run test -- vote-view`

### Task 5: 제한시간 마감 처리

- **담당 시나리오**: Scenario 5 (full), 불변 규칙(마감 후 미반영)
- **크기**: S (2 파일)
- **의존성**: Task 4 (`vote-view.tsx`의 `mySelection`·라벨 분기 위에 `isClosed` 분기를 얹는다 — `isClosed`가 `true`면 Task 4의 프리체크·라벨 로직 자체를 건너뛰고 읽기 전용 결과만 렌더한다. 두 Task가 같은 파일의 같은 조건 트리를 다루므로 Task 4 이후에 순서대로 진행)
- **참조**: wireframe.html 화면 "14. 마감"
- **구현 대상**:
  - `app/api/votes/[id]/ballot/route.ts` (Modify — 마감 시각이 지났으면 저장을 거부하고 409 반환)
  - `components/vote/vote-view.tsx` (Modify — 최상위에서 `isClosed` 분기를 먼저 검사해 체크박스·제출 버튼·Task 4의 프리체크/라벨 로직을 전부 건너뛰고 "투표가 마감되었어요" + 최종 득표수만 표시)
- **수용 기준**:
  - [x] 마감 시각이 지난 투표 링크 접속 → 체크박스·"투표하기"/"투표 변경" 버튼이 보이지 않고 최종 득표수만 표시된다
  - [x] 마감 전 미투표 기기가 마감 후 접속해도 투표할 수 없다 (제출 UI 자체가 없음)
  - [x] 마감 전 이미 투표했던 기기가 마감 후 접속해도 선택을 바꿀 수 없다 (제출 UI 자체가 없음)
- **검증**: `bun run test -- votes` (ballot 마감 거부), `bun run test -- vote-view`

### Task 6: 진행 중인 투표 목록

- **담당 시나리오**: Scenario 6 (full)
- **크기**: M (3 파일)
- **의존성**: Task 1 (목록 조회), Task 2 (링크 대상)
- **참조**: shadcn (`Badge`), wireframe.html 화면 "2. 기본"의 "진행 중인 투표" 섹션
- **구현 대상**:
  - `components/vote/active-votes-list.tsx` + test
  - `app/results/page.tsx` (Modify — `getVoteStore().listAll()` 호출해 `ResultList`에 전달)
  - `components/venue/result-list.tsx` (Modify — `ActiveVotesList` 렌더, 각 항목 클릭 시 `/vote/[id]`로 이동)
- **수용 기준**:
  - [x] 진행 중인 투표와 마감된 투표가 함께 있을 때 목록에 둘 다 나타난다
  - [x] 진행 중 투표에는 "진행 중" 배지, 마감된 투표에는 "마감" 배지가 붙는다
  - [x] 목록 항목 클릭 → 해당 `/vote/[id]`로 이동한다
- **검증**: `bun run test -- active-votes-list`, `bun run test -- result-list`

---

### Checkpoint 2: Tasks 3-6 이후
- [x] 모든 테스트 통과: `bun run test`
- [x] 빌드 성공: `bun run build`
- [x] 투표 만들기 → 다른 기기(시크릿 창)로 투표 → 원래 화면에서 득표수 갱신 확인 → 재투표 → 마감(테스트용으로 30분 대신 매우 짧은 제한시간을 임시로 넣거나, DB의 `deadline_at`을 직접 과거로 돌려 확인)까지 브라우저에서 동작
- [x] web-design-guidelines 기준 모바일(375px) 레이아웃에 가로 스크롤 없는지 확인

---

### Task 7: E2E 수용 시나리오

- **담당 시나리오**: Scenario 1·2·3·4·6 (E2E 골든 패스), Scenario 5(마감)는 실제 대기가 필요해 유닛/컴포넌트 테스트로 커버(Task 5) — E2E에서는 DB에 이미 마감된 투표를 직접 삽입해 마감 화면만 별도 케이스로 확인
- **크기**: S (1 파일)
- **의존성**: Task 2, 3, 4, 5, 6
- **참조**: `playwright.config.ts`, CLAUDE.md Testing
- **구현 대상**:
  - `e2e/venue-vote.spec.ts`
- **수용 기준**:
  - [x] 결과 화면에서 후보 선택 없이 투표 만들기 시도 → 안내 확인 → 후보 2곳 선택 → 투표 만들기 → 제한시간 선택 → 링크 발급 확인 → 그 링크로 접속(같은 브라우저 컨텍스트, 새 페이지)해 후보 1곳 투표 → 득표수 반영 확인 → 같은 페이지에서 선택 변경 후 재투표 → 변경 반영 확인, 이 흐름이 하나의 스펙에서 전부 통과한다
  - [x] 이미 마감된 투표(DB에 과거 `deadline_at`으로 직접 삽입) 링크 접속 → 투표 UI 없이 최종 득표수만 보이는지 별도 케이스로 확인한다
- **검증**: `bun run test:e2e -- venue-vote`

---

## 미결정 항목

없음 — HOW 레벨 결정은 모두 위 아키텍처 결정 표에서 확정했다.
