/** 실시간 장소 생성 품질 문턱 (spec 불변 규칙 — 실사용 후 조정 가능) */
export const RATING_MIN = 4.0;
export const REVIEW_MIN = 20;
/** 후보 부족 시 완화된 리뷰 문턱 */
export const RELAXED_REVIEW_MIN = 5;

/** 생성 모델 */
export const GENERATION_MODEL = "claude-sonnet-5";
/** 1콜(웹 검색·종합)의 검색 횟수 상한 — 비용 절감 */
export const WEB_SEARCH_MAX_USES = 5;
/** 지역 하나당 1차·2차 각각 상위 5곳을 추리기 위해 넉넉히 조사할 후보 개수 */
export const CANDIDATE_COUNT = 12;

/** 자유 텍스트로 한 번에 입력 가능한 지역 개수 상한 (비용·시간 제한) */
export const MAX_REGIONS = 5;

/** 요청 지역 기준 도보 시간 상한(분) — 이 이내인 곳만 추천한다. 도보 시간을 알 수 없는 곳도 제외한다 */
export const MAX_WALKING_MINUTES = 10;

/** 1차(식사 위주) 업종 */
export const COURSE_ONE_CATEGORIES = [
  "고깃집",
  "일식",
  "해물",
  "찜",
  "양식",
  "곱창",
  "중식",
  "횟집",
] as const;

/** 2차(간단한 술 위주, 1차 이후 갈 만한 곳) 업종 */
export const COURSE_TWO_CATEGORIES = ["이자카야", "호프"] as const;

/**
 * 1차 세부 업종 → 큰 분류(양식·한식·중식·일식) 매핑.
 * 조사·표시에는 세부 업종을 그대로 쓰되, 1차 상위 5곳을 고를 때는 이 큰 분류
 * 기준으로 다양성을 맞춘다 — 고깃집·해물·찜·곱창·횟집이 전부 "한식"에 몰려도
 * 한 카테고리로 취급해 양식·중식·일식과 고르게 섞이게 한다.
 */
export const COURSE_ONE_CUISINE_OF: Record<(typeof COURSE_ONE_CATEGORIES)[number], string> = {
  고깃집: "한식",
  일식: "일식",
  해물: "한식",
  찜: "한식",
  양식: "양식",
  곱창: "한식",
  중식: "중식",
  횟집: "한식",
};

/** 회식에 어울리는 업종 화이트리스트 전체 — 카페·편의점 등 회식과 무관한 곳을 걸러낸다 */
export const ALLOWED_CATEGORIES = [...COURSE_ONE_CATEGORIES, ...COURSE_TWO_CATEGORIES] as const;

/** 같은 지역·인원수·예산 조합의 생성 결과를 재사용하는 유효 시간 */
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * claude-sonnet-5 1토큰당 요금(USD, 2026-08-31까지 적용되는 도입가 기준).
 * 캐시 read/write는 공식 배율(입력가의 0.1배/1.25배)을 곱해 계산한다.
 * 도입가 종료 후에는 input $3.00, output $15.00/1M로 갱신 필요.
 */
const SONNET_5_INPUT_PRICE_PER_TOKEN = 2.0 / 1_000_000;
const SONNET_5_OUTPUT_PRICE_PER_TOKEN = 10.0 / 1_000_000;
export const SONNET_5_PRICE_PER_TOKEN = {
  input: SONNET_5_INPUT_PRICE_PER_TOKEN,
  output: SONNET_5_OUTPUT_PRICE_PER_TOKEN,
  cacheRead: SONNET_5_INPUT_PRICE_PER_TOKEN * 0.1,
  cacheWrite: SONNET_5_INPUT_PRICE_PER_TOKEN * 1.25,
};
