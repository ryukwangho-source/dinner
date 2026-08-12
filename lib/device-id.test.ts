import { beforeEach, describe, expect, it } from "vitest";
import { getDeviceId } from "@/lib/device-id";

describe("getDeviceId", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("최초 호출 시 새 id를 생성해 localStorage에 저장한다", () => {
    const id = getDeviceId();
    expect(id).toBeTruthy();
    expect(localStorage.getItem("dinner-device-id")).toBe(id);
  });

  it("다시 호출하면 저장된 같은 id를 반환한다", () => {
    const first = getDeviceId();
    const second = getDeviceId();
    expect(second).toBe(first);
  });
});
