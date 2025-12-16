import { test, expect } from '@playwright/test';
import { TEST_USER, TEST_PRODUCT } from './global-setup';

test.describe('Critical Flow: Shift & Sales', () => {
  
  test('should open shift, make a sale of test product, and close shift', async ({ page }) => {
    test.setTimeout(60000); // Increase timeout for full E2E flow
    
    // 1. Login
    await page.goto('/login');
    
    // Explicitly check if we are on login page or already redirected
    // If we see dashboard, skip login
    const isDashboard = page.url().includes('/dashboard');
    if (!isDashboard) {
        console.log('Filling login form...');
        // Playwright fill automatically waits for visibility
        await page.fill('input[name="email"]', TEST_USER.email);
        await page.fill('input[name="password"]', TEST_USER.password);
        
        console.log('Clicking submit...');
        await page.getByRole('button', { name: 'Ingresar' }).click();
        
        // Wait for auth request to complete
        await page.waitForLoadState('networkidle');
    }
    
    // Wait for either Redirect or Error Toast
    const errorToast = page.getByText('Error al iniciar sesión');
    try {
      console.log('Waiting for dashboard...');
      await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
    } catch (e) {
      console.log('Login timed out.');
      // If timeout, check if error toast is present
      if (await errorToast.isVisible()) {
        const errorMsg = await errorToast.textContent();
        throw new Error(`Login Failed: ${errorMsg}`);
      }
      
      // Log current URL and text
      console.log('Current URL:', page.url());
      console.log('Page Text:', await page.textContent('body'));
      
      throw e; // Rethrow timeout
    }

    // 2. Open Shift (Finance)
    await page.goto('/finance');
    
    // If shift is closed (expected due to seeded state usually being clean), open it.
    // We look for 'Abrir Caja'. If we see 'Cerrar Caja', we assume it's open (maybe from previous failed run if seeded logic didn't clear sessions).
    // But global setup doesn't clear sessions, it just seeds users. Ideally we'd ensure no open session in setup.
    // For this flow, let's assume we proceed.

    if (await page.getByText('Abrir Caja').isVisible()) {
        await page.getByText('Abrir Caja').click();
        await page.fill('input[placeholder="0.00"]', '1000'); // Initial Cash
        await page.click('button:has-text("Confirmar")'); // Assuming the dialog button says Confirmar or Abrir
        await expect(page.getByText('Caja Abierta')).toBeVisible();
    } else {
        console.log('Shift already open, proceeding...');
    }

    // 3. Make a Sale (POS)
    await page.goto('/pos');
    
    // Wait for POS to load (waiting for Products query)
    await expect(page.getByText('Cargando POS...')).not.toBeVisible({ timeout: 20000 });

    // Search for the specific TEST PRODUCT to avoid random clicks
    await page.fill('input[placeholder*="Buscar"]', TEST_PRODUCT.name);
    // Click the specific product card
    await page.click(`text=${TEST_PRODUCT.name}`);
    
    // Check total matches product price
    await expect(page.locator('text=Total:')).toContainText(`$${TEST_PRODUCT.price}`);

    // Pay
    await page.click('button:has-text("Pagar")'); // Open Checkout Dialog
    // Select Cash (default) and Confirm
    await page.click('button:has-text("Confirmar Pago")'); 
    
    // Verify Success Toast or Message
    await expect(page.getByText('Venta realizada con éxito')).toBeVisible();

    // 4. Close Shift (Finance)
    await page.goto('/finance');
    await page.click('button:has-text("Cerrar Caja")');
    await page.fill('textarea[name="notes"]', 'Cierre E2E Automático');
    await page.click('button:has-text("Confirmar Cierre")');
    
    await expect(page.getByText('Caja Cerrada')).toBeVisible();
  });
});
