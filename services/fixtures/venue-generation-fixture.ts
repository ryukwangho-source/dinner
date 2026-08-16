import type { RawVenuePair } from "@/lib/venue-ranking";

/**
 * GENERATE_FIXTURE=1(테스트·E2E)용 결정적 회식 페어(1차+2차) 후보 풀.
 * rankVenuePairs 후처리를 그대로 태워 실제와 같은 응답 모양을 만든다 —
 * 근접(도보 5분 이내)·비근접 페어와 예산 이내·초과 페어가 섞이도록 구성한다.
 */
export function venueGenerationFixture(region: string): RawVenuePair[] {
  const base: {
    courseOne: Omit<RawVenuePair["courseOne"], "id" | "region" | "name">;
    courseTwo: Omit<RawVenuePair["courseTwo"], "id" | "region" | "name">;
    walkingBetweenMinutes: number;
  }[] = [
    {
      courseOne: { category: "고깃집", rating: 4.6, reviewCount: 1200, viewCount: 9600, pricePerPerson: 28000, walkingMinutes: 5 },
      courseTwo: { category: "이자카야", rating: 4.5, reviewCount: 900, viewCount: 7200, pricePerPerson: 22000, walkingMinutes: 6 },
      walkingBetweenMinutes: 3,
    },
    {
      courseOne: { category: "일식", rating: 4.8, reviewCount: 540, viewCount: 4320, pricePerPerson: 42000, walkingMinutes: 8 },
      courseTwo: { category: "호프", rating: 4.3, reviewCount: 610, viewCount: 4880, pricePerPerson: 21000, walkingMinutes: 12 },
      walkingBetweenMinutes: 4,
    },
    {
      courseOne: { category: "고깃집", rating: 4.4, reviewCount: 730, viewCount: 5840, pricePerPerson: 27000, walkingMinutes: 3 },
      courseTwo: { category: "호프", rating: 4.4, reviewCount: 420, viewCount: 3360, pricePerPerson: 21000, walkingMinutes: 5 },
      walkingBetweenMinutes: 2,
    },
    {
      courseOne: { category: "횟집", rating: 4.5, reviewCount: 480, viewCount: 3840, pricePerPerson: 35000, walkingMinutes: 10 },
      courseTwo: { category: "이자카야", rating: 4.2, reviewCount: 350, viewCount: 2800, pricePerPerson: 26000, walkingMinutes: 13 },
      walkingBetweenMinutes: 8,
    },
    {
      courseOne: { category: "곱창", rating: 4.4, reviewCount: 500, viewCount: 4000, pricePerPerson: 19000, walkingMinutes: 6 },
      courseTwo: { category: "호프", rating: 4.1, reviewCount: 260, viewCount: 2080, pricePerPerson: 18000, walkingMinutes: 9 },
      walkingBetweenMinutes: 4,
    },
    {
      courseOne: { category: "양식", rating: 4.7, reviewCount: 610, viewCount: 4880, pricePerPerson: 31000, walkingMinutes: 4 },
      courseTwo: { category: "이자카야", rating: 4.6, reviewCount: 730, viewCount: 5840, pricePerPerson: 24000, walkingMinutes: 7 },
      walkingBetweenMinutes: 9,
    },
  ];

  const names1 = ["숯불향", "오마카세 결", "모던삼겹", "본가 횟집", "곱창골목", "트라토리아 델"];
  const names2 = ["이자카야 온기", "호프집 불빛", "달빛호프", "이자카야 소소", "포차마당", "루프탑 이자카야"];

  return base.map((p, i) => ({
    courseOne: { ...p.courseOne, id: `fixture-${region}-${i}-1`, region, name: `${names1[i]} ${region}` },
    courseTwo: { ...p.courseTwo, id: `fixture-${region}-${i}-2`, region, name: `${names2[i]} ${region}` },
    walkingBetweenMinutes: p.walkingBetweenMinutes,
  }));
}
