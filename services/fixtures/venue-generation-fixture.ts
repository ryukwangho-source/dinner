import type { Venue } from "@/types/recommendation";

/**
 * GENERATE_FIXTURE=1(테스트·E2E)용 결정적 회식 후보 풀.
 * 실 웹검색 없이 rankVenueCandidates 후처리를 그대로 태워 실제와 같은 응답 모양을 만든다.
 */
export function venueGenerationFixture(region: string): Venue[] {
  const base: Omit<Venue, "id" | "region" | "name">[] = [
    { category: "고깃집", rating: 4.6, reviewCount: 1200, viewCount: 9600, pricePerPerson: 28000 },
    { category: "이자카야", rating: 4.5, reviewCount: 900, viewCount: 7200, pricePerPerson: 29500 },
    { category: "고깃집", rating: 4.4, reviewCount: 730, viewCount: 5840, pricePerPerson: 27000 },
    { category: "일식", rating: 4.8, reviewCount: 540, viewCount: 4320, pricePerPerson: 42000 },
    { category: "호프", rating: 4.3, reviewCount: 610, viewCount: 4880, pricePerPerson: 22000 },
    { category: "횟집", rating: 4.5, reviewCount: 480, viewCount: 3840, pricePerPerson: 35000 },
    { category: "곱창", rating: 4.4, reviewCount: 500, viewCount: 4000, pricePerPerson: 19000 },
  ];
  const names = ["숯불향", "이자카야 온기", "모던삼겹", "오마카세 결", "호프집 불빛", "본가 횟집", "곱창골목"];

  return base.map((v, i) => ({
    ...v,
    id: `fixture-${region}-${i}`,
    region,
    name: `${names[i]} ${region}`,
  }));
}
