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
        ['当前', '名称', '站点', 'Token 状态'],
        all.map(p => {
          const hasToken = p.token && p.tokenExpiry && Date.now() < p.tokenExpiry;
          const isActive = active && p.name === active.name;
          return [
            isActive ? chalk.green('▶') : ' ',
            p.name,
            p.site,
            hasToken ? chalk.green('有效') : chalk.red('过期/未登录'),
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

  profiles.command('current')
    .description('查看当前站点')
    .option('--json', 'JSON 格式')
    .action((opts) => {
      const p = config.getActiveProfile();
      if (!p) return info('未选择站点，请先 login 或 profiles use <name>');
      if (opts.json) return json(p);
      const hasToken = p.token && p.tokenExpiry && Date.now() < p.tokenExpiry;
      console.log(`  名称: ${p.name}`);
      console.log(`  站点: ${p.site}`);
      console.log(`  Token: ${hasToken ? chalk.green('有效') : chalk.red('过期/未登录')}`);
    });
}

module.exports = { register };
