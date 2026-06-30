const { success, error, json } = require('../utils');

function register(program, getClient) {
  const settings = program.command('settings').description('站点设置');

  settings.command('get')
    .description('查看站点设置')
    .option('--json', 'JSON 格式')
    .action(async (opts) => {
      const { client } = getClient();
      const res = await client.get('/wp/v2/settings');
      if (opts.json) return json(res.data);
      const s = res.data;
      console.log(`  站点标题: ${s.title}`);
      console.log(`  站点描述: ${s.description}`);
      console.log(`  URL: ${s.url}`);
      console.log(`  时区: ${s.timezone}`);
      console.log(`  语言: ${s.lang || 'zh_CN'}`);
      console.log(`  日期格式: ${s.date_format}`);
      console.log(`  时间格式: ${s.time_format}`);
      console.log(`  每页文章数: ${s.posts_per_page}`);
    });

  settings.command('update')
    .description('更新站点设置')
    .option('-t, --title <t>', '站点标题')
    .option('-d, --description <d>', '站点描述')
    .option('--timezone <tz>', '时区')
    .option('--json', 'JSON 格式')
    .action(async (opts) => {
      const { client } = getClient();
      const body = {};
      if (opts.title) body.title = opts.title;
      if (opts.description) body.description = opts.description;
      if (opts.timezone) body.timezone = opts.timezone;
      if (Object.keys(body).length === 0) return error('至少需要提供一个更新项');
      const res = await client.post('/wp/v2/settings', body);
      if (opts.json) return json(res.data);
      success('站点设置已更新');
    });
}

module.exports = { register };
