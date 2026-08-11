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

/**
 * 추천 결과를 공유한다. 모바일은 Web Share 시트(카톡 선택 가능),
 * 미지원 환경은 클립보드 복사.
 */
export async function shareVenues(results: RankedVenue[]): Promise<ShareResult> {
  const text = buildShareText(results);
  const title = "회식 장소 추천";

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
