import { describe, expect, it } from "vitest";
import { formatCategoryLabel } from "@/lib/venue-category-label";

describe("formatCategoryLabel", () => {
  it("큰 분류(한식)와 세부 업종이 다르면 '한식(세부업종)' 형태로 합쳐 보여준다", () => {
    expect(formatCategoryLabel("고깃집")).toBe("한식(고깃집)");
    expect(formatCategoryLabel("해물")).toBe("한식(해물)");
    expect(formatCategoryLabel("찜")).toBe("한식(찜)");
    expect(formatCategoryLabel("곱창")).toBe("한식(곱창)");
    expect(formatCategoryLabel("횟집")).toBe("한식(횟집)");
  });

  it("큰 분류와 세부 업종이 같으면 그대로 보여준다", () => {
    expect(formatCategoryLabel("일식")).toBe("일식");
    expect(formatCategoryLabel("중식")).toBe("중식");
    expect(formatCategoryLabel("양식")).toBe("양식");
  });

  it("매핑에 없는 업종(2차 등)은 그대로 보여준다", () => {
    expect(formatCategoryLabel("이자카야")).toBe("이자카야");
    expect(formatCategoryLabel("호프")).toBe("호프");
  });
});
