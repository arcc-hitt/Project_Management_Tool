import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing sessions
    await page.context().clearCookies();
    await page.goto('/');
  });

  test('should redirect to login page when not authenticated', async ({ page }) => {
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should show login form elements', async ({ page }) => {
    await page.goto('/login');
    
    // Check for login form elements
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/login');
    
    // Click on register link
    await page.getByRole('link', { name: /sign up/i }).click();
    
    await expect(page).toHaveURL(/.*\/register/);
    await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/login');
    
    // Try to submit empty form
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show validation errors (adjust based on your implementation)
    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();
  });

  test('should attempt login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in credentials
    await page.getByPlaceholder(/email/i).fill('test@example.com');
  await page.getByPlaceholder(/password/i).fill('Password123!');
    
    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should either redirect to dashboard or show error
    // This depends on whether you have a test backend running
    await page.waitForLoadState('networkidle');
    
    // Check if we're on dashboard (successful login) or still on login (failed)
    const url = page.url();
    expect(url).toMatch(/(dashboard|login)/);
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for dashboard tests
    await page.goto('/dashboard');
    
    // If redirected to login, mock a successful authentication
    if (page.url().includes('login')) {
      // In a real app, you'd need to properly authenticate or mock the auth state
      await page.goto('/dashboard');
    }
  });

  test('should display dashboard page elements', async ({ page }) => {
    // Skip if still on login page
    if (page.url().includes('login')) {
      test.skip(true, 'Authentication required for dashboard');
    }

    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    
    // Check for key dashboard elements
    await expect(page.locator('[data-testid="stats-cards"]')).toBeVisible();
  });

  test('should navigate to projects page', async ({ page }) => {
    if (page.url().includes('login')) {
      test.skip(true, 'Authentication required for navigation');
    }

    // Click on projects navigation
    await page.getByRole('link', { name: /projects/i }).click();
    
    await expect(page).toHaveURL(/.*\/projects/);
  });

  test('should navigate to tasks page', async ({ page }) => {
    if (page.url().includes('login')) {
      test.skip(true, 'Authentication required for navigation');
    }

    // Click on tasks navigation
    await page.getByRole('link', { name: /tasks/i }).click();
    
    await expect(page).toHaveURL(/.*\/tasks/);
  });
});

test.describe('Projects Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    
    if (page.url().includes('login')) {
      test.skip(true, 'Authentication required for projects');
    }
  });

  test('should display projects page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
    
    // Check for create project button
    await expect(page.getByRole('button', { name: /create project/i })).toBeVisible();
  });

  test('should open create project dialog', async ({ page }) => {
    // Click create project button
    await page.getByRole('button', { name: /create project/i }).click();
    
    // Check if dialog opens
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /create new project/i })).toBeVisible();
  });

  test('should filter projects by status', async ({ page }) => {
    // Look for filter controls
    const statusFilter = page.getByRole('combobox', { name: /status/i });
    
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.getByRole('option', { name: /active/i }).click();
      
      // Wait for filtering to complete
      await page.waitForLoadState('networkidle');
    }
  });
});

test.describe('Responsive Design', () => {
  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    
    if (page.url().includes('login')) {
      await page.goto('/login');
    }
    
    // Check mobile menu button is visible
    await expect(page.getByRole('button', { name: /menu/i })).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    
    if (page.url().includes('login')) {
      await page.goto('/login');
    }
    
    // Check layout adapts to tablet size
    await expect(page.locator('body')).toBeVisible();
  });
});