const chalk = require('chalk');
const { success, error, info, warn } = require('../utils');
const config = require('../config');

/**
 * Resolve Zibll pay-download links to actual download URLs.
 * Requires cookie-based profile for sites with Zibll paywall.
 */
async function getDownloads(program, getClientFn) {
  program.command('download <postId>')
    .description('获取付费下载资源地址（Zibll 付费墙站点）')
    .option('--all', '显示所有下载通道')
    .action(async (postId, opts) => {
      const { client, profile } = getClientFn();
      const site = client.site;
      const token = client.token;

      // Check if this profile uses cookie auth
      if (!token || !token.startsWith('Cookie:')) {
        error('此命令需要 Cookie 认证。请使用 profiles cookie-add 添加 Cookie，或 cookie-login 浏览器登录');
        return;
      }

      try {
        const { chromium } = require('playwright');
        const cookieHeader = token.replace(/^Cookie:\s*/, '');
        const cookiePairs = cookieHeader.split('; ').filter(Boolean);

        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        });

        // Set cookies
        const cookies = cookiePairs.map(pair => {
          const [name, ...rest] = pair.split('=');
          return {
            name,
            value: rest.join('='),
            domain: new URL(site).hostname,
            path: '/',
          };
        });
        await context.addCookies(cookies);

        const page = await context.newPage();

        try {
          // Step 1: Visit download page
          info(`正在获取文章 #${postId} 的下载资源...`);
          await page.goto(`${site}/download/?post=${postId}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          await page.waitForTimeout(3000);

          // Step 2: Extract pay-download links and password
          const payLinks = await page.locator('a[href*="pay-download"]').all();
          const passwordEl = await page.$('[data-clipboard-text]');
          const password = passwordEl
            ? await passwordEl.getAttribute('data-clipboard-text')
            : null;

          if (payLinks.length === 0) {
            // Maybe it's a free resource, check for direct links
            const allLinks = await page.locator('a[href*="pan.baidu"], a[href*="pan.quark"], a[href*="115.com"], a[href*="aliyundrive"]').all();
            if (allLinks.length > 0) {
              console.log(chalk.bold('\n  下载链接:'));
              for (const link of allLinks) {
                const href = await link.getAttribute('href');
                const text = await link.innerText();
                console.log(`  ${chalk.cyan(text.trim() || '下载')}: ${href}`);
              }
            } else {
              warn('未找到下载链接。该文章可能无资源或已是免费内容。');
            }
            if (password) console.log(`  解压密码: ${chalk.yellow(password)}`);
            return;
          }

          console.log(chalk.bold(`\n  找到 ${payLinks.length} 个下载通道${opts.all ? '' : '（仅显示第1个，加 --all 查看全部）'}\n`));

          const limit = opts.all ? payLinks.length : Math.min(payLinks.length, 1);

          for (let i = 0; i < limit; i++) {
            const href = await payLinks[i].getAttribute('href');
            const label = await payLinks[i].innerText();

            console.log(chalk.dim(`  [${i + 1}] 解析: ${href}`));
            const resp = await page.goto(href, {
              waitUntil: 'domcontentloaded',
              timeout: 15000,
            });
            await page.waitForTimeout(4000);

            const finalUrl = page.url();

            // Parse download info from final URL
            console.log(`  通道 ${i + 1}: ${chalk.cyan(label.trim() || '下载')}`);
            console.log(`  地址: ${chalk.green(finalUrl)}`);

            // Try to extract pwd from URL
            const pwdMatch = finalUrl.match(/[?&]pwd=([^&#]+)/);
            if (pwdMatch) {
              console.log(`  提取码: ${chalk.yellow(pwdMatch[1])}`);
            }
          }

          if (password) {
            console.log(`\n  解压密码: ${chalk.yellow(password)}`);
          } else {
            // Search page for password hints
            const pageText = await page.locator('body').innerText();
            const jyMatch = pageText.match(/解压[密码码][：:]\s*(\S+)/);
            if (jyMatch) console.log(`\n  解压密码: ${chalk.yellow(jyMatch[1])}`);
          }

        } finally {
          await browser.close();
        }
      } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
          error('需要安装 playwright: npm i playwright && npx playwright install chromium');
        } else {
          error(`获取下载地址失败: ${e.message}`);
        }
      }
    });
}

module.exports = { register: getDownloads };
