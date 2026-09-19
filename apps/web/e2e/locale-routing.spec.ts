import {expect, test} from "@playwright/test";

test("English locale route renders the Chronicle bootstrap", async ({page}) => {
  await page.goto("/en");

  await expect(page.getByRole("heading", {name: "FOXHOLE CHRONICLE"})).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("Russian locale route renders localized current-war copy", async ({page}) => {
  await page.goto("/ru/current/live-1");

  await expect(page.getByRole("heading", {name: "Текущая война"})).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
});
