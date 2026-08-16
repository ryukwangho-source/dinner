import { describe, expect, it } from "vitest";
import { formatDurationKo } from "@/lib/format-duration";

describe("formatDurationKo", () => {
  it("60초 미만이면 초 단위로만 표시한다", () => {
    expect(formatDurationKo(45_000)).toBe("45초");
  });

  it("분이 딱 떨어지면 초를 붙이지 않는다", () => {
    expect(formatDurationKo(120_000)).toBe("2분");
  });

  it("분·초가 섞이면 둘 다 표시한다", () => {
    expect(formatDurationKo(90_000)).toBe("1분 30초");
  });

  it("0 이하 값은 0초로 취급한다", () => {
    expect(formatDurationKo(-500)).toBe("0초");
  });

  it("반올림해 가장 가까운 초로 맞춘다", () => {
    expect(formatDurationKo(1_500)).toBe("2초");
  });
});
