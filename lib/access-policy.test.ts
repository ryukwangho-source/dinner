import { describe, expect, it } from "vitest";
import { isPublicRequest } from "./access-policy";

describe("isPublicRequest", () => {
  it("친구가 받은 투표 링크로 보기·투표하기는 비밀번호 없이 된다", () => {
    expect(isPublicRequest("GET", "/vote/abc123")).toBe(true);
    expect(isPublicRequest("GET", "/api/votes/abc123")).toBe(true);
    expect(isPublicRequest("POST", "/api/votes/abc123/ballot")).toBe(true);
  });

  it("잠금 해제 화면과 API는 열려 있다", () => {
    expect(isPublicRequest("GET", "/unlock")).toBe(true);
    expect(isPublicRequest("POST", "/api/unlock")).toBe(true);
  });

  it("장소 추천(Claude 사용)·저장 목록·투표 생성/삭제·홈은 잠긴다", () => {
    expect(isPublicRequest("GET", "/")).toBe(false);
    expect(isPublicRequest("POST", "/api/venues/generate")).toBe(false);
    expect(isPublicRequest("GET", "/api/venues/generate/job1")).toBe(false);
    expect(isPublicRequest("GET", "/saved")).toBe(false);
    expect(isPublicRequest("GET", "/api/saved")).toBe(false);
    expect(isPublicRequest("POST", "/api/saved")).toBe(false);
    expect(isPublicRequest("DELETE", "/api/saved/1")).toBe(false);
    expect(isPublicRequest("GET", "/vote/new")).toBe(false);
    expect(isPublicRequest("GET", "/api/votes")).toBe(false);
    expect(isPublicRequest("POST", "/api/votes")).toBe(false);
    expect(isPublicRequest("DELETE", "/api/votes/abc123")).toBe(false);
    expect(isPublicRequest("GET", "/results")).toBe(false);
  });
});
