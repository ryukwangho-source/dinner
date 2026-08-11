import { describe, expect, it } from "vitest";
import { validateRecommendationInput } from "@/lib/recommendation-validation";

describe("validateRecommendationInput", () => {
  it("인원수·예산이 비어있으면 각각 입력해주세요 에러를 반환한다", () => {
    const errors = validateRecommendationInput({
      region: "강남역",
      partySize: "",
      budgetPerPerson: "",
    });
    expect(errors.partySize).toBe("입력해주세요");
    expect(errors.budgetPerPerson).toBe("입력해주세요");
  });

  it("지역이 비어있으면 입력해주세요 에러를 반환한다", () => {
    const errors = validateRecommendationInput({
      region: "",
      partySize: "8",
      budgetPerPerson: "30000",
    });
    expect(errors.region).toBe("입력해주세요");
  });

  it("모든 값이 유효하면 에러가 없다", () => {
    const errors = validateRecommendationInput({
      region: "강남역",
      partySize: "8",
      budgetPerPerson: "30000",
    });
    expect(errors).toEqual({});
  });

  it("인원수가 0 이하이거나 정수가 아니면 에러를 반환한다", () => {
    expect(
      validateRecommendationInput({
        region: "강남역",
        partySize: "0",
        budgetPerPerson: "30000",
      }).partySize,
    ).toBe("입력해주세요");
    expect(
      validateRecommendationInput({
        region: "강남역",
        partySize: "3.5",
        budgetPerPerson: "30000",
      }).partySize,
    ).toBe("입력해주세요");
  });

  it("예산이 0 이하이면 에러를 반환한다", () => {
    expect(
      validateRecommendationInput({
        region: "강남역",
        partySize: "8",
        budgetPerPerson: "0",
      }).budgetPerPerson,
    ).toBe("입력해주세요");
  });
});
