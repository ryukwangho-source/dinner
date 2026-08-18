import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VenueCard } from "@/components/venue/venue-card";
import type { Venue } from "@/types/recommendation";

const venue: Venue = {
  id: "gangnam-charcoal",
  name: "숯불향 강남점",
  category: "고깃집",
  region: "강남역",
  rating: 4.6,
  reviewCount: 1204,
  viewCount: 8900,
  pricePerPerson: 28000,
  walkingMinutes: 5,
};

describe("VenueCard", () => {
  it("장소명·카테고리·평점·리뷰수·조회수·1인 예상 비용을 표시한다", () => {
    render(<VenueCard venue={venue} withinBudget checked={false} onCheckedChange={() => {}} />);
    expect(screen.getByText("숯불향 강남점")).toBeInTheDocument();
    expect(screen.getByText(/고깃집/)).toBeInTheDocument();
    expect(screen.getByText(/4.6/)).toBeInTheDocument();
    expect(screen.getByText(/1,204/)).toBeInTheDocument();
    expect(screen.getByText(/8,900|8.9k/)).toBeInTheDocument();
    expect(screen.getByText(/28,000/)).toBeInTheDocument();
  });

  it("평점·리뷰·조회수의 출처 안내 문구를 표시한다", () => {
    render(<VenueCard venue={venue} withinBudget checked={false} onCheckedChange={() => {}} />);
    expect(screen.getByText(/네이버 플레이스 등 웹검색 기준/)).toBeInTheDocument();
  });

  it("withinBudget=false이면 예산 초과 배지가 보인다", () => {
    render(<VenueCard venue={venue} withinBudget={false} checked={false} onCheckedChange={() => {}} />);
    expect(screen.getByText("예산 초과")).toBeInTheDocument();
  });

  it("withinBudget=true이면 예산 초과 배지가 없다", () => {
    render(<VenueCard venue={venue} withinBudget checked={false} onCheckedChange={() => {}} />);
    expect(screen.queryByText("예산 초과")).not.toBeInTheDocument();
  });

  it("체크박스를 클릭하면 onCheckedChange가 호출된다", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<VenueCard venue={venue} withinBudget checked={false} onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("네이버 지도에서 보기 링크가 새 탭으로 이 장소를 검색한다", () => {
    render(<VenueCard venue={venue} withinBudget checked={false} onCheckedChange={() => {}} />);
    const link = screen.getByRole("link", { name: "네이버 지도에서 보기" });
    expect(link).toHaveAttribute(
      "href",
      `https://map.naver.com/p/search/${encodeURIComponent("숯불향 강남점")}`,
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("walkingMinutes가 있으면 요청 지역 기준 도보 시간을 표시한다", () => {
    render(<VenueCard venue={venue} withinBudget checked={false} onCheckedChange={() => {}} />);
    expect(screen.getByText(/도보 5분/)).toBeInTheDocument();
  });

  it("walkingMinutes가 null이면 도보 시간을 표시하지 않는다", () => {
    render(
      <VenueCard
        venue={{ ...venue, walkingMinutes: null }}
        withinBudget
        checked={false}
        onCheckedChange={() => {}}
      />,
    );
    expect(screen.queryByText(/도보/)).not.toBeInTheDocument();
  });

  it("onDismiss가 없으면 삭제 버튼이 보이지 않는다", () => {
    render(<VenueCard venue={venue} withinBudget checked={false} onCheckedChange={() => {}} />);
    expect(screen.queryByRole("button", { name: `${venue.name} 삭제` })).not.toBeInTheDocument();
  });

  it("onDismiss가 있으면 삭제 버튼이 보이고 클릭하면 호출된다", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <VenueCard
        venue={venue}
        withinBudget
        checked={false}
        onCheckedChange={() => {}}
        onDismiss={onDismiss}
      />,
    );
    await user.click(screen.getByRole("button", { name: `${venue.name} 삭제` }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
