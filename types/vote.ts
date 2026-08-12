export type VoteDuration = "30m" | "1h" | "3h" | "tomorrow";

export interface VoteCandidate {
  id: string;
  venueId: string;
  name: string;
  pricePerPerson: number;
}

export interface VoteCandidateTally extends VoteCandidate {
  voteCount: number;
}

export interface VoteDetail {
  id: string;
  deadlineAt: string;
  isClosed: boolean;
  candidates: VoteCandidateTally[];
  mySelection: string[];
}

export interface VoteSummary {
  id: string;
  candidateCount: number;
  status: "open" | "closed";
  createdAt: string;
  deadlineAt: string;
}

export type SubmitBallotResult = "ok" | "not-found" | "closed";
