"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { MAX_REGIONS } from "@/config/venue-generation";
import { validateRecommendationInput } from "@/lib/recommendation-validation";
import type { RecommendationFormErrors } from "@/lib/recommendation-validation";

export function RecommendForm() {
  const router = useRouter();
  const [regions, setRegions] = useState<string[]>([]);
  const [regionInput, setRegionInput] = useState("");
  const [partySize, setPartySize] = useState("");
  const [budgetPerPerson, setBudgetPerPerson] = useState("");
  const [errors, setErrors] = useState<RecommendationFormErrors>({});

  function addRegion() {
    const trimmed = regionInput.trim();
    if (!trimmed || regions.includes(trimmed) || regions.length >= MAX_REGIONS) return;
    setRegions([...regions, trimmed]);
    setRegionInput("");
  }

  function removeRegion(region: string) {
    setRegions(regions.filter((r) => r !== region));
  }

  function handleRegionKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addRegion();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validateRecommendationInput({
      regions,
      partySize,
      budgetPerPerson,
    });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const params = new URLSearchParams({
      regions: regions.join(","),
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
          지역·인원수·예산만 입력하면 지역마다 1차·2차 상위 5곳을 추천해드려요
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field data-invalid={!!errors.region}>
            <FieldLabel htmlFor="region">지역</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="region"
                placeholder="예: 강남역 (Enter로 추가)"
                value={regionInput}
                aria-invalid={!!errors.region}
                onChange={(e) => setRegionInput(e.target.value)}
                onKeyDown={handleRegionKeyDown}
              />
              <Button type="button" variant="secondary" onClick={addRegion}>
                추가
              </Button>
            </div>
            {regions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {regions.map((r) => (
                  <Badge key={r} variant="secondary" className="gap-1 py-1 pl-3 pr-1">
                    {r}
                    <button
                      type="button"
                      aria-label={`${r} 삭제`}
                      onClick={() => removeRegion(r)}
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
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
