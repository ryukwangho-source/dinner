import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { copyVoteLink, shareVoteLink } from "@/lib/venue-share";
import { CreateVoteForm } from "@/components/vote/create-vote-form";
import type { Venue } from "@/types/recommendation";

const backMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: backMock }),
}));

vi.mock("@/lib/venue-share", () => ({
  shareVoteLink: vi.fn().mockResolvedValue("shared"),
  copyVoteLink: vi.fn().mockResolvedValue(true),
}));

function makeVenue(id: string, name: string, price: number): Venue {
  return {
    id,
    name,
    category: "고깃집",
    region: "오산역",
    rating: 4.5,
    reviewCount: 100,
    viewCount: 1000,
    pricePerPerson: price,
    walkingMinutes: null,
  };
}

const candidates: Venue[] = [
  makeVenue("a", "숯불향 오산역점", 28000),
  makeVenue("b", "이자카야 온기 오산", 29500),
  makeVenue("c", "모던삼겹 오산", 27000),
];

describe("CreateVoteForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "vote-1", deadlineAt: "2026-08-12T15:00:00.000Z" }),
      }),
    );
    vi.stubGlobal("location", { origin: "http://localhost:3110" });
  });

  it("후보 장소 이름과 가격을 표시한다", () => {
    render(<CreateVoteForm candidates={candidates} />);
    for (const venue of candidates) {
      expect(screen.getByText(venue.name)).toBeInTheDocument();
    }
  });

  it("각 후보에 평점·리뷰수·조회수가 표시된다", () => {
    render(<CreateVoteForm candidates={candidates} />);
    expect(screen.getAllByText("★ 4.5")).toHaveLength(3);
    expect(screen.getAllByText(/리뷰 100/)).toHaveLength(3);
    expect(screen.getAllByText(/조회 1.0k/)).toHaveLength(3);
  });

  it("각 후보에 네이버 지도에서 보기 링크가 있다", () => {
    render(<CreateVoteForm candidates={candidates} />);
    const links = screen.getAllByRole("link", { name: "네이버 지도에서 보기" });
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute(
      "href",
      `https://map.naver.com/p/search/${encodeURIComponent("숯불향 오산역점")}`,
    );
  });

  it("제한시간 선택 후 확정하면 POST /api/votes가 호출되고 공유 링크가 표시된다", async () => {
    const user = userEvent.setup();
    render(<CreateVoteForm candidates={candidates} />);

    await user.click(screen.getByRole("radio", { name: "1시간" }));
    await user.click(screen.getByRole("button", { name: "투표 만들기 확정" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/votes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ venues: candidates, duration: "1h" }),
      }),
    );
    expect(await screen.findByText("http://localhost:3110/vote/vote-1")).toBeInTheDocument();
  });

  it("직접 입력 선택 → 분 입력란이 나타나고, 값을 채워 확정하면 customMinutes와 함께 요청된다", async () => {
    const user = userEvent.setup();
    render(<CreateVoteForm candidates={candidates} />);

    await user.click(screen.getByRole("radio", { name: "직접 입력" }));
    const minutesInput = screen.getByRole("spinbutton", { name: "제한시간 직접 입력(분)" });
    await user.type(minutesInput, "90");
    await user.click(screen.getByRole("button", { name: "투표 만들기 확정" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/votes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ venues: candidates, duration: "custom", customMinutes: 90 }),
      }),
    );
    expect(await screen.findByText("http://localhost:3110/vote/vote-1")).toBeInTheDocument();
  });

  it("직접 입력을 고르고 분을 비워둔 채 확정하면 요청을 보내지 않는다", async () => {
    const user = userEvent.setup();
    render(<CreateVoteForm candidates={candidates} />);

    await user.click(screen.getByRole("radio", { name: "직접 입력" }));
    await user.click(screen.getByRole("button", { name: "투표 만들기 확정" }));

    expect(fetch).not.toHaveBeenCalled();
  });

  it("발급 완료 후 링크 복사 클릭 → copyVoteLink가 URL로 호출된다", async () => {
    const user = userEvent.setup();
    render(<CreateVoteForm candidates={candidates} />);

    await user.click(screen.getByRole("button", { name: "투표 만들기 확정" }));
    await screen.findByText("http://localhost:3110/vote/vote-1");
    await user.click(screen.getByRole("button", { name: "링크 복사" }));

    expect(copyVoteLink).toHaveBeenCalledWith("http://localhost:3110/vote/vote-1");
  });

  it("발급 완료 후 카톡으로 공유 클릭 → shareVoteLink가 URL로 호출된다", async () => {
    const user = userEvent.setup();
    render(<CreateVoteForm candidates={candidates} />);

    await user.click(screen.getByRole("button", { name: "투표 만들기 확정" }));
    await screen.findByText("http://localhost:3110/vote/vote-1");
    await user.click(screen.getByRole("button", { name: "카톡으로 공유" }));

    expect(shareVoteLink).toHaveBeenCalledWith("http://localhost:3110/vote/vote-1");
  });

  it("발급 완료 후 결과 화면으로 돌아가기 클릭 → 이전 화면으로 이동한다", async () => {
    const user = userEvent.setup();
    render(<CreateVoteForm candidates={candidates} />);

    await user.click(screen.getByRole("button", { name: "투표 만들기 확정" }));
    await screen.findByText("http://localhost:3110/vote/vote-1");
    await user.click(screen.getByRole("button", { name: "결과 화면으로 돌아가기" }));

    expect(backMock).toHaveBeenCalled();
  });
});
