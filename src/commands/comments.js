const { table, success, error, json, formatDate, stripHtml } = require('../utils');

function register(program, getClient) {
  const comments = program.command('comments').description('评论管理');

  comments.command('list')
    .description('列出评论')
    .option('-n, --number <n>', '每页数量', '20')
    .option('--post <id>', '筛选文章 ID')
    .option('--status <s>', '状态: approved/hold/spam/trash')
    .option('--json', 'JSON 格式')
    .action(async (opts) => {
      const { client } = getClient();
      const qs = { per_page: opts.number };
      if (opts.post) qs.post = opts.post;
      if (opts.status) qs.status = opts.status;
      const res = await client.get('/wp/v2/comments', qs);
      if (opts.json) return json(res.data);
      console.log(table(
        ['ID', '文章', '作者', '内容', '日期'],
        res.data.map(c => [c.id, c.post, c.author_name, stripHtml(c.content.rendered).substring(0, 40), formatDate(c.date)])
      ));
    });

  comments.command('create')
    .description('创建评论')
    .requiredOption('--post <id>', '文章 ID')
    .requiredOption('-c, --content <text>', '评论内容')
    .option('--author <name>', '作者名')
    .option('--email <email>', '邮箱')
    .action(async (opts) => {
      const { client } = getClient();
      const body = { post: Number(opts.post), content: opts.content };
      if (opts.author) body.author_name = opts.author;
      if (opts.email) body.author_email = opts.email;
      const res = await client.post('/wp/v2/comments', body);
      success(`评论已创建: ID=${res.data.id}`);
    });

  comments.command('approve <id>').description('批准评论').action(async (id) => {
    const { client } = getClient();
    await client.post(`/wp/v2/comments/${id}`, { status: 'approved' });
    success(`评论 ${id} 已批准`);
  });

  comments.command('spam <id>').description('标记垃圾').action(async (id) => {
    const { client } = getClient();
    await client.post(`/wp/v2/comments/${id}`, { status: 'spam' });
    success(`评论 ${id} 已标记为垃圾`);
  });

  comments.command('trash <id>').description('移至回收站').action(async (id) => {
    const { client } = getClient();
    await client.delete(`/wp/v2/comments/${id}`);
    success(`评论 ${id} 已移至回收站`);
  });

  comments.command('delete <id>')
    .description('永久删除评论')
    .action(async (id) => {
      const { client } = getClient();
      await client.delete(`/wp/v2/comments/${id}`, { force: true });
      success(`评论 ${id} 已永久删除`);
    });
}

module.exports = { register };
