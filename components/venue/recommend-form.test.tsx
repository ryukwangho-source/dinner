import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { RecommendForm } from "@/components/venue/recommend-form";

describe("RecommendForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("인원수·예산을 비운 채 추천받기를 누르면 입력해주세요 안내가 표시되고 이동하지 않는다", async () => {
    const user = userEvent.setup();
    render(<RecommendForm />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "오산역" }));
    await user.click(screen.getByRole("button", { name: "추천받기" }));

    expect(await screen.findAllByText("입력해주세요")).toHaveLength(2);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("유효한 입력으로 제출하면 결과 화면으로 이동한다", async () => {
    const user = userEvent.setup();
    render(<RecommendForm />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "오산역" }));
    await user.type(screen.getByLabelText("인원수"), "8");
    await user.type(screen.getByLabelText("인원당 가용예산"), "30000");
    await user.click(screen.getByRole("button", { name: "추천받기" }));

    expect(pushMock).toHaveBeenCalledWith(
      `/results?region=${encodeURIComponent("오산역")}&people=8&budget=30000`,
    );
  });

  it("저장한 장소 보기 링크가 /saved를 가리킨다", () => {
    render(<RecommendForm />);
    expect(screen.getByRole("link", { name: /저장한 장소 보기/ })).toHaveAttribute(
      "href",
      "/saved",
    );
  });
});
