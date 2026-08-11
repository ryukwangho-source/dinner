# Venue Recommendation 구현 계획

## 아키텍처 결정

| 결정 | 선택 | 이유 |
|---|---|---|
| 시드 데이터 소스 | `config/venues.ts`에 지역별 정적 TS 배열로 큐레이션 | spec 범위상 외부 API 미사용 확정. config 계층은 의존성이 없어 어디서든 import 가능하고 마이그레이션도 불필요 |
| 결과 계산 위치 | `lib/venue-ranking.ts` 순수 함수, `app/results/page.tsx`(서버 컴포넌트)가 `searchParams`를 받아 직접 호출 | LLM 생성이 없는 결정적 계산이라 API 라운드트립·로딩 상태가 불필요. URL이 곧 상태라 새로고침·재방문에도 같은 결과가 재현되고 링크 공유도 가능 |
| 정렬 알고리즘 | ① 예산 이내 여부로 1차 분리(이내 그룹이 항상 먼저) ② 각 그룹 내부는 평점 desc → 리뷰수 desc → 조회수 desc, 동점 시 예산 근접도(차액 작은 순)로 tie-break | spec 불변 규칙("예산 이내 장소가 항상 먼저")을 지키면서, 사용자가 원한 "예산에 가까울수록 상위 노출"을 tie-break로 반영 |
| 다중 선택 상태 | 결과 화면은 클라이언트 컴포넌트(`result-list.tsx`)가 체크된 `venueId[]`를 로컬 state로 관리 | 체크박스는 네트워크 없이 즉시 반응해야 하고, 서버 호출은 "저장" 클릭 시점에만 필요 |
| 저장소 | SQLite(`better-sqlite3`), `data/saved-venues.db`, 레코드는 저장 시점 장소 스냅샷(JSON 아님 — 컬럼 단순) | travel의 `trip-store.ts`와 동일 패턴(로그인 없이 소수가 공유). 시드 데이터가 나중에 바뀌어도 이미 저장된 기록은 스냅샷이라 안 흔들림 |
| 공유 구현 | Web Share API 우선, 미지원 시 클립보드 복사 (`lib/venue-share.ts`) | travel `lib/share.ts`와 동일 패턴. 카카오톡 SDK 연동 없이 OS 공유 시트로 충분하다고 이미 확정됨 |
| 검증 경계 | 랭킹·검증·저장소는 Vitest로 직접 증명. 홈→결과→저장 골든 패스는 Playwright 1개로 마무리 | LLM 호출이 없어 travel처럼 fixture 분기나 라이브 스모크가 필요 없음 — 결정적 로직이라 유닛 테스트만으로 충분히 증명 가능 |
| 안내 문구(토스트/배너) | 별도 토스트 라이브러리 없이 인라인 상태 텍스트/배너 컴포넌트로 구현 | wireframe의 안내 문구가 전역 알림이 아니라 화면 안에 고정 노출되는 단순 배너 형태(`w-toast` 블록)라, 이 규모에 sonner 같은 전역 토스트 시스템을 들이는 건 과하다 |

## 인프라 리소스

| 리소스 | 유형 | 선언 위치 | 생성 Task |
|---|---|---|---|
| `data/saved-venues.db` | SQLite 파일 | `services/saved-venue-store.ts`가 생성, `data/`는 이미 `.gitignore`에 있음 | Task 4 |

## 데이터 모델

### Venue (시드 데이터, `config/venues.ts`)
- id (string)
- name (string)
- category (string — 예: "고깃집", "이자카야", "호프", "일식")
- region (string — 홈 화면 드롭다운 값과 1:1)
- rating (number, 5점 만점)
- reviewCount (number)
- viewCount (number)
- pricePerPerson (number, 원)

### RecommendationQuery
- region (string)
- partySize (number) — 결과 표시용, 랭킹 계산에는 쓰지 않음 (예산은 인원당 값이라 인원수가 필터링에 영향을 주지 않음)
- budgetPerPerson (number)

### RankedVenue
- venue → Venue
- withinBudget (boolean)

### SavedVenue (SQLite 레코드)
- id (uuid)
- venueId, name, category, region, pricePerPerson — 저장 시점 스냅샷
- savedAt (ISO datetime)

## 필요 스킬

