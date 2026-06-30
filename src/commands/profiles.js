const chalk = require('chalk');
const { table, success, error, info, json } = require('../utils');
const config = require('../config');

function register(program) {
  const profiles = program.command('profiles').description('站点配置管理');

  profiles.command('list')
    .description('列出所有站点配置')
    .option('--json', 'JSON 格式')
    .action((opts) => {
      const all = config.readProfiles();
      const active = config.getActiveProfile();
      if (opts.json) return json({ profiles: all, active: active?.name || null });
      if (all.length === 0) return info('暂无站点配置，使用 login 命令添加');

      console.log(table(
        ['当前', '名称', '站点', '认证方式', '状态'],
        all.map(p => {
          const isActive = active && p.name === active.name;
          let authType, status;
          if (p.cookie) {
            authType = chalk.yellow('Cookie');
            const expired = p.tokenExpiry && Date.now() > p.tokenExpiry;
            status = expired ? chalk.red('过期') : chalk.green('有效');
          } else if (p.public) {
            authType = chalk.blue('公开');
            status = chalk.cyan('无需认证');
          } else if (p.token) {
            const isBasic = p.token.length < 100 && !p.token.includes('|');
            authType = isBasic ? chalk.magenta('AppPwd') : chalk.blue('JWT');
            const expired = p.tokenExpiry && Date.now() > p.tokenExpiry;
            status = expired ? chalk.red('过期') : chalk.green('有效');
          } else {
            authType = chalk.gray('无');
            status = chalk.red('未登录');
          }
          return [
            isActive ? chalk.green('▶') : ' ',
            p.name,
            p.site,
            authType,
            status,
          ];
        })
      ));
      console.log(chalk.dim(`\n  配置目录: ${config.configDir()}`));
    });

  profiles.command('use <name>')
    .description('切换当前站点')
    .action((name) => {
      const all = config.readProfiles();
      if (!all.find(p => p.name === name)) return error(`配置 "${name}" 不存在`);
      config.setActiveProfile(name);
      success(`已切换到: ${name}`);
    });

  profiles.command('remove <name>')
    .description('删除站点配置')
    .action((name) => {
      const all = config.readProfiles();
      if (!all.find(p => p.name === name)) return error(`配置 "${name}" 不存在`);
      config.deleteProfile(name);
      success(`已删除: ${name}`);
    });

  profiles.command('public-add')
    .description('添加公开站点（无需认证，仅可读取公开内容）')
    .requiredOption('-s, --site <url>', '站点地址 (如 https://example.com)')
    .option('-n, --name <name>', '配置名称')
    .action((opts) => {
      const site = opts.site.replace(/\/+$/, '');
      const profileName = opts.name || new URL(site).hostname.replace(/^www\./, '');
      config.saveProfile({ name: profileName, site, public: true });
      config.setActiveProfile(profileName);
      success(`已添加公开站点: ${profileName}`);
      console.log(chalk.dim(`  站点: ${site}`));
      console.log(chalk.dim(`  模式: 公开（无需认证，仅读取）`));
    });

  profiles.command('cookie-add')
    .description('添加 Cookie 认证站点（手动粘贴浏览器 Cookie）')
    .requiredOption('-s, --site <url>', '站点地址')
    .requiredOption('-c, --cookie <string>', 'Cookie 字符串（从浏览器开发者工具复制）')
    .option('-n, --name <name>', '配置名称')
    .option('-e, --expiry <days>', 'Cookie 有效期天数', '14')
    .action((opts) => {
      const site = opts.site.replace(/\/+$/, '');
      const profileName = opts.name || new URL(site).hostname.replace(/^www\./, '');
      const token = `Cookie: ${opts.cookie.trim()}`;
      const days = parseInt(opts.expiry) || 14;
      const expiry = Date.now() + days * 24 * 60 * 60 * 1000;

      config.saveProfile({ name: profileName, site, token, tokenExpiry: expiry, cookie: true, public: false });
      config.setActiveProfile(profileName);

      success(`已添加 Cookie 站点: ${profileName}`);
      console.log(chalk.dim(`  站点: ${site}`));
      console.log(chalk.dim(`  认证方式: Cookie`));
      console.log(chalk.dim(`  有效期: ${days} 天`));
      console.log(chalk.dim(`\n  提示: Cookie 过期后需重新添加。获取方式: 浏览器 F12 → Application → Cookies →`));
      console.log(chalk.dim(`        将 wordpress_logged_in 和 wordpress_sec 等 cookie 拼接为 name=value; name2=value2 格式`));
    });

  profiles.command('current')
    .description('查看当前站点')
    .option('--json', 'JSON 格式')
    .action((opts) => {
      const p = config.getActiveProfile();
      if (!p) return info('未选择站点，请先 login 或 profiles use <name>');
      if (opts.json) return json(p);
      console.log(`  名称: ${p.name}`);
      console.log(`  站点: ${p.site}`);
      if (p.public) {
        console.log(`  认证方式: ${chalk.cyan('公开（无需认证）')}`);
      } else if (p.cookie) {
        const expired = p.tokenExpiry && Date.now() > p.tokenExpiry;
        console.log(`  认证方式: ${chalk.yellow('Cookie')}`);
        console.log(`  状态: ${expired ? chalk.red('过期') : chalk.green('有效')}`);
      } else {
        const hasToken = p.token && p.tokenExpiry && Date.now() < p.tokenExpiry;
        console.log(`  认证方式: ${p.token && p.token.length < 100 ? chalk.magenta('Application Password') : chalk.blue('JWT')}`);
        console.log(`  Token: ${hasToken ? chalk.green('有效') : chalk.red('过期/未登录')}`);
      }
    });
}

module.exports = { register };
