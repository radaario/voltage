# Voltage Testing Documentation

Complete testing infrastructure for the Voltage video encoding platform.

## 📋 Overview

This project has comprehensive test coverage across all packages and applications:

- **3 Apps**: API, Frontend, Runtime
- **2 Packages**: Config, Utils
- **Test Types**: Unit, Integration, Component, E2E

## 🎯 Test Coverage Goals

| Package/App  | Target Coverage | Test Types         |
| ------------ | --------------- | ------------------ |
| **Utils**    | 80%+            | Unit               |
| **Config**   | 90%+            | Unit               |
| **API**      | 70%+            | Unit + Integration |
| **Runtime**  | 60%+            | Unit + Integration |
| **Frontend** | 60%+            | Component + E2E    |

## 🚀 Quick Start

### Install Dependencies

```bash
pnpm install
```

### Run All Tests

```bash
# Run all tests across all packages
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage reports
pnpm test:coverage
```

### Run Tests for Specific Package

```bash
# Utils package
pnpm --filter @voltage/utils test

# Config package
pnpm --filter @voltage/config test

# API app
pnpm --filter @voltage/api test

# Runtime app
pnpm --filter @voltage/runtime test

# Frontend app
pnpm --filter @voltage/frontend test
```

### Run E2E Tests

```bash
# Run Playwright E2E tests
pnpm test:e2e

# Run E2E tests in UI mode
pnpm --filter @voltage/frontend test:e2e:ui
```

## 📁 Test Structure

Tests are organized using the `__tests__` pattern:

```
packages/
  utils/
    __tests__/
      database.test.ts
      storage.test.ts
      logger.test.ts
      stats.test.ts
    helpers/
      __tests__/
        crypto.test.ts
        date.test.ts
        sanitize.test.ts
        system.test.ts
        content-type.test.ts

  config/
    __tests__/
      loader.test.ts
      validators.test.ts

apps/
  api/
    services/
      __tests__/
        auth.service.test.ts
        jobs.service.test.ts
        ...
    controllers/
      __tests__/
        auth.controller.test.ts
        ...
    middleware/
      __tests__/
        auth.middleware.test.ts
        ...

  runtime/
    services/
      __tests__/
        jobs.service.test.ts
        workers.service.test.ts
        ...
    worker/
      __tests__/
        processor.test.ts
        analyzer.test.ts
        ...

  frontend/
    src/
      components/
        __tests__/
          Button.test.tsx
          ...
      hooks/
        __tests__/
          useAuth.test.ts
          ...
      utils/
        __tests__/
          api.test.ts
          ...
    tests/
      e2e/
        login.spec.ts
        jobs.spec.ts
        instances.spec.ts
```

## 🧪 Testing Frameworks

### Backend (API, Runtime, Packages)

