import { describe, expect, it } from "vitest";
import { computeDeadline } from "@/lib/vote-deadline";

const NOW = new Date("2026-08-12T14:00:00.000Z");

describe("computeDeadline", () => {
  it('"30m" → 기준 시각으로부터 30분 뒤', () => {
    expect(computeDeadline("30m", NOW).toISOString()).toBe("2026-08-12T14:30:00.000Z");
  });

  it('"1h" → 기준 시각으로부터 1시간 뒤', () => {
    expect(computeDeadline("1h", NOW).toISOString()).toBe("2026-08-12T15:00:00.000Z");
  });

  it('"3h" → 기준 시각으로부터 3시간 뒤', () => {
    expect(computeDeadline("3h", NOW).toISOString()).toBe("2026-08-12T17:00:00.000Z");
  });

  it('"tomorrow" → 다음 날 23:59:59.999', () => {
    const deadline = computeDeadline("tomorrow", NOW);
    expect(deadline.getFullYear()).toBe(2026);
    expect(deadline.getMonth()).toBe(7); // 0-indexed: August
    expect(deadline.getDate()).toBe(13);
    expect(deadline.getHours()).toBe(23);
    expect(deadline.getMinutes()).toBe(59);
    expect(deadline.getSeconds()).toBe(59);
  });
});
