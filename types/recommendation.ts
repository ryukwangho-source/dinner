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

export interface RecommendationQuery {
  region: string;
  partySize: number;
  budgetPerPerson: number;
}

export interface RankedVenue {
  venue: Venue;
  withinBudget: boolean;
}
