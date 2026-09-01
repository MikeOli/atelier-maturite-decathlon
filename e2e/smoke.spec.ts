import { test, expect } from "@playwright/test";

test("home page loads with starter tagline", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Supabase and Next\.js Starter Template/i,
    }),
  ).toBeVisible();
});
