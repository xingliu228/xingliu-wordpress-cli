const chalk = require('chalk');
const { table, success, error, info, json, formatDate, statusColor, stripHtml } = require('../utils');

function register(program, getClient) {
  const posts = program.command('posts').description('文章管理');

  posts.command('list')
    .description('列出文章')
    .option('-n, --number <n>', '每页数量', '20')
    .option('--page <p>', '页码', '1')
    .option('--status <s>', '状态: publish/draft/pending/trash')
    .option('--search <q>', '搜索关键词')
    .option('--after <date>', '开始日期 (YYYY-MM-DDTHH:mm:ss)')
    .option('--before <date>', '结束日期')
    .option('--order <o>', '排序', 'desc')
    .option('--orderby <f>', '排序字段', 'date')
    .option('--json', 'JSON 格式')
    .action(async (opts) => {
      const { client, profile } = getClient();
      const qs = { per_page: opts.number, page: opts.page, order: opts.order, orderby: opts.orderby, _embed: true };
      if (opts.status) qs.status = opts.status;
      if (opts.search) qs.search = opts.search;
      if (opts.after) qs.after = opts.after;
      if (opts.before) qs.before = opts.before;

      const res = await client.get('/wp/v2/posts', qs);
      if (opts.json) return json(res.data);

      const total = res.headers['x-wp-total'] || '?';
      info(`站点: ${client.site} | 文章总数: ${total} | 当前: ${res.data.length} 篇`);
      console.log(table(
        ['ID', '状态', '标题', '日期'],
        res.data.map(p => [
          p.id,
          statusColor(p.status),
          stripHtml(p.title.rendered).substring(0, 55),
          formatDate(p.date),
        ])
      ));
    });

  posts.command('get <id>')
    .description('查看文章详情')
    .option('--json', 'JSON 格式')
    .action(async (id, opts) => {
      const { client } = getClient();
      const res = await client.get(`/wp/v2/posts/${id}`, { _embed: true });
      if (res.status !== 200) return error(`文章 ${id} 不存在`);
      const p = res.data;
      if (opts.json) return json(p);

      console.log(chalk.bold(`\n  [${p.id}] ${stripHtml(p.title.rendered)}`));
      console.log(`  状态: ${statusColor(p.status)} | 日期: ${formatDate(p.date)} | 链接: ${p.link}`);
      console.log(`  内容:\n${stripHtml(p.content.rendered).substring(0, 500)}${p.content.rendered.length > 500 ? '...' : ''}\n`);
    });

  posts.command('create')
    .description('创建文章')
    .requiredOption('-t, --title <title>', '文章标题')
    .option('-c, --content <content>', '文章内容')
    .option('--status <s>', '状态 (draft/publish)', 'draft')
    .option('--categories <ids>', '分类 ID，逗号分隔')
    .option('--tags <ids>', '标签 ID，逗号分隔')
    .option('--json', 'JSON 格式')
    .action(async (opts) => {
      const { client } = getClient();
      const body = { title: opts.title, content: opts.content || '', status: opts.status };
      if (opts.categories) body.categories = opts.categories.split(',').map(Number);
      if (opts.tags) body.tags = opts.tags.split(',').map(Number);
      const res = await client.post('/wp/v2/posts', body);
      if (opts.json) return json(res.data);
      success(`文章已创建: ID=${res.data.id}, 状态=${res.data.status}, 链接=${res.data.link}`);
    });

  posts.command('update <id>')
    .description('更新文章')
    .option('-t, --title <title>', '新标题')
    .option('-c, --content <content>', '新内容')
    .option('--status <s>', '状态')
    .option('--categories <ids>', '分类 ID，逗号分隔')
    .option('--json', 'JSON 格式')
    .action(async (id, opts) => {
      const { client } = getClient();
      const body = {};
      if (opts.title) body.title = opts.title;
      if (opts.content) body.content = opts.content;
      if (opts.status) body.status = opts.status;
      if (opts.categories) body.categories = opts.categories.split(',').map(Number);
      if (opts.tags) body.tags = (opts.tags || '').split(',').map(Number);
      const res = await client.post(`/wp/v2/posts/${id}`, body);
      if (opts.json) return json(res.data);
      success(`文章 ${id} 已更新`);
    });

  posts.command('delete <id>')
    .description('删除文章')
    .option('--force', '永久删除（跳过回收站）')
    .action(async (id, opts) => {
      const { client } = getClient();
      const qs = opts.force ? { force: true } : {};
      const res = await client.delete(`/wp/v2/posts/${id}`, qs);
      success(`文章 ${id} 已${opts.force ? '永久删除' : '移至回收站'}`);
    });
}

module.exports = { register };
