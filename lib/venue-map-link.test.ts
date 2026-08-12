import { describe, expect, it } from "vitest";
import { naverMapSearchUrl } from "@/lib/venue-map-link";

describe("naverMapSearchUrl", () => {
  it("네이버 지도 검색 링크를 반환한다", () => {
    const url = naverMapSearchUrl("숯불향 오산역점", "오산역");
    expect(url).toContain("map.naver.com");
  });

  it("지역명을 장소명 앞에 붙여 동명이소를 구분한다", () => {
    const url = naverMapSearchUrl("이자카야 온기", "강남");
    expect(url).toContain(encodeURIComponent("강남 이자카야 온기"));
  });

  it("장소명에 지역명이 이미 포함되어 있으면 지역명을 중복해서 붙이지 않는다", () => {
    const url = naverMapSearchUrl("한우마당 동탄", "동탄역");
    expect(url).toContain(encodeURIComponent("한우마당 동탄"));
    expect(url).not.toContain(encodeURIComponent("동탄역 한우마당 동탄"));
  });
});
