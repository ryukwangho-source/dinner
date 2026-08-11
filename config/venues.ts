import type { Venue } from "@/types/recommendation";

/**
 * 직접 큐레이션한 시드 데이터 (MVP). 실 리뷰·조회수 API 연동은 이 feature 범위 밖.
 * 지역별 개수를 의도적으로 다르게 뒀다 — 판교역은 전 구간이 다소 고가라 저예산
 * 입력 시 "예산 초과뿐" 케이스를, 여의도역은 3곳뿐이라 "시드 부족" 케이스를 실데이터로 재현한다.
 */
const VENUES: Venue[] = [
  {
    id: "gangnam-charcoal",
    name: "숯불향 강남점",
    category: "고깃집",
    region: "강남역",
    rating: 4.6,
    reviewCount: 1204,
    viewCount: 8900,
    pricePerPerson: 28000,
  },
  {
    id: "gangnam-izakaya",
    name: "이자카야 온기",
    category: "이자카야",
    region: "강남역",
    rating: 4.5,
    reviewCount: 902,
    viewCount: 6200,
    pricePerPerson: 29500,
  },
  {
    id: "gangnam-samgyup",
    name: "모던삼겹 강남",
    category: "고깃집",
    region: "강남역",
    rating: 4.4,
    reviewCount: 731,
    viewCount: 5100,
    pricePerPerson: 27000,
  },
  {
    id: "gangnam-omakase",
    name: "오마카세 결",
    category: "일식",
    region: "강남역",
    rating: 4.8,
    reviewCount: 540,
    viewCount: 4400,
    pricePerPerson: 42000,
  },
  {
    id: "gangnam-hof",
    name: "호프집 강남불빛",
    category: "호프",
    region: "강남역",
    rating: 4.3,
    reviewCount: 615,
    viewCount: 3800,
    pricePerPerson: 22000,
  },
  {
    id: "pangyo-sushi",
    name: "스시엔",
    category: "일식",
    region: "판교역",
    rating: 4.5,
    reviewCount: 480,
    viewCount: 4100,
    pricePerPerson: 22000,
  },
  {
    id: "pangyo-hanwoo",
    name: "한우마당",
    category: "고깃집",
    region: "판교역",
    rating: 4.7,
    reviewCount: 690,
    viewCount: 5300,
    pricePerPerson: 35000,
  },
  {
    id: "pangyo-bistro",
    name: "비스트로 판교",
    category: "양식",
    region: "판교역",
    rating: 4.4,
    reviewCount: 320,
    viewCount: 2800,
    pricePerPerson: 38000,
  },
  {
    id: "pangyo-izakaya",
    name: "판교 이자카야 결",
    category: "이자카야",
    region: "판교역",
    rating: 4.3,
    reviewCount: 410,
    viewCount: 3300,
    pricePerPerson: 26000,
  },
  {
    id: "pangyo-hof",
    name: "판교 호프거리",
    category: "호프",
    region: "판교역",
    rating: 4.2,
    reviewCount: 275,
    viewCount: 2100,
    pricePerPerson: 24000,
  },
  {
    id: "yeouido-gopchang",
    name: "여의도 곱창골목",
    category: "곱창",
    region: "여의도역",
    rating: 4.5,
    reviewCount: 388,
    viewCount: 2600,
    pricePerPerson: 19000,
  },
  {
    id: "yeouido-samgyup",
    name: "여의나루 삼겹살",
    category: "고깃집",
    region: "여의도역",
    rating: 4.3,
    reviewCount: 512,
    viewCount: 3100,
    pricePerPerson: 21000,
  },
  {
    id: "yeouido-pocha",
    name: "한강포차",
    category: "호프",
    region: "여의도역",
    rating: 4.1,
    reviewCount: 297,
    viewCount: 1900,
    pricePerPerson: 18000,
  },
];

export const REGIONS: readonly string[] = Array.from(
  new Set(VENUES.map((v) => v.region)),
);

export function getVenuesByRegion(region: string): Venue[] {
  return VENUES.filter((v) => v.region === region);
}

export function getVenuesByIds(ids: string[]): Venue[] {
  const idSet = new Set(ids);
  return VENUES.filter((v) => idSet.has(v.id));
}
