---
category: task-ordering
applied: discarded
---
## Task 순서는 plan.md 그대로 따름

**상황**: Step 2, Task 의존성 식별. Task 1(생성 서비스)·Task 2(job store)는 서로 독립적이라 plan.md에 적힌 순서(Task 1 → Task 2 → Task 3...)를 그대로 따름.
**판단**: 재정렬 없음.
**다시 마주칠 가능성**: 낮음 — 자명한 결정이라 기록할 가치가 크지 않지만, "재정렬 안 함"도 명시해 다음 사람이 순서를 의심하지 않게 남긴다.

---
category: spec-ambiguity
applied: not-yet
---
## Task 2: findFresh의 새 mode 파라미터 위치를 plan.md와 다르게 함

**상황**: Step 3, Task 2 구현 중. plan.md는 `findFresh(regions, partySize, budgetPerPerson, mode, now?)` 순서를 제안했지만, 기존 `findFresh`는 이미 4번째 위치 인자가 `now`였다(`findFresh(regions, partySize, budgetPerPerson, now = new Date())`). plan.md대로 mode를 4번째에 끼워 넣으면 기존 테스트·호출부의 `findFresh(..., new Date())` 호출이 Date 객체를 mode로 오인해 조용히 깨질 뻔했다.
**판단**: mode를 마지막(5번째) 파라미터로 옮기고 기본값 `"region"`을 줌 — `findFresh(regions, partySize, budgetPerPerson, now = new Date(), mode = "region")`. 기존 호출부는 한 글자도 안 바꿔도 컴파일·동작한다. `create`/`findActive`는 애초에 그런 4번째 인자가 없어서 plan.md 순서 그대로 둬도 안전했다.
**다시 마주칠 가능성**: 중간 — plan.md 작성 시점엔 실제 함수 시그니처를 한 줄씩 대조하지 않고 "새 파라미터를 앞쪽에 끼워 넣는" 직관적인 순서로 적기 쉽다. 기존 함수에 새 판별 파라미터를 추가할 때는 **기존 파라미터 뒤에, 기본값과 함께 추가한다**는 원칙을 다음 draft-plan에서 더 명시적으로 검토할 만하다.

---
category: tooling
applied: not-yet
---
## Browser MCP의 computer.screenshot이 이 세션 내내 사용 불가

**상황**: Step 3, Task 5 human review. `computer{action:"screenshot"}`이 세션 전체에 걸쳐 거의 항상 "Browser pane is not displayed, so the page is not compositing frames"로 실패했다 (resize_window로 가끔 read_page는 되살아났지만 screenshot은 끝내 안 됨). click/type 액션도 자주 timeout을 보고했지만 실제로는 반영되는 경우가 많았다(재확인 필요).
**판단**: 계획대로 `.png` 스크린샷을 못 남기고, `get_page_text`/`javascript_tool` DOM 텍스트 캡처로 증거를 대체했다(`evidence/task-5.md`). 클릭이 timeout으로 보고되면 곧바로 `javascript_tool`로 실제 DOM 상태를 재확인하고, 필요하면 `[...document.querySelectorAll(...)].find(...).click()`로 우회했다.
**다시 마주칠 가능성**: 높음 — 이 세션/환경의 Browser MCP 렌더링 파이프라인 자체의 문제로 보인다. 다음 feature에서도 Browser MCP로 human review를 할 계획이면, computer 액션 결과의 에러 메시지만 보고 실패로 단정하지 말고 항상 `get_page_text`/`location.href`로 실제 상태를 먼저 확인하는 습관을 CLAUDE.md나 관련 스킬에 명시할 만하다.

---
category: escalation
applied: not-yet
---
## Task 6: 기존 e2e 스위트의 지역명 캐시 충돌 버그를 발견했지만 직접 고치지 않음

**상황**: Step 3, Task 6 E2E 작성 후 `bun run test:e2e` 전체 스위트를 돌리자 내 새 테스트와 무관하게 `venue-vote.spec.ts`가 간헐적으로 실패했다. 원인을 추적해보니 `venue-recommendation.spec.ts`와 `venue-vote.spec.ts`가 둘 다 region="오산역"+partySize=8+budgetPerPerson=30000을 써서, 알파벳순 실행 시 recommendation이 먼저 캐시 job을 만들어버리고 vote 테스트가 그 캐시 다이얼로그를 만나 타임아웃한다. 내 파일을 빼고 돌려도 재현돼 내 변경과 무관한 기존 버그임을 확인했다.
**판단**: spec 범위 밖(이번 feature와 무관한 기존 테스트 간 지역명 충돌)이라 직접 고치지 않고 `spawn_task`로 별도 세션 제안만 남겼다(task_7500f2c3).
**다시 마주칠 가능성**: 중간 — e2e 스펙 파일들이 같은 "예시" 지역명(오산역·강남역·동탄역)을 관성적으로 재사용하는 패턴이 있다. 새 e2e 스펙을 쓸 때 다른 파일이 이미 쓰는 region/place 문자열을 grep으로 먼저 확인하는 습관이 다음 feature에도 유효할 것.
