import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActiveVotesList } from "@/components/vote/active-votes-list";
import type { VoteSummary } from "@/types/vote";

const votes: VoteSummary[] = [
  {
    id: "vote-open",
    candidateCount: 3,
    status: "open",
    createdAt: "2026-08-12T13:00:00.000Z",
    deadlineAt: new Date(Date.now() + 42 * 60 * 1000).toISOString(),
  },
  {
    id: "vote-closed",
    candidateCount: 2,
    status: "closed",
    createdAt: "2026-08-11T13:00:00.000Z",
    deadlineAt: "2026-08-11T14:00:00.000Z",
  },
];

describe("ActiveVotesList", () => {
  it("진행 중인 투표와 마감된 투표가 함께 목록에 나타난다", () => {
    render(<ActiveVotesList votes={votes} />);
    expect(screen.getByText("후보 3곳", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("후보 2곳", { exact: false })).toBeInTheDocument();
  });

  it("진행 중 투표에는 진행 중 배지, 마감된 투표에는 마감 배지가 붙는다", () => {
    render(<ActiveVotesList votes={votes} />);
    expect(screen.getByText("진행 중")).toBeInTheDocument();
    expect(screen.getByText("마감")).toBeInTheDocument();
  });

  it("목록 항목은 해당 /vote/[id]로 연결된다", () => {
    render(<ActiveVotesList votes={votes} />);
    expect(screen.getByRole("link", { name: /후보 3곳/ })).toHaveAttribute(
      "href",
      "/vote/vote-open",
    );
    expect(screen.getByRole("link", { name: /후보 2곳/ })).toHaveAttribute(
      "href",
      "/vote/vote-closed",
    );
  });

  it("투표가 없으면 아무것도 렌더하지 않는다", () => {
    const { container } = render(<ActiveVotesList votes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
