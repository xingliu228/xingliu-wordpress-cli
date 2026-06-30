#!/usr/bin/env node
const { program } = require('commander');
const chalk = require('chalk');
const config = require('./src/config');
const { WPClient } = require('./src/client');
const { success, error, info, warn } = require('./src/utils');

const VERSION = '1.1.0';

program
  .name('xingliu-wp')
  .description('WordPress REST API 通用命令行工具，支持多站点管理')
  .version(VERSION);

// === Helper: get client from active profile ===
function getClient() {
  let token, site, profile;
  const activeProfile = config.getActiveProfile();
  if (!activeProfile) {
    error('未选择站点。请先 login 登录或 profiles use 切换站点');
    process.exit(1);
  }
  site = activeProfile.site;
  profile = activeProfile.name;
  // Public profile (no auth needed)
  if (activeProfile.public) {
    return { client: new WPClient(site), profile };
  }
  // Auth profile
  const tokenInfo = config.getToken();
  token = tokenInfo.token;
  if (!token) {
    warn(`站点 "${profile}" Token 已过期，请重新 login`);
    process.exit(1);
  }
  return { client: new WPClient(site, token), profile };
}

// === Login ===
program.command('login')
  .description('登录 WordPress 站点（需安装 JWT Auth 插件）')
  .requiredOption('-s, --site <url>', '站点地址 (如 https://example.com)')
  .requiredOption('-u, --user <user>', '用户名')
  .requiredOption('-p, --password <password>', '密码')
  .option('-n, --name <name>', '配置名称（用于多站点区分）')
  .action(async (opts) => {
    const site = opts.site.replace(/\/+$/, '');
    const profileName = opts.name || new URL(site).hostname.replace(/^www\./, '');

    // Try common JWT routes
    const jwtRoute = config.detectJwtRoute(site);

    try {
      info(`正在连接 ${site} ...`);
      const client = new WPClient(site);

      // Try JWT auth
      const authRes = await client.login('/jwt-auth/v1/token', opts.user, opts.password);

      if (authRes.status === 200 && authRes.data.token) {
        // JWT success
        const token = authRes.data.token;
        const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

        config.saveProfile({ name: profileName, site, token, tokenExpiry: expiry });
        config.setActiveProfile(profileName);
        config.setToken(profileName, token, expiry);

        // Fetch user info
        const c2 = new WPClient(site, token);
        try {
          const me = await c2.get('/wp/v2/users/me');
          const roles = (me.data.roles || []).join(', ');
          success(`登录成功！用户: ${me.data.name} (${me.data.slug}), 角色: ${roles}`);
        } catch {
          success('登录成功！Token 已保存');
        }
        console.log(chalk.dim(`\n  配置名称: ${profileName}`));
        console.log(chalk.dim(`  站点: ${site}`));
        console.log(chalk.dim(`  Token 有效期: 7 天`));
        return;
      }

      // Try alternative JWT routes
      const altRes = await client.login('/simple-jwt-login/v1/token', opts.user, opts.password);
      if (altRes.status === 200 && altRes.data.token) {
        const token = altRes.data.token;
        config.saveProfile({ name: profileName, site, token, tokenExpiry: Date.now() + 7 * 24 * 60 * 60 * 1000 });
        config.setActiveProfile(profileName);
        config.setToken(profileName, token, Date.now() + 7 * 24 * 60 * 60 * 1000);
        success('登录成功！(Simple JWT)');
        return;
      }

      // Application password fallback
      error('JWT 认证失败。该站点可能未安装 JWT Auth 插件。');
      info('替代方案：在 WordPress 后台生成 Application Password，然后使用以下命令:');
      info(`  xingliu-wp app-auth -s ${site} -u "${opts.user}" -a "<应用密码>" -n ${profileName}`);
    } catch (e) {
      error(`连接失败: ${e.message}`);
      info('请确认站点地址正确且已安装 JWT Authentication for WP REST API 插件');
    }
  });

// === Application Password Auth ===
program.command('app-auth')
  .description('使用 Application Password 登录（WP 5.6+ 原生支持）')
  .requiredOption('-s, --site <url>', '站点地址')
  .requiredOption('-u, --user <user>', '用户名')
  .requiredOption('-a, --app-password <pass>', 'Application Password (不含空格)')
  .option('-n, --name <name>', '配置名称')
  .action(async (opts) => {
    const site = opts.site.replace(/\/+$/, '');
    const profileName = opts.name || new URL(site).hostname.replace(/^www\./, '');

    try {
      // Encode user:password in base64 for basic auth
      const token = Buffer.from(`${opts.user}:${opts.appPassword}`).toString('base64');
      const basicAuth = `Basic ${token}`;

      // Verify by fetching user info
      const basicClient = new WPClient(site, basicAuth);
      const res = await basicClient.get('/wp/v2/users/me');

      if (res.status === 200) {
        config.saveProfile({ name: profileName, site, token: token, tokenExpiry: Date.now() + 365 * 24 * 60 * 60 * 1000 });
        config.setActiveProfile(profileName);
        config.setToken(profileName, token, Date.now() + 365 * 24 * 60 * 60 * 1000);
        success(`登录成功！用户: ${res.data.name} (${res.data.slug})`);
        console.log(chalk.dim(`  认证方式: Application Password`));
        console.log(chalk.dim(`  配置名称: ${profileName}`));
      } else {
        error('认证失败，请检查 Application Password 是否正确');
      }
    } catch (e) {
      error(`连接失败: ${e.message}`);
    }
  });

