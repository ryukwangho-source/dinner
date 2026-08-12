import { describe, expect, it } from "vitest";
import { formatRemaining } from "@/lib/format-remaining";

const NOW = new Date("2026-08-12T14:00:00.000Z");

describe("formatRemaining", () => {
  it("42분 남았으면 42분 남음", () => {
    const deadline = new Date(NOW.getTime() + 42 * 60 * 1000).toISOString();
    expect(formatRemaining(deadline, NOW)).toBe("42분 남음");
  });

  it("1시간 24분 남았으면 1시간 24분 남음", () => {
    const deadline = new Date(NOW.getTime() + (60 + 24) * 60 * 1000).toISOString();
    expect(formatRemaining(deadline, NOW)).toBe("1시간 24분 남음");
  });

  it("마감 시각이 지났으면 마감", () => {
    const deadline = new Date(NOW.getTime() - 1000).toISOString();
    expect(formatRemaining(deadline, NOW)).toBe("마감");
  });

  it("마감 시각과 정확히 같으면 마감", () => {
    expect(formatRemaining(NOW.toISOString(), NOW)).toBe("마감");
  });
});
