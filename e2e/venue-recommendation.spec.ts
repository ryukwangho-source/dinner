import { expect, test } from "@playwright/test";

test("입력 오류→재제출→추천→선택 저장→저장 목록 확인→삭제 전체 흐름", async ({ page }) => {
  await page.goto("/");

  // 미완성 입력 → 입력해주세요 안내, 화면 전환 없음
  await page.getByLabel("지역").fill("오산역");
  await page.getByLabel("지역").press("Enter");
  await page.getByRole("button", { name: "추천받기" }).click();
  await expect(page.getByText("입력해주세요").first()).toBeVisible();
  await expect(page).toHaveURL("/");

  // 값 채워 재제출
  await page.getByLabel("인원수").fill("8");
  await page.getByLabel("인원당 가용예산").fill("30000");
  await page.getByRole("button", { name: "추천받기" }).click();

  await expect(page).toHaveURL(/\/results\?/);
  await expect(page.getByText("1차 · 식사")).toBeVisible({ timeout: 30_000 });
  const cards = page.getByRole("checkbox");
  await expect(cards).toHaveCount(10);

  // 2곳 선택 후 저장
  await cards.nth(0).click();
  await cards.nth(1).click();
  await expect(page.getByText("2곳 선택됨")).toBeVisible();
  await page.getByRole("button", { name: "선택 저장" }).click();
  await expect(page.getByText("2곳을 저장했어요")).toBeVisible();

  // 저장 목록에서 확인
  await page.goto("/saved");
  const deleteButtons = page.getByRole("button", { name: "삭제", exact: true });
  await expect(deleteButtons).toHaveCount(2);

  // 1곳 삭제 → 남은 1곳만 존재
  await deleteButtons.first().click();
  await expect(deleteButtons).toHaveCount(1);
});
