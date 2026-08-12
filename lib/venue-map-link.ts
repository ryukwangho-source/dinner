/**
 * 네이버 지도 검색 링크 (링크아웃, API 키 불필요). 일반 검색(search.naver.com)은 장소 매칭이
 * 잘 안 돼 지도 검색으로 되돌렸다.
 * 지역명을 앞에 붙여 동명이소를 구분하되, 장소명에 이미 지역명이 들어있으면("한우마당 동탄" + "동탄역") 중복 붙이지 않는다.
 */
export function naverMapSearchUrl(name: string, region: string): string {
  const core = region.endsWith("역") ? region.slice(0, -1) : region;
  const searchText = name.includes(core) ? name : `${region} ${name}`;
  return `https://map.naver.com/p/search/${encodeURIComponent(searchText)}`;
}
