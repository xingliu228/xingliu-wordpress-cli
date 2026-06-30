const { table, success, error, json } = require('../utils');

function register(program, getClient) {
  const cats = program.command('categories').description('分类管理');

  cats.command('list')
    .description('列出分类')
    .option('-n, --number <n>', '每页数量', '50')
    .option('--json', 'JSON 格式')
    .action(async (opts) => {
      const { client } = getClient();
      const res = await client.get('/wp/v2/categories', { per_page: opts.number });
      if (opts.json) return json(res.data);
      console.log(table(
        ['ID', '名称', '别名', '文章数'],
        res.data.map(c => [c.id, c.name, c.slug, c.count])
      ));
    });

  cats.command('create')
    .description('创建分类')
    .requiredOption('-n, --name <name>', '分类名称')
    .option('--slug <slug>', '别名')
    .option('--parent <id>', '父分类 ID')
    .option('--json', 'JSON 格式')
    .action(async (opts) => {
      const { client } = getClient();
      const body = { name: opts.name };
      if (opts.slug) body.slug = opts.slug;
      if (opts.parent) body.parent = Number(opts.parent);
      const res = await client.post('/wp/v2/categories', body);
      if (opts.json) return json(res.data);
      success(`分类已创建: ID=${res.data.id}, ${res.data.name}`);
    });

  cats.command('delete <id>')
    .description('删除分类')
    .action(async (id) => {
      const { client } = getClient();
      await client.delete(`/wp/v2/categories/${id}`, { force: true });
      success(`分类 ${id} 已删除`);
    });

  // Tags
  const tags = program.command('tags').description('标签管理');

  tags.command('list')
    .description('列出标签')
    .option('-n, --number <n>', '每页数量', '50')
    .option('--json', 'JSON 格式')
    .action(async (opts) => {
      const { client } = getClient();
      const res = await client.get('/wp/v2/tags', { per_page: opts.number });
      if (opts.json) return json(res.data);
      console.log(table(
        ['ID', '名称', '别名', '文章数'],
        res.data.map(t => [t.id, t.name, t.slug, t.count])
      ));
    });

  tags.command('create')
    .description('创建标签')
    .requiredOption('-n, --name <name>', '标签名称')
    .option('--slug <slug>', '别名')
    .option('--json', 'JSON 格式')
    .action(async (opts) => {
      const { client } = getClient();
      const body = { name: opts.name };
      if (opts.slug) body.slug = opts.slug;
      const res = await client.post('/wp/v2/tags', body);
      if (opts.json) return json(res.data);
      success(`标签已创建: ID=${res.data.id}, ${res.data.name}`);
    });

  tags.command('delete <id>')
    .description('删除标签')
    .action(async (id) => {
      const { client } = getClient();
      await client.delete(`/wp/v2/tags/${id}`, { force: true });
      success(`标签 ${id} 已删除`);
    });
}

module.exports = { register };
