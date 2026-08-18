import { COURSE_ONE_CUISINE_OF } from "@/config/venue-generation";

/**
 * 카드에 표시할 업종 라벨. 세부 업종이 큰 분류(양식·한식·중식·일식)와 다르면
 * "한식(고깃집)"처럼 큰 분류를 앞에 붙인다. 같으면(일식·중식·양식 자체이거나
 * 2차 업종처럼 매핑에 없으면) 세부 업종 그대로 보여준다.
 */
export function formatCategoryLabel(category: string): string {
  const group = COURSE_ONE_CUISINE_OF[category as keyof typeof COURSE_ONE_CUISINE_OF];
  if (group && group !== category) return `${group}(${category})`;
  return category;
}
