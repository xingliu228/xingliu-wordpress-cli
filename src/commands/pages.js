const chalk = require('chalk');
const { table, success, error, json, formatDate, statusColor, stripHtml } = require('../utils');

function register(program, getClient) {
  const pages = program.command('pages').description('页面管理');

  pages.command('list')
    .description('列出页面')
    .option('-n, --number <n>', '每页数量', '20')
    .option('--status <s>', '状态')
    .option('--json', 'JSON 格式')
    .action(async (opts) => {
      const { client } = getClient();
      const res = await client.get('/wp/v2/pages', { per_page: opts.number, status: opts.status || 'publish' });
      if (opts.json) return json(res.data);
      console.log(table(
        ['ID', '状态', '标题', '日期'],
        res.data.map(p => [p.id, statusColor(p.status), stripHtml(p.title.rendered).substring(0, 55), formatDate(p.date)])
      ));
    });

  pages.command('get <id>')
    .description('查看页面')
    .option('--json', 'JSON 格式')
    .action(async (id, opts) => {
      const { client } = getClient();
      const res = await client.get(`/wp/v2/pages/${id}`);
      if (res.status !== 200) return error(`页面 ${id} 不存在`);
      if (opts.json) return json(res.data);
      const p = res.data;
      console.log(`\n  [${p.id}] ${stripHtml(p.title.rendered)}`);
      console.log(`  状态: ${statusColor(p.status)} | 链接: ${p.link}\n`);
      console.log(`  ${stripHtml(p.content.rendered).substring(0, 500)}\n`);
    });

  pages.command('create')
    .description('创建页面')
    .requiredOption('-t, --title <title>', '标题')
    .option('-c, --content <content>', '内容')
    .option('--status <s>', '状态', 'draft')
    .option('--json', 'JSON 格式')
    .action(async (opts) => {
      const { client } = getClient();
      const res = await client.post('/wp/v2/pages', { title: opts.title, content: opts.content || '', status: opts.status });
      if (opts.json) return json(res.data);
      success(`页面已创建: ID=${res.data.id}, 链接=${res.data.link}`);
    });

  pages.command('update <id>')
    .description('更新页面')
    .option('-t, --title <title>', '新标题')
    .option('-c, --content <content>', '新内容')
    .option('--status <s>', '状态')
    .action(async (id, opts) => {
      const { client } = getClient();
      const body = {};
      if (opts.title) body.title = opts.title;
      if (opts.content) body.content = opts.content;
      if (opts.status) body.status = opts.status;
      await client.post(`/wp/v2/pages/${id}`, body);
      success(`页面 ${id} 已更新`);
    });

  pages.command('delete <id>')
    .description('删除页面')
    .option('--force', '永久删除')
    .action(async (id, opts) => {
      const { client } = getClient();
      await client.delete(`/wp/v2/pages/${id}`, opts.force ? { force: true } : {});
      success(`页面 ${id} 已${opts.force ? '永久删除' : '移至回收站'}`);
    });
}

module.exports = { register };
