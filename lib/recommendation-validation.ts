export interface RecommendationFormInput {
  region: string;
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

  if (!input.region.trim()) {
    errors.region = REQUIRED_MESSAGE;
  }
  if (!isPositiveInteger(input.partySize)) {
    errors.partySize = REQUIRED_MESSAGE;
  }
  if (!isPositiveNumber(input.budgetPerPerson)) {
    errors.budgetPerPerson = REQUIRED_MESSAGE;
  }

  return errors;
}
