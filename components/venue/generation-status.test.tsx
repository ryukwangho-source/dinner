import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GenerationStatus } from "@/components/venue/generation-status";

describe("GenerationStatus", () => {
  it("loading 상태면 진행 중 안내가 보인다", () => {
    render(<GenerationStatus state="loading" />);
    expect(screen.getByText("추천 장소를 찾고 있어요")).toBeInTheDocument();
  });

  it("error 상태면 실패 안내와 다시 시도 버튼이 보인다", () => {
    render(<GenerationStatus state="error" onRetry={() => {}} />);
    expect(screen.getByText("추천 생성에 실패했어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("다시 시도 버튼 클릭 → onRetry가 호출된다", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<GenerationStatus state="error" onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalled();
  });
});
