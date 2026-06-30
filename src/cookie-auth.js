/**
 * Cookie-based authentication for WordPress sites with Zibll/custom login.
 * Uses Playwright to automate browser login and extract WordPress auth cookies.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const COOKIE_FILE = path.join(__dirname, '..', '.wp-cookies.json');
const DEBUG_DIR = path.join(__dirname, '..', '.debug');

async function cookieLogin(siteUrl, username, password) {
  console.log(`\n🔐 Logging in to ${siteUrl} via browser...`);

  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });
  const page = await context.newPage();
  let loggedIn = false;

  try {
    const baseUrl = siteUrl.replace(/\/$/, '');
    const loginUrl = `${baseUrl}/user-sign/?tab=signin`;
    
    console.log(`  → Opening login page`);
    await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Click signin tab to ensure we're on the right form
    const signinTab = await page.$('a[href*="tab=signin"]');
    if (signinTab) { await signinTab.click(); await page.waitForTimeout(800); }

    // Fill form
    console.log(`  → Filling form`);
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);

    // Check remember me
    const remember = await page.$('input[name="remember"]');
    if (remember && !(await remember.isChecked())) await remember.check();

    // Listen for navigation (this is key - cookies are set on redirect)
    const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => null);

    // Click login
    console.log(`  → Submitting login`);
    const submitBtn = await page.$('.signsubmit-loader');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.press('input[name="password"]', 'Enter');
    }

    // Wait for navigation (Zibll redirects after login)
    await navigationPromise;
    await page.waitForTimeout(3000);

    // Get current URL
    const currentUrl = page.url();
    console.log(`  → Current URL: ${currentUrl}`);
    await page.screenshot({ path: path.join(DEBUG_DIR, 'after-login.png'), fullPage: true });

    // Extract all cookies
    const allCookies = await context.cookies();
    
    // Check for WordPress auth cookies
    const wpCookies = allCookies.filter(c => 
      c.name.startsWith('wordpress_logged_in') || 
      c.name.startsWith('wordpress_') ||
      c.name.startsWith('wp-')
    );
    
    if (wpCookies.length > 0) {
      console.log(`  ✅ Got ${wpCookies.length} WordPress auth cookies`);
      loggedIn = true;
    } else {
      console.log(`  ⚠️ No WordPress auth cookies. Total cookies: ${allCookies.length}`);
      for (const c of allCookies) {
        console.log(`      ${c.name} (domain: ${c.domain})`);
      }

      // Try navigating to home page to trigger cookie set
      console.log(`  → Trying home page to trigger cookies...`);
      await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);

      const cookies2 = await context.cookies();
      const wpCookies2 = cookies2.filter(c => 
        c.name.startsWith('wordpress_logged_in') || 
        c.name.startsWith('wordpress_') ||
        c.name.startsWith('wp-')
      );
      
      if (wpCookies2.length > 0) {
        console.log(`  ✅ Got ${wpCookies2.length} WordPress cookies after home page`);
        loggedIn = true;
      } else {
        // Check if we're actually logged in by looking for user menu
        const userElements = await page.$$('.user-info, .header-user, .user-avatar, .logged-in, a[href*="user"]');
        console.log(`  User elements found: ${userElements.length}`);
        if (userElements.length > 0) {
          console.log(`  Seems logged in (found user elements) but no cookies?`);
          // Re-check all cookies
          const finalCookies = await context.cookies();
          console.log(`  Final cookies count: ${finalCookies.length}`);
          for (const c of finalCookies) {
            console.log(`      ${c.name} = ${c.value.substring(0, 50)}...`);
          }
          loggedIn = true;
        }
      }
    }

    // Save all cookies
    const allFinalCookies = await context.cookies();
    const cookieData = {
      site: siteUrl,
      username,
      savedAt: new Date().toISOString(),
      success: loggedIn,
      cookies: allFinalCookies,
    };
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookieData, null, 2));

    // Test REST API
    console.log(`\n  → Testing REST API /users/me...`);
    const apiRes = await page.goto(`${baseUrl}/wp-json/wp/v2/users/me`, {
      waitUntil: 'networkidle', timeout: 10000
    });
    if (apiRes && apiRes.status() === 200) {
      const user = await apiRes.json();
      console.log(`  ✅ API OK! User: ${user.name} (ID: ${user.id}), Roles: ${JSON.stringify(user.roles)}`);
      loggedIn = true;
    } else {
      // Try fetching the page content to see if it's JSON or HTML
      try {
        const text = await apiRes.text();
        console.log(`  API status: ${apiRes?.status() || '?'}, body: ${text.substring(0, 200)}`);
      } catch {
        console.log(`  API status: ${apiRes?.status() || '?'}, no body`);
      }
    }

    return loggedIn;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  } finally {
    await browser.close();
  }
}

function loadCookies() {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      return JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function getCookieHeader() {
  const data = loadCookies();
  if (!data || !data.cookies) return null;
  return data.cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

module.exports = { cookieLogin, loadCookies, getCookieHeader, COOKIE_FILE };