| 스킬 | 적용 Task | 용도 |
|---|---|---|
| shadcn | 1, 3, 4, 5 | select, checkbox, button, badge, card 등 UI 컴포넌트. `components/ui/*` 직접 수정 금지 규칙 |
| next-best-practices | 1, 3, 4, 5 | Route Handlers, RSC 경계, `searchParams` 비동기 처리 |
| vercel-react-best-practices | 3 | 체크박스 다중 선택 리렌더 최적화 |
| web-design-guidelines | Checkpoint 2 | 최종 UI 점검 (모바일 레이아웃) |

## 영향 받는 파일

| 파일 경로 | 변경 유형 | 관련 Task |
|---|---|---|
| `types/recommendation.ts` | New | 1 |
| `config/venues.ts` | New | 1 |
| `lib/recommendation-validation.ts` (+test) | New | 1 |
| `lib/venue-ranking.ts` (+test) | New | 2 |
| `lib/venue-share.ts` (+test) | New | 6 |
| `services/saved-venue-store.ts` (+test) | New | 4 |
| `components/venue/recommend-form.tsx` (+test) | New | 1 |
| `components/venue/venue-card.tsx` (+test) | New | 3 |
| `components/venue/result-list.tsx` (+test) | New | 3, 4, 5, 6 |
| `components/venue/saved-list.tsx` (+test) | New | 4, 5 |
| `app/page.tsx` | Modify (placeholder → 입력 폼) | 1 |
| `app/results/page.tsx` | New | 3 |
| `app/saved/page.tsx` | New | 4 |
| `app/api/saved/route.ts` (+test) | New | 4, 5 (DELETE all 추가) |
| `app/api/saved/[id]/route.ts` (+test) | New | 5 |
| `e2e/venue-recommendation.spec.ts` | New | 7 |
| `.gitignore` | 확인만 (`data/`는 이미 있음) | 4 |

## Tasks

### Task 1: 홈 입력 폼 — 지역·인원수·예산 입력과 유효성

- **담당 시나리오**: Scenario 11 (full), Scenario 1 (partial — 입력까지)
- **크기**: M (5 파일)
- **의존성**: None
- **참조**: shadcn (select, input, field, button), wireframe.html 화면 "0. 기본"·"1. 입력오류"
- **구현 대상**:
  - `types/recommendation.ts`
  - `config/venues.ts` (지역별 시드 장소 배열 — 최소 2개 지역, 지역당 3곳 이상 포함해 Task 2·3의 예산초과뿐/시드부족 케이스를 실데이터로 검증 가능하게 구성)
  - `lib/recommendation-validation.ts` + `lib/recommendation-validation.test.ts`
  - `components/venue/recommend-form.tsx` + `components/venue/recommend-form.test.tsx`
  - `app/page.tsx` (Modify — placeholder 제거, 폼으로 교체)
- **수용 기준**:
  - [ ] 지역 드롭다운 옵션은 `config/venues.ts`에 있는 지역만 나온다 (자유 텍스트 입력 없음)
  - [ ] 인원수·예산을 비운 채 "추천받기" 클릭 → 각 필드 아래 "입력해주세요"가 표시되고 화면 전환은 없다
  - [ ] 지역="강남역", 인원수=8, 예산=30000 입력 후 "추천받기" 클릭 → `/results?region=강남역&people=8&budget=30000`로 이동한다
  - [ ] 홈 화면 하단에 "저장한 장소 보기 →" 링크(`href="/saved"`)가 렌더된다 (실제 이동 확인은 `/saved` 페이지가 생기는 Task 4에서 검증)
- **검증**: `bun run test -- recommendation-validation`, `bun run test -- recommend-form`

### Task 2: 추천 랭킹 로직 — 예산 우선순위 + 평점·리뷰·조회수 정렬

- **담당 시나리오**: Scenario 1 (계산 부분), Scenario 2 (full), Scenario 3 (full), Scenario 4 (full), 불변 규칙(예산 이내 우선)
- **크기**: S (2 파일)
- **의존성**: Task 1 (`types/recommendation.ts`, `config/venues.ts`)
- **참조**: 없음 (순수 함수)
- **구현 대상**:
  - `lib/venue-ranking.ts` + `lib/venue-ranking.test.ts`