// === Cookie Login (browser automation) ===
program.command('cookie-login')
  .description('通过浏览器自动化登录（适用于自定义登录页的站点）')
  .requiredOption('-s, --site <url>', '站点地址')
  .requiredOption('-u, --user <user>', '用户名')
  .requiredOption('-p, --password <password>', '密码')
  .option('-n, --name <name>', '配置名称')
  .action(async (opts) => {
    const site = opts.site.replace(/\/+$/, '');
    const profileName = opts.name || new URL(site).hostname.replace(/^www\./, '');

    try {
      const { cookieLogin } = require('./src/cookie-auth');
      const success = await cookieLogin(site, opts.user, opts.password);
      if (!success) {
        error('浏览器登录失败');
        process.exit(1);
      }

      // Load cookies and save as token
      const { getCookieHeader } = require('./src/cookie-auth');
      const cookieHeader = getCookieHeader();
      if (!cookieHeader) {
        error('未能提取 Cookie');
        process.exit(1);
      }

      const token = `Cookie: ${cookieHeader}`;
      const expiry = Date.now() + 14 * 24 * 60 * 60 * 1000; // 14 days

      config.saveProfile({ name: profileName, site, token, tokenExpiry: expiry });
      config.setActiveProfile(profileName);
      config.setToken(profileName, token, expiry);

      success(`Cookie 登录成功！配置名称: ${profileName}`);
      info(`站点: ${site}`);
      info(`Cookie 有效期约 14 天，过期后需重新登录`);
    } catch (e) {
      error(`Cookie 登录失败: ${e.message}`);
      info('请确认: 1) 账号密码正确 2) 站点无需人机验证 3) 已安装 playwright (npm i playwright && npx playwright install chromium)');
    }
  });

// === Logout ===
program.command('logout')
  .description('清除当前站点 Token')
  .action(() => {
    const profile = config.getActiveProfile();
    if (!profile) return info('未选择站点');
    config.setToken(profile.name, null, null);
    success(`已登出: ${profile.name}`);
  });

// === Info ===
program.command('info')
  .description('查看当前站点 API 信息')
  .action(async () => {
    const { client, profile } = getClient();
    try {
      const siteInfo = await client.get('/');
      const namespaces = siteInfo.data.namespaces || [];
      console.log(`  站点: ${client.site}`);
      console.log(`  配置: ${profile}`);
      console.log(`  命名空间: ${namespaces.join(', ')}`);

      // Count types
      try {
        const types = await client.get('/wp/v2/types');
        const typeList = Object.keys(types.data).filter(k => k !== 'attachment' && k !== 'wp_block' && k !== 'wp_template' && k !== 'wp_template_part');
        console.log(`  文章类型: ${typeList.join(', ')}`);
      } catch {}
    } catch (e) {
      error('无法获取站点信息');
    }
  });

// === Check token ===
program.command('check')
  .description('检查当前站点 Token 状态')
  .action(async () => {
    const p = config.getActiveProfile();
    if (!p) return info('未选择站点');
    const { token } = config.getToken();
    if (!token) return warn(`站点 "${p.name}" Token 已过期或不存在`);

    try {
      const client = new WPClient(p.site, token);
      // Cookie auth doesn't support /users/me, fallback to /posts
      let res = await client.get('/wp/v2/users/me');
      if (res.status === 200) {
        success(`站点 "${p.name}" 连接正常 (用户: ${res.data.name})`);
        return;
      }
      // Fallback: try fetching posts
      res = await client.get('/wp/v2/posts', { per_page: 1 });
      if (res.status === 200) {
        const total = res.headers['x-wp-total'] || '?';
        success(`站点 "${p.name}" 连接正常 (Cookie 认证，共 ${total} 篇文章)`);
      } else {
        error(`认证失败 (HTTP ${res.status})`);
      }
    } catch {
      error('连接失败，请重新登录或更新 Cookie');
    }
  });

// === Register sub-commands ===
require('./src/commands/posts').register(program, getClient);
require('./src/commands/pages').register(program, getClient);
require('./src/commands/media').register(program, getClient);
require('./src/commands/taxonomies').register(program, getClient);
require('./src/commands/comments').register(program, getClient);
require('./src/commands/users').register(program, getClient);
require('./src/commands/settings').register(program, getClient);
require('./src/commands/search').register(program, getClient);
require('./src/commands/download').register(program, getClient);
require('./src/commands/profiles').register(program);

// === Parse ===
program.parse(process.argv);
