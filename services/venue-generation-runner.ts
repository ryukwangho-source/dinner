import { generateManualVenues } from "@/services/venue-manual-generator";
import { generateVenues } from "@/services/venue-generator";
import { getVenueJobStore, type VenueGenerationJob } from "@/services/venue-job-store";

export interface StartGenerationResult {
  job: VenueGenerationJob;
  /** true면 이번 요청이 6시간 캐시를 그대로 재사용한 결과다 — 클라이언트가 "다시 검색할까요?"를 물어야 한다 */
  fromCache: boolean;
}

/**
 * 생성 시작 — 순서대로 확인한다:
 * ① force가 아니고 6시간 이내 캐시된 완료 job이 있으면 그대로 반환 (재검색 없음, fromCache:true)
 * ② 진행 중인(pending/running) job이 있으면 그 job을 그대로 반환 (새로고침·재검색 중복 요청으로 인한 중복 웹검색 방지)
 * ③ 둘 다 없으면(또는 force로 캐시를 건너뛰면) 새 job을 만들고 fire-and-forget으로 백그라운드 생성을 시작한다
 */
export function startGeneration(
  regions: string[],
  partySize: number,
  budgetPerPerson: number,
  force = false,
): StartGenerationResult {
  const store = getVenueJobStore();

  if (!force) {
    const cached = store.findFresh(regions, partySize, budgetPerPerson);
    if (cached) return { job: cached, fromCache: true };
  }

  const active = store.findActive(regions, partySize, budgetPerPerson);
  if (active) return { job: active, fromCache: false };

  const job = store.create(regions, partySize, budgetPerPerson);

  // fire-and-forget — 상시 구동 노드 서버라 요청이 끝나도 계속 실행된다.
  // 어떤 실패도 서버를 죽이지 않도록 IIFE 내부 try/catch + 외부 .catch로 이중 방어.
  void (async () => {
    store.markRunning(job.id);
    try {
      const { results, usage } = await generateVenues(regions, partySize, budgetPerPerson);
      store.markDone(job.id, results, usage);
    } catch (error) {
      console.error("[venue-generation] 실패:", error);
      store.markError(job.id, error instanceof Error ? error.message : "추천 생성에 실패했습니다");
    }
  })().catch((error) => {
    console.error("[venue-generation] 처리되지 않은 오류:", error);
    try {
      store.markError(job.id, "추천 생성 중 오류가 발생했습니다");
    } catch {
      /* store 오류는 무시 — 서버 유지가 우선 */
    }
  });

  return { job, fromCache: false };
}

/**
 * startGeneration과 동일한 캐시/진행중/신규생성 순서를 따르되, mode="manual"로 job store를
 * 조회·생성하고 백그라운드 생성은 {@link generateManualVenues}(1차 장소 검증 + 도보 10분 이내
 * 2차 조사)를 호출한다. regions 컬럼에는 place를 단일 원소 배열로 저장해 기존 job store 스키마를
 * 그대로 재사용한다.
 */
export function startManualGeneration(
  place: string,
  partySize: number,
  budgetPerPerson: number,
  force = false,
): StartGenerationResult {
  const store = getVenueJobStore();
  const regions = [place];

  if (!force) {
    const cached = store.findFresh(regions, partySize, budgetPerPerson, new Date(), "manual");
    if (cached) return { job: cached, fromCache: true };
  }

  const active = store.findActive(regions, partySize, budgetPerPerson, "manual");
  if (active) return { job: active, fromCache: false };

  const job = store.create(regions, partySize, budgetPerPerson, "manual");

  void (async () => {
    store.markRunning(job.id);
    try {
      const { results, usage } = await generateManualVenues(place, partySize, budgetPerPerson);
      store.markDone(job.id, results, usage);
    } catch (error) {
      console.error("[venue-manual-generation] 실패:", error);
      store.markError(job.id, error instanceof Error ? error.message : "추천 생성에 실패했습니다");
    }
  })().catch((error) => {
    console.error("[venue-manual-generation] 처리되지 않은 오류:", error);
    try {
      store.markError(job.id, "추천 생성 중 오류가 발생했습니다");
    } catch {
      /* store 오류는 무시 — 서버 유지가 우선 */
    }
  });

  return { job, fromCache: false };
}
