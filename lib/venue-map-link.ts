/** 네이버 지도 검색 링크 (링크아웃, API 키 불필요). 지역명을 앞에 붙여 동명이소를 구분한다. */
export function naverMapSearchUrl(name: string, region: string): string {
  const query = encodeURIComponent(`${region} ${name}`);
  return `https://map.naver.com/p/search/${query}`;
}