- **수용 기준**:
  - [ ] 예산 이내 장소 A(1인 25,000원)와 예산 초과 장소 B(1인 40,000원)가 후보일 때, 예산 30,000원 기준으로 A가 B보다 항상 먼저 나온다
  - [ ] 후보가 6곳 이상인 지역 → 결과가 정확히 5곳으로 잘린다
  - [ ] 후보 전원이 예산 초과인 지역·예산 조합 → 5곳 모두 `withinBudget: false`로 반환되고, 예산에 가장 가까운 순으로 정렬된다
  - [ ] 시드 장소가 3곳뿐인 지역 → 정확히 3곳만 반환된다 (5곳을 채우려고 다른 지역 장소를 섞지 않는다)
  - [ ] 존재하지 않는 지역으로 조회 → 빈 배열을 반환한다
- **검증**: `bun run test -- venue-ranking`

### Task 3: 결과 화면 — 추천 카드 렌더 + 다중 선택

- **담당 시나리오**: Scenario 1 (full), Scenario 2·3·4 (표시 부분)
- **크기**: M (4 파일)
- **의존성**: Task 1 (폼에서 이동), Task 2 (랭킹 함수)
- **참조**: shadcn (card, checkbox, badge), wireframe.html 화면 "2. 기본"·"3. 예산초과뿐"·"4. 시드부족", vercel-react-best-practices
- **구현 대상**:
  - `components/venue/venue-card.tsx` + test
  - `components/venue/result-list.tsx` + test (체크박스 다중 선택 상태만 — 저장·공유·투표 버튼은 Task 4·6에서 연결)
  - `app/results/page.tsx`
- **수용 기준**:
  - [ ] 지역="강남역", 인원수=8, 예산=30000으로 접속 → 카드가 정확히 5개(시드가 5곳 이상일 때) 표시된다
  - [ ] 각 카드에 장소명·카테고리·평점·리뷰수·조회수·1인 예상 비용이 표시된다
  - [ ] `withinBudget: false`인 카드에는 "예산 초과" 배지가 보인다
  - [ ] 예산 이내 후보가 0곳인 조회 → "예산에 맞는 장소가 없어 가까운 순으로 보여드려요" 문구가 카드 목록 위에 나타나고, 카드는 5개 그대로 렌더링된다 (Scenario 3)
  - [ ] 시드 장소가 3곳뿐인 지역으로 조회 → 카드가 정확히 3개 렌더링된다 (Scenario 4)
  - [ ] 카드 체크박스를 클릭하면 선택 개수 표시가 즉시 갱신된다 (서버 왕복 없음)
- **검증**: `bun run test -- venue-card`, `bun run test -- result-list`

---

### Checkpoint 1: Tasks 1-3 이후
- [ ] 모든 테스트 통과: `bun run test`
- [ ] 빌드 성공: `bun run build`
- [ ] 홈에서 지역·인원수·예산 입력 → 결과 화면에 추천 카드가 뜨는 흐름이 브라우저에서 end-to-end로 동작 (스크린샷 `evidence/checkpoint-1.png`)

---

### Task 4: 선택 저장 + 저장 목록 화면

- **담당 시나리오**: Scenario 5 (full), Scenario 8 (full)
- **크기**: M (6 파일)
- **의존성**: Task 3 (`result-list.tsx`의 선택 상태)
- **참조**: shadcn (card, button), next-best-practices (Route Handlers), wireframe.html 화면 "5. 저장완료"·"8. 기본"
- **구현 대상**:
  - `services/saved-venue-store.ts` + test (`better-sqlite3`, `data/saved-venues.db`)
  - `app/api/saved/route.ts` + test (POST 여러 건 저장, GET 목록)
  - `components/venue/result-list.tsx` (Modify — "선택 저장" 버튼 연결, 저장 완료 토스트)
  - `components/venue/saved-list.tsx` + test
  - `app/saved/page.tsx`
- **수용 기준**:
  - [ ] 카드 2개 체크 후 "선택 저장" 클릭 → "2곳을 저장했어요" 안내가 나타난다
  - [ ] 저장 목록 화면 진입 → 방금 저장한 2곳이 보인다
  - [ ] 장소 여러 건을 저장 → 저장 목록에서 저장 시각 역순(최근 저장이 위)으로 나열된다
  - [ ] 유효하지 않은 저장 요청(빈 배열) POST → 400
  - [ ] 인증 헤더·쿠키 없이 저장 API를 호출해도 성공한다 (로그인 요구 없음)
  - [ ] 저장 레코드에는 저장자를 구분하는 필드가 없다 — 누가 저장했든 같은 저장 목록에 모인다
  - [ ] 홈 화면의 "저장한 장소 보기 →" 링크 클릭 → 저장 목록 화면으로 이동한다
