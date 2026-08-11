"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REGIONS } from "@/config/venues";
import { validateRecommendationInput } from "@/lib/recommendation-validation";
import type { RecommendationFormErrors } from "@/lib/recommendation-validation";

export function RecommendForm() {
  const router = useRouter();
  const [region, setRegion] = useState("");
  const [partySize, setPartySize] = useState("");
  const [budgetPerPerson, setBudgetPerPerson] = useState("");
  const [errors, setErrors] = useState<RecommendationFormErrors>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validateRecommendationInput({
      region,
      partySize,
      budgetPerPerson,
    });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const params = new URLSearchParams({
      region,
      people: partySize,
      budget: budgetPerPerson,
    });
    router.push(`/results?${params.toString()}`);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-4">
      <div className="text-center">
        <h1 className="text-lg font-bold">회식 장소 추천</h1>
        <p className="text-sm text-muted-foreground">
          지역·인원수·예산만 입력하면 상위 5곳을 추천해드려요
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field data-invalid={!!errors.region}>
            <FieldLabel htmlFor="region">지역</FieldLabel>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger id="region" className="w-full" aria-invalid={!!errors.region}>
                <SelectValue placeholder="지역을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError errors={errors.region ? [{ message: errors.region }] : undefined} />
          </Field>

          <Field data-invalid={!!errors.partySize}>
            <FieldLabel htmlFor="partySize">인원수</FieldLabel>
            <Input
              id="partySize"
              inputMode="numeric"
              placeholder="예: 8"
              value={partySize}
              aria-invalid={!!errors.partySize}
              onChange={(e) => setPartySize(e.target.value)}
            />
            <FieldError
              errors={errors.partySize ? [{ message: errors.partySize }] : undefined}
            />
          </Field>

          <Field data-invalid={!!errors.budgetPerPerson}>
            <FieldLabel htmlFor="budgetPerPerson">인원당 가용예산</FieldLabel>
            <Input
              id="budgetPerPerson"
              inputMode="numeric"
              placeholder="예: 30000"
              value={budgetPerPerson}
              aria-invalid={!!errors.budgetPerPerson}
              onChange={(e) => setBudgetPerPerson(e.target.value)}
            />
            <FieldError
              errors={
                errors.budgetPerPerson ? [{ message: errors.budgetPerPerson }] : undefined
              }
            />
          </Field>

          <Button type="submit">추천받기</Button>
        </FieldGroup>
      </form>

      <div className="text-center">
        <a href="/saved" className="text-xs text-muted-foreground underline">
          저장한 장소 보기 →
        </a>
      </div>
    </div>
  );
}
