import { generateVenues } from "@/services/venue-generator";
import { getVenueJobStore, type VenueGenerationJob } from "@/services/venue-job-store";

/**
 * 생성 시작 — 순서대로 확인한다:
 * ① 6시간 이내 캐시된 완료 job이 있으면 그대로 반환 (재검색 없음)
 * ② 진행 중인(pending/running) job이 있으면 그 job을 그대로 반환 (새로고침으로 인한 중복 웹검색 방지)
 * ③ 둘 다 없으면 새 job을 만들고 fire-and-forget으로 백그라운드 생성을 시작한다
 */
export function startGeneration(
  regions: string[],
  partySize: number,
  budgetPerPerson: number,
): VenueGenerationJob {
  const store = getVenueJobStore();

  const cached = store.findFresh(regions, partySize, budgetPerPerson);
  if (cached) return cached;

  const active = store.findActive(regions, partySize, budgetPerPerson);
  if (active) return active;

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

  return job;
}
