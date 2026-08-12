---
category: tooling
applied: rule
---
## jsdom에 pointer capture·scrollIntoView no-op 폴리필 추가

**상황**: Task 1, `recommend-form.tsx`의 shadcn `Select` 테스트가 `TypeError: target.hasPointerCapture is not a function`로 전부 실패.
**판단**: jsdom이 Radix UI가 쓰는 pointer capture API·`scrollIntoView`를 구현하지 않아 발생. `vitest.setup.ts`에 `Element.prototype`에 no-op 폴리필을 추가해 해결 — 전역 setup 파일이라 앞으로 `Select`·`Combobox`·`DropdownMenu` 등 Radix 기반 컴포넌트를 테스트할 때 자동으로 적용된다.
**다시 마주칠 가능성**: 높음 — 이미 코드(`vitest.setup.ts`)에 반영되어 재발해도 자동으로 해결됨.

---
category: tooling
applied: not-yet
---
## jsdom에서 navigator.share/clipboard를 컴포넌트 테스트에서 직접 stub하면 불안정

**상황**: Task 6, `result-list.tsx`의 카톡 공유 버튼 테스트에서 `vi.stubGlobal("navigator", ...)`와 `Object.defineProperty(navigator, "clipboard", ...)` 둘 다 시도했지만 원인 불명으로 mock이 호출되지 않았다 (같은 로직을 `lib/venue-share.test.ts`에서 직접 테스트할 땐 `vi.stubGlobal`이 정상 동작).
**판단**: 컴포넌트 테스트에서는 `navigator` 자체를 건드리지 않고, `vi.mock("@/lib/venue-share")`로 모듈 경계에서 모킹하는 쪽으로 바꿨다. `navigator` API를 직접 검증해야 하는 테스트는 그 API를 감싼 lib 함수의 단위 테스트(`venue-share.test.ts`)에만 남긴다.
**다시 마주칠 가능성**: 높음 — 카톡 공유 같은 브라우저 API 연동 기능은 이후 feature(예: venue-vote의 링크 공유)에서도 나올 수 있다.

---
category: spec-ambiguity
applied: rule
---
## plan.md 작성 시 필요 스킬의 Critical Rules를 먼저 확인하지 않아 재작업 발생

**상황**: Task 4, `draft-plan` 단계에서 "안내 문구는 토스트 라이브러리 없이 인라인 배너로"라고 아키텍처 결정을 내렸는데, `execute-plan` 중 shadcn 스킬을 다시 읽어보니 "Toast via sonner. Use toast() from sonner."가 Critical Rule로 명시돼 있었다. 결국 plan.md 결정을 뒤집고 sonner를 도입 → plan.md를 사후에 고쳐야 했다.
**판단**: `/draft-plan`의 "필요 스킬" 표에 올린 스킬(특히 shadcn)의 Critical Rules는 아키텍처 결정을 확정하기 **전에** 한 번 읽어야 한다. `CLAUDE.md`에 이 순서를 명시해 다음 feature부터 반복하지 않도록 한다.
**다시 마주칠 가능성**: 높음 — shadcn Critical Rules는 이 프로젝트의 모든 UI feature에 적용되고, "미리 안 읽으면 나중에 뒤집는다"는 패턴이 일반화 가능하다. → CLAUDE.md에 즉시 반영.

---
category: tooling
applied: rule
---
## Playwright e2e SQLite 정리는 DELETE FROM이 아니라 파일 삭제로

**상황**: Task 7, `e2e/global-setup.ts`에서 travel과 같은 "DELETE FROM 테이블"(연결은 유지) 방식을 그대로 썼더니, 두 번째 `bun run test:e2e` 실행에서 이전 실행의 레코드가 남아있는 것처럼 보였다 (실제로는 저장/삭제 버튼 accessible name이 "모두 삭제"와 부분일치해 카운트가 어긋난 테스트 버그였음 — 그 과정에서 먼저 파일 삭제 방식으로 바꿔 검증했다).
**판단**: `globalSetup`은 `webServer`보다 먼저 실행되어 아직 아무 프로세스도 DB 파일을 잡고 있지 않으므로, Windows에서도 EBUSY 위험 없이 `-e2e.db*` 파일을 통째로 지울 수 있다. DELETE FROM보다 더 확실하고 코드도 짧다. 근본 원인(테스트의 role 이름 부분일치)은 별도로 고쳤지만, 파일 삭제 방식 자체는 더 견고해 그대로 유지.
**다시 마주칠 가능성**: 높음 — `venue-vote`도 자체 SQLite 저장(투표·득표)이 필요해 같은 global-setup 패턴을 그대로 재사용하게 된다. 이미 `e2e/global-setup.ts`에 구현·주석으로 남겨 다음 feature가 참고하도록 했다.

---
category: task-ordering
applied: not-yet
---
## 계획에 없는 기능의 UI를 절반만 걸쳐두지 않는다

**상황**: Task 3, 결과 화면 액션바를 만들 때 wireframe에는 "저장/카톡공유/투표 만들기" 세 버튼이 나란히 있었지만, `venue-vote`는 아직 plan.md가 없는 상태였다.
**판단**: "투표 만들기" 버튼은 아예 렌더링하지 않기로 했다 — 클릭해도 아무 동작 안 하는 버튼을 미리 깔아두면 다음 feature 작업자가 "이미 있는 줄" 착각하거나, 사용자가 실사용 중에 죽은 버튼을 만난다. venue-vote의 plan.md에서 `result-list.tsx`를 Modify하며 추가하기로 명시.
**다시 마주칠 가능성**: 중간 — 여러 feature가 화면을 공유하는 이번 케이스(venue-recommendation ↔ venue-vote)에 특히 해당. 일반적인 원칙이긴 하나 아직 이 프로젝트에서 한 번뿐이라 규칙 승격은 보류.
