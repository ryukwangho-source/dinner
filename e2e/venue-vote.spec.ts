import path from "node:path";
import Database from "better-sqlite3";
import { expect, test } from "@playwright/test";

const VOTES_DB_PATH = path.join(process.cwd(), "data", "votes-e2e.db");

test("선택없이 투표만들기 시도→안내→투표 생성→링크 접속→투표→변경 전체 흐름", async ({ page }) => {
  await page.goto("/results?regions=%EC%98%A4%EC%82%B0%EC%97%AD&people=8&budget=30000");
  const checkboxes = page.getByRole("checkbox");
  await expect(checkboxes.first()).toBeVisible({ timeout: 30_000 });

  // 선택 없이 투표 만들기 시도 → 안내, 이동 없음
  await page.getByRole("button", { name: "투표 만들기" }).click();
  await expect(page.getByText("투표할 장소를 선택해주세요")).toBeVisible();
  await expect(page).toHaveURL(/\/results\?/);

  // 후보 2곳 선택 후 투표 만들기
  await checkboxes.nth(0).click();
  await checkboxes.nth(1).click();
  await page.getByRole("button", { name: "투표 만들기" }).click();

  await expect(page).toHaveURL(/\/vote\/new\?/);
  await page.getByRole("radio", { name: "1시간" }).click();
  await page.getByRole("button", { name: "투표 만들기 확정" }).click();

  const linkBox = page.getByText(/^http:\/\/localhost:3110\/vote\//);
  await expect(linkBox).toBeVisible();
  const voteUrl = (await linkBox.textContent())!.trim();

  // 발급된 링크로 접속해 후보 1곳 투표
  await page.goto(voteUrl);
  const voteCheckboxes = page.getByRole("checkbox");
  await expect(voteCheckboxes).toHaveCount(2);
  await voteCheckboxes.nth(0).click();
  await page.getByRole("button", { name: "투표하기" }).click();

  await expect(page.getByRole("button", { name: "투표 변경" })).toBeVisible();
  await expect(page.getByText("1표").first()).toBeVisible();

  // 선택 변경 후 재투표
  await voteCheckboxes.nth(0).click(); // 첫 후보 체크 해제
  await voteCheckboxes.nth(1).click(); // 두 번째 후보 체크
  await page.getByRole("button", { name: "투표 변경" }).click();

  await expect(async () => {
    const counts = await page.locator("text=/^[01]표$/").allTextContents();
    expect(counts.sort()).toEqual(["0표", "1표"]);
  }).toPass();
});

test("이미 마감된 투표 링크 접속 → 투표 UI 없이 최종 득표수만 보인다", async ({ page, request }) => {
  // API로 정상 투표를 만든 뒤, e2e DB에서 마감 시각을 과거로 직접 되돌린다.
  const venue = (id: string, name: string) => ({
    id,
    name,
    category: "고깃집",
    region: "오산역",
    rating: 4.5,
    reviewCount: 500,
    viewCount: 4000,
    pricePerPerson: 28000,
    walkingMinutes: null,
  });
  const res = await request.post("/api/votes", {
    data: {
      venues: [venue("osan-charcoal", "숯불향 오산역점"), venue("osan-hof", "호프집 오산불빛")],
      duration: "1h",
    },
  });
  const { id } = await res.json();

  const db = new Database(VOTES_DB_PATH);
  db.prepare("UPDATE votes SET deadline_at = ? WHERE id = ?").run(
    new Date(Date.now() - 1000).toISOString(),
    id,
  );
  db.close();

  await page.goto(`/vote/${id}`);
  await expect(page.getByText("투표가 마감되었어요")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "투표하기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "투표 변경" })).toHaveCount(0);
});
