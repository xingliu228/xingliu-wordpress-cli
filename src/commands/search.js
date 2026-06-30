const { table, error, json, stripHtml } = require('../utils');

function register(program, getClient) {
  program.command('search <query>')
    .description('搜索内容')
    .option('-t, --type <type>', '搜索类型: post/term', 'post')
    .option('-n, --number <n>', '每页数量', '20')
    .option('--json', 'JSON 格式')
    .action(async (query, opts) => {
      const { client } = getClient();
      const res = await client.get('/wp/v2/search', {
        search: query,
        type: opts.type,
        per_page: opts.number,
        subtype: opts.type === 'post' ? 'post' : undefined,
      });
      if (opts.json) return json(res.data);
      const total = res.headers['x-wp-total'] || res.data.length;
      console.log(`\n  搜索 "${query}" (共 ${total} 条)\n`);
      console.log(table(
        ['ID', '类型', '标题', '链接'],
        res.data.map(r => [r.id, r.subtype || r.type, stripHtml(r.title).substring(0, 55), r.url])
      ));
    });
}

module.exports = { register };
