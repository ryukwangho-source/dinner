import { expect, test } from "@playwright/test";

test("추천받기(GENERATE_FIXTURE) → 로딩 → 결과 5곳(회식 업종) → 2곳 선택 저장까지 동작", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "강남" }).click();
  await page.getByLabel("인원수").fill("8");
  await page.getByLabel("인원당 가용예산").fill("30000");
  await page.getByRole("button", { name: "추천받기" }).click();

  await expect(page).toHaveURL(/\/results\?/);

  // 생성 진행 중 안내가 먼저 보인다
  await expect(page.getByText("추천 장소를 찾고 있어요")).toBeVisible();

  // 완료되면 자동으로 카드 5개로 전환된다 (첫 요청은 라우트 컴파일이 겹쳐 느릴 수 있어 여유를 둔다)
  const cards = page.getByRole("checkbox");
  await expect(cards).toHaveCount(5, { timeout: 30_000 });
  await expect(page.getByText("추천 장소를 찾고 있어요")).not.toBeVisible();

  // 2곳 선택 후 저장
  await cards.nth(0).click();
  await cards.nth(1).click();
  await page.getByRole("button", { name: "선택 저장" }).click();
  await expect(page.getByText("2곳을 저장했어요")).toBeVisible();

  await page.goto("/saved");
  await expect(page.getByTestId("saved-item-name")).toHaveCount(2);
});
