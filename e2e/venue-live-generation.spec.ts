import { expect, test } from "@playwright/test";

test("추천받기(GENERATE_FIXTURE) → 로딩 → 지역별 1차·2차 결과 → 2곳 선택 저장까지 동작", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("지역").fill("강남");
  await page.getByLabel("지역").press("Enter");
  await page.getByLabel("인원수").fill("8");
  await page.getByLabel("인원당 가용예산").fill("30000");
  await page.getByRole("button", { name: "추천받기" }).click();

  await expect(page).toHaveURL(/\/results\?/);

  // 생성 진행 중 안내가 먼저 보인다
  await expect(page.getByText("추천 장소를 찾고 있어요")).toBeVisible();

  // 완료되면 자동으로 1차·2차 섹션과 카드로 전환된다 (첫 요청은 라우트 컴파일이 겹쳐 느릴 수 있어 여유를 둔다)
  await expect(page.getByText("1차 · 식사")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("2차 · 가볍게 한잔")).toBeVisible();
  await expect(page.getByText("추천 장소를 찾고 있어요")).not.toBeVisible();

  const cards = page.getByRole("checkbox");
  await expect(cards).toHaveCount(10);

  // 2곳 선택 후 저장
  await cards.nth(0).click();
  await cards.nth(1).click();
  await page.getByRole("button", { name: "선택 저장" }).click();
  await expect(page.getByText("2곳을 저장했어요")).toBeVisible();

  await page.goto("/saved");
  await expect(page.getByTestId("saved-item-name")).toHaveCount(2);

  // 저장 목록은 다른 e2e 파일과 공유되는 상태라 여기서 남긴 항목을 정리한다
  // (venue-recommendation.spec.ts 등 다른 파일의 "정확히 N개" 검증이 깨지지 않도록).
  await page.getByRole("button", { name: "모두 삭제" }).click();
  await page.getByRole("button", { name: "모두 삭제하기" }).click();
  await expect(page.getByText("저장된 장소가 없어요")).toBeVisible();
});
