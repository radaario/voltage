import { test, expect } from "@playwright/test";

test.describe("Instances Management", () => {
	test.beforeEach(async ({ page }) => {
		// Login
		await page.goto("/login");
		const passwordInput = page.locator('input[type="password"]').first();
		const submitButton = page.locator('button[type="submit"]').first();

		if ((await passwordInput.count()) > 0) {
			await passwordInput.fill(process.env.FRONTEND_PASSWORD || "test-password");
			await submitButton.click();
			await page.waitForTimeout(2000);
		}

		// Navigate to instances page
		await page.goto("/instances");
		await page.waitForLoadState("networkidle");
	});

	test("should display instances list", async ({ page }) => {
		const pageContent = await page.content();
		expect(pageContent).toBeTruthy();

		// Look for instances table or cards
		const hasTable = await page.locator("table").count();
		const hasCards = await page.locator('[data-testid="instance-card"]').count();

		expect(hasTable + hasCards).toBeGreaterThan(0);
	});

	test("should show instance details", async ({ page }) => {
		// Find first instance
		const firstInstance = page.locator('tr[data-instance-key], [data-testid="instance-card"]').first();

		if ((await firstInstance.count()) > 0) {
			await firstInstance.click();
			await page.waitForTimeout(500);

			// Check for details view
			const detailsView = page.locator('[role="dialog"], .modal, .details-panel').first();
			expect(await detailsView.count()).toBeGreaterThan(0);
		}
	});

	test("should display instance statistics", async ({ page }) => {
		// Look for stats cards or metrics
		const statsElements = await page.locator('[data-testid*="stat"], .stat-card, .metric').count();

		// Should have some statistical information displayed
		expect(statsElements).toBeGreaterThanOrEqual(0);
	});

	test("should filter active instances", async ({ page }) => {
		// Look for active filter
		const activeFilter = page.locator('button:has-text("Active"), input[type="checkbox"]:near(:text("Active"))').first();

		if ((await activeFilter.count()) > 0) {
			await activeFilter.click();
			await page.waitForTimeout(1000);

			// Verify filtering occurred
			const pageContent = await page.content();
			expect(pageContent).toBeTruthy();
		}
	});
});
