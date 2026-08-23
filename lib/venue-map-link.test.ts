import { describe, expect, it } from "vitest";
import { naverMapSearchUrl } from "@/lib/venue-map-link";

describe("naverMapSearchUrl", () => {
  it("네이버 지도 검색 링크를 반환한다", () => {
    const url = naverMapSearchUrl("숯불향 오산역점");
    expect(url).toBe(`https://map.naver.com/p/search/${encodeURIComponent("숯불향 오산역점")}`);
  });

  it("지역명은 붙이지 않고 장소명만으로 검색한다", () => {
    // 지역은 역명·지번 주소·아파트 단지명 등 자유 텍스트라 장소명과 결합하면
    // 네이버 지도가 엉뚱한 위치로 매칭하거나("김포시 마산동 667-5") 검색결과 없음으로
    // 깨지는 사례가 반복돼(지번 주소, "동탄메타폴리스" 같은 단지명) 장소명 단독 검색으로 되돌린다.
    const url = naverMapSearchUrl("알부자 강남역점");
    expect(url).toBe(`https://map.naver.com/p/search/${encodeURIComponent("알부자 강남역점")}`);
  });
});
