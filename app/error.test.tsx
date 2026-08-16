import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "@/app/error";

describe("ErrorBoundary", () => {
  it("안내 문구와 다시 시도·홈으로 액션을 보여준다", () => {
    render(<ErrorBoundary error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByText("문제가 발생했어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute("href", "/");
  });

  it("다시 시도 클릭 → reset이 호출된다", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<ErrorBoundary error={new Error("boom")} reset={reset} />);
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(reset).toHaveBeenCalled();
  });

  it("에러를 콘솔에 기록한다", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");
    render(<ErrorBoundary error={error} reset={vi.fn()} />);
    expect(spy).toHaveBeenCalledWith("[app-error]", error);
    spy.mockRestore();
  });
});
