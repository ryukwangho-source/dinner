/**
 * 네이버 지도 검색 링크 (링크아웃, API 키 불필요).
 * 예전에는 지역명을 장소명 앞에 붙여 동명이소를 구분했지만, 지역이 역명뿐 아니라
 * 지번·도로명 주소("김포시 마산동 667-5")나 아파트 단지명("동탄메타폴리스") 같은
 * 자유 텍스트로 확장되면서 결합한 검색어가 네이버 지도에서 엉뚱한 위치로 매칭되거나
 * 검색결과 없음으로 깨지는 사례가 반복됐다. 장소명 단독 검색으로 되돌린다 —
 * 동명이소는 네이버 지도 자체 검색결과 목록에서 사용자가 고르면 된다.
 */
export function naverMapSearchUrl(name: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(name)}`;
}
