import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
let currentSearch = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { RecommendForm } from "@/components/venue/recommend-form";

async function addRegion(user: ReturnType<typeof userEvent.setup>, region: string) {
  const input = screen.getByLabelText("지역");
  await user.type(input, region);
  await user.keyboard("{Enter}");
}

describe("RecommendForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
    currentSearch = "";
  });

  it("지역·인원수·예산을 비운 채 추천받기를 누르면 입력해주세요 안내가 표시되고 이동하지 않는다", async () => {
    const user = userEvent.setup();
    render(<RecommendForm />);

    await user.click(screen.getByRole("button", { name: "추천받기" }));

    expect(await screen.findAllByText("입력해주세요")).toHaveLength(3);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("지역을 입력하고 Enter를 누르면 칩으로 추가된다", async () => {
    const user = userEvent.setup();
    render(<RecommendForm />);

    await addRegion(user, "동탄역");

    expect(screen.getByText("동탄역")).toBeInTheDocument();
    expect(screen.getByLabelText("지역")).toHaveValue("");
  });

  it("추가된 지역 칩의 삭제 버튼을 누르면 제거된다", async () => {
    const user = userEvent.setup();
    render(<RecommendForm />);

    await addRegion(user, "동탄역");
    await user.click(screen.getByRole("button", { name: "동탄역 삭제" }));

    expect(screen.queryByText("동탄역")).not.toBeInTheDocument();
  });

  it("여러 지역을 입력하고 유효한 값으로 제출하면 결과 화면으로 이동한다", async () => {
    const user = userEvent.setup();
    render(<RecommendForm />);

    await addRegion(user, "동탄역");
    await addRegion(user, "강남역");
    await user.type(screen.getByLabelText("인원수"), "8");
    await user.type(screen.getByLabelText("인원당 가용예산"), "30000");
    await user.click(screen.getByRole("button", { name: "추천받기" }));

    expect(pushMock).toHaveBeenCalledWith(
      `/results?${new URLSearchParams({ regions: "동탄역,강남역", people: "8", budget: "30000" }).toString()}`,
    );
  });

  it("URL에 region이 있으면 지역 칩으로 미리 채워진다", () => {
    currentSearch = "region=%EB%8F%99%ED%83%84%EC%97%AD";
    render(<RecommendForm />);

    expect(screen.getByText("동탄역")).toBeInTheDocument();
  });

  it("저장한 장소 보기 링크가 /saved를 가리킨다", () => {
    render(<RecommendForm />);
    expect(screen.getByRole("link", { name: /저장한 장소 보기/ })).toHaveAttribute(
      "href",
      "/saved",
    );
  });

  it("첫 진입 시 지역으로 찾기 모드가 기본이고 지역 입력 필드가 보인다", () => {
    render(<RecommendForm />);
    expect(screen.getByRole("radio", { name: "지역으로 찾기" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("지역")).toBeInTheDocument();
    expect(screen.queryByLabelText("1차 장소명")).not.toBeInTheDocument();
  });

  it("1차 장소 직접 입력 탭을 클릭하면 지역 입력 대신 1차 장소명 필드가 보인다", async () => {
    const user = userEvent.setup();
    render(<RecommendForm />);

    await user.click(screen.getByRole("radio", { name: "1차 장소 직접 입력" }));

    expect(screen.queryByLabelText("지역")).not.toBeInTheDocument();
    expect(screen.getByLabelText("1차 장소명")).toBeInTheDocument();
  });

  it("1차 장소명·인원수·예산을 입력하고 제출하면 place 쿼리로 결과 화면으로 이동한다", async () => {
    const user = userEvent.setup();
    render(<RecommendForm />);

    await user.click(screen.getByRole("radio", { name: "1차 장소 직접 입력" }));
    await user.type(screen.getByLabelText("1차 장소명"), "브리비트 강남역점");
    await user.type(screen.getByLabelText("인원수"), "8");
    await user.type(screen.getByLabelText("인원당 가용예산"), "30000");
    await user.click(screen.getByRole("button", { name: "추천받기" }));

    expect(pushMock).toHaveBeenCalledWith(
      `/results?${new URLSearchParams({ place: "브리비트 강남역점", people: "8", budget: "30000" }).toString()}`,
    );
  });

  it("1차 장소명을 비운 채 추천받기를 누르면 입력해주세요 안내가 표시되고 이동하지 않는다", async () => {
    const user = userEvent.setup();
    render(<RecommendForm />);

    await user.click(screen.getByRole("radio", { name: "1차 장소 직접 입력" }));
    await user.click(screen.getByRole("button", { name: "추천받기" }));

    expect(await screen.findAllByText("입력해주세요")).toHaveLength(3);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
