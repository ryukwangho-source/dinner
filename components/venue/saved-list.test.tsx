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
    pricePerPerson: 22000,
    savedAt: "2026-08-12T00:10:00.000Z",
  },
  {
    id: "s2",
    venueId: "gangnam-charcoal",
    name: "숯불향 강남점",
    category: "고깃집",
    region: "강남역",
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

  it("장소 A 삭제 클릭 → A는 사라지고 B는 남는다", async () => {
    const user = userEvent.setup();
    render(<SavedList items={items} />);
    await user.click(screen.getAllByRole("button", { name: "삭제" })[0]);

    expect(fetch).toHaveBeenCalledWith("/api/saved/s1", expect.objectContaining({ method: "DELETE" }));
    expect(await screen.findByText("숯불향 강남점")).toBeInTheDocument();
    expect(screen.queryByText("호프집 강남불빛")).not.toBeInTheDocument();
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

  it("모두 삭제 확인 → 목록이 0건이 되고 빈 상태 문구가 나타난다", async () => {
    const user = userEvent.setup();
    render(<SavedList items={items} />);
    await user.click(screen.getByRole("button", { name: "모두 삭제" }));
    await user.click(await screen.findByRole("button", { name: "모두 삭제하기" }));

    expect(fetch).toHaveBeenCalledWith("/api/saved", expect.objectContaining({ method: "DELETE" }));
    expect(await screen.findByText("저장된 장소가 없어요")).toBeInTheDocument();
  });
});
