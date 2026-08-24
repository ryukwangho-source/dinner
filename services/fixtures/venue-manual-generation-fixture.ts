/**
 * GENERATE_FIXTURE=1(테스트·E2E)용 결정적 데이터 — 입력한 1차 장소 1곳(평점·리뷰·조회수 포함) +
 * 도보 10분 이내 2차 후보 5곳 이상(이자카야·호프 섞어서). 실 웹검색 없이
 * generateManualVenues의 후처리(withinBudget 계산·rankVenueCandidates)를 그대로 태워
 * 실제와 같은 응답 모양을 만든다.
 *
 * place 이름에 "실패"가 포함되면 장소를 확인할 수 없는 상황(오타·존재하지 않음)을
 * 흉내내 에러를 던진다 — Scenario 4(생성 실패) 재현용.
 */

export interface FixtureManualVenue {
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  viewCount: number;
  pricePerPerson: number;
  walkingMinutes: number | null;
}

export interface FixtureManualResult {
  place: FixtureManualVenue;
  courseTwo: FixtureManualVenue[];
}

export function venueManualGenerationFixture(place: string): FixtureManualResult {
  if (place.includes("실패")) {
    throw new Error("장소를 찾지 못했습니다");
  }

  return {
    place: {
      name: place,
      category: "양식",
      rating: 4.9,
      reviewCount: 336,
      viewCount: 45000,
      pricePerPerson: 35000,
      walkingMinutes: null,
    },
    courseTwo: [
      { name: "오뎅오색", category: "이자카야", rating: 4.5, reviewCount: 480, viewCount: 30000, pricePerPerson: 30000, walkingMinutes: 6 },
      { name: "생활맥주", category: "호프", rating: 4.2, reviewCount: 260, viewCount: 16000, pricePerPerson: 25000, walkingMinutes: 5 },
      { name: "야키토리 나루토", category: "이자카야", rating: 4.6, reviewCount: 390, viewCount: 25000, pricePerPerson: 35000, walkingMinutes: 6 },
      { name: "이자카야 나무", category: "이자카야", rating: 4.0, reviewCount: 620, viewCount: 40000, pricePerPerson: 35000, walkingMinutes: 5 },
      { name: "호프집 온기", category: "호프", rating: 4.3, reviewCount: 190, viewCount: 12000, pricePerPerson: 22000, walkingMinutes: 8 },
    ],
  };
}
