import { test, expect } from "@playwright/test";

test("joining a non-existent session shows a clear error message", async ({
  page,
}) => {
  await page.goto("/session/00000000-0000-0000-0000-000000000000");
  await expect(
    page.getByRole("heading", { name: /session introuvable/i }),
  ).toBeVisible();
});

test("joining a session route never redirects to admin login", async ({
  page,
}) => {
  await page.goto("/session/00000000-0000-0000-0000-000000000000");
  await expect(page).not.toHaveURL(/\/admin\/login/);
});
