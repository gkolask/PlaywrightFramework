import { test, expect } from '@playwright/test';

test('basic example.com smoke test', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example Domain/);
});
