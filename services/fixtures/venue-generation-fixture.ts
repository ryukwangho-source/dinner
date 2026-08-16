import type { Venue } from "@/types/recommendation";

/**
 * GENERATE_FIXTURE=1(테스트·E2E)용 결정적 회식 후보 풀.
 * 1차(식사)·2차(술) 업종이 각각 5곳 이상 섞이도록 구성해 실 웹검색 없이
 * rankVenueCandidates·splitByCourse 후처리를 그대로 태워 실제와 같은 응답 모양을 만든다.
 */
export function venueGenerationFixture(region: string): Venue[] {
  const base: Omit<Venue, "id" | "region" | "name">[] = [
    { category: "고깃집", rating: 4.6, reviewCount: 1200, viewCount: 9600, pricePerPerson: 28000, walkingMinutes: 5 },
    { category: "일식", rating: 4.8, reviewCount: 540, viewCount: 4320, pricePerPerson: 42000, walkingMinutes: 8 },
    { category: "고깃집", rating: 4.4, reviewCount: 730, viewCount: 5840, pricePerPerson: 27000, walkingMinutes: 3 },
    { category: "횟집", rating: 4.5, reviewCount: 480, viewCount: 3840, pricePerPerson: 35000, walkingMinutes: 10 },
    { category: "곱창", rating: 4.4, reviewCount: 500, viewCount: 4000, pricePerPerson: 19000, walkingMinutes: 6 },
    { category: "이자카야", rating: 4.5, reviewCount: 900, viewCount: 7200, pricePerPerson: 29500, walkingMinutes: 4 },
    { category: "호프", rating: 4.3, reviewCount: 610, viewCount: 4880, pricePerPerson: 22000, walkingMinutes: 7 },
    { category: "이자카야", rating: 4.2, reviewCount: 350, viewCount: 2800, pricePerPerson: 26000, walkingMinutes: 9 },
    { category: "호프", rating: 4.4, reviewCount: 420, viewCount: 3360, pricePerPerson: 21000, walkingMinutes: 2 },
    { category: "호프", rating: 4.1, reviewCount: 260, viewCount: 2080, pricePerPerson: 18000, walkingMinutes: 12 },
  ];
  const names = [
    "숯불향",
    "오마카세 결",
    "모던삼겹",
    "본가 횟집",
    "곱창골목",
    "이자카야 온기",
    "호프집 불빛",
    "이자카야 소소",
    "달빛호프",
    "포차마당",
  ];

  return base.map((v, i) => ({
    ...v,
    id: `fixture-${region}-${i}`,
    region,
    name: `${names[i]} ${region}`,
  }));
}
