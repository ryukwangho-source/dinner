---
category: tooling
applied: rule
---
## 폴링(setInterval) 컴포넌트 테스트는 처음부터 fake timer + 서버-상태 mock으로

**상황**: Task 3, `vote-view.tsx`가 5초 폴링을 갖게 되면서 real-timer 테스트에서 폴링 interval이 테스트 실행 도중 실제로 발동해, 순차 `mockResolvedValueOnce` 큐(POST 응답을 기대한 자리에 다음 GET 폴링이 끼어듦)가 어긋나며 `detail.candidates`가 undefined인 상태로 렌더돼 죽었다.
**판단**: 테스트 파일 전체를 `vi.useFakeTimers()`로 통일하고, mock을 "호출 순서대로 값을 하나씩 내주는 큐"가 아니라 "현재 서버 상태를 들고 있다가 GET엔 그 상태를, POST(ballot)엔 상태를 갱신한 뒤 성공 응답을 주는 작은 가짜 서버 함수"로 바꿨다. 폴링·재시도·디바운스가 있는 컴포넌트는 애초에 이 패턴으로 시작하는 게 낫다.
**다시 마주칠 가능성**: 높음 — venue-recommendation에서도 `navigator.share`를 컴포넌트 테스트에서 직접 stub하다 비슷하게 실패한 적이 있다(원인은 다르지만 "비동기/타이머가 얽힌 컴포넌트를 얕은 mock으로 테스트하면 순서에 의존하게 된다"는 같은 패턴). → CLAUDE.md에 반영.

---
category: code-review
applied: rule
---
## `bun run build`는 lint 실패를 잡지 못한다 — Task 검증에 `bun run lint`를 넣는다

**상황**: Step 4 code-reviewer가 `components/vote/vote-view.tsx`의 `react-hooks/set-state-in-effect` 위반으로 `bun run lint`가 실패 중임을 지적했다. 7개 Task 내내 `bun run test`·`bun run build`만 돌렸고 `bun run lint`는 한 번도 실행하지 않아 놓쳤다 — Next.js의 내장 빌드 타임 린트는 이 프로젝트의 flat config 전체를 도는 `bun run lint`보다 검사 범위가 좁다.
**판단**: 정당한 폴링 패턴이라 규칙을 끄되 근거를 주석으로 남기는 쪽으로 고쳤다. 앞으로는 Task 완료 조건에 `bun run lint`를 포함시킨다.
**다시 마주칠 가능성**: 높음 — 재발 방지 효과가 명확하고 비용이 거의 없다(명령 하나 추가). → CLAUDE.md Testing/Commands에 반영.

---
category: code-review
applied: rule
---
## 클라이언트가 보낸 id 배열은 "존재 검증"만으론 부족하다 — 중복 제거까지 해야 한다

**상황**: Step 4 code-reviewer가 `submitBallot`에서 같은 `candidateId`를 여러 번 보내면(`[candA, candA, candA]`) 한 기기의 제출 하나가 득표수를 3표까지 부풀릴 수 있음을 직접 재현해 지적했다. venue-recommendation의 저장 API(`getVenuesByIds`)는 "존재하지 않는 id 거르기"까지는 이미 하고 있었지만, "같은 id 중복"까지는 이번에 처음 마주쳤다.
**판단**: `services/vote-store.ts`의 `submitBallot`에서 `Set`으로 중복 제거 후 실제 후보 id로만 필터링하도록 고쳤다. `app/api/votes/route.ts`의 생성 API도 "일부만 유효한 venueIds"를 조용히 통과시키던 문제를 같이 고쳐, 요청 개수와 실제 생성 개수가 다르면 400을 반환하게 했다.
**다시 마주칠 가능성**: 높음 — 사용자가 id 배열을 보내는 API를 또 만들 가능성이 크고, "존재 검증"과 "중복 제거"는 별개로 챙겨야 한다는 걸 이번에 배웠다. → CLAUDE.md에 반영.

---
category: spec-ambiguity
applied: not-yet
---
## 스냅샷 테이블의 로컬 id와 원본 id를 테스트에서 혼동

**상황**: Task 1, `vote-store.test.ts`를 처음 쓸 때 `submitBallot`에 venueId("a")를 그대로 넘겼다가 실패했다 — 실제로는 `vote_candidates`가 발급한 로컬 uuid를 써야 했다(후보가 스냅샷이라 venueId와 별개 id 공간).
**판단**: `store.get()`으로 먼저 조회해 candidate.id를 얻은 뒤 그걸로 제출하도록 테스트를 고쳤다.
**다시 마주칠 가능성**: 중간 — 스냅샷 테이블(원본과 별도 id를 발급하는 테이블)을 또 만들 때 같은 실수를 할 수 있지만, 아직 이 프로젝트에 그런 패턴이 하나뿐이라 규칙 승격은 보류.
