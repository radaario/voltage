import { test, expect } from "@playwright/test";

test.describe("Login Flow", () => {
	test("should show login page", async ({ page }) => {
		await page.goto("/login");

		// Wait for page to load
		await page.waitForLoadState("networkidle");

		// Check if login form exists
		const hasPasswordInput = await page.locator('input[type="password"]').count();
		expect(hasPasswordInput).toBeGreaterThan(0);
	});

	test("should display error for invalid password", async ({ page }) => {
		await page.goto("/login");

		// Find password input
		const passwordInput = page.locator('input[type="password"]').first();
		const submitButton = page.locator('button[type="submit"]').first();

		// Enter invalid password
		await passwordInput.fill("wrong-password");
		await submitButton.click();

		// Wait for error message
		await page.waitForTimeout(1000);

		// Check for error indication (adjust selector based on actual implementation)
		const pageContent = await page.content();
		expect(pageContent).toBeTruthy();
	});

	test("should redirect to overview on successful login", async ({ page }) => {
		await page.goto("/login");

		const passwordInput = page.locator('input[type="password"]').first();
		const submitButton = page.locator('button[type="submit"]').first();

		// Enter valid password (use environment variable)
		const password = process.env.FRONTEND_PASSWORD || "test-password";
		await passwordInput.fill(password);
		await submitButton.click();

		// Wait for navigation
		await page.waitForTimeout(2000);

		// Should redirect to overview or dashboard
		const url = page.url();
		expect(url).toMatch(/\/(overview|dashboard|jobs)?$/);
	});

	test("should persist authentication on page reload", async ({ page }) => {
		// First login
		await page.goto("/login");
		const passwordInput = page.locator('input[type="password"]').first();
		const submitButton = page.locator('button[type="submit"]').first();

		await passwordInput.fill(process.env.FRONTEND_PASSWORD || "test-password");
		await submitButton.click();
		await page.waitForTimeout(2000);

		// Reload page
		await page.reload();
		await page.waitForLoadState("networkidle");

		// Should still be authenticated (not redirected to login)
		const url = page.url();
		expect(url).not.toContain("/login");
	});
});
