import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SavedList } from "@/components/venue/saved-list";
import type { SavedVenue } from "@/services/saved-venue-store";

const items: SavedVenue[] = [
  {
    id: "s1",
    venueId: "gangnam-hof",
    name: "호프집 강남불빛",
    category: "호프",
    region: "강남역",
    rating: 4.3,
    pricePerPerson: 22000,
    savedAt: "2026-08-12T00:10:00.000Z",
  },
  {
    id: "s2",
    venueId: "gangnam-charcoal",
    name: "숯불향 강남점",
    category: "고깃집",
    region: "강남역",
    rating: 4.6,
    pricePerPerson: 28000,
    savedAt: "2026-08-12T00:05:00.000Z",
  },
];

describe("SavedList", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  });

  it("전달받은 순서 그대로 각 장소를 렌더한다", () => {
    render(<SavedList items={items} />);
    const names = screen.getAllByTestId("saved-item-name").map((el) => el.textContent);
    expect(names).toEqual(["호프집 강남불빛", "숯불향 강남점"]);
  });

  it("항목이 없으면 빈 상태 문구가 표시된다", () => {
    render(<SavedList items={[]} />);
    expect(screen.getByText("저장된 장소가 없어요")).toBeInTheDocument();
  });

  it("각 장소에 평점이 표시된다", () => {
    render(<SavedList items={items} />);
    expect(screen.getByText("호프 · 강남역 · ★ 4.3")).toBeInTheDocument();
    expect(screen.getByText("한식(고깃집) · 강남역 · ★ 4.6")).toBeInTheDocument();
  });

  it("각 장소에 네이버 지도에서 보기 링크가 있다", () => {
    render(<SavedList items={items} />);
    const links = screen.getAllByRole("link", { name: "네이버 지도에서 보기" });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute(
      "href",
      `https://map.naver.com/p/search/${encodeURIComponent("호프집 강남불빛")}`,
    );
    expect(links[0]).toHaveAttribute("target", "_blank");
  });

  it("선택 없이는 선택 삭제 버튼이 비활성화되어 삭제 API가 호출되지 않는다", () => {
    render(<SavedList items={items} />);
    expect(screen.getByRole("button", { name: "선택 삭제" })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("장소 하나 체크 후 선택 삭제 → 그 장소만 개별 DELETE로 삭제된다", async () => {
    const user = userEvent.setup();
    render(<SavedList items={items} />);
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "선택 삭제" }));
    await user.click(await screen.findByRole("button", { name: "삭제하기" }));

    expect(fetch).toHaveBeenCalledWith("/api/saved/s1", expect.objectContaining({ method: "DELETE" }));
    expect(fetch).not.toHaveBeenCalledWith("/api/saved", expect.anything());
    expect(await screen.findByText("숯불향 강남점")).toBeInTheDocument();
    expect(screen.queryByText("호프집 강남불빛")).not.toBeInTheDocument();
  });

  it("전체 선택 후 선택 삭제 → 전체 삭제 API 한 번으로 처리되고 빈 상태가 된다", async () => {
    const user = userEvent.setup();
    render(<SavedList items={items} />);
    await user.click(screen.getByRole("button", { name: "전체 선택" }));
    await user.click(screen.getByRole("button", { name: "선택 삭제" }));
    await user.click(await screen.findByRole("button", { name: "삭제하기" }));

    expect(fetch).toHaveBeenCalledWith("/api/saved", expect.objectContaining({ method: "DELETE" }));
    expect(await screen.findByText("저장된 장소가 없어요")).toBeInTheDocument();
  });

  it("전체 선택 후 전체 해제 클릭 → 선택이 모두 풀린다", async () => {
    const user = userEvent.setup();
    render(<SavedList items={items} />);
    await user.click(screen.getByRole("button", { name: "전체 선택" }));
    await user.click(screen.getByRole("button", { name: "전체 해제" }));

    expect(screen.getByText("0곳 선택됨")).toBeInTheDocument();
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).not.toBeChecked();
    }
  });

  it("삭제 후 삭제한 지역으로 다시 추천받기 링크가 /?region=<지역>으로 뜬다", async () => {
    const user = userEvent.setup();
    render(<SavedList items={items} />);
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "선택 삭제" }));
    await user.click(await screen.findByRole("button", { name: "삭제하기" }));

    const link = await screen.findByRole("link", { name: "강남역" });
    expect(link).toHaveAttribute("href", `/?region=${encodeURIComponent("강남역")}`);
  });
});
