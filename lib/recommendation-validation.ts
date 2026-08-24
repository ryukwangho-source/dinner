import { MAX_REGIONS } from "@/config/venue-generation";

export interface RecommendationFormInput {
  regions: string[];
  partySize: string;
  budgetPerPerson: string;
}

export interface RecommendationFormErrors {
  region?: string;
  partySize?: string;
  budgetPerPerson?: string;
}

const REQUIRED_MESSAGE = "입력해주세요";

function isPositiveInteger(value: string): boolean {
  const n = Number(value);
  return value.trim() !== "" && Number.isInteger(n) && n > 0;
}

function isPositiveNumber(value: string): boolean {
  const n = Number(value);
  return value.trim() !== "" && !Number.isNaN(n) && n > 0;
}

export function validateRecommendationInput(
  input: RecommendationFormInput,
): RecommendationFormErrors {
  const errors: RecommendationFormErrors = {};

  if (input.regions.length === 0) {
    errors.region = REQUIRED_MESSAGE;
  } else if (input.regions.length > MAX_REGIONS) {
    errors.region = `지역은 최대 ${MAX_REGIONS}곳까지 입력할 수 있어요`;
  }
  if (!isPositiveInteger(input.partySize)) {
    errors.partySize = REQUIRED_MESSAGE;
  }
  if (!isPositiveNumber(input.budgetPerPerson)) {
    errors.budgetPerPerson = REQUIRED_MESSAGE;
  }

  return errors;
}

export interface ManualRecommendationFormInput {
  place: string;
  partySize: string;
  budgetPerPerson: string;
}

export interface ManualRecommendationFormErrors {
  place?: string;
  partySize?: string;
  budgetPerPerson?: string;
}

export function validateManualRecommendationInput(
  input: ManualRecommendationFormInput,
): ManualRecommendationFormErrors {
  const errors: ManualRecommendationFormErrors = {};

  if (input.place.trim() === "") {
    errors.place = REQUIRED_MESSAGE;
  }
  if (!isPositiveInteger(input.partySize)) {
    errors.partySize = REQUIRED_MESSAGE;
  }
  if (!isPositiveNumber(input.budgetPerPerson)) {
    errors.budgetPerPerson = REQUIRED_MESSAGE;
  }

  return errors;
}