- **검증**: `bun run test -- saved-venue-store`, `bun run test -- saved`, `bun run test -- saved-list`

### Task 5: 저장 목록 삭제 — 개별·전체

- **담당 시나리오**: Scenario 6 (full), Scenario 9 (full), Scenario 10 (full)
- **크기**: M (4 파일)
- **의존성**: Task 4
- **참조**: shadcn (alert-dialog — 전체 삭제 확인), wireframe.html 화면 "6. 선택없음"·"9. 빈상태"
- **구현 대상**:
  - `app/api/saved/[id]/route.ts` + test (DELETE 개별)
  - `app/api/saved/route.ts` (Modify — DELETE 전체 추가) + test
  - `components/venue/saved-list.tsx` (Modify — 개별 삭제·모두 삭제 버튼 연결, 빈 상태 렌더)
  - `components/venue/result-list.tsx` (Modify — 선택 0개 상태에서 "선택 저장" 클릭 시 경고)
- **수용 기준**:
  - [ ] 결과 화면에서 카드 선택 없이 "선택 저장" 클릭 → "저장할 장소를 선택해주세요" 안내가 나타나고 저장 목록은 변하지 않는다
  - [ ] 저장 목록에서 장소 A 삭제 → A는 사라지고 다른 장소는 그대로 남는다
  - [ ] 인증 헤더·쿠키 없이 삭제 API를 호출해도 성공한다 (로그인 요구 없음)
  - [ ] 저장 목록에 3건이 있는 상태에서 "모두 삭제" 확인 → 목록이 0건이 되고 "저장된 장소가 없어요" 문구가 나타난다
- **검증**: `bun run test -- saved`, `bun run test -- saved-list`

### Task 6: 카톡 공유

- **담당 시나리오**: Scenario 7 (full)
- **크기**: S (2 파일)
- **의존성**: Task 3 (`result-list.tsx`)
- **참조**: 없음 (travel `lib/share.ts` 패턴 재사용)
- **구현 대상**:
  - `lib/venue-share.ts` + test (`buildShareText`, `shareVenues` — Web Share API 우선, 클립보드 폴백)
  - `components/venue/result-list.tsx` (Modify — "카톡 공유" 버튼 연결)
- **수용 기준**:
  - [ ] 추천 결과 5곳으로 공유 텍스트를 만들면 5곳의 이름이 모두 포함된다
  - [ ] `navigator.share`가 있는 환경에서 공유 버튼 클릭 → `navigator.share`가 호출된다
  - [ ] `navigator.share`가 없는 환경에서 공유 버튼 클릭 → 클립보드에 복사되고 "클립보드에 복사했어요" 안내가 나타난다
- **검증**: `bun run test -- venue-share`, `bun run test -- result-list`

---

### Checkpoint 2: Tasks 4-6 이후
- [ ] 모든 테스트 통과: `bun run test`
- [ ] 빌드 성공: `bun run build`
- [ ] 저장·삭제·공유가 결과 화면에서 실제로 동작 (스크린샷 `evidence/checkpoint-2.png`)
- [ ] web-design-guidelines 기준으로 모바일(375px) 레이아웃에 가로 스크롤이 없는지 확인

---

### Task 7: E2E 수용 시나리오

- **담당 시나리오**: Scenario 1·5·8·9·10·11 (E2E 골든 패스)
- **크기**: S (1 파일)
- **의존성**: Task 4, 5, 6
- **참조**: `playwright.config.ts`, CLAUDE.md Testing
- **구현 대상**:
  - `e2e/venue-recommendation.spec.ts`
- **수용 기준**:
  - [ ] 홈에서 입력값 미완성으로 제출 → 에러 문구 확인 → 값 채워 재제출 → 결과 화면에 카드 5개 표시 → 2곳 체크 후 저장 → 저장 목록에서 확인 → 1곳 삭제 → 남은 1곳만 존재 확인, 이 흐름이 하나의 스펙에서 전부 통과한다
- **검증**: `bun run test:e2e -- venue-recommendation`

---

## 미결정 항목

없음 — HOW 레벨 결정은 모두 위 아키텍처 결정 표에서 확정했고, 사용자에게 다시 물을 만큼 변경 비용이 높은 항목은 없었다.
