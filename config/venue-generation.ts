/** 실시간 장소 생성 품질 문턱 (spec 불변 규칙 — 실사용 후 조정 가능) */
export const RATING_MIN = 4.0;
export const REVIEW_MIN = 20;
/** 후보 부족 시 완화된 리뷰 문턱 */
export const RELAXED_REVIEW_MIN = 5;

/** 생성 모델 */
export const GENERATION_MODEL = "claude-sonnet-5";
/** 1콜(웹 검색·종합)의 검색 횟수 상한 — 비용 절감 */
export const WEB_SEARCH_MAX_USES = 5;
/** 상위 5곳을 추리기 위해 넉넉히 조사할 후보 개수 */
export const CANDIDATE_COUNT = 8;

/** 회식에 어울리는 업종 화이트리스트 — 카페·편의점 등 회식과 무관한 곳을 걸러낸다 */
export const ALLOWED_CATEGORIES = [
  "고깃집",
  "이자카야",
  "호프",
  "일식",
  "해물",
  "찜",
  "양식",
  "곱창",
  "중식",
  "횟집",
] as const;

/** 같은 지역·인원수·예산 조합의 생성 결과를 재사용하는 유효 시간 */
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
