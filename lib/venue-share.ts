import type { RankedVenue } from "@/types/recommendation";

/** 추천 결과 요약 텍스트 (카톡 등 공유용) */
export function buildShareText(results: RankedVenue[]): string {
  const lines: string[] = ["📍 회식 장소 추천"];
  results.forEach(({ venue }, i) => {
    lines.push(`${i + 1}. ${venue.name} (1인 ${venue.pricePerPerson.toLocaleString("ko-KR")}원)`);
  });
  return lines.join("\n");
}

export type ShareResult = "shared" | "copied" | "failed";

/** Web Share API 우선, 미지원 시 클립보드 복사. */
async function shareOrCopy(title: string, text: string): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch {
      return "failed";
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}

/**
 * 추천 결과를 공유한다. 모바일은 Web Share 시트(카톡 선택 가능),
 * 미지원 환경은 클립보드 복사.
 */
export async function shareVenues(results: RankedVenue[]): Promise<ShareResult> {
  return shareOrCopy("회식 장소 추천", buildShareText(results));
}

/** 투표 공유 링크를 공유한다 (같은 Web Share/클립보드 패턴을 URL 하나에 재사용). */
export async function shareVoteLink(url: string): Promise<ShareResult> {
  return shareOrCopy("회식 투표", url);
}

/** "링크 복사" 버튼 전용 — Web Share 지원 여부와 무관하게 항상 클립보드로 복사한다. */
export async function copyVoteLink(url: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
