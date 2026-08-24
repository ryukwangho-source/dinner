import { expect, test } from "@playwright/test";

test("1차 장소 직접 입력(GENERATE_FIXTURE) → 로딩 → 1차 1곳+2차 5곳 결과 → 저장·카톡공유·투표까지 동작", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/");

  await page.getByRole("radio", { name: "1차 장소 직접 입력" }).click();
  await page.getByLabel("1차 장소명").fill("브리비트 강남역점");
  await page.getByLabel("인원수").fill("8");
  await page.getByLabel("인원당 가용예산").fill("30000");
  await page.getByRole("button", { name: "추천받기" }).click();

  await expect(page).toHaveURL(/\/results\?place=/);

  // 생성 진행 중 안내가 먼저 보인다
  await expect(page.getByText("추천 장소를 찾고 있어요")).toBeVisible();

  // 완료되면 1차·2차 섹션과 카드로 전환된다
  await expect(page.getByText("1차 · 식사")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("2차 · 가볍게 한잔")).toBeVisible();
  await expect(page.getByText("추천 장소를 찾고 있어요")).not.toBeVisible();

  // 그룹 제목이 입력한 1차 장소명 그대로다 (spec 시나리오 2)
  await expect(page.getByRole("heading", { name: "브리비트 강남역점" })).toBeVisible();

  // 1차 카드 1개 + 2차 카드 5개 = 체크박스 6개
  const cards = page.getByRole("checkbox");
  await expect(cards).toHaveCount(6);

  // 2차 카드 2곳 선택 후 저장
  await cards.nth(1).click();
  await cards.nth(2).click();
  await page.getByRole("button", { name: "선택 저장" }).click();
  await expect(page.getByText("2곳을 저장했어요")).toBeVisible();

  // 카톡 공유 — 선택된(오뎅오색·호프집 온기) 장소만 클립보드에 담기고, 나머지는 빠진다
  await page.getByRole("button", { name: "카톡 공유" }).click();
  await expect(page.getByText("클립보드에 복사했어요")).toBeVisible();
  const shareText = await page.evaluate(() => navigator.clipboard.readText());
  expect(shareText).toContain("오뎅오색");
  expect(shareText).toContain("호프집 온기");
  for (const name of ["브리비트 강남역점", "생활맥주", "야키토리 나루토", "이자카야 나무"]) {
    expect(shareText).not.toContain(name);
  }

  // 투표 만들기 — 후보 등록·득표까지
  await page.getByRole("button", { name: "투표 만들기" }).click();
  await expect(page).toHaveURL(/\/vote\/new\?/);
  await page.getByRole("radio", { name: "1시간" }).click();
  await page.getByRole("button", { name: "투표 만들기 확정" }).click();

  const linkBox = page.getByText(/^http:\/\/localhost:3110\/vote\//);
  await expect(linkBox).toBeVisible();
  const voteUrl = (await linkBox.textContent())!.trim();

  await page.goto(voteUrl);
  const voteCheckboxes = page.getByRole("checkbox");
  await expect(voteCheckboxes).toHaveCount(2);
  await voteCheckboxes.nth(0).click();
  await page.getByRole("button", { name: "투표하기" }).click();
  await expect(page.getByText("1표").first()).toBeVisible();

  // 저장 목록 정리 (다른 e2e 파일과 공유되는 상태)
  await page.goto("/saved");
  await page.getByRole("button", { name: "전체 선택" }).click();
  await page.getByRole("button", { name: "선택 삭제" }).click();
  await page.getByRole("button", { name: "삭제하기" }).click();
  await expect(page.getByText("저장된 장소가 없어요")).toBeVisible();
});