- **Framework**: [Vitest](https://vitest.dev/)
- **Why**: Native ESM support, 10x faster than Jest, TypeScript-friendly
- **Integration Testing**: [Supertest](https://github.com/ladjs/supertest)
- **Mocking**: [nock](https://github.com/nock/nock) for HTTP, built-in Vitest mocks

### Frontend

- **Unit/Component**: [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/react)
- **E2E**: [Playwright](https://playwright.dev/)
- **Environment**: jsdom for component tests

## 📝 Writing Tests

### Unit Test Example (Utils)

```typescript
// packages/utils/helpers/__tests__/crypto.test.ts
import { describe, it, expect } from "vitest";
import { hash, uuid } from "../crypto";

describe("crypto helpers", () => {
	it("should generate unique UUIDs", () => {
		const uuid1 = uuid();
		const uuid2 = uuid();
		expect(uuid1).not.toBe(uuid2);
	});

	it("should hash data consistently", () => {
		const result1 = hash("test", "SHA256");
		const result2 = hash("test", "SHA256");
		expect(result1).toBe(result2);
	});
});
```

### Integration Test Example (API)

```typescript
// apps/api/controllers/__tests__/jobs.controller.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../index";

describe("Jobs Controller", () => {
	it("should create a new job", async () => {
		const response = await request(app)
			.post("/jobs")
			.set("x-api-key", "test-key")
			.send({ name: "Test Job", input: "https://example.com/video.mp4" });

		expect(response.status).toBe(201);
		expect(response.body.data).toHaveProperty("key");
	});
});
```

### Component Test Example (Frontend)

```typescript
// apps/frontend/src/components/__tests__/Button.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button Component', () => {
  it('should render button text', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('should call onClick handler', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### E2E Test Example (Playwright)

```typescript
// apps/frontend/tests/e2e/login.spec.ts
import { test, expect } from "@playwright/test";

test("should login successfully", async ({ page }) => {
	await page.goto("/login");

	await page.fill('input[type="password"]', "test-password");
	await page.click('button[type="submit"]');

	await expect(page).toHaveURL(/\/overview/);
});
```

## 🔧 Mocking Strategies

### Database Mocking

Use in-memory SQLite for fast, isolated tests:

```typescript
beforeEach(async () => {
	await database.config({
		type: "sqlite3",
		filename: ":memory:"
	});
	await database.createSchema();
});
```

### Storage Mocking

Mock AWS SDK and file operations:

```typescript
vi.mock("@aws-sdk/client-s3", () => ({
	S3Client: vi.fn(() => ({ send: mockS3Send })),
	PutObjectCommand: vi.fn()
}));
```

### External Dependencies

- **FFmpeg**: Mock command execution, use fixture outputs
- **TensorFlow**: Mock NSFW detection results
- **Whisper**: Mock transcription results

## 📊 Coverage Reports

Coverage reports are generated in:

- `coverage/` directory at package root
- HTML report: `coverage/index.html`

### View Coverage

```bash
# Generate and view coverage
pnpm test:coverage

# Open HTML report (adjust path to specific package)
open packages/utils/coverage/index.html
```

## 🎭 CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - uses: pnpm/action-setup@v2
            - uses: actions/setup-node@v3
              with:
                  node-version: "20"
                  cache: "pnpm"

            - name: Install dependencies
              run: pnpm install

            - name: Run tests
              run: pnpm test:coverage

            - name: Upload coverage
              uses: codecov/codecov-action@v3
```

## 🐛 Debugging Tests

### Vitest UI

```bash
# Launch interactive test UI
pnpm --filter @voltage/frontend test:ui
```

### Playwright Debug Mode

```bash
# Run E2E tests in headed mode
pnpm --filter @voltage/frontend test:e2e -- --headed

# Debug specific test
pnpm --filter @voltage/frontend test:e2e -- --debug login.spec.ts
```

## 📚 Best Practices

### 1. Test Isolation

- Each test should be independent
- Use `beforeEach` to reset state
- Clean up after tests (database, mocks)

### 2. Descriptive Names

```typescript
// ❌ Bad
it('works', () => { ... });

// ✅ Good
it('should create job with valid input', () => { ... });
```

### 3. Arrange-Act-Assert Pattern

```typescript
it("should update job status", async () => {
	// Arrange
	const job = await createTestJob();

	// Act
	await updateJobStatus(job.key, "COMPLETED");

	// Assert
	const updated = await getJob(job.key);
	expect(updated.status).toBe("COMPLETED");
});
```

### 4. Mock External Dependencies

Only mock what you don't control (APIs, databases, file system).

### 5. Test Behavior, Not Implementation

Focus on what the code does, not how it does it.

## 🔍 Common Issues

### ESM Import Errors

Ensure `vitest.config.ts` has proper configuration for ESM:

```typescript
export default defineConfig({
	test: {
		globals: true,
		environment: "node"
	}
});
```

### Mock Not Working

Clear mocks between tests:

```typescript
beforeEach(() => {
	vi.clearAllMocks();
});
```

### Database Tests Failing

Ensure schema is created before running tests:

```typescript
beforeEach(async () => {
	await database.config({ type: "sqlite3", filename: ":memory:" });
	await database.createSchema();
});
```

## 📖 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)
- [Supertest GitHub](https://github.com/ladjs/supertest)

## 🤝 Contributing

When adding new features:

1. Write tests first (TDD approach recommended)
2. Ensure tests pass locally
3. Maintain or improve coverage
4. Update this documentation if needed

## 📄 License

Tests follow the same license as the main project.
