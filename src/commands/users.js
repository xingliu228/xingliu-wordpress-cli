const { table, success, error, json } = require('../utils');

function register(program, getClient) {
  const users = program.command('users').description('用户管理');

  users.command('list')
    .description('列出用户')
    .option('-n, --number <n>', '每页数量', '20')
    .option('--json', 'JSON 格式')
    .action(async (opts) => {
      const { client } = getClient();
      const res = await client.get('/wp/v2/users', { per_page: opts.number });
      if (opts.json) return json(res.data);
      console.log(table(
        ['ID', '用户名', '显示名', '角色', '邮箱'],
        res.data.map(u => [u.id, u.slug, u.name, (u.roles || []).join(','), u.email || '-'])
      ));
    });

  users.command('me')
    .description('当前用户信息')
    .option('--json', 'JSON 格式')
    .action(async (opts) => {
      const { client } = getClient();
      const res = await client.get('/wp/v2/users/me');
      if (opts.json) return json(res.data);
      const u = res.data;
      console.log(`  ID: ${u.id}\n  用户名: ${u.slug}\n  显示名: ${u.name}\n  邮箱: ${u.email}\n  角色: ${(u.roles || []).join(', ')}`);
    });

  users.command('get <id>')
    .description('查看用户')
    .option('--json', 'JSON 格式')
    .action(async (id, opts) => {
      const { client } = getClient();
      const res = await client.get(`/wp/v2/users/${id}`);
      if (opts.json) return json(res.data);
      const u = res.data;
      console.log(`  ID: ${u.id}\n  用户名: ${u.slug}\n  显示名: ${u.name}\n  邮箱: ${u.email || '-'}\n  角色: ${(u.roles || []).join(', ')}`);
    });
}

module.exports = { register };
