import { test, expect } from "@playwright/test";

test("unauthenticated access to /admin redirects to /admin/login", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("participant join route stays public, no redirect to admin login", async ({
  page,
}) => {
  await page.goto("/session/test-code");
  await expect(page).not.toHaveURL(/\/admin\/login/);
});
