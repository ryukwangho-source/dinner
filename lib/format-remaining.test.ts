import { describe, expect, it } from "vitest";
import { formatDeadline } from "@/lib/format-remaining";

describe("formatDeadline", () => {
  it("마감 절대 시각을 '월 일 시:분 마감' 형식으로 반환한다", () => {
    const local = new Date(2026, 7, 13, 21, 0, 0);
    expect(formatDeadline(local.toISOString())).toBe("8월 13일 21:00 마감");
  });

  it("한 자리 시·분도 두 자리로 0을 채운다", () => {
    const local = new Date(2026, 0, 5, 9, 5, 0);
    expect(formatDeadline(local.toISOString())).toBe("1월 5일 09:05 마감");
  });
});
