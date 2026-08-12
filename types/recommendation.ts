import { z } from "zod";

export interface Venue {
  id: string;
  name: string;
  category: string;
  region: string;
  rating: number;
  reviewCount: number;
  viewCount: number;
  pricePerPerson: number;
}

/**
 * 클라이언트가 저장·투표 요청에 실어 보내는 Venue 검증 스키마.
 * 실시간 생성된 장소는 config/venues.ts 정적 배열에 없어 id로 재조회할 수 없으므로,
 * 클라이언트가 이미 들고 있는 전체 Venue 객체를 그대로 검증해 받는다.
 */
export const venueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  region: z.string().min(1),
  rating: z.number(),
  reviewCount: z.number(),
  viewCount: z.number(),
  pricePerPerson: z.number(),
}) satisfies z.ZodType<Venue>;

export interface RecommendationQuery {
  region: string;
  partySize: number;
  budgetPerPerson: number;
}

export interface RankedVenue {
  venue: Venue;
  withinBudget: boolean;
}
